/*
 * Client side of the agent loop.
 *
 * The plugin owns the conversation (provider-neutral message format, see
 * proxy/src/types.ts). Each step: send history + document outline to the
 * proxy -> receive new messages and pending tool calls -> execute them locally
 * in the editor -> append tool results -> repeat until the proxy says done.
 */
(function (window) {
  'use strict';

  var MAX_CLIENT_ROUNDS = 12;
  var REQUEST_TIMEOUT_MS = 120000;

  function ProxyError(kind, detail, status) {
    this.name = 'ProxyError';
    this.kind = kind;
    this.detail = detail;
    this.status = status;
    this.message = kind + ': ' + detail;
  }
  ProxyError.prototype = Object.create(Error.prototype);

  function request(settings, path, body, signal) {
    var url = settings.proxyUrl.replace(/\/+$/, '') + path;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
    if (signal) signal.addEventListener('abort', function () { controller.abort(); });
    var init = {
      method: body ? 'POST' : 'GET',
      headers: { authorization: 'Bearer ' + settings.token },
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit'
    };
    if (body) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    return fetch(url, init).then(function (res) {
      clearTimeout(timer);
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        if (res.status === 401) throw new ProxyError('auth', '', 401);
        if (res.status === 429) throw new ProxyError('rateLimit', '', 429);
        if (!res.ok) throw new ProxyError('server', (data && (data.message || data.error)) || ('HTTP ' + res.status), res.status);
        return data;
      });
    }, function (err) {
      clearTimeout(timer);
      if (signal && signal.aborted) throw new ProxyError('aborted', '');
      throw new ProxyError('network', err && err.message ? err.message : String(err));
    });
  }

  /**
   * @param {object} hooks
   *   getSettings(): settings
   *   onMessage(msg): an assistant text message arrived
   *   onToolStart(call) / onToolDone(call, result)
   *   confirmInsert(call, rendered): Promise<boolean> – preview (only if autoInsert is off)
   */
  function ChatAgent(hooks) {
    this.hooks = hooks;
    this.messages = [];
    this.busy = false;
    this.controller = null;
  }

  ChatAgent.prototype.reset = function () {
    this.abort();
    this.messages = [];
  };

  ChatAgent.prototype.abort = function () {
    if (this.controller) this.controller.abort();
  };

  /** Make sure every tool call in the history has a result (e.g. after an abort). */
  ChatAgent.prototype._closeOpenCalls = function (reason) {
    var open = {};
    this.messages.forEach(function (m) {
      if (m.role === 'assistant' && m.tool_calls) m.tool_calls.forEach(function (c) { open[c.id] = c; });
      if (m.role === 'tool') delete open[m.tool_call_id];
    });
    var self = this;
    Object.keys(open).forEach(function (id) {
      self.messages.push({ role: 'tool', tool_call_id: id, name: open[id].name, content: JSON.stringify({ ok: false, error: reason }) });
    });
  };

  ChatAgent.prototype.send = function (text) {
    var self = this;
    if (this.busy) return Promise.reject(new Error('busy'));
    this.busy = true;
    this.controller = new AbortController();
    var signal = this.controller.signal;
    this._closeOpenCalls('aborted by user');
    this.messages.push({ role: 'user', content: text });
    var rounds = 0;

    function step() {
      if (signal.aborted) throw new ProxyError('aborted', '');
      if (++rounds > MAX_CLIENT_ROUNDS) throw new ProxyError('maxRounds', '');
      return window.MusicEditor.getOutline().catch(function () { return null; }).then(function (ctx) {
        return request(self.hooks.getSettings(), '/v1/chat', { messages: self.messages, document_context: ctx || undefined }, signal);
      }).then(function (resp) {
        (resp.messages || []).forEach(function (m) {
          self.messages.push(m);
          if (m.role === 'assistant' && m.content && m.content.trim()) self.hooks.onMessage(m);
          if (m.role === 'tool' && self.hooks.onServerTool) self.hooks.onServerTool(m);
        });
        var calls = resp.pending_tool_calls || [];
        if (resp.done || !calls.length) return null;
        // Execute sequentially – insert positions depend on previous inserts.
        return calls.reduce(function (p, call) {
          return p.then(function () {
            if (signal.aborted) throw new ProxyError('aborted', '');
            self.hooks.onToolStart(call);
            return self.executeTool(call).catch(function (e) {
              return { ok: false, error: e && e.message ? e.message : String(e) };
            }).then(function (result) {
              self.hooks.onToolDone(call, result);
              self.messages.push({ role: 'tool', tool_call_id: call.id, name: call.name, content: JSON.stringify(result) });
            });
          });
        }, Promise.resolve()).then(step);
      });
    }

    return step().then(function () {
      self.busy = false;
    }, function (err) {
      self.busy = false;
      self._closeOpenCalls(err && err.kind === 'aborted' ? 'aborted by user' : 'client error');
      throw err;
    });
  };

  /** Execute a client tool call in the editor. Returns a JSON-serialisable result for the model. */
  ChatAgent.prototype.executeTool = function (call) {
    var self = this;
    var args = call.arguments || {};
    var settings = this.hooks.getSettings();

    if (call.name === 'get_document_outline') {
      return window.MusicEditor.getOutline().then(function (o) { return { ok: true, outline: o }; });
    }

    var abc;
    if (call.name === 'insert_staff') {
      var v = window.MusicAbc.validateAbc(args.abc, { requireClef: true });
      if (!v.valid) return Promise.resolve({ ok: false, error: 'Invalid ABC: ' + window.MusicAbc.formatValidationErrors(v) });
      abc = v.normalized;
    } else if (call.name === 'insert_empty_staves') {
      abc = window.MusicAbc.emptyStavesAbc({ clef: args.clef, count: args.count, measures: args.measures });
    } else {
      return Promise.resolve({ ok: false, error: 'Unknown tool ' + call.name });
    }

    var widthCm = Number(args.width_cm) || settings.widthCm;
    return window.MusicRenderer.renderPng(abc, { widthCm: widthCm, dpi: settings.dpi }).then(function (rendered) {
      var confirm = settings.autoInsert ? Promise.resolve(true) : self.hooks.confirmInsert(call, rendered, abc);
      return confirm.then(function (accepted) {
        if (!accepted) return { ok: true, inserted: false, reason: 'The user discarded the preview.' };
        return window.MusicEditor.insertImage({
          dataUrl: rendered.dataUrl,
          widthMm: rendered.widthMm,
          heightMm: rendered.heightMm,
          abc: abc,
          position: args.position,
          method: settings.insertMethod
        }).then(function (r) {
          if (!r.ok) return { ok: false, inserted: false, error: r.error };
          var out = { ok: true, inserted: true, index: r.index, method: r.method, alt_text_set: !!r.alt_text };
          if (r.warnings && r.warnings.indexOf('cursor') !== -1) out.note = 'Inserted at the cursor because the requested position could not be reached.';
          if (rendered.warnings && rendered.warnings.length) out.render_warnings = rendered.warnings.slice(0, 5);
          return out;
        });
      });
    });
  };

  /** GET /v1/info – used by the settings view to test the connection. */
  function testConnection(settings) {
    return request(settings, '/v1/info', null, null);
  }

  window.MusicAgent = {
    ChatAgent: ChatAgent,
    ProxyError: ProxyError,
    testConnection: testConnection
  };
})(window);
