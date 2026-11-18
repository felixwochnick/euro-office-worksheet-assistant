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
    props: {},             // document custom properties
    header: [],            // header paragraphs (element objects)
    footer: [],
    page: { w: 11906, h: 16838, portrait: true, margins: null, columns: 1 },
    selection: null,       // { el, text } for Search(...).Select()
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
    state.props = {};
    state.header = [];
    state.footer = [];
    state.page = { w: 11906, h: 16838, portrait: true, margins: null, columns: 1 };
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
  ApiParagraph.prototype.AddText = function (t) {
    var el = this._el;
    el.text += t;
    var run = { text: t, b: false, i: false, u: false };
    // Like the real editor: a new run inherits the previous run's formatting.
    var prevRun = el.runs && el.runs[el.runs.length - 1];
    if (prevRun) { run.b = prevRun.b; run.i = prevRun.i; run.u = prevRun.u; run.color = prevRun.color; run.size = prevRun.size; run.font = prevRun.font; }
    (el.runs = el.runs || []).push(run);
    return {
      SetBold: function (v) { run.b = !!v; },
      SetItalic: function (v) { run.i = !!v; },
      SetUnderline: function (v) { run.u = !!v; },
      SetFontSize: function (v) { run.size = v / 2; },
      SetFontFamily: function (v) { run.font = v; },
      SetColor: function (r, g, b) { run.color = 'rgb(' + r + ',' + g + ',' + b + ')'; },
      GetTextPr: function () { return { GetFontFamily: function () { return run.font; }, GetFontSize: function () { return run.size ? run.size * 2 : null; }, GetBold: function () { return run.b; } }; }
    };
  };
  ApiParagraph.prototype.AddLineBreak = function () { this._el.text += '\n'; (this._el.runs = this._el.runs || []).push({ text: '\n' }); };
  ApiParagraph.prototype.AddTabStop = function () { this._el.text += '\t'; (this._el.runs = this._el.runs || []).push({ text: '\t', tab: true }); };
  ApiParagraph.prototype.AddPageNumber = function () { this._el.text += '1'; (this._el.runs = this._el.runs || []).push({ text: '1' }); };
  ApiParagraph.prototype.AddPagesCount = function () { this._el.text += '1'; (this._el.runs = this._el.runs || []).push({ text: '1' }); };
  ApiParagraph.prototype.GetElement = function (i) { var r = (this._el.runs || [])[i]; return r ? { GetTextPr: function () { return { GetFontFamily: function () { return r.font; }, GetFontSize: function () { return r.size ? r.size * 2 : null; }, GetBold: function () { return r.b; } }; } } : null; };
  ['SetIndLeft', 'SetIndRight', 'SetIndFirstLine', 'SetSpacingLine', 'SetTabs', 'SetBold'].forEach(function (m) {
    ApiParagraph.prototype[m] = function (v) { (this._el.pr = this._el.pr || {})[m] = v; return true; };
  });
  ApiParagraph.prototype.SetKeepNext = function (v) { this._el.keepNext = !!v; return true; };
  ApiParagraph.prototype.SetKeepLines = function (v) { this._el.keepLines = !!v; return true; };
  ApiParagraph.prototype.SetShd = function (t, r, g, b) { this._el.shd = 'rgb(' + r + ',' + g + ',' + b + ')'; return true; };
  ['Top', 'Left', 'Right'].forEach(function (side) {
    ApiParagraph.prototype['Set' + side + 'Border'] = function () { (this._el.borders = this._el.borders || {})[side] = true; return true; };
  });
  ApiParagraph.prototype.SetStyle = function (st) { if (st) this._el.style = st.GetName(); };
  ApiParagraph.prototype.SetNumbering = function (lvl) { this._el.list = lvl && lvl._type; };
  ApiParagraph.prototype.GetNumbering = function () { return this._el.list ? { type: this._el.list } : null; };
  ApiParagraph.prototype.SetBottomBorder = function () { this._el.line = true; (this._el.borders = this._el.borders || {}).Bottom = true; };
  ApiParagraph.prototype.SetSpacingBefore = function () {};
  ApiParagraph.prototype.SetSpacingAfter = function () {};
  ApiParagraph.prototype.AddPageBreak = function () { this._el.pageBreak = true; };
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

  // Tables: element { type: 'table', rows: [[cell]] }, cell = { paras: [paragraph element], shd }
  function ApiTable(el) { this._el = el; }
  ApiTable.prototype.GetClassType = function () { return 'table'; };
  ApiTable.prototype.GetRowsCount = function () { return this._el.rows.length; };
  ApiTable.prototype.GetRow = function (r) {
    var row = this._el.rows[r];
    return {
      GetCellsCount: function () { return row.length; },
      SetHeight: function (rule, h) { row.height = h; return true; },
      GetCell: function (c) {
        var cell = row[c];
        return {
          SetShd: function (t, r, g, b) { cell.shd = r != null ? 'rgb(' + r + ',' + g + ',' + b + ')' : true; },
          SetWidth: function (t, w) { cell.width = w; return true; },
          SetVerticalAlign: function () { return true; },
          GetContent: function () {
            return {
              GetElementsCount: function () { return cell.paras.length; },
              GetElement: function (i) { return wrap(cell.paras[i]); },
              Push: function (p) { cell.paras.push(p._el); },
              RemoveElement: function (i) { cell.paras.splice(i, 1); return true; },
              RemoveAllElements: function () { cell.paras = [para('', 'Normal')]; return true; }
            };
          }
        };
      }
    };
  };
  ApiTable.prototype.GetText = function () {
    return this._el.rows.map(function (r) { return r.map(function (c) { return c.paras.map(function (p) { return p.text; }).join(' '); }).join('\t'); }).join(' ');
  };
  ['SetWidth', 'SetStyle', 'SetTableBorderTop', 'SetTableBorderBottom', 'SetTableBorderLeft', 'SetTableBorderRight', 'SetTableBorderInsideH',
    'SetTableBorderInsideV', 'SetTableLayout', 'SetTableCellMarginLeft', 'SetTableCellMarginRight', 'SetTableCellMarginTop',
    'SetTableCellMarginBottom', 'SetJc'].forEach(function (m) {
    ApiTable.prototype[m] = function (type) { if (/^SetTableBorder(Top|Left)$/.test(m) && type === 'single') this._el.box = true; return true; };
  });
  ApiTable.prototype.SetTableDescription = function (d) { this._el.description = d; return true; };
  ApiTable.prototype.GetTableDescription = function () { return this._el.description || ''; };

  function wrap(el) { return el.type === 'table' ? new ApiTable(el) : new ApiParagraph(el); }

  function findText(text) {
    var out = [];
    function scan(list) {
      list.forEach(function (el) {
        if (el.type === 'table') { el.rows.forEach(function (r) { r.forEach(function (c) { scan(c.paras); }); }); return; }
        if ((el.text || '').indexOf(text) !== -1) out.push({ Select: function () { state.selection = { el: el, text: text }; return true; } });
      });
    }
    scan(state.elements);
    return out;
  }

  function headerContent(list) {
    return {
      GetElementsCount: function () { return list.length; },
      GetElement: function (i) { return new ApiParagraph(list[i]); },
      Push: function (p) { list.push(p._el); },
      RemoveElement: function (i) { list.splice(i, 1); return true; },
      RemoveAllElements: function () { list.splice(0, list.length, para('', 'Normal')); return true; }
    };
  }

  function ApiSection() {
    this.Section = { get PageMargins() { var m = state.page.margins; return m ? { Left: m[0] / 56.7, Top: m[1] / 56.7, Right: m[2] / 56.7, Bottom: m[3] / 56.7 } : { Left: 20, Top: 20, Right: 20, Bottom: 20 }; } };
  }
  ApiSection.prototype.GetPageWidth = function () { return state.page.w; };
  ApiSection.prototype.GetPageHeight = function () { return state.page.h; };
  ApiSection.prototype.SetPageSize = function (w, h, portrait) { state.page.w = w; state.page.h = h; state.page.portrait = portrait; return true; };
  ApiSection.prototype.SetPageMargins = function (l, t, r, b) { state.page.margins = [l, t, r, b]; return true; };
  ApiSection.prototype.SetEqualColumns = function (n) { state.page.columns = n; return true; };
  ApiSection.prototype.GetHeader = function () { return headerContent(state.header); };
  ApiSection.prototype.GetFooter = function () { return headerContent(state.footer); };

  function ApiDocument() { this.Document = LOGIC_DOC; }
  ApiDocument.prototype.GetCustomProperties = function () {
    return { Add: function (k, v) { state.props[k] = v; return true; }, Get: function (k) { return state.props[k]; } };
  };
  ApiDocument.prototype.Search = function (text) { return findText(text); };
  ApiDocument.prototype.AddMathEquation = function (latex) {
    var sel = state.selection;
    if (!sel) return false;
    sel.el.text = sel.el.text.replace(sel.text, '⟨' + latex + '⟩');
    (sel.el.runs || []).forEach(function (r) { if (r.text && r.text.indexOf(sel.text) !== -1) { r.text = r.text.replace(sel.text, '⟨' + latex + '⟩'); r.math = true; } });
    state.selection = null;
    return true;
  };
  ApiDocument.prototype.RemoveSelection = function () { state.selection = null; return true; };
  ApiDocument.prototype.GetFinalSection = function () { return new ApiSection(); };
  ApiDocument.prototype.GetSections = function () { return [new ApiSection()]; };
  ApiDocument.prototype.GetPageCount = function () { return 1; };
  ApiDocument.prototype.GetElementsCount = function () { return state.elements.length; };
  ApiDocument.prototype.GetElement = function (i) { var el = state.elements[i]; return el ? wrap(el) : null; };
  ApiDocument.prototype.RemoveElement = function (i) { state.elements.splice(i, 1); return true; };
  ApiDocument.prototype.GetStyle = function (name) { return { GetName: function () { return name; } }; };
  ApiDocument.prototype.CreateNumbering = function (type) {
    var lvl = { _type: type, SetTemplateType: function (t, sym) { lvl._type = t === 'a)' ? 'letters' : sym === '☐' ? 'checkbox' : type; return true; } };
    return { GetLevel: function () { return lvl; } };
  };
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
      CreateTable: function (cols, rows) {
        var r = [];
        for (var i = 0; i < rows; i++) { var row = []; for (var j = 0; j < cols; j++) row.push({ paras: [para('', 'Normal')] }); r.push(row); }
        return new ApiTable({ type: 'table', rows: r, drawings: [], id: Math.random().toString(36).slice(2) });
      },
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
  function renderRuns(target, p) {
    (p.runs || [{ text: p.text }]).forEach(function (r) {
      if (r.text === '\n') { target.appendChild(document.createElement('br')); return; }
      var node = document.createElement(r.b ? 'strong' : r.i ? 'em' : r.u ? 'u' : 'span');
      node.textContent = r.tab ? '    ' : r.text;
      if (r.color) node.style.color = r.color;
      if (r.size) node.style.fontSize = Math.round(r.size * 1.2) + 'px';
      if (r.math) node.className = 'math';
      target.appendChild(node);
    });
    (p.drawings || []).forEach(function (d) {
      if (target.closest && target.closest('td')) {
        var img = document.createElement('img');
        img.src = d.src;
        img.style.width = d.wMm + 'mm';
        img.style.verticalAlign = 'middle';
        target.insertBefore(img, target.firstChild);
      }
    });
  }

  function renderHeaderFooter(list, cls) {
    if (!list.length || !list.some(function (p) { return p.text || (p.drawings && p.drawings.length); })) return null;
    var div = document.createElement('div');
    div.className = cls;
    list.forEach(function (p) {
      var line = document.createElement('div');
      (p.drawings || []).forEach(function (d) { var img = document.createElement('img'); img.src = d.src; img.style.height = '24px'; line.appendChild(img); });
      renderRuns(line, { runs: p.runs, text: p.text });
      div.appendChild(line);
    });
    return div;
  }

  function render() {
    var root = document.getElementById('mock-doc');
    if (!root) return;
    root.innerHTML = '';
    var hdr = renderHeaderFooter(state.header, 'mock-header');
    if (hdr) root.appendChild(hdr);
    state.elements.forEach(function (el, i) {
      var div = document.createElement('div');
      div.className = 'el' + (i === state.cursor ? ' cursor' : '') + (/^Heading/.test(el.style) ? ' heading' : '');
      var idx = document.createElement('span');
      idx.className = 'idx';
      idx.textContent = i;
      div.appendChild(idx);
      if (el.type === 'table') {
        var table = document.createElement('table');
        table.className = el.box ? 'box' : '';
        el.rows.forEach(function (row) {
          var tr = document.createElement('tr');
          row.forEach(function (cell) {
            var td = document.createElement('td');
            if (cell.shd) { td.className = 'shd'; if (typeof cell.shd === 'string') td.style.background = cell.shd; }
            cell.paras.forEach(function (p, k) { if (k) td.appendChild(document.createElement('br')); renderRuns(td, p); });
            tr.appendChild(td);
          });
          table.appendChild(tr);
        });
        div.appendChild(table);
      } else {
        var text = document.createElement('span');
        if (el.list) text.className = 'list ' + el.list;
        if (el.line) div.className += ' line';
        if (el.pageBreak) div.className += ' page-break';
        if (el.shd) div.style.background = el.shd;
        if (el.runs && el.runs.length) renderRuns(text, el);
        else text.textContent = el.text || (el.drawings.length || el.line ? '' : '¶');
        div.appendChild(text);
      }
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
    var ftr = renderHeaderFooter(state.footer, 'mock-footer');
    if (ftr) root.appendChild(ftr);
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
