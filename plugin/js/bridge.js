/*
 * MCP bridge (client side): while "MCP-Zugriff erlauben" is switched on, the panel keeps a WebSocket to the
 * proxy (GET /v1/bridge). AI clients connected to the proxy's MCP endpoint (Claude, ChatGPT, Le Chat …) send
 * tool calls through it; the panel executes them with the same code as chat tool calls (agent.js) and sends
 * the result back. Calls are executed one after the other.
 *
 * Changes from MCP clients are applied without a preview (the AI client asks the user before calling tools;
 * the editor's undo works as usual). Every call is logged in the chat.
 */
(function (window) {
  'use strict';

  var MIN_RETRY_MS = 2000;
  var MAX_RETRY_MS = 60000;
  var ACTIVE_THROTTLE_MS = 20000;

  /**
   * @param {object} opts
   *   getSettings(): settings
   *   executor: object with executeTool(call) -> Promise<result> (a ChatAgent)
   *   onStatus(status, detail): 'off' | 'connecting' | 'connected' | 'auth' | 'origin' | 'error'
   *   onCall(call, result): a tool call was executed
   */
  function Bridge(opts) {
    this.opts = opts;
    this.ws = null;
    this.status = 'off';
    this.retryMs = MIN_RETRY_MS;
    this.retryTimer = null;
    this.queue = Promise.resolve();
    this.lastActive = 0;
    this.wanted = false;
    this.user = null;
    var self = this;
    ['focus', 'mousedown', 'keydown'].forEach(function (ev) {
      window.addEventListener(ev, function () { self.markActive(); }, true);
    });
  }

  Bridge.prototype.setStatus = function (status, detail) {
    this.status = status;
    if (this.opts.onStatus) this.opts.onStatus(status, detail);
  };

  function documentTitle() {
    var info = window.Asc && window.Asc.plugin && window.Asc.plugin.info;
    return (info && info.documentTitle) || document.title || 'Dokument';
  }

  function bridgeUrl(proxyUrl) {
    return proxyUrl.replace(/\/+$/, '').replace(/^http(s?):\/\//i, 'ws$1://') + '/v1/bridge';
  }

  /** (Re)connect according to the current settings. */
  Bridge.prototype.update = function () {
    var s = this.opts.getSettings();
    var want = !!(s.mcpEnabled && s.proxyUrl && /^https?:\/\//i.test(s.proxyUrl) && typeof window.WebSocket === 'function');
    var key = want ? s.proxyUrl + '|' + s.token : '';
    if (this.wanted && key === this.key && this.ws) return;
    this.stop();
    this.wanted = want;
    this.key = key;
    if (!want) { this.setStatus('off'); return; }
    this.retryMs = MIN_RETRY_MS;
    this.connect();
  };

  Bridge.prototype.stop = function () {
    this.wanted = false;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (this.ws) {
      var ws = this.ws;
      this.ws = null;
      try { ws.close(1000, 'disabled'); } catch (e) {}
    }
  };

  Bridge.prototype.connect = function () {
    var self = this;
    var s = this.opts.getSettings();
    var ws;
    try {
      ws = new window.WebSocket(bridgeUrl(s.proxyUrl));
    } catch (e) {
      this.setStatus('error', e && e.message);
      return;
    }
    this.ws = ws;
    this.setStatus('connecting');
    ws.onopen = function () {
      ws.send(JSON.stringify({ type: 'hello', token: s.token, document: { title: documentTitle() }, client: { version: '0.4.2' } }));
    };
    ws.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.type === 'welcome') {
        self.retryMs = MIN_RETRY_MS;
        self.user = msg.user || null;
        self.setStatus('connected', self.user);
        self.lastActive = 0;
        self.markActive();
      } else if (msg.type === 'call') {
        self.handleCall(ws, msg);
      } else if (msg.type === 'error') {
        self.lastError = msg.message;
      }
    };
    ws.onclose = function (ev) {
      if (self.ws !== ws) return; // replaced or stopped
      self.ws = null;
      if (ev.code === 4401) { self.setStatus('auth', self.lastError); return; }
      if (ev.code === 4403) { self.setStatus('origin'); return; }
      if (ev.code === 4404) { self.setStatus('error', 'MCP is disabled on the server'); return; }
      if (!self.wanted) return;
      self.setStatus('error', self.lastError || (ev.code ? 'code ' + ev.code : ''));
      self.retryTimer = setTimeout(function () { if (self.wanted) self.connect(); }, self.retryMs);
      self.retryMs = Math.min(MAX_RETRY_MS, self.retryMs * 2);
    };
    ws.onerror = function () { /* onclose follows */ };
  };

  Bridge.prototype.markActive = function () {
    var now = Date.now();
    if (!this.ws || this.status !== 'connected' || now - this.lastActive < ACTIVE_THROTTLE_MS) return;
    this.lastActive = now;
    try { this.ws.send(JSON.stringify({ type: 'active' })); } catch (e) {}
  };

  Bridge.prototype.handleCall = function (ws, msg) {
    var self = this;
    var call = { id: msg.id, name: msg.name, arguments: msg.arguments || {} };
    this.queue = this.queue.then(function () {
      return Promise.resolve().then(function () {
        return self.opts.executor.executeTool(call, null);
      }).then(function (result) {
        if (self.opts.onCall) self.opts.onCall(call, result);
        send({ type: 'result', id: msg.id, ok: true, result: result });
      }, function (err) {
        var message = err && err.message ? err.message : String(err);
        if (self.opts.onCall) self.opts.onCall(call, { ok: false, error: message });
        send({ type: 'result', id: msg.id, ok: false, error: message });
      });
    });
    function send(obj) {
      try { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); } catch (e) {}
    }
  };

  window.WorksheetBridge = { Bridge: Bridge, _bridgeUrl: bridgeUrl };
})(window);
