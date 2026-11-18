/*
 * Mock of the Euro-Office/ONLYOFFICE editor side of the plugin API, used by
 * harness/index.html. It answers the plugin's "initialize" handshake with a
 * plugin_init message whose code installs mocked window.Asc.plugin methods
 * (callCommand, executeMethod) and a small fake builder API (Api.*) backed by
 * an in-memory document that is rendered in the harness page.
 *
 * callCommand functions are re-created from their source text and run with a
 * JSON copy of Asc.scope – like the real editor – so closures over plugin
 * variables fail here as well.
 */
(function (window) {
  'use strict';

  var EMU_PER_MM = 36000;

  var state = {
    elements: [],
    cursor: 0,
    selectedDrawing: null, // {el, idx}
    options: { failCreateImage: false, legacyApi: false },
    log: []
  };

  function resetDocument() {
    state.elements = [
      para('Arbeitsblatt: Tonnamen', 'Heading 1'),
      para('Name: ____________   Klasse: ____', 'Normal'),
      para('Aufgabe 1', 'Heading 2'),
      para('Schreibe die Tonnamen unter die Noten.', 'Normal'),
      para('Aufgabe 2', 'Heading 2'),
      para('Spiele die Töne auf dem Glockenspiel und schreibe sie ab.', 'Normal'),
      para('Aufgabe 3', 'Heading 2'),
      para('Male die Notenschlüssel nach.', 'Normal'),
      para('', 'Normal')
    ];
    state.cursor = 3;
    state.selectedDrawing = null;
    render();
  }

  function para(text, style) {
    return { type: 'paragraph', text: text, style: style, drawings: [], id: Math.random().toString(36).slice(2) };
  }

  function log(msg) {
    state.log.push(new Date().toLocaleTimeString() + '  ' + msg);
    if (state.log.length > 200) state.log.shift();
    var el = document.getElementById('mock-log');
    if (el) { el.textContent = state.log.slice(-30).join('\n'); el.scrollTop = el.scrollHeight; }
  }

  // ---------------------------------------------------------------------------
  // Fake builder API (subset used by the plugin)
  // ---------------------------------------------------------------------------
  var LOGIC_DOC = { name: 'CDocument' };

  function ApiDrawing(d) { this._d = d; }
  ApiDrawing.prototype.GetClassType = function () { return 'image'; };
  ApiDrawing.prototype.SetWrappingStyle = function (s) { this._d.wrap = s; return true; };
  ApiDrawing.prototype.GetWidth = function () { return Math.round(this._d.wMm * EMU_PER_MM); };
  ApiDrawing.prototype.GetHeight = function () { return Math.round(this._d.hMm * EMU_PER_MM); };
  ApiDrawing.prototype.SetDescription = function (s) { if (!s) return false; this._d.descr = s; return true; };
  ApiDrawing.prototype.GetDescription = function () { return this._d.descr || null; };
  ApiDrawing.prototype.SetTitle = function (s) { this._d.title = s; return true; };
  ApiDrawing.prototype.getParaDrawing = function () {
    var d = this._d;
    return { docPr: { get descr() { return d.descr; }, setDescr: function (s) { d.descr = s; }, setTitle: function (s) { d.title = s; } } };
  };
  ApiDrawing.prototype.Delete = function () {
    var owner = findDrawing(this._d);
    if (!owner) return false;
    owner.el.drawings.splice(owner.idx, 1);
    if (state.selectedDrawing && state.selectedDrawing.d === this._d) state.selectedDrawing = null;
    return true;
  };
  ApiDrawing.prototype.GetParentParagraph = function () {
    var owner = findDrawing(this._d);
    return owner ? new ApiParagraph(owner.el) : null;
  };

  function findDrawing(d) {
    for (var i = 0; i < state.elements.length; i++) {
      var idx = state.elements[i].drawings.indexOf(d);
      if (idx !== -1) return { el: state.elements[i], idx: idx };
    }
    return null;
  }

  function ApiParagraph(el) {
    this._el = el;
    this.Paragraph = { GetParent: function () { return state.elements.indexOf(el) !== -1 ? LOGIC_DOC : null; } };
  }
  ApiParagraph.prototype.GetClassType = function () { return 'paragraph'; };
  ApiParagraph.prototype.GetText = function () { return this._el.text; };
  ApiParagraph.prototype.GetStyle = function () { var n = this._el.style; return { GetName: function () { return n; } }; };
  ApiParagraph.prototype.GetPosInParent = function () { return state.elements.indexOf(this._el); };
  ApiParagraph.prototype.AddText = function (t) { this._el.text += t; };
  ApiParagraph.prototype.AddDrawing = function (img) { this._el.drawings.push(img._d); return true; };
  ApiParagraph.prototype.SetJc = function () { return true; };
  ApiParagraph.prototype.GetAllDrawingObjects = function () { return this._el.drawings.map(function (d) { return new ApiDrawing(d); }); };
  ApiParagraph.prototype.GetRange = function () {
    var el = this._el;
    return {
      GetText: function () { return el.text; },
      Select: function () { state.cursor = state.elements.indexOf(el); return true; }
    };
  };

  function ApiDocument() { this.Document = LOGIC_DOC; }
  ApiDocument.prototype.GetElementsCount = function () { return state.elements.length; };
  ApiDocument.prototype.GetElement = function (i) { var el = state.elements[i]; return el ? new ApiParagraph(el) : null; };
  ApiDocument.prototype.AddElement = function (pos, p) {
    state.elements.splice(Math.max(0, Math.min(pos, state.elements.length)), 0, p._el);
    return true;
  };
  ApiDocument.prototype.InsertContent = function (arr) {
    // Simplification: inserts the paragraphs after the cursor paragraph.
    var at = state.cursor + 1;
    arr.forEach(function (p, k) { state.elements.splice(at + k, 0, p._el); });
    state.cursor = at + arr.length - 1;
    return true;
  };
  ApiDocument.prototype.GetCurrentParagraph = function () { return new ApiParagraph(state.elements[state.cursor]); };
  ApiDocument.prototype.GetSelectedDrawings = function () {
    return state.selectedDrawing ? [new ApiDrawing(state.selectedDrawing.d)] : [];
  };

  function makeApi() {
    var legacy = state.options.legacyApi;
    var api = {
      GetDocument: function () {
        var doc = new ApiDocument();
        if (legacy) doc.GetCurrentParagraph = undefined; // < 9.0
        // Legacy builds have no CurPos-independent API; emulate the internal fallback.
        doc.Document = { CurPos: { ContentPos: state.cursor }, IsSelectionUse: function () { return false; } };
        LOGIC_DOC = doc.Document;
        return doc;
      },
      CreateParagraph: function () { return new ApiParagraph(para('', 'Normal')); },
      CreateImage: function (src, w, h) {
        if (state.options.failCreateImage) throw new Error('CreateImage: data URLs not supported (simulated)');
        var img = new ApiDrawing({ src: src, wMm: w / EMU_PER_MM, hMm: h / EMU_PER_MM, descr: null, title: null });
        if (legacy) { img.SetDescription = undefined; img.GetDescription = undefined; img.SetTitle = undefined; }
        return img;
      }
    };
    return api;
  }

  // ---------------------------------------------------------------------------
  // Plugin API mock (installed into the plugin iframe via plugin_init)
  // ---------------------------------------------------------------------------
  function install(win) {
    var plugin = win.Asc.plugin;
    win.Asc.scope = win.Asc.scope || {};
    plugin.info = { lang: 'de-DE', editorType: 'word', guid: plugin.guid };
    plugin.theme = { type: 'light' };

    plugin.callCommand = function (fn, isClose, isCalc, callback) {
      var src = fn.toString();
      var scope = JSON.parse(JSON.stringify(win.Asc.scope || {}));
      setTimeout(function () {
        var result;
        try {
          // eslint-disable-next-line no-new-func
          var run = new Function('Asc', 'Api', 'return (' + src + ')();');
          result = run({ scope: scope }, makeApi());
        } catch (e) {
          log('callCommand threw: ' + e.message);
          result = undefined;
        }
        log('callCommand ' + (fn.name || 'anonymous') + ' -> ' + JSON.stringify(result, function (k, v) {
          return typeof v === 'string' && v.length > 120 ? v.slice(0, 60) + '…' : v;
        }));
        render();
        if (callback) callback(result === undefined ? undefined : JSON.parse(JSON.stringify(result)));
      }, 30);
    };

    plugin.executeMethod = function (name, params, callback) {
      setTimeout(function () {
        var result;
        if (name === 'PutImageDataToSelection') {
          var d = params[0];
          var target = state.selectedDrawing;
          if (target) {
            target.d.src = d.src;
            target.d.wMm = d.width / 96 * 25.4;
            target.d.hMm = d.height / 96 * 25.4;
          } else {
            var p = para('', 'Normal');
            var drawing = { src: d.src, wMm: d.width / 96 * 25.4, hMm: d.height / 96 * 25.4, descr: null };
            p.drawings.push(drawing);
            state.elements.splice(state.cursor + 1, 0, p);
            state.cursor += 1;
            state.selectedDrawing = { d: drawing };
          }
        } else if (name === 'PasteHtml') {
          var m = /src="([^"]+)"[^>]*alt="([^"]*)"/.exec(params[0]);
          var p2 = para('', 'Normal');
          if (m) p2.drawings.push({ src: m[1], wMm: 160, hMm: 30, descr: m[2].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') });
          state.elements.splice(state.cursor + 1, 0, p2);
          state.cursor += 1;
        } else if (name === 'GetVersion') {
          result = 'harness';
        }
        log('executeMethod ' + name);
        render();
        if (callback) callback(result);
      }, 30);
    };

    plugin.executeCommand = function (type) { log('executeCommand ' + type); };
    plugin.resizeWindow = function () {};
    plugin.onThemeChangedBase = function () {};
    log('plugin_init: mock API installed');
    if (typeof plugin.init === 'function') plugin.init('');
  }

  // ---------------------------------------------------------------------------
  // Rendering of the mock document
  // ---------------------------------------------------------------------------
  function render() {
    var root = document.getElementById('mock-doc');
    if (!root) return;
    root.innerHTML = '';
    state.elements.forEach(function (el, i) {
      var div = document.createElement('div');
      div.className = 'el' + (i === state.cursor ? ' cursor' : '') + (/^Heading/.test(el.style) ? ' heading' : '');
      var idx = document.createElement('span');
      idx.className = 'idx';
      idx.textContent = i;
      div.appendChild(idx);
      var text = document.createElement('span');
      text.textContent = el.text || (el.drawings.length ? '' : '¶');
      div.appendChild(text);
      el.drawings.forEach(function (d) {
        var img = document.createElement('img');
        img.src = d.src;
        img.style.width = d.wMm + 'mm';
        img.title = d.descr || '(no alt text)';
        img.className = state.selectedDrawing && state.selectedDrawing.d === d ? 'selected' : '';
        img.addEventListener('click', function (e) {
          e.stopPropagation();
          state.selectedDrawing = { d: d };
          state.cursor = i;
          render();
        });
        div.appendChild(img);
      });
      div.addEventListener('click', function () {
        state.cursor = i;
        state.selectedDrawing = null;
        render();
      });
      root.appendChild(div);
    });
  }

  function onMessage(e) {
    var data;
    try { data = JSON.parse(e.data); } catch (err) { return; }
    if (data && data.type === 'initialize') {
      log('initialize from plugin ' + data.guid);
      e.source.postMessage(JSON.stringify({ type: 'plugin_init', data: 'parent.HarnessMock.install(window);' }), '*');
    }
  }

  window.addEventListener('message', onMessage);

  window.HarnessMock = {
    state: state,
    install: install,
    render: render,
    resetDocument: resetDocument,
    log: log
  };
})(window);
