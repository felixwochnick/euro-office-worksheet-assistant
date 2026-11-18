/*
 * Worksheet building blocks: insert, replace and delete document content
 * (headings, paragraphs, lists, tables, writing lines, boxes, staves, page breaks).
 *
 * Block format (also used by the AI tools insert_blocks / replace_elements):
 *   { type: 'heading',   text, level: 1|2|3 }
 *   { type: 'paragraph', text, align?: 'left'|'center'|'right'|'justify' }
 *   { type: 'list',      items: string[], ordered?: boolean }
 *   { type: 'table',     rows: string[][], header?: boolean }
 *   { type: 'lines',     count: 1..20, label?: string }         writing lines
 *   { type: 'box',       text, title?: string }                  framed info box ("Merke")
 *   { type: 'staff',     abc, width_cm? }                        music staff (image, ABC as alt text)
 *   { type: 'empty_staves', clef, count, measures? }             empty staves to write in
 *   { type: 'page_break' }
 *   { type: 'spacer',    lines?: 1..10 }
 * Text supports **bold**, *italic*, __underline__ and "\n" for a line break.
 *
 * All functions passed to callCommand are self-contained (they run inside the editor).
 */
(function (window) {
  'use strict';

  // Inline markup. "__text__" (underline) must not touch further underscores: cloze gaps are written as
  // "________", and the text between two gaps must not become underlined.
  var INLINE_SPLIT = /(\*\*[^*]+\*\*|(?<!_)__(?=[^_\s])[^_]*[^_\s]__(?!_)|\*[^*\s][^*]*\*)/;
  var UNDERLINE = /^__[^_\s]([^_]*[^_\s])?__$/;

  var EMU_PER_MM = 36000;

  /* eslint-disable no-undef */
  /**
   * One editor command for all block operations:
   *   { op: 'insert',  position, blocks }
   *   { op: 'replace', from, to, blocks }
   *   { op: 'delete',  from, to }
   * Staff blocks arrive with a prepared image: block.image = { dataUrl, wEmu, hEmu, alt }.
   */
  function cmdEditBlocks() {
    // Runs inside the editor (callCommand serialises this function): no access to variables outside it.
    var INLINE_SPLIT = /(\*\*[^*]+\*\*|(?<!_)__(?=[^_\s])[^_]*[^_\s]__(?!_)|\*[^*\s][^*]*\*)/;
    var UNDERLINE = /^__[^_\s]([^_]*[^_\s])?__$/;
    var req = Asc.scope.req;
    var doc = Api.GetDocument();
    var count = doc.GetElementsCount();

    function fail(msg) { return { ok: false, fatal: true, error: msg }; }
    function norm(s) {
      return String(s || '').toLowerCase().replace(/[\s\u00a0]+/g, ' ').replace(/[\s:.\-–—)]+$/, '').trim();
    }
    function textOf(el) {
      try { return String(el.GetText ? el.GetText() : '').replace(/[\r\n]+$/, ''); } catch (e) { return ''; }
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

    // --- inline text: **bold**, *italic*, __underline__, \n -------------------
    function addInline(par, text) {
      var lines = String(text == null ? '' : text).split('\n');
      // A new run inherits the formatting of the previous one. Set a property only when
      // it changes – setting "not bold" everywhere would override bold heading styles.
      var prev = { b: false, i: false, u: false };
      for (var li = 0; li < lines.length; li++) {
        if (li > 0) { try { par.AddLineBreak(); } catch (e) {} }
        var parts = lines[li].split(INLINE_SPLIT);
        for (var k = 0; k < parts.length; k++) {
          var part = parts[k];
          if (!part) continue;
          var f = { b: false, i: false, u: false };
          if (/^\*\*[^*]+\*\*$/.test(part)) { f.b = true; part = part.slice(2, -2); }
          else if (UNDERLINE.test(part)) { f.u = true; part = part.slice(2, -2); }
          else if (/^\*[^*\s][^*]*\*$/.test(part)) { f.i = true; part = part.slice(1, -1); }
          var run = par.AddText(part);
          try {
            if (f.b !== prev.b) run.SetBold(f.b);
            if (f.i !== prev.i) run.SetItalic(f.i);
            if (f.u !== prev.u) run.SetUnderline(f.u);
          } catch (e) {}
          prev = f;
        }
      }
    }
    function newPara(text, styleName) {
      var p = Api.CreateParagraph();
      if (styleName) { var st = style(styleName); if (st) { try { p.SetStyle(st); } catch (e) {} } }
      if (text != null && text !== '') addInline(p, text);
      return p;
    }
    function setAlt(drawing, alt) {
      try { if (drawing.SetDescription && drawing.SetDescription(alt)) { try { drawing.SetTitle('ABC-Notation'); } catch (e) {} return true; } } catch (e) {}
      try {
        var pd = drawing.getParaDrawing ? drawing.getParaDrawing() : (drawing.Drawing && drawing.Drawing.parent);
        if (pd && pd.docPr && pd.docPr.setDescr) { pd.docPr.setDescr(alt); try { pd.docPr.setTitle('ABC-Notation'); } catch (e) {} return true; }
      } catch (e) {}
      return false;
    }
    function borderAll(table, type, size, r, g, b) {
      ['Top', 'Bottom', 'Left', 'Right'].forEach(function (s) {
        try { table['SetTableBorder' + s](type, size, 0, r, g, b); } catch (e) {}
      });
    }

    // --- table widths ------------------------------------------------------------
    // A table with only a percentage width (tblW type="pct") and automatic cell widths is stretched by Word, but
    // Google Docs and Apple Pages follow the grid (w:gridCol) and cell widths (w:tcW) and shrink the table to its
    // content. So every table gets an absolute width in twips, a fixed layout and explicit, equal cell widths.
    var TEXT_WIDTH_FALLBACK = 9070; // 16 cm: A4 with common margins
    var textWidthCache = null;
    function textWidth() {
      if (textWidthCache) return textWidthCache;
      var w = 0;
      try {
        var sec = doc.GetFinalSection();
        // Public getters (twips) in newer editor versions ...
        if (sec.GetPageWidth && sec.GetPageMarginLeft && sec.GetPageMarginRight) {
          w = sec.GetPageWidth() - sec.GetPageMarginLeft() - sec.GetPageMarginRight();
        }
        // ... otherwise the internal section properties (millimetres).
        if (!(w > 0) && sec.Section && sec.Section.GetPageWidth) {
          var s = sec.Section;
          w = Math.round((s.GetPageWidth() - s.GetPageMarginLeft() - s.GetPageMarginRight()) * 1440 / 25.4);
        }
      } catch (e) { w = 0; }
      textWidthCache = w > 1440 && w < 31680 ? Math.round(w) : TEXT_WIDTH_FALLBACK; // 1 in .. 22 in
      return textWidthCache;
    }
    function setTableWidths(table, rowCount, cols) {
      var total = textWidth();
      var colW = Math.floor(total / cols);
      try { table.SetWidth('twips', total); } catch (e) {}
      try { table.SetTableLayout('fixed'); } catch (e) {}
      for (var r = 0; r < rowCount; r++) {
        for (var c = 0; c < cols; c++) {
          try { table.GetRow(r).GetCell(c).SetWidth('twips', colW); } catch (e) {}
        }
      }
      // The grid (w:tblGrid) is not derived from the cell widths: Api.CreateTable starts with a default grid.
      // Set it on the underlying table so the exported w:gridCol values match the cell widths.
      try {
        var t = table.Table;
        if (t && t.SetTableGrid) {
          var grid = [];
          for (var g = 0; g < cols; g++) grid.push(colW * 25.4 / 1440); // millimetres
          t.SetTableGrid(grid);
        }
      } catch (e) {}
    }

    // --- block -> document elements ---------------------------------------------
    function build(block) {
      var out = [];
      var t = block.type;
      if (t === 'heading') {
        var lvl = Math.min(3, Math.max(1, Number(block.level) || 2));
        var hp = newPara(block.text, 'Heading ' + lvl);
        // Documents without heading styles: bold, larger text instead (untested fallback).
        if (!style('Heading ' + lvl)) { try { hp.SetBold(true); hp.SetFontSize([32, 28, 24][lvl - 1]); } catch (e) {} }
        out.push(hp);
      } else if (t === 'paragraph') {
        var p = newPara(block.text);
        if (block.align && /^(left|center|right|both|justify)$/.test(block.align)) {
          try { p.SetJc(block.align === 'justify' ? 'both' : block.align); } catch (e) {}
        }
        out.push(p);
      } else if (t === 'list') {
        // A new numbering per list, so every numbered list starts at 1.
        var numbering = null;
        try { numbering = doc.CreateNumbering(block.ordered ? 'numbered' : 'bullet'); } catch (e) {}
        (block.items || []).forEach(function (item) {
          var lp = newPara(item, 'List Paragraph');
          if (numbering) { try { lp.SetNumbering(numbering.GetLevel(0)); } catch (e) {} }
          out.push(lp);
        });
      } else if (t === 'table') {
        var rows = block.rows || [];
        var cols = rows.reduce(function (m, r) { return Math.max(m, (r || []).length); }, 1);
        var table = Api.CreateTable(cols, rows.length || 1);
        setTableWidths(table, rows.length || 1, cols);
        var grid = style('Table Grid');
        if (grid) { try { table.SetStyle(grid); } catch (e) {} } else { borderAll(table, 'single', 4, 0, 0, 0); }
        var header = block.header !== false && rows.length > 1;
        for (var r = 0; r < rows.length; r++) {
          for (var c = 0; c < cols; c++) {
            var cell = table.GetRow(r).GetCell(c);
            var cp = cell.GetContent().GetElement(0);
            var txt = (rows[r] || [])[c];
            if (txt != null && txt !== '') addInline(cp, header && r === 0 ? '**' + String(txt).replace(/\*\*/g, '') + '**' : txt);
            try { cp.SetSpacingBefore(40); cp.SetSpacingAfter(40); } catch (e) {}
            if (header && r === 0) { try { cell.SetShd('clear', 235, 237, 245, false); } catch (e) {} }
          }
        }
        out.push(table);
      } else if (t === 'lines') {
        if (block.label) out.push(newPara(block.label));
        var n = Math.min(20, Math.max(1, Number(block.count) || 3));
        for (var i = 0; i < n; i++) {
          var lineP = Api.CreateParagraph();
          // Alternating border spacing keeps the editor from merging the lines into one bordered group.
          try { lineP.SetBottomBorder('single', 6, i % 2, 0, 0, 0); } catch (e) {}
          try { lineP.SetSpacingBefore(360); lineP.SetSpacingAfter(0); } catch (e) {}
          out.push(lineP);
        }
      } else if (t === 'box') {
        var box = Api.CreateTable(1, 1);
        setTableWidths(box, 1, 1);
        borderAll(box, 'single', 8, 79, 70, 229);
        var bc = box.GetRow(0).GetCell(0);
        try { bc.SetShd('clear', 238, 242, 255, false); } catch (e) {}
        var content = bc.GetContent();
        var first = content.GetElement(0);
        if (block.title) {
          addInline(first, '**' + String(block.title).replace(/\*\*/g, '') + '**');
          var bp = newPara(block.text);
          try { content.Push(bp); } catch (e) { addInline(first, '\n' + block.text); }
        } else {
          addInline(first, block.text);
        }
        out.push(box);
      } else if (t === 'staff' || t === 'empty_staves') {
        var im = block.image;
        if (!im || !im.dataUrl) throw new Error('staff image missing');
        var sp = Api.CreateParagraph();
        var img = Api.CreateImage(im.dataUrl, im.wEmu, im.hEmu);
        try { img.SetWrappingStyle('inline'); } catch (e) {}
        setAlt(img, im.alt);
        sp.AddDrawing(img);
        out.push(sp);
      } else if (t === 'page_break') {
        var pb = Api.CreateParagraph();
        pb.AddPageBreak();
        out.push(pb);
      } else if (t === 'spacer') {
        var m = Math.min(10, Math.max(1, Number(block.lines) || 1));
        for (var s = 0; s < m; s++) out.push(Api.CreateParagraph());
      } else {
        throw new Error('unknown block type "' + t + '"');
      }
      return out;
    }

    function buildAll(blocks) {
      var all = [];
      for (var b = 0; b < blocks.length; b++) {
        var els = build(blocks[b]);
        // Two tables directly after each other would merge into one (Word): separate them.
        var last = all[all.length - 1];
        if (last && els.length && last.GetClassType() === 'table' && els[0].GetClassType() === 'table') {
          all.push(Api.CreateParagraph());
        }
        all = all.concat(els);
      }
      return all;
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

    try {
      if (req.op === 'delete' || req.op === 'replace') {
        var from = Number(req.from);
        var to = req.to == null ? from : Number(req.to);
        if (!(from >= 0 && to >= from && to < count)) return fail('range ' + from + '..' + to + ' is out of range (0..' + (count - 1) + ')');
        var removed = [];
        for (var x = from; x <= to; x++) removed.push(textOf(doc.GetElement(x)).slice(0, 80));
        var els = req.op === 'replace' ? buildAll(req.blocks || []) : [];
        if (req.op === 'delete' && from === 0 && to === count - 1) els = [Api.CreateParagraph()]; // a document needs one element
        for (var a = 0; a < els.length; a++) doc.AddElement(to + 1 + a, els[a]);
        for (var d = to; d >= from; d--) doc.RemoveElement(d);
        return { ok: true, op: req.op, first_index: els.length ? from : null, last_index: els.length ? from + els.length - 1 : null, count: els.length, removed: removed };
      }

      // insert
      var elements = buildAll(req.blocks || []);
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
        var best = null;
        var bestScore = 0;
        for (var i2 = 0; i2 < count; i2++) {
          var el = doc.GetElement(i2);
          if (!el || !el.GetClassType || el.GetClassType() !== 'paragraph') continue;
          var tt = norm(textOf(el));
          if (!tt || !needle) continue;
          var score = tt === needle ? 3 : tt.indexOf(needle) === 0 ? 2 : tt.indexOf(needle) !== -1 ? 1 : 0;
          if (score && isHeading(el)) score += 3;
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
      return { ok: true, op: 'insert', first_index: insertAt, last_index: insertAt + elements.length - 1, count: elements.length };
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  }

  /** Full content of top-level elements from..to (for editing). */
  function cmdGetElements() {
    var req = Asc.scope.req;
    var doc = Api.GetDocument();
    var count = doc.GetElementsCount();
    var from = Math.max(0, Number(req.from) || 0);
    var to = Math.min(count - 1, req.to == null ? from : Number(req.to));
    var out = [];
    function textOf(el) {
      // Paragraphs end with "\r\n", paragraphs in table cells additionally with "\t".
      try { return String(el.GetText ? el.GetText() : '').replace(/[\r\n\t]+$/, ''); } catch (e) { return ''; }
    }
    for (var i = from; i <= to && out.length < 60; i++) {
      var el = doc.GetElement(i);
      if (!el) continue;
      var type = el.GetClassType ? el.GetClassType() : 'unknown';
      var item = { index: i, type: type };
      if (type === 'paragraph') {
        item.text = textOf(el).slice(0, 4000);
        try { var st = el.GetStyle(); item.style = st ? st.GetName() : ''; } catch (e) {}
        try { item.list_item = !!(el.GetNumbering && el.GetNumbering()); } catch (e) {}
        try {
          var ds = el.GetAllDrawingObjects ? el.GetAllDrawingObjects() : [];
          if (ds.length) {
            item.has_image = true;
            var d0 = ds[0];
            var desc = null;
            try { desc = d0.GetDescription ? d0.GetDescription() : null; } catch (e) {}
            if (!desc) {
              try { var pd = d0.getParaDrawing ? d0.getParaDrawing() : (d0.Drawing && d0.Drawing.parent); desc = pd && pd.docPr ? pd.docPr.descr : null; } catch (e) {}
            }
            if (desc && /^\s*X:\s*\d+/.test(desc)) item.abc = desc;
          }
        } catch (e) {}
      } else if (type === 'table') {
        var rows = [];
        try {
          var rc = el.GetRowsCount();
          for (var r = 0; r < rc && r < 40; r++) {
            var row = el.GetRow(r);
            var cells = [];
            var cc = row.GetCellsCount();
            for (var c = 0; c < cc && c < 12; c++) {
              var content = row.GetCell(c).GetContent();
              var parts = [];
              for (var e2 = 0; e2 < content.GetElementsCount(); e2++) parts.push(textOf(content.GetElement(e2)));
              cells.push(parts.join('\n').slice(0, 500));
            }
            rows.push(cells);
          }
        } catch (e) {}
        item.rows = rows;
      } else {
        item.text = textOf(el).slice(0, 4000);
      }
      out.push(item);
    }
    return { total_elements: count, elements: out };
  }
  /* eslint-enable no-undef */

  // ---------------------------------------------------------------------------
  // Plugin-side helpers
  // ---------------------------------------------------------------------------

  /** Render staff / empty_staves blocks to images (needs the browser: abcjs + canvas). */
  function prepareImages(blocks, settings) {
    var jobs = (blocks || []).map(function (block) {
      if (block.type !== 'staff' && block.type !== 'empty_staves') return Promise.resolve(block);
      var abc;
      if (block.type === 'staff') {
        var v = window.MusicAbc.validateAbc(block.abc, { requireClef: true });
        if (!v.valid) return Promise.reject(new Error('Invalid ABC: ' + window.MusicAbc.formatValidationErrors(v)));
        abc = v.normalized;
      } else {
        abc = window.MusicAbc.emptyStavesAbc({ clef: block.clef, count: block.count, measures: block.measures });
      }
      var widthCm = Number(block.width_cm) || settings.widthCm;
      return window.MusicRenderer.renderPng(abc, { widthCm: widthCm, dpi: settings.dpi }).then(function (r) {
        var copy = {};
        Object.keys(block).forEach(function (k) { copy[k] = block[k]; });
        copy.abc = abc;
        copy.image = {
          dataUrl: r.dataUrl,
          wEmu: Math.round(r.widthMm * EMU_PER_MM),
          hEmu: Math.round(r.heightMm * EMU_PER_MM),
          alt: abc
        };
        copy.previewSvg = r.svg;
        return copy;
      });
    });
    return Promise.all(jobs);
  }

  function stripPreview(blocks) {
    return blocks.map(function (b) {
      if (!b.previewSvg) return b;
      var c = {};
      Object.keys(b).forEach(function (k) { if (k !== 'previewSvg') c[k] = b[k]; });
      return c;
    });
  }

  function editBlocks(req) {
    var copy = {};
    Object.keys(req).forEach(function (k) { copy[k] = req[k]; });
    if (copy.blocks) copy.blocks = stripPreview(copy.blocks);
    return window.MusicEditor.callCommand(cmdEditBlocks, { req: copy }, true).then(function (r) {
      return r || { ok: false, error: 'no answer from the editor' };
    });
  }

  function getElements(from, to) {
    return window.MusicEditor.callCommand(cmdGetElements, { req: { from: from, to: to } }, false);
  }

  /** Append inline-formatted text (**bold**, *italic*, __underline__) to a DOM element – no innerHTML. */
  function appendInline(el, text) {
    String(text == null ? '' : text).split('\n').forEach(function (line, li) {
      if (li > 0) el.appendChild(document.createElement('br'));
      line.split(INLINE_SPLIT).forEach(function (part) {
        if (!part) return;
        var node;
        if (/^\*\*[^*]+\*\*$/.test(part)) { node = document.createElement('strong'); node.textContent = part.slice(2, -2); }
        else if (UNDERLINE.test(part)) { node = document.createElement('u'); node.textContent = part.slice(2, -2); }
        else if (/^\*[^*\s][^*]*\*$/.test(part)) { node = document.createElement('em'); node.textContent = part.slice(1, -1); }
        else node = document.createTextNode(part);
        el.appendChild(node);
      });
    });
  }

  /** Small HTML preview of blocks for the chat preview card. */
  function renderPreview(blocks) {
    var root = document.createElement('div');
    root.className = 'blocks-preview';
    (blocks || []).forEach(function (b) {
      var el;
      if (b.type === 'heading') {
        el = document.createElement('h' + Math.min(3, Math.max(1, Number(b.level) || 2) + 1));
        appendInline(el, b.text);
      } else if (b.type === 'paragraph') {
        el = document.createElement('p');
        if (b.align) el.style.textAlign = b.align === 'justify' ? 'justify' : b.align;
        appendInline(el, b.text);
      } else if (b.type === 'list') {
        el = document.createElement(b.ordered ? 'ol' : 'ul');
        (b.items || []).forEach(function (it) { var li = document.createElement('li'); appendInline(li, it); el.appendChild(li); });
      } else if (b.type === 'table') {
        el = document.createElement('table');
        (b.rows || []).forEach(function (row, r) {
          var tr = document.createElement('tr');
          (row || []).forEach(function (cell) {
            var td = document.createElement(b.header !== false && r === 0 ? 'th' : 'td');
            appendInline(td, cell);
            tr.appendChild(td);
          });
          el.appendChild(tr);
        });
      } else if (b.type === 'lines') {
        el = document.createElement('div');
        if (b.label) { var lp = document.createElement('p'); appendInline(lp, b.label); el.appendChild(lp); }
        for (var i = 0; i < Math.min(20, Number(b.count) || 3); i++) { var ln = document.createElement('div'); ln.className = 'write-line'; el.appendChild(ln); }
      } else if (b.type === 'box') {
        el = document.createElement('div');
        el.className = 'box';
        if (b.title) { var st = document.createElement('strong'); st.textContent = b.title; el.appendChild(st); el.appendChild(document.createElement('br')); }
        appendInline(el, b.text);
      } else if (b.type === 'staff' || b.type === 'empty_staves') {
        el = document.createElement('div');
        el.className = 'preview';
        if (b.image && b.image.dataUrl) { var img = document.createElement('img'); img.src = b.image.dataUrl; img.alt = 'staff'; el.appendChild(img); }
      } else if (b.type === 'page_break') {
        el = document.createElement('div');
        el.className = 'page-break';
        el.textContent = '— Seitenumbruch —';
      } else {
        el = document.createElement('div');
      }
      root.appendChild(el);
    });
    return root;
  }

  window.WorksheetDoc = {
    editBlocks: editBlocks,
    getElements: getElements,
    prepareImages: prepareImages,
    renderPreview: renderPreview,
    _commands: { editBlocks: cmdEditBlocks, getElements: cmdGetElements }
  };
})(window);
