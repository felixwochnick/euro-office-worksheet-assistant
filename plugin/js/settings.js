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
    language: 'de'
  };

  var memory = null;
  var persistent = true;

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
    isPersistent: function () { return persistent; }
  };
})(window);
