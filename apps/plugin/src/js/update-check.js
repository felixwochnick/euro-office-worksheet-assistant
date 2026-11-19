/*
 * Detects a plugin update that the browser does not see yet.
 *
 * The Document Server's service worker caches everything under sdkjs-plugins/ "cache first",
 * per Document Server version. After the plugin was updated (but not the Document Server),
 * browsers that opened the editor before keep running the old plugin files.
 *
 * check(): compares the cached config.json with the current one on the server (fetched with a
 * unique query, which the service worker cannot answer from its cache). If they differ, all
 * cached files of this plugin are removed from the service worker's caches and the promise
 * resolves { updated: true, from, to } – the panel then asks the user to reopen the document.
 */
(function (window) {
  'use strict';

  var CACHE_PREFIX = 'document_editor_static_';

  function readConfig(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  /**
   * Remove the cached files of this plugin folder from the service worker caches and load them again,
   * bypassing the HTTP cache as well (the server sends them as "immutable" for a year). The service
   * worker then stores the new versions, so the next start of the plugin runs the update.
   */
  function purge(folderUrl) {
    if (!window.caches || !window.caches.keys) return Promise.resolve(0);
    var urls = {};
    return window.caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return n.indexOf(CACHE_PREFIX) === 0; }).map(function (name) {
        return window.caches.open(name).then(function (cache) {
          return cache.keys().then(function (reqs) {
            var mine = reqs.filter(function (r) { return r.url.indexOf(folderUrl) === 0 && r.url.indexOf('update-check=') === -1; });
            mine.forEach(function (r) { urls[r.url] = true; });
            return Promise.all(mine.map(function (r) { return cache['delete'](r); }));
          });
        });
      }));
    }).then(function () {
      var list = Object.keys(urls);
      return Promise.all(list.map(function (u) {
        return fetch(u, { cache: 'reload', credentials: 'same-origin' })['catch'](function () { return null; });
      })).then(function () { return list.length; });
    });
  }

  function check() {
    var folder = window.location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
    var fresh = folder + 'config.json?update-check=' + Date.now();
    return Promise.all([readConfig(folder + 'config.json'), readConfig(fresh)]).then(function (r) {
      var cached = r[0].version || '';
      var current = r[1].version || '';
      // the cache-busting request itself was cached by the service worker – remove it again
      var cleanup = window.caches && window.caches.keys ? window.caches.keys().then(function (names) {
        return Promise.all(names.map(function (n) {
          return window.caches.open(n).then(function (c) { return c['delete'](fresh); });
        }));
      }) : Promise.resolve();
      return cleanup.then(function () {
        if (!current || cached === current) return { updated: false, version: current };
        return purge(folder).then(function (n) { return { updated: true, from: cached, to: current, purged: n }; });
      });
    })['catch'](function () {
      return { updated: false };
    });
  }

  window.WorksheetUpdate = { check: check };
})(window);
