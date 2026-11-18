/*
 * Worksheet content in the editor: build, replace and delete document content from
 * layout elements (shared/worksheet-layout.js), read elements back, page setup and
 * the data for the worksheet check.
 *
 *   blocks (from the AI) --WorksheetLayout.compose--> layout elements --rasterise images-->
 *   cmdBuild (runs inside the editor, builder API) --> paragraphs, tables, images, equations
 *
 * All functions passed to callCommand are self-contained (they run inside the editor and
 * only see Asc.scope).
 */
(function (window) {
  'use strict';

  var EMU_PER_MM = 36000;

  /* eslint-disable no-undef */
  /**
   * The one editor command for document content:
   *   { op: 'insert',  position, elements, theme?, lang?, token }
   *   { op: 'replace', from, to, elements, theme?, lang?, token }
   *   { op: 'delete',  from, to }
   *   { op: 'setup_page', page: { width, height, portrait, margins, columns }, header?, footer?, theme?, lang? }
   * Images in the elements arrive rasterised: run.image = { dataUrl, wEmu, hEmu, alt }.
   */
  function cmdBuild() {
    // Runs inside the editor (callCommand serialises this function): no access to variables outside it.
    var req = Asc.scope.req;
    var doc = Api.GetDocument();
    var count = doc.GetElementsCount();
    var token = String(req.token || '0').replace(/[^0-9a-z]/gi, '').slice(0, 12);
    var numberings = {};
    var maths = [];
    var warnings = [];

    function fail(msg) { return { ok: false, fatal: true, error: msg }; }
    function rgb(hex) {
      var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
      if (!m) return null;
      var n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function norm(s) {
      return String(s || '').toLowerCase().replace(/[\s\u00a0]+/g, ' ').replace(/[\s:.\-–—)]+$/, '').trim();
    }
    function textOf(el) {
      try { return String(el.GetText ? el.GetText() : '').replace(/[\r\n]+$/, ''); } catch (e) { return ''; }
    }
    function describe(drawing) {
      try { if (drawing.GetDescription) { var d = drawing.GetDescription(); if (d) return String(d); } } catch (e) {}
      try {
        var pd = drawing.getParaDrawing ? drawing.getParaDrawing() : (drawing.Drawing && drawing.Drawing.parent);
        if (pd && pd.docPr && pd.docPr.descr) return String(pd.docPr.descr);
      } catch (e) {}
      return null;
    }
    function taskNumberOf(el) {
      try {
        var ds = el.GetAllDrawingObjects ? el.GetAllDrawingObjects() : [];
        for (var i = 0; i < ds.length; i++) {
          var d = describe(ds[i]);
          var k = d ? d.indexOf('WSTASK ') : -1;
          if (k !== -1) return String(JSON.parse(d.slice(k + 7)).number);
        }
      } catch (e) {}
      return null;
    }
    function isHeading(p) {
      try { var st = p.GetStyle ? p.GetStyle() : null; if (st && /^(heading|überschrift|title|titel)/i.test(st.GetName())) return true; } catch (e) {}
      try { if (p.GetOutlineLvl) { var o = p.GetOutlineLvl(); if (typeof o === 'number' && o >= 0 && o < 9) return true; } } catch (e) {}
      return false;
    }
    function isEmptyParagraph(el) {
      try {
        return el.GetClassType() === 'paragraph' && !textOf(el).replace(/\s+/g, '') &&
          !(el.GetAllDrawingObjects && el.GetAllDrawingObjects().length);
      } catch (e) { return false; }
    }
    function style(name) {
      try { return doc.GetStyle(name); } catch (e) { return null; }
    }
    function setAlt(drawing, alt, title) {
      try { if (drawing.SetDescription && drawing.SetDescription(alt)) { try { if (title) drawing.SetTitle(title); } catch (e) {} return true; } } catch (e) {}
      try {
        var pd = drawing.getParaDrawing ? drawing.getParaDrawing() : (drawing.Drawing && drawing.Drawing.parent);
        if (pd && pd.docPr && pd.docPr.setDescr) { pd.docPr.setDescr(alt); try { if (title) pd.docPr.setTitle(title); } catch (e) {} return true; }
      } catch (e) {}
      return false;
    }

    // --- runs ----------------------------------------------------------------
    function buildRuns(p, runs) {
      // A new text run inherits the formatting of the previous one. Set a property only when it
      // changes – setting "not bold" everywhere would override bold heading styles. After an image
      // or tab the next text run additionally sets everything it specifies (force).
      var prev = { b: false, i: false, u: false, font: null, size: null, color: null, known: true };
      for (var i = 0; i < (runs || []).length; i++) {
        var r = runs[i];
        try {
          if (r.br) { p.AddLineBreak(); continue; }
          if (r.tab) { p.AddTabStop(); prev.known = false; continue; }
          if (r.pageNum) { p.AddPageNumber(); prev.known = false; continue; }
          if (r.pagesCount) { p.AddPagesCount(); prev.known = false; continue; }
          if (r.image) {
            var im = r.image;
            if (!im.dataUrl) continue;
            var img = Api.CreateImage(im.dataUrl, im.wEmu, im.hEmu);
            try { img.SetWrappingStyle('inline'); } catch (e) {}
            if (im.alt) setAlt(img, im.alt, im.title || (im.kind === 'staff' || im.kind === 'empty_staves' ? 'ABC-Notation' : null));
            p.AddDrawing(img);
            prev.known = false;
            continue;
          }
          var text = r.text;
          if (r.math) {
            text = '\u27e6M' + token + '_' + maths.length + '\u27e7';
            maths.push({ ph: text, latex: r.math });
          }
          if (!text) continue;
          var run = p.AddText(text);
          var force = !prev.known;
          var flags = [['b', 'SetBold'], ['i', 'SetItalic'], ['u', 'SetUnderline']];
          for (var f = 0; f < flags.length; f++) {
            var k = flags[f][0];
            var want = !!r[k];
            if (want !== prev[k] || (force && r[k] !== undefined)) run[flags[f][1]](want);
            prev[k] = want;
          }
          if (r.font && (force || r.font !== prev.font)) { run.SetFontFamily(r.font); prev.font = r.font; }
          if (r.size && (force || r.size !== prev.size)) { run.SetFontSize(Math.round(r.size * 2)); prev.size = r.size; }
          if (r.color && (force || r.color !== prev.color)) { var c = rgb(r.color); if (c) run.SetColor(c[0], c[1], c[2]); prev.color = r.color; }
          prev.known = true;
        } catch (e) {
          warnings.push('run: ' + String((e && e.message) || e));
        }
      }
    }

    // --- paragraphs ------------------------------------------------------------
    function numberingFor(n) {
      if (numberings[n.ref]) return numberings[n.ref];
      var num = null;
      try {
        num = doc.CreateNumbering(n.type === 'numbered' || n.type === 'letters' ? 'numbered' : 'bullet');
        if (n.type === 'letters') num.GetLevel(0).SetTemplateType('a)');
        if (n.type === 'checkbox') num.GetLevel(0).SetTemplateType('bullet', '\u2610');
      } catch (e) {}
      numberings[n.ref] = num;
      return num;
    }
    function buildParagraph(e) {
      var p = Api.CreateParagraph();
      if (e.style) {
        var st = style(e.style);
        if (st) { try { p.SetStyle(st); } catch (x) {} }
        else if (/^Heading (\d)/.test(e.style)) {
          // Documents without heading styles: bold, larger text instead.
          try { p.SetBold(true); } catch (x) {}
        }
      }
      try {
        if (e.jc) p.SetJc(e.jc);
        if (e.indLeft != null) p.SetIndLeft(e.indLeft);
        if (e.indRight != null) p.SetIndRight(e.indRight);
        if (e.indFirst != null) p.SetIndFirstLine(e.indFirst);
        if (e.before != null) p.SetSpacingBefore(e.before);
        if (e.after != null) p.SetSpacingAfter(e.after);
        if (e.line) p.SetSpacingLine(e.line.rule === 'auto' ? Math.round(e.line.value * 240) : Math.round(e.line.value), e.line.rule);
        if (e.keepNext) p.SetKeepNext(true);
        if (e.keepLines) p.SetKeepLines(true);
        if (e.tabs && e.tabs.length) p.SetTabs(e.tabs.map(function (t) { return t.pos; }), e.tabs.map(function (t) { return t.type; }));
        if (e.shd) { var s = rgb(e.shd); if (s) p.SetShd('clear', s[0], s[1], s[2], false); }
        if (e.borders) {
          ['Top', 'Bottom', 'Left', 'Right'].forEach(function (side) {
            var b = e.borders[side.toLowerCase()];
            if (!b) return;
            var c = rgb(b.color) || [0, 0, 0];
            p['Set' + side + 'Border']('single', b.size, b.space || 0, c[0], c[1], c[2]);
          });
        }
        if (e.numbering) {
          var num = numberingFor(e.numbering);
          if (num) p.SetNumbering(num.GetLevel(0));
        }
      } catch (x) {
        warnings.push('paragraph: ' + String((x && x.message) || x));
      }
      buildRuns(p, e.runs);
      if (e.pageBreak) p.AddPageBreak();
      return p;
    }

    // --- tables ----------------------------------------------------------------
    var SIDES = { top: 'Top', bottom: 'Bottom', left: 'Left', right: 'Right', insideH: 'InsideH', insideV: 'InsideV' };
    function cellBorder(cellObj, side, b) {
      var c = b ? rgb(b.color) || [0, 0, 0] : [0, 0, 0];
      // ApiTableCellPr.SetCellBorder*(type, size, space, r, g, b) – ApiTableCell overrides it with an
      // ApiFill variant that does not draw in this editor version, so call the parent prototype.
      try {
        var proto = Object.getPrototypeOf(Object.getPrototypeOf(cellObj));
        if (proto && proto['SetCellBorder' + side]) {
          proto['SetCellBorder' + side].call(cellObj, b ? 'single' : 'none', b ? b.size : 0, 0, c[0], c[1], c[2]);
          return;
        }
      } catch (e) {}
      try { if (b) cellObj['SetCellBorder' + side](b.size / 8 * 0.3528, Api.CreateSolidFill(Api.CreateRGBColor(c[0], c[1], c[2]))); } catch (e) {}
    }
    // A table with only a percentage width (tblW type="pct") and automatic cell widths is stretched by Word, but
    // Google Docs and Apple Pages follow the grid (w:gridCol) and cell widths (w:tcW) and shrink the table to its
    // content. So every table gets an absolute width in twips, a fixed layout and explicit cell and grid widths.
    var TEXT_WIDTH_FALLBACK = 9070; // 16 cm: A4 with common margins
    var DEFAULT_CELL_MARGIN = 108; // 0.19 cm, left and right, when the table sets none
    var textWidthCache = null;
    function textWidth() {
      if (textWidthCache) return textWidthCache;
      var w = 0;
      var sec = null;
      try {
        sec = doc.GetFinalSection();
        // Public getters (twips) in newer editor versions ...
        if (sec.GetPageWidth && sec.GetPageMarginLeft && sec.GetPageMarginRight) {
          w = sec.GetPageWidth() - sec.GetPageMarginLeft() - sec.GetPageMarginRight();
        }
        // ... otherwise the internal section properties (millimetres).
        if (!(w > 0) && sec.Section && sec.Section.GetPageWidth) {
          var s = sec.Section;
          w = (s.GetPageWidth() - s.GetPageMarginLeft() - s.GetPageMarginRight()) * 1440 / 25.4;
        }
      } catch (x) { w = 0; }
      // Page columns: one column (as in cmdDocInfo).
      try {
        var colsPr = sec && sec.Section && sec.Section.Columns;
        if (w > 0 && colsPr && colsPr.Num > 1) w = (w - (colsPr.Num - 1) * (colsPr.Space || 10) * 1440 / 25.4) / colsPr.Num;
      } catch (x) {}
      textWidthCache = w > 1440 && w < 31680 ? Math.round(w) : TEXT_WIDTH_FALLBACK; // 1 in .. 22 in
      return textWidthCache;
    }
    /** Column widths in twips: the layout's percentages (e.widths) of the total, else equal columns. */
    function columnWidths(e, cols, total) {
      var out = [];
      var pct = e.widths && e.widths.length >= cols ? e.widths : null;
      var sum = 0;
      for (var i = 0; i < cols; i++) sum += pct ? Number(pct[i]) || 0 : 0;
      for (var j = 0; j < cols; j++) out.push(pct && sum > 0 ? Math.floor(total * (Number(pct[j]) || 0) / sum) : Math.floor(total / cols));
      return out;
    }
    function setTableWidths(t, rowCount, cols, colW, total) {
      try { t.SetWidth('twips', total); } catch (x) {}
      try { t.SetTableLayout('fixed'); } catch (x) {}
      for (var r = 0; r < rowCount; r++) {
        for (var c = 0; c < cols; c++) {
          try { t.GetRow(r).GetCell(c).SetWidth('twips', colW[c]); } catch (x) {}
        }
      }
      // The grid (w:tblGrid) is not derived from the cell widths: Api.CreateTable starts with a default grid
      // (2 cm per column). Set it on the underlying table so the exported w:gridCol values match the cells.
      try {
        if (t.Table && t.Table.SetTableGrid) t.Table.SetTableGrid(colW.map(function (v) { return v * 25.4 / 1440; }));
      } catch (x) {}
    }

    /** availTwips: width available for the table (the text width, or the inner width of the parent cell). */
    function buildTable(e, availTwips) {
      var rows = e.rows || [];
      var cols = rows.reduce(function (m, r) { return Math.max(m, (r.cells || []).length); }, 1);
      var t = Api.CreateTable(cols, Math.max(1, rows.length));
      var total = availTwips > 0 ? Math.round(availTwips) : textWidth();
      var colW = columnWidths(e, cols, total);
      setTableWidths(t, Math.max(1, rows.length), cols, colW, total);
      var cm = e.cellMargins || {};
      var padding = (cm.left != null ? cm.left : DEFAULT_CELL_MARGIN) + (cm.right != null ? cm.right : DEFAULT_CELL_MARGIN);
      if (e.borders) {
        Object.keys(SIDES).forEach(function (k) {
          if (!(k in e.borders)) return;
          var b = e.borders[k];
          var c = b ? rgb(b.color) || [0, 0, 0] : [0, 0, 0];
          try { t['SetTableBorder' + SIDES[k]](b ? 'single' : 'none', b ? b.size : 0, 0, c[0], c[1], c[2]); } catch (x) {}
        });
      } else {
        var grid = style('Table Grid');
        if (grid) { try { t.SetStyle(grid); } catch (x) {} }
      }
      if (e.cellMargins) {
        var cm = e.cellMargins;
        try { if (cm.left != null) t.SetTableCellMarginLeft(cm.left); } catch (x) {}
        try { if (cm.right != null) t.SetTableCellMarginRight(cm.right); } catch (x) {}
        try { if (cm.top != null) t.SetTableCellMarginTop(cm.top); } catch (x) {}
        try { if (cm.bottom != null) t.SetTableCellMarginBottom(cm.bottom); } catch (x) {}
      }
      try { if (e.description) t.SetTableDescription(e.description); } catch (x) {}
      try { if (e.jc) t.SetJc(e.jc); } catch (x) {}
      for (var r = 0; r < rows.length; r++) {
        var row = t.GetRow(r);
        try { if (rows[r].height) row.SetHeight('atLeast', rows[r].height); } catch (x) {}
        for (var ci = 0; ci < cols; ci++) {
          var spec = (rows[r].cells || [])[ci] || { content: [] };
          var cl = row.GetCell(ci);
          try { if (spec.shd) { var s = rgb(spec.shd); if (s) cl.SetShd('clear', s[0], s[1], s[2], false); } } catch (x) {}
          try { if (spec.valign) cl.SetVerticalAlign(spec.valign); } catch (x) {}
          if (spec.borders) {
            ['top', 'bottom', 'left', 'right'].forEach(function (side) {
              if (side in spec.borders) cellBorder(cl, SIDES[side], spec.borders[side]);
            });
          }
          var content = cl.GetContent();
          var inner = Math.max(144, colW[ci] - padding); // nested tables: the inner width of this cell
          var built = (spec.content || []).map(function (x) { return buildElement(x, inner); });
          if (built.length) {
            for (var b2 = 0; b2 < built.length; b2++) content.Push(built[b2]);
            try { content.RemoveElement(0); } catch (x) {}
          }
        }
      }
      return t;
    }

    function buildElement(e, availTwips) {
      return e.t === 'table' ? buildTable(e, availTwips) : buildParagraph(e);
    }

    function buildAll(elements) {
      var all = [];
      for (var i = 0; i < elements.length; i++) {
        var el = buildElement(elements[i]);
        // Two tables directly after each other would merge into one (Word): separate them.
        var last = all[all.length - 1];
        if (last && last.GetClassType() === 'table' && el.GetClassType() === 'table') all.push(Api.CreateParagraph());
        all.push(el);
      }
      return all;
    }

    /** Placeholders -> native equations (LaTeX). Last first, so earlier positions stay valid. */
    function convertMath() {
      if (!maths.length) return null;
      var found = [];
      maths.forEach(function (m) {
        try {
          var res = doc.Search(m.ph, true);
          if (res && res.length) found.push({ m: m, range: res[0] });
        } catch (e) { warnings.push('math search: ' + String((e && e.message) || e)); }
      });
      var ok = 0;
      for (var i = found.length - 1; i >= 0; i--) {
        try {
          found[i].range.Select();
          if (doc.AddMathEquation(found[i].m.latex, 'latex')) ok++;
          else warnings.push('math: could not convert "' + found[i].m.latex + '"');
        } catch (e) {
          warnings.push('math: ' + String((e && e.message) || e));
        }
      }
      try { doc.RemoveSelection(); } catch (e) {}
      return { equations: maths.length, converted: ok };
    }

    function rememberTheme() {
      try {
        var props = doc.GetCustomProperties();
        if (req.theme) props.Add('WorksheetTheme', String(req.theme));
        if (req.lang) props.Add('WorksheetLanguage', String(req.lang));
      } catch (e) {}
    }

    function cursorIndex() {
      try {
        var sel = doc.GetSelectedDrawings ? doc.GetSelectedDrawings() : [];
        var spp = sel && sel.length && sel[0].GetParentParagraph ? sel[0].GetParentParagraph() : null;
        if (spp && spp.Paragraph && spp.Paragraph.GetParent && spp.Paragraph.GetParent() === doc.Document) return spp.GetPosInParent();
      } catch (e) {}
      try {
        var cp2 = doc.GetCurrentParagraph ? doc.GetCurrentParagraph() : null;
        if (cp2 && cp2.Paragraph && cp2.Paragraph.GetParent && cp2.Paragraph.GetParent() === doc.Document) return cp2.GetPosInParent();
      } catch (e) {}
      try { var ld = doc.Document; if (ld && ld.CurPos && typeof ld.CurPos.ContentPos === 'number') return ld.CurPos.ContentPos; } catch (e) {}
      return count - 1;
    }

    function setupPage() {
      var sections = [];
      try { sections = doc.GetSections ? doc.GetSections() : []; } catch (e) {}
      if (!sections || !sections.length) sections = [doc.GetFinalSection()];
      var pg = req.page || {};
      var done = [];
      sections.forEach(function (s) {
        try {
          if (pg.width && pg.height) { s.SetPageSize(pg.width, pg.height, pg.portrait !== false); done.push('size'); }
          if (pg.margins) { s.SetPageMargins(pg.margins.left, pg.margins.top, pg.margins.right, pg.margins.bottom); done.push('margins'); }
          if (pg.columns) { s.SetEqualColumns(pg.columns, pg.columnSpace || 567); done.push('columns'); }
        } catch (e) { warnings.push('section: ' + String((e && e.message) || e)); }
      });
      [['header', 'GetHeader'], ['footer', 'GetFooter']].forEach(function (hf) {
        var spec = req[hf[0]];
        if (spec === undefined) return;
        try {
          var s0 = doc.GetFinalSection();
          var content = s0[hf[1]]('default', true);
          if (!content) return;
          var els = (spec || []).map(function (x) { return buildElement(x); });
          if (content.RemoveAllElements) content.RemoveAllElements();
          for (var k = 0; k < els.length; k++) content.Push(els[k]);
          if (els.length && content.GetElementsCount() > els.length) content.RemoveElement(0);
          done.push(hf[0]);
        } catch (e) { warnings.push(hf[0] + ': ' + String((e && e.message) || e)); }
      });
      rememberTheme();
      return { ok: true, op: 'setup_page', changed: done, warnings: warnings };
    }

    try {
      if (req.op === 'setup_page') return setupPage();

      if (req.op === 'delete' || req.op === 'replace') {
        var from = Number(req.from);
        var to = req.to == null ? from : Number(req.to);
        if (!(from >= 0 && to >= from && to < count)) return fail('range ' + from + '..' + to + ' is out of range (0..' + (count - 1) + ')');
        var removed = [];
        for (var x = from; x <= to; x++) removed.push(textOf(doc.GetElement(x)).slice(0, 80));
        var els = req.op === 'replace' ? buildAll(req.elements || []) : [];
        if (req.op === 'delete' && from === 0 && to === count - 1) els = [Api.CreateParagraph()]; // a document needs one element
        for (var a = 0; a < els.length; a++) doc.AddElement(to + 1 + a, els[a]);
        for (var d = to; d >= from; d--) doc.RemoveElement(d);
        var mathInfo = convertMath();
        if (req.op === 'replace') rememberTheme();
        return { ok: true, op: req.op, first_index: els.length ? from : null, last_index: els.length ? from + els.length - 1 : null, count: els.length, removed: removed, math: mathInfo, warnings: warnings };
      }

      // insert
      var elements = buildAll(req.elements || []);
      if (!elements.length) return fail('no blocks');
      var pos = req.position;
      var insertAt;
      var dropEmpty = -1;
      if (pos && typeof pos === 'object' && pos.after_paragraph_index != null) {
        var target = Number(pos.after_paragraph_index);
        if (!(target >= 0 && target < count)) return fail('after_paragraph_index ' + target + ' is out of range (0..' + (count - 1) + ')');
        insertAt = target + 1;
      } else if (pos && typeof pos === 'object' && pos.after_heading) {
        var needle = norm(pos.after_heading);
        var taskNeedle = /^(?:aufgabe|task|übung|exercise|nr\.?)\s*(\S+)$/i.exec(needle);
        var best = null;
        var bestScore = 0;
        for (var i2 = 0; i2 < count; i2++) {
          var el = doc.GetElement(i2);
          if (!el || !el.GetClassType || el.GetClassType() !== 'paragraph') continue;
          var tt = norm(textOf(el));
          var score = 0;
          if (taskNeedle) { var tn = taskNumberOf(el); if (tn !== null && norm(tn) === norm(taskNeedle[1])) score = 7; }
          if (!score && tt && needle) score = tt === needle ? 3 : tt.indexOf(needle) === 0 ? 2 : tt.indexOf(needle) !== -1 ? 1 : 0;
          if (score && score < 7 && isHeading(el)) score += 3;
          if (score > bestScore) { best = i2; bestScore = score; }
        }
        if (best === null) return fail('No paragraph matching "' + pos.after_heading + '" found');
        insertAt = best + 1;
      } else if (pos === 'start') {
        insertAt = 0;
      } else if (pos === 'end') {
        // before a trailing empty paragraph, if there is one
        insertAt = count > 0 && isEmptyParagraph(doc.GetElement(count - 1)) ? count - 1 : count;
        if (count === 1 && isEmptyParagraph(doc.GetElement(0))) { insertAt = 0; dropEmpty = 0; }
      } else {
        // cursor: after the paragraph with the cursor; an empty paragraph there is replaced
        var cur = cursorIndex();
        if (cur >= 0 && cur < count && isEmptyParagraph(doc.GetElement(cur))) { insertAt = cur; dropEmpty = cur; }
        else insertAt = Math.min(count, cur + 1);
      }
      for (var k2 = 0; k2 < elements.length; k2++) doc.AddElement(insertAt + k2, elements[k2]);
      if (dropEmpty >= 0) { try { doc.RemoveElement(dropEmpty + elements.length); } catch (e) {} }
      var mi = convertMath();
      rememberTheme();
      return { ok: true, op: 'insert', first_index: insertAt, last_index: insertAt + elements.length - 1, count: elements.length, math: mi, warnings: warnings };
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e), warnings: warnings };
    }
  }

  /**
   * Full content of top-level elements from..to (for editing), or – with Asc.scope.req.check –
   * all elements with the information the worksheet check needs (pages, writing lines, tasks).
   */
  function cmdGetElements() {
    var req = Asc.scope.req || {};
    var doc = Api.GetDocument();
    var layout = null;
    var pageInfo = null;
    if (req.check) {
      try {
        var pages = doc.GetPageCount(); // recalculates the layout
        var sect = doc.GetFinalSection();
        var pm = sect.Section && sect.Section.PageMargins;
        pageInfo = { pages: pages, h: sect.GetPageHeight() / 1440 * 25.4, top: pm ? pm.Top : 20, bottom: pm ? pm.Bottom : 20 };
        layout = { pages: pages, last_page_fill: null };
      } catch (e) {}
    }
    var count = doc.GetElementsCount();
    var from = req.check ? 0 : Math.max(0, Number(req.from) || 0);
    var to = req.check ? count - 1 : Math.min(count - 1, req.to == null ? from : Number(req.to));
    var limit = req.check ? 600 : 60;
    var out = [];
    var lastBottom = 0;
    function textOf(el) {
      // Paragraphs end with "\r\n", paragraphs in table cells additionally with "\t".
      try { return String(el.GetText ? el.GetText() : '').replace(/[\r\n\t]+$/, ''); } catch (e) { return ''; }
    }
    function describe(d0) {
      var desc = null;
      try { desc = d0.GetDescription ? d0.GetDescription() : null; } catch (e) {}
      if (!desc) {
        try { var pd = d0.getParaDrawing ? d0.getParaDrawing() : (d0.Drawing && d0.Drawing.parent); desc = pd && pd.docPr ? pd.docPr.descr : null; } catch (e) {}
      }
      return desc ? String(desc) : null;
    }
    function marker(text, m) {
      var k = text ? text.indexOf(m) : -1;
      if (k === -1) return null;
      try { return JSON.parse(text.slice(k + m.length)); } catch (e) { return null; }
    }
    function format(el) {
      try {
        var r0 = el.GetElement ? el.GetElement(0) : null;
        if (!r0 || !r0.GetTextPr) return null;
        var tp = r0.GetTextPr();
        var f = {};
        try { f.font = tp.GetFontFamily ? tp.GetFontFamily() : undefined; } catch (e) {}
        try { var sz = tp.GetFontSize ? tp.GetFontSize() : null; if (sz) f.size = sz / 2; } catch (e) {}
        try { f.bold = tp.GetBold ? !!tp.GetBold() : undefined; } catch (e) {}
        return f;
      } catch (e) { return null; }
    }
    for (var i = from; i <= to && out.length < limit; i++) {
      var el = doc.GetElement(i);
      if (!el) continue;
      var type = el.GetClassType ? el.GetClassType() : 'unknown';
      var item = { index: i, type: type };
      if (type === 'paragraph') {
        item.text = textOf(el).slice(0, req.check ? 2000 : 4000);
        try { var st = el.GetStyle(); item.style = st ? st.GetName() : ''; } catch (e) {}
        var m = /^(heading|überschrift|title|titel)\s*(\d*)/i.exec(item.style || '');
        if (m) { item.is_heading = true; item.heading_level = m[2] ? parseInt(m[2], 10) : 1; }
        try { item.list_item = !!(el.GetNumbering && el.GetNumbering()); } catch (e) {}
        try {
          var ds = el.GetAllDrawingObjects ? el.GetAllDrawingObjects() : [];
          if (ds.length) {
            item.has_image = true;
            for (var d = 0; d < ds.length; d++) {
              var desc = describe(ds[d]);
              if (!desc) continue;
              if (/^\s*X:\s*\d+/.test(desc)) { item.abc = desc; break; }
              var task = marker(desc, 'WSTASK ');
              if (task) { item.task = task; continue; }
              var g = marker(desc, 'WSGRAPHIC ');
              if (g) { item.graphic = g; if (!req.check && g.svg && g.svg.length > 3000) g.svg = g.svg.slice(0, 3000) + '…'; }
            }
          }
        } catch (e) {}
        if (!item.text && !item.has_image) {
          item.empty = true;
          try { var brd = el.Paragraph && el.Paragraph.Pr && el.Paragraph.Pr.Brd; if (brd && brd.Bottom && brd.Bottom.Value === 1) item.line = true; } catch (e) {}
        }
        if (!req.check) { var fmt = format(el); if (fmt) item.format = fmt; }
      } else if (type === 'table') {
        var rows = [];
        var maxRows = req.check ? 30 : 40;
        try {
          var rc = el.GetRowsCount();
          for (var r = 0; r < rc && r < maxRows; r++) {
            var row = el.GetRow(r);
            var cells = [];
            var cc = row.GetCellsCount();
            for (var c = 0; c < cc && c < 12; c++) {
              var content = row.GetCell(c).GetContent();
              var parts = [];
              for (var e2 = 0; e2 < content.GetElementsCount(); e2++) {
                var ce = content.GetElement(e2);
                parts.push(textOf(ce));
                if (req.check && !item.task) {
                  try {
                    var cds = ce.GetAllDrawingObjects ? ce.GetAllDrawingObjects() : [];
                    for (var q = 0; q < cds.length; q++) { var g2 = marker(describe(cds[q]), 'WSGRAPHIC '); if (g2 && !item.graphic) item.graphic = g2; }
                  } catch (e) {}
                }
              }
              cells.push(parts.join('\n').slice(0, 500));
            }
            rows.push(cells);
          }
        } catch (e) {}
        item.rows = rows;
        if (req.check) item.text = rows.map(function (rw) { return rw.join(' | '); }).join(' | ').slice(0, 3000);
        try { var bl = marker(el.GetTableDescription ? el.GetTableDescription() : '', 'WSBLOCK '); if (bl) item.block = bl.type; if (bl && !req.check) item.block_info = bl; } catch (e) {}
      } else {
        item.text = textOf(el).slice(0, 4000);
      }
      if (pageInfo) {
        try {
          var o = el.Paragraph || el.Table;
          var n = o.Pages ? o.Pages.length : 1;
          // A paragraph moved to the next page ("keep with next") keeps an empty segment on the
          // previous page (EndLine < FirstLine) – only segments with lines count.
          var firstSeg = 0;
          var lastSeg = n - 1;
          if (el.Paragraph && o.Pages) {
            while (firstSeg < n - 1 && o.Pages[firstSeg].EndLine < o.Pages[firstSeg].FirstLine) firstSeg++;
            while (lastSeg > firstSeg && o.Pages[lastSeg].EndLine < o.Pages[lastSeg].FirstLine) lastSeg--;
          }
          item.page_start = o.GetAbsolutePage(firstSeg) + 1;
          item.page_end = o.GetAbsolutePage(lastSeg) + 1;
          if (item.page_end === pageInfo.pages) {
            var bnd = o.GetPageBounds(lastSeg);
            if (bnd && bnd.Bottom > lastBottom) lastBottom = bnd.Bottom;
          }
        } catch (e) {}
      }
      out.push(item);
    }
    if (layout && pageInfo) {
      var area = pageInfo.h - pageInfo.top - pageInfo.bottom;
      if (lastBottom && area > 0) layout.last_page_fill = Math.max(0, Math.min(1, Math.round((lastBottom - pageInfo.top) / area * 100) / 100));
    }
    var res = { total_elements: count, elements: out };
    if (layout) res.layout = layout;
    return res;
  }

  /** Theme, language and text width of the document (for laying out new content). */
  function cmdDocInfo() {
    var doc = Api.GetDocument();
    var res = { theme: null, lang: null, textWidthMm: 170, pageHeightMm: 297, empty: false, count: 0 };
    try {
      var props = doc.GetCustomProperties();
      res.theme = props.Get('WorksheetTheme') || null;
      res.lang = props.Get('WorksheetLanguage') || null;
    } catch (e) {}
    try {
      var s = doc.GetFinalSection();
      var w = s.GetPageWidth() / 1440 * 25.4;
      var pm = s.Section && s.Section.PageMargins;
      res.pageWidthMm = Math.round(w * 10) / 10;
      res.pageHeightMm = Math.round(s.GetPageHeight() / 1440 * 254) / 10;
      if (pm) res.textWidthMm = Math.round((w - pm.Left - pm.Right) * 10) / 10;
      try { if (s.Section.Columns && s.Section.Columns.Num > 1) res.textWidthMm = Math.round((res.textWidthMm - (s.Section.Columns.Num - 1) * (s.Section.Columns.Space || 10)) / s.Section.Columns.Num * 10) / 10; } catch (e) {}
    } catch (e) {}
    try {
      var count = doc.GetElementsCount();
      res.count = count;
      var empty = true;
      for (var i = 0; i < count && empty; i++) {
        var el = doc.GetElement(i);
        if (el.GetClassType() !== 'paragraph') { empty = false; break; }
        if (String(el.GetText() || '').replace(/\s+/g, '')) empty = false;
        else if (el.GetAllDrawingObjects && el.GetAllDrawingObjects().length) empty = false;
      }
      res.empty = empty;
    } catch (e) {}
    return res;
  }
  /* eslint-enable no-undef */

  // ---------------------------------------------------------------------------
  // Plugin-side helpers
  // ---------------------------------------------------------------------------

  function docInfo() {
    return window.MusicEditor.callCommand(cmdDocInfo, {}, false).then(function (r) {
      return r || { theme: null, lang: null, textWidthMm: 170, empty: false };
    }, function () {
      return { theme: null, lang: null, textWidthMm: 170, empty: false };
    });
  }

  /**
   * Theme for new content: the requested one, else the document's, else the user's default for
   * empty documents and "document" (follow the existing styles) for documents with content.
   */
  function resolveTheme(requested, info, settings) {
    var T = window.WorksheetThemes;
    if (requested && T.isThemeId(requested)) return requested;
    if (info && info.theme && T.isThemeId(info.theme)) return info.theme;
    if (info && info.empty) return settings.theme && T.isThemeId(settings.theme) ? settings.theme : 'modern';
    return 'document';
  }

  function rasterSvg(img, dpi) {
    return window.MusicRenderer.rasterizeSvg(img.svg, img.widthMm, img.heightMm, dpi).then(function (dataUrl) {
      img.dataUrl = dataUrl;
      img.wEmu = Math.round(img.widthMm * EMU_PER_MM);
      img.hEmu = Math.round(img.heightMm * EMU_PER_MM);
    });
  }

  function rasterStaff(img, settings) {
    var abc;
    if (img.kind === 'staff') {
      var v = window.MusicAbc.validateAbc(img.abc, { requireClef: true });
      if (!v.valid) return Promise.reject(new Error('Invalid ABC: ' + window.MusicAbc.formatValidationErrors(v)));
      abc = v.normalized;
    } else {
      abc = window.MusicAbc.emptyStavesAbc({ clef: img.clef, count: img.count, measures: img.measures });
    }
    return window.MusicRenderer.renderPng(abc, { widthCm: img.widthCm || settings.widthCm, dpi: settings.dpi }).then(function (r) {
      img.abc = abc;
      img.alt = abc;
      img.dataUrl = r.dataUrl;
      img.wEmu = Math.round(r.widthMm * EMU_PER_MM);
      img.hEmu = Math.round(r.heightMm * EMU_PER_MM);
      img.widthMm = r.widthMm;
      img.heightMm = r.heightMm;
    });
  }

  /** Rasterise all images of the layout elements (SVG graphics and music staves). */
  function rasterize(elements, settings) {
    var imgs = window.WorksheetLayout.collectImages(elements);
    // Sequential: abcjs renders into one shared sandbox element.
    return imgs.reduce(function (p, img) {
      return p.then(function () {
        if (img.dataUrl) return null;
        if (img.kind === 'staff' || img.kind === 'empty_staves') return rasterStaff(img, settings);
        if (img.svg) return rasterSvg(img, settings.dpi);
        return null;
      });
    }, Promise.resolve()).then(function () { return elements; });
  }

  /**
   * Blocks from the AI -> layout elements with rasterised images.
   * opts: { theme, lang } (requested by the AI, optional). Resolves { elements, theme, lang, warnings }.
   */
  function prepare(blocks, settings, opts) {
    opts = opts || {};
    return docInfo().then(function (info) {
      var theme = resolveTheme(opts.theme, info, settings);
      var lang = opts.lang || info.lang || 'de';
      var themeSpec = theme;
      if (settings.font && theme !== 'document') {
        // the user's own font (house style) instead of the theme's
        themeSpec = {};
        var base = window.WorksheetThemes.getTheme(theme);
        Object.keys(base).forEach(function (k) { themeSpec[k] = base[k]; });
        themeSpec.font = settings.font;
        themeSpec.headingFont = settings.font;
      }
      var composed = window.WorksheetLayout.compose(blocks, {
        theme: themeSpec, lang: lang, textWidthMm: info.textWidthMm, staffWidthCm: settings.widthCm,
        taskStart: opts.taskStart
      });
      return rasterize(composed.elements, settings).then(function (els) {
        return {
          elements: els, theme: theme, lang: lang, warnings: composed.warnings, textWidthMm: info.textWidthMm,
          // remember the theme in the document when it was chosen now (new worksheet or explicit request)
          storeTheme: opts.theme || !info.theme ? theme : null,
          storeLang: opts.lang || (!info.lang && info.empty) ? lang : null
        };
      });
    });
  }

  function token() {
    return (Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)).slice(-10);
  }

  /** Run an insert/replace/delete with prepared layout elements. */
  function editBlocks(req) {
    var copy = {};
    Object.keys(req).forEach(function (k) { copy[k] = req[k]; });
    copy.token = token();
    return window.MusicEditor.callCommand(cmdBuild, { req: copy }, true).then(function (r) {
      return r || { ok: false, error: 'no answer from the editor' };
    });
  }

  function getElements(from, to) {
    return window.MusicEditor.callCommand(cmdGetElements, { req: { from: from, to: to } }, false);
  }

  /** All elements with page information, for WorksheetCheck. */
  function checkData() {
    return window.MusicEditor.callCommand(cmdGetElements, { req: { check: true } }, false);
  }

  // --- page setup ------------------------------------------------------------
  var PAPER = { A4: [210, 297], A5: [148, 210], letter: [215.9, 279.4] };
  function twips(mm) { return Math.round(mm * 1440 / 25.4); }

  function loadImageSize(dataUrl) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
      img.onerror = function () { resolve(null); };
      img.src = dataUrl;
    });
  }

  /** Split "Seite {page} von {pages}" into text and page-number runs. */
  function fieldRuns(text, base) {
    var out = [];
    String(text || '').split(/(\{page\}|\{pages\})/).forEach(function (part) {
      if (!part) return;
      if (part === '{page}') out.push({ pageNum: true });
      else if (part === '{pages}') out.push({ pagesCount: true });
      else window.WorksheetLayout.textRuns(part, base).forEach(function (r) { out.push(r); });
    });
    return out;
  }

  /**
   * setup_page: paper, orientation, margins, columns, header/footer (with the school name and logo
   * from the settings), theme. args are validated by the proxy.
   */
  function setupPage(args, settings) {
    var T = window.WorksheetThemes;
    return docInfo().then(function (info) {
      var theme = T.getTheme(resolveTheme(args.theme, info, settings));
      var L = T.labels(args.lang || info.lang || 'de');
      var paper = PAPER[args.paper] || null;
      var landscape = args.orientation === 'landscape';
      var page = {};
      var pageW = info.pageWidthMm || 210;
      if (paper || args.orientation) {
        var size = paper || [Math.min(info.pageWidthMm || 210, info.pageHeightMm || 297), Math.max(info.pageWidthMm || 210, info.pageHeightMm || 297)];
        var w = landscape ? size[1] : size[0];
        var h = landscape ? size[0] : size[1];
        page.width = twips(w);
        page.height = twips(h);
        page.portrait = !landscape;
        pageW = w;
      }
      var marginMm = null;
      if (args.margins_cm != null) {
        marginMm = Math.min(40, Math.max(5, Number(args.margins_cm) * 10));
        var m = twips(marginMm);
        page.margins = { left: m, right: m, top: m, bottom: m };
      }
      if (args.columns) page.columns = Math.min(3, Math.max(1, Math.round(args.columns)));
      var textW = pageW - (marginMm != null ? 2 * marginMm : (info.pageWidthMm ? info.pageWidthMm - info.textWidthMm : 40));
      var small = { font: (theme.id !== 'document' && settings.font) || theme.font, size: theme.sizes.small || 9, color: theme.colors.muted };
      var tabs = [{ pos: twips(textW / 2), type: 'center' }, { pos: twips(textW), type: 'right' }];
      var req = { op: 'setup_page', page: page, theme: args.theme || (info.theme ? null : theme.id), lang: args.lang || null };
      var logoPromise = args.logo && settings.logo ? loadImageSize(settings.logo) : Promise.resolve(null);
      return logoPromise.then(function (logoSize) {
        function threeParts(spec, withLogo) {
          var runs = [];
          if (withLogo && logoSize) {
            var hMm = 11;
            var wMm = Math.min(45, hMm * logoSize.w / logoSize.h);
            runs.push({ image: { dataUrl: settings.logo, wEmu: Math.round(wMm * EMU_PER_MM), hEmu: Math.round(hMm * EMU_PER_MM), alt: 'Logo' } });
            runs.push({ text: '  ' });
          }
          fieldRuns(spec.left, small).forEach(function (r) { runs.push(r); });
          if (spec.center || spec.right) { runs.push({ tab: true }); fieldRuns(spec.center, small).forEach(function (r) { runs.push(r); }); }
          if (spec.right) { runs.push({ tab: true }); fieldRuns(spec.right, small).forEach(function (r) { runs.push(r); }); }
          return runs;
        }
        if (args.header) {
          var hs = { left: args.header.left, center: args.header.center, right: args.header.right };
          if (args.header.school !== false && settings.school && !hs.left) hs.left = settings.school;
          req.header = [{ t: 'p', runs: threeParts(hs, args.logo), tabs: tabs, after: 0, borders: args.header.line === false ? undefined : { bottom: { size: 4, color: theme.colors.border || '#999999', space: 3 } } }];
        }
        if (args.footer || args.page_numbers) {
          var fs = args.footer ? { left: args.footer.left, center: args.footer.center, right: args.footer.right } : {};
          if (args.page_numbers && !/\{page\}/.test([fs.left, fs.center, fs.right].join(' '))) {
            var pn = L.page + ' {page} ' + L.of + ' {pages}';
            if (!fs.right) fs.right = pn; else if (!fs.center) fs.center = pn; else fs.left = pn;
          }
          req.footer = [{ t: 'p', runs: threeParts(fs, false), tabs: tabs, after: 0 }];
        }
        return window.MusicEditor.callCommand(cmdBuild, { req: req }, true).then(function (r) {
          return r || { ok: false, error: 'no answer from the editor' };
        });
      });
    });
  }

  // --- preview -----------------------------------------------------------------
  function css(el, styles) { Object.keys(styles).forEach(function (k) { if (styles[k] != null) el.style[k] = styles[k]; }); }

  function borderCss(b) { return b ? Math.max(0.5, b.size / 8) + 'pt solid ' + (b.color || '#000') : 'none'; }

  function previewRuns(target, runs) {
    (runs || []).forEach(function (r) {
      if (r.br) { target.appendChild(document.createElement('br')); return; }
      if (r.tab) { var sp = document.createElement('span'); sp.style.display = 'inline-block'; sp.style.minWidth = '2em'; target.appendChild(sp); return; }
      if (r.pageNum || r.pagesCount) { target.appendChild(document.createTextNode('1')); return; }
      if (r.image) {
        if (!r.image.dataUrl) return;
        var img = document.createElement('img');
        img.src = r.image.dataUrl;
        img.alt = '';
        css(img, { width: (r.image.widthMm || r.image.wEmu / EMU_PER_MM) + 'mm', height: 'auto', verticalAlign: 'middle', display: 'inline' });
        target.appendChild(img);
        return;
      }
      var node = document.createElement('span');
      node.textContent = r.math ? r.math : r.text;
      css(node, {
        fontWeight: r.b ? 'bold' : null, fontStyle: r.i ? 'italic' : null, textDecoration: r.u ? 'underline' : null,
        color: r.color || null, fontSize: r.size ? r.size + 'pt' : null, fontFamily: r.font ? "'" + r.font + "', sans-serif" : null
      });
      if (r.math) { node.style.fontFamily = 'serif'; node.style.fontStyle = 'italic'; }
      target.appendChild(node);
    });
  }

  function previewElement(e, lists) {
    if (e.t === 'table') {
      var table = document.createElement('table');
      css(table, { width: '100%', borderCollapse: 'collapse', tableLayout: e.widths ? 'fixed' : null, margin: '0' });
      var b = e.borders || {};
      (e.rows || []).forEach(function (row) {
        var tr = document.createElement('tr');
        if (row.height) tr.style.height = (row.height / 1440 * 25.4) + 'mm';
        (row.cells || []).forEach(function (cl, ci) {
          var td = document.createElement('td');
          var cb = cl.borders || {};
          css(td, {
            background: cl.shd || null, verticalAlign: cl.valign === 'center' ? 'middle' : cl.valign || 'top',
            borderTop: borderCss('top' in cb ? cb.top : b.insideH !== undefined ? (b.insideH || b.top) : b.top),
            borderBottom: borderCss('bottom' in cb ? cb.bottom : b.insideH || b.bottom),
            borderLeft: borderCss('left' in cb ? cb.left : ci === 0 ? b.left : b.insideV),
            borderRight: borderCss('right' in cb ? cb.right : ci === row.cells.length - 1 ? b.right : b.insideV),
            padding: e.cellMargins ? ((e.cellMargins.top || 0) / 20) + 'pt ' + ((e.cellMargins.right || 0) / 20) + 'pt ' + ((e.cellMargins.bottom || 0) / 20) + 'pt ' + ((e.cellMargins.left || 0) / 20) + 'pt' : '2pt 4pt',
            width: e.widths && e.widths[ci] != null ? e.widths[ci] + '%' : null
          });
          (cl.content || []).forEach(function (sub) { td.appendChild(previewElement(sub, lists)); });
          tr.appendChild(td);
        });
        table.appendChild(tr);
      });
      return table;
    }
    var p = document.createElement('p');
    css(p, {
      margin: '0', textAlign: e.jc === 'both' ? 'justify' : e.jc || null,
      paddingTop: e.before ? (e.before / 20) + 'pt' : null, paddingBottom: e.after ? (e.after / 20) + 'pt' : null,
      paddingLeft: e.indLeft ? (e.indLeft / 1440 * 25.4) + 'mm' : null, background: e.shd || null,
      borderBottom: e.borders && e.borders.bottom ? borderCss(e.borders.bottom) : null,
      lineHeight: e.line && e.line.rule === 'auto' ? String(e.line.value * 1.2) : null,
      minHeight: e.line && e.line.rule === 'exact' ? (e.line.value / 1440 * 25.4) + 'mm' : '1em'
    });
    if (e.line && e.line.rule === 'exact') p.style.height = (e.line.value / 1440 * 25.4) + 'mm';
    if (e.numbering) {
      lists[e.numbering.ref] = (lists[e.numbering.ref] || 0) + 1;
      var n = lists[e.numbering.ref];
      var bullet = e.numbering.type === 'numbered' ? n + '.' : e.numbering.type === 'letters' ? String.fromCharCode(96 + n) + ')' : e.numbering.type === 'checkbox' ? '\u2610' : '\u2022';
      var bs = document.createElement('span');
      bs.textContent = bullet;
      css(bs, { display: 'inline-block', width: '1.6em', marginLeft: '0.6em' });
      p.appendChild(bs);
    }
    previewRuns(p, e.runs);
    if (e.pageBreak) {
      var pb = document.createElement('div');
      pb.className = 'page-break';
      pb.textContent = '— Seitenumbruch —';
      return pb;
    }
    return p;
  }

  /**
   * HTML preview of layout elements, scaled to the panel: the page text width is drawn at its real
   * size in mm and zoomed down (DOM built with textContent, no HTML from the model).
   */
  function renderPreview(elements, opts) {
    opts = opts || {};
    var root = document.createElement('div');
    root.className = 'blocks-preview';
    var page = document.createElement('div');
    page.className = 'page';
    var widthMm = opts.textWidthMm || 170;
    css(page, { width: widthMm + 'mm', fontFamily: "'Open Sans', 'DejaVu Sans', Arial, sans-serif", fontSize: '11pt', color: '#111' });
    var lists = {};
    (elements || []).forEach(function (e) { page.appendChild(previewElement(e, lists)); });
    root.appendChild(page);
    // zoom the page to the available width once it is in the DOM
    setTimeout(function () {
      var avail = root.clientWidth || 260;
      var px = widthMm / 25.4 * 96;
      page.style.zoom = String(Math.min(1, avail / px));
    }, 0);
    return root;
  }

  window.WorksheetDoc = {
    prepare: prepare,
    rasterize: rasterize,
    resolveTheme: resolveTheme,
    docInfo: docInfo,
    editBlocks: editBlocks,
    getElements: getElements,
    checkData: checkData,
    setupPage: setupPage,
    renderPreview: renderPreview,
    _commands: { build: cmdBuild, getElements: cmdGetElements, docInfo: cmdDocInfo }
  };
})(window);
