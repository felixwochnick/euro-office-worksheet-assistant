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
  // One proxy request can include several model calls (server-side tools); reasoning models are slow.
  var REQUEST_TIMEOUT_MS = 300000;
  // History sent to the proxy is compacted to stay well below its limits
  // (proxy/src/server.ts: 400 messages, 200 000 chars per message, 1 MB body).
  var MAX_HISTORY_MESSAGES = 80;
  var OLD_TOOL_RESULT_CHARS = 1500;
  var MAX_TOOL_RESULT_CHARS = 30000;

  function ProxyError(kind, detail, status) {
    this.name = 'ProxyError';
    this.kind = kind;
    this.detail = detail;
    this.status = status;
    this.message = kind + ': ' + detail;
  }
  ProxyError.prototype = Object.create(Error.prototype);

  function request(settings, path, body, signal) {
    if (signal && signal.aborted) return Promise.reject(new ProxyError('aborted', ''));
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
    function mapError(err) {
      if (err instanceof ProxyError) return err;
      if (signal && signal.aborted) return new ProxyError('aborted', '');
      return new ProxyError('network', err && err.message ? err.message : String(err));
    }
    return fetch(url, init).then(function (res) {
      return res.text().then(function (text) {
        clearTimeout(timer);
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        if (res.status === 401) throw new ProxyError('auth', '', 401);
        if (res.status === 429) throw new ProxyError('rateLimit', '', 429);
        if (!res.ok) throw new ProxyError('server', (data && (data.message || data.error)) || ('HTTP ' + res.status), res.status);
        return data;
      });
    }).catch(function (err) {
      clearTimeout(timer);
      throw mapError(err);
    });
  }

  /**
   * Compact the history for sending: keep the most recent messages (starting at
   * a user message so no tool result loses its tool call) and shorten tool
   * results of earlier turns.
   */
  function compactHistory(messages) {
    var start = 0;
    if (messages.length > MAX_HISTORY_MESSAGES) {
      start = messages.length - MAX_HISTORY_MESSAGES;
      while (start < messages.length && messages[start].role !== 'user') start++;
      if (start >= messages.length) start = 0;
    }
    var lastUser = -1;
    for (var i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'user') { lastUser = i; break; }
    return messages.slice(start).map(function (m, k) {
      var idx = start + k;
      if (m.role === 'tool' && idx < lastUser && m.content && m.content.length > OLD_TOOL_RESULT_CHARS) {
        return { role: 'tool', tool_call_id: m.tool_call_id, name: m.name, content: m.content.slice(0, OLD_TOOL_RESULT_CHARS) + '…(truncated)' };
      }
      return m;
    });
  }

  /** Keep a tool result JSON small enough for the proxy and the model. */
  function toolContent(result) {
    var json = JSON.stringify(result);
    if (json.length <= MAX_TOOL_RESULT_CHARS) return json;
    if (result && result.outline && result.outline.elements) {
      var o = result.outline;
      var els = o.elements.map(function (e) {
        var c = {};
        Object.keys(e).forEach(function (k) { c[k] = e[k]; });
        if (c.text && c.text.length > 80) c.text = c.text.slice(0, 80) + '…';
        if (c.abc && c.abc.length > 200) c.abc = c.abc.slice(0, 200) + '…';
        return c;
      });
      // Drop elements farthest from the cursor until it fits.
      var cursor = o.cursor_index == null ? 0 : o.cursor_index;
      var small = { ok: true, outline: { total_elements: o.total_elements, cursor_index: o.cursor_index, truncated: true, elements: els } };
      json = JSON.stringify(small);
      while (json.length > MAX_TOOL_RESULT_CHARS && els.length > 1) {
        var first = Math.abs(els[0].index - cursor);
        var last = Math.abs(els[els.length - 1].index - cursor);
        if (first > last) els.shift(); else els.pop();
        json = JSON.stringify(small);
      }
      return json;
    }
    return json.slice(0, MAX_TOOL_RESULT_CHARS);
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
    // A running send() keeps writing into its own (old) array, never into the new one.
    this.messages = [];
  };

  ChatAgent.prototype.abort = function () {
    if (this.controller) this.controller.abort();
  };

  /** Make sure every tool call in the history has a result (e.g. after an abort). */
  ChatAgent.prototype._closeOpenCalls = function (reason, messages) {
    var list = messages || this.messages;
    var open = {};
    list.forEach(function (m) {
      if (m.role === 'assistant' && m.tool_calls) m.tool_calls.forEach(function (c) { open[c.id] = c; });
      if (m.role === 'tool') delete open[m.tool_call_id];
    });
    Object.keys(open).forEach(function (id) {
      list.push({ role: 'tool', tool_call_id: id, name: open[id].name, content: JSON.stringify({ ok: false, error: reason }) });
    });
  };

  ChatAgent.prototype.send = function (text) {
    var self = this;
    if (this.busy) return Promise.reject(new Error('busy'));
    this.busy = true;
    this.controller = new AbortController();
    var signal = this.controller.signal;
    // All writes of this send() go to `msgs`. After reset() this.messages is a
    // new array, so late results of an aborted run cannot corrupt the new chat.
    var msgs = this.messages;
    this._closeOpenCalls('aborted by user', msgs);
    msgs.push({ role: 'user', content: text });
    var rounds = 0;
    function current() { return self.messages === msgs && !signal.aborted; }

    function step() {
      if (signal.aborted) throw new ProxyError('aborted', '');
      if (++rounds > MAX_CLIENT_ROUNDS) throw new ProxyError('maxRounds', '');
      return window.MusicEditor.getOutline().catch(function () { return null; }).then(function (ctx) {
        return request(self.hooks.getSettings(), '/v1/chat', { messages: compactHistory(msgs), document_context: ctx || undefined }, signal);
      }).then(function (resp) {
        if (!current()) throw new ProxyError('aborted', '');
        (resp.messages || []).forEach(function (m) {
          msgs.push(m);
          if (m.role === 'assistant' && m.content && m.content.trim()) self.hooks.onMessage(m);
          if (m.role === 'tool' && self.hooks.onServerTool) self.hooks.onServerTool(m);
        });
        var calls = resp.pending_tool_calls || [];
        if (resp.done || !calls.length) return null;
        // Execute sequentially – insert positions depend on previous inserts.
        return calls.reduce(function (p, call) {
          return p.then(function () {
            if (!current()) throw new ProxyError('aborted', '');
            self.hooks.onToolStart(call);
            return self.executeTool(call, signal).catch(function (e) {
              return { ok: false, error: e && e.message ? e.message : String(e) };
            }).then(function (result) {
              msgs.push({ role: 'tool', tool_call_id: call.id, name: call.name, content: toolContent(result) });
              if (self.messages === msgs) self.hooks.onToolDone(call, result);
            });
          });
        }, Promise.resolve()).then(step);
      });
    }

    return step().then(function () {
      self.busy = false;
    }, function (err) {
      self.busy = false;
      self._closeOpenCalls(err && err.kind === 'aborted' ? 'aborted by user' : 'client error', msgs);
      throw err;
    });
  };

  /** Execute a client tool call in the editor. Returns a JSON-serialisable result for the model. */
  ChatAgent.prototype.executeTool = function (call, signal) {
    var self = this;
    var args = call.arguments || {};
    var settings = this.hooks.getSettings();

    if (call.name === 'get_document_outline') {
      return window.MusicEditor.getOutline().then(function (o) { return { ok: true, outline: o }; });
    }

    if (call.name === 'replace_staff') return this.replaceStaff(call, signal);
    if (call.name === 'insert_blocks' || call.name === 'replace_elements') return this.editBlocks(call, signal);
    if (call.name === 'delete_elements') return this.deleteElements(call, signal);
    if (call.name === 'get_elements') {
      return window.WorksheetDoc.getElements(Number(args.from), args.to == null ? Number(args.from) : Number(args.to))
        .then(function (r) { return { ok: true, total_elements: r.total_elements, elements: r.elements }; });
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
      if (signal && signal.aborted) return { ok: false, inserted: false, error: 'aborted by user' };
      var confirm = settings.autoInsert ? Promise.resolve(true) : self.hooks.confirmInsert(call, rendered, abc, signal);
      return confirm.then(function (accepted) {
        if (signal && signal.aborted) return { ok: false, inserted: false, error: 'aborted by user' };
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

  /** insert_blocks / replace_elements: worksheet content (headings, lists, tables, lines, staves …). */
  ChatAgent.prototype.editBlocks = function (call, signal) {
    var self = this;
    var args = call.arguments || {};
    var settings = this.hooks.getSettings();
    var replacing = call.name === 'replace_elements';
    return window.WorksheetDoc.prepareImages(args.blocks, settings).then(function (blocks) {
      if (signal && signal.aborted) return { ok: false, error: 'aborted by user' };
      var confirm = settings.autoInsert
        ? Promise.resolve(true)
        : self.hooks.confirmInsert(call, { element: window.WorksheetDoc.renderPreview(blocks) }, null, signal);
      return confirm.then(function (accepted) {
        if (signal && signal.aborted) return { ok: false, error: 'aborted by user' };
        if (!accepted) return replacing ? { ok: true, replaced: false, reason: 'The user discarded the preview.' } : { ok: true, inserted: false, reason: 'The user discarded the preview.' };
        var req = replacing
          ? { op: 'replace', from: args.from, to: args.to, blocks: blocks }
          : { op: 'insert', position: args.position, blocks: blocks };
        return window.WorksheetDoc.editBlocks(req).then(function (r) {
          if (!r.ok) return { ok: false, error: r.error };
          var out = { ok: true, count: r.count, first_index: r.first_index, last_index: r.last_index };
          if (replacing) { out.replaced = true; out.removed = r.removed; } else { out.inserted = true; }
          out.note = 'Indices of later elements have shifted. Call get_document_outline before further edits further down.';
          return out;
        });
      });
    });
  };

  /** delete_elements: always asks for confirmation unless auto insert is on. */
  ChatAgent.prototype.deleteElements = function (call, signal) {
    var self = this;
    var args = call.arguments || {};
    var settings = this.hooks.getSettings();
    var from = Number(args.from);
    var to = args.to == null ? from : Number(args.to);
    return window.WorksheetDoc.getElements(from, to).then(function (info) {
      var list = document.createElement('ul');
      list.className = 'delete-list';
      (info.elements || []).forEach(function (e) {
        var li = document.createElement('li');
        li.textContent = '[' + e.index + '] ' + (e.text ? e.text.slice(0, 80) : e.abc ? '♪ ' + e.abc.split('\n').pop() : e.rows ? 'Tabelle ' + e.rows.length + '×' + ((e.rows[0] || []).length) : '(leer)');
        list.appendChild(li);
      });
      var confirm = settings.autoInsert ? Promise.resolve(true) : self.hooks.confirmInsert(call, { element: list }, null, signal);
      return confirm.then(function (accepted) {
        if (signal && signal.aborted) return { ok: false, error: 'aborted by user' };
        if (!accepted) return { ok: true, deleted: false, reason: 'The user did not confirm the deletion.' };
        return window.WorksheetDoc.editBlocks({ op: 'delete', from: from, to: to }).then(function (r) {
          if (!r.ok) return { ok: false, error: r.error };
          return { ok: true, deleted: true, removed_count: r.removed.length, removed: r.removed, note: 'Indices of later elements have shifted.' };
        });
      });
    });
  };

  /** replace_staff: change an existing staff (keeps its width unless width_cm is given). */
  ChatAgent.prototype.replaceStaff = function (call, signal) {
    var self = this;
    var args = call.arguments || {};
    var settings = this.hooks.getSettings();
    var v = window.MusicAbc.validateAbc(args.abc, { requireClef: true });
    if (!v.valid) return Promise.resolve({ ok: false, error: 'Invalid ABC: ' + window.MusicAbc.formatValidationErrors(v) });
    var abc = v.normalized;
    var index = Number(args.index);
    return window.MusicEditor.getStaffAt(index).then(function (staff) {
      if (!staff || !staff.found) return { ok: false, replaced: false, error: (staff && staff.error) || 'no staff at element ' + index };
      var widthCm = Number(args.width_cm) || (staff.width_mm ? Math.round(staff.width_mm) / 10 : settings.widthCm);
      return window.MusicRenderer.renderPng(abc, { widthCm: widthCm, dpi: settings.dpi }).then(function (rendered) {
        if (signal && signal.aborted) return { ok: false, replaced: false, error: 'aborted by user' };
        var confirm = settings.autoInsert ? Promise.resolve(true) : self.hooks.confirmInsert(call, rendered, abc, signal);
        return confirm.then(function (accepted) {
          if (signal && signal.aborted) return { ok: false, replaced: false, error: 'aborted by user' };
          if (!accepted) return { ok: true, replaced: false, reason: 'The user discarded the preview.' };
          return window.MusicEditor.replaceStaffAt(index, staff.drawing, {
            dataUrl: rendered.dataUrl,
            widthMm: rendered.widthMm,
            heightMm: rendered.heightMm,
            abc: abc
          }).then(function (r) {
            if (!r || !r.ok) return { ok: false, replaced: false, error: (r && r.error) || 'replace failed' };
            return { ok: true, replaced: true, index: index, method: r.method, alt_text_set: !!r.alt_text, previous_abc: staff.abc };
          });
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
    request: request,
    _compactHistory: compactHistory,
    _toolContent: toolContent,
    ProxyError: ProxyError,
    testConnection: testConnection
  };
})(window);
