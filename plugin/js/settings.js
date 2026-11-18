/*
 * Settings persisted in localStorage (per browser and document server origin).
 * Every access is wrapped in try/catch: storage may be blocked (private mode,
 * third-party iframe restrictions) – the plugin then works with in-memory values.
 */
(function (window) {
  'use strict';

  var KEY = 'music-notation-plugin.settings.v1';
  var DEFAULTS = {
    proxyUrl: '',
    token: '',
    autoInsert: false,
    widthCm: 16,
    dpi: 300,
    insertMethod: 'auto', // auto | api | imageData | html
    language: 'de',
    // Let MCP clients edit this document through the proxy's plugin bridge (bridge.js).
    mcpEnabled: false,
    // Display name of the Nextcloud user (AUTH_MODE=nextcloud; the token is then a sign-in token).
    userName: ''
  };

  var memory = null;
  var persistent = true;
  // Written by the companion app into local-config.js (desktop app): its local server and token.
  var LOCAL = window.WORKSHEET_LOCAL && window.WORKSHEET_LOCAL.proxyUrl ? window.WORKSHEET_LOCAL : null;

  function isLoopback(url) {
    return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(url || '');
  }

  function load() {
    var stored = null;
    try {
      var raw = window.localStorage.getItem(KEY);
      stored = raw ? JSON.parse(raw) : null;
    } catch (e) {
      persistent = false;
    }
    var s = {};
    Object.keys(DEFAULTS).forEach(function (k) { s[k] = DEFAULTS[k]; });
    var src = stored || memory || {};
    Object.keys(DEFAULTS).forEach(function (k) {
      if (src[k] !== undefined && typeof src[k] === typeof DEFAULTS[k]) s[k] = src[k];
    });
    if (LOCAL) {
      // Companion app: use it unless the user chose another (non-local) server; MCP is on by default.
      if (!s.proxyUrl || isLoopback(s.proxyUrl)) {
        s.proxyUrl = LOCAL.proxyUrl;
        s.token = LOCAL.token;
      }
      if (src.mcpEnabled === undefined) s.mcpEnabled = true;
    }
    return s;
  }

  function save(values) {
    var s = load();
    Object.keys(values || {}).forEach(function (k) {
      if (k in DEFAULTS) s[k] = values[k];
    });
    s.widthCm = Math.min(19, Math.max(3, Number(s.widthCm) || DEFAULTS.widthCm));
    s.dpi = Math.min(600, Math.max(96, Number(s.dpi) || DEFAULTS.dpi));
    s.proxyUrl = String(s.proxyUrl || '').trim().replace(/\/+$/, '');
    memory = s;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(s));
      persistent = true;
    } catch (e) {
      persistent = false;
    }
    return s;
  }

  window.MusicSettings = {
    DEFAULTS: DEFAULTS,
    load: load,
    save: save,
    isPersistent: function () { return persistent; },
    local: function () { return LOCAL; }
  };
})(window);
