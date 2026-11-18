/*
 * Bridge to the Euro-Office / ONLYOFFICE document editor.
 *
 * All functions passed to callCommand are serialised and executed inside the
 * editor, so they must be self-contained and receive data only via Asc.scope.
 *
 * Several builder methods are newer than some Euro-Office builds (e.g.
 * ApiDrawing.SetDescription since 10.0, ApiDocument.GetCurrentParagraph since
 * 9.0). Every such call is feature-detected and has a fallback; see README,
 * "Known limitations".
 */
(function (window) {
  'use strict';

  var queue = Promise.resolve();
  var COMMAND_TIMEOUT_MS = 30000;

  /** Run tasks strictly one after another – the plugin API is not re-entrant. */
  function enqueue(task) {
    var p = queue.then(task, task);
    queue = p.then(function () {}, function () {});
    return p;
  }

  function callCommand(fn, scope, recalc) {
    return enqueue(function () {
      return new Promise(function (resolve, reject) {
        var plugin = window.Asc && window.Asc.plugin;
        if (!plugin || typeof plugin.callCommand !== 'function') {
          reject(new Error('Editor API not available'));
          return;
        }
        window.Asc.scope = window.Asc.scope || {};
        Object.keys(scope || {}).forEach(function (k) { window.Asc.scope[k] = scope[k]; });
        var finished = false;
        var timer = setTimeout(function () {
          if (!finished) { finished = true; reject(new Error('Editor command timed out')); }
        }, COMMAND_TIMEOUT_MS);
        try {
          plugin.callCommand(fn, false, recalc !== false, function (result) {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            resolve(result);
          });
        } catch (e) {
          finished = true;
          clearTimeout(timer);
          reject(e);
        }
      });
    });
  }

  function executeMethod(name, params) {
    return enqueue(function () {
      return new Promise(function (resolve, reject) {
        var plugin = window.Asc && window.Asc.plugin;
        if (!plugin || typeof plugin.executeMethod !== 'function') {
          reject(new Error('Editor API not available'));
          return;
        }
        var finished = false;
        var timer = setTimeout(function () {
          if (!finished) { finished = true; reject(new Error('Editor method ' + name + ' timed out')); }
        }, COMMAND_TIMEOUT_MS);
        try {
          plugin.executeMethod(name, params || [], function (result) {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            resolve(result);
          });
        } catch (e) {
          finished = true;
          clearTimeout(timer);
          reject(e);
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Commands executed inside the editor (self-contained!)
  // ---------------------------------------------------------------------------

  /* eslint-disable no-undef */
  function cmdOutline() {
    var maxText = Asc.scope.maxText || 300;
    var maxElements = Asc.scope.maxElements || 300;
    var doc = Api.GetDocument();
    var count = doc.GetElementsCount();
    var res = { elements: [], total_elements: count, cursor_index: null, cursor_source: null, truncated: false };

    function textOf(el) {
      try { if (el.GetText) return String(el.GetText({ Numbering: true }) || ''); } catch (e) {}
      try { if (el.GetRange) { var r = el.GetRange(); if (r && r.GetText) return String(r.GetText() || ''); } } catch (e) {}
      return '';
    }
    function describe(drawing) {
      try { if (drawing.GetDescription) { var d = drawing.GetDescription(); if (d) return String(d); } } catch (e) {}
      try {
        var pd = drawing.getParaDrawing ? drawing.getParaDrawing() : (drawing.Drawing && drawing.Drawing.parent);
        if (pd && pd.docPr && pd.docPr.descr) return String(pd.docPr.descr);
      } catch (e) {}
      return null;
    }

    // --- cursor position (top-level element index) ---
    try {
      if (doc.GetCurrentParagraph) {
        var cp = doc.GetCurrentParagraph();
        if (cp && cp.GetPosInParent && cp.Paragraph && cp.Paragraph.GetParent && cp.Paragraph.GetParent() === doc.Document) {
          var pos = cp.GetPosInParent();
          if (pos >= 0) { res.cursor_index = pos; res.cursor_source = 'api'; }
        }
      }
    } catch (e) {}
    if (res.cursor_index === null) {
      try {
        var ld = doc.Document;
        if (ld && ld.CurPos && typeof ld.CurPos.ContentPos === 'number') {
          var idx = ld.CurPos.ContentPos;
          if (ld.IsSelectionUse && ld.IsSelectionUse() && ld.Selection) idx = Math.max(ld.Selection.StartPos, ld.Selection.EndPos);
          if (idx >= 0 && idx < count) { res.cursor_index = idx; res.cursor_source = 'internal'; }
        }
      } catch (e) {}
    }

    // --- elements (window around the cursor for very long documents) ---
    var from = 0;
    var to = count;
    if (count > maxElements) {
      res.truncated = true;
      var c = res.cursor_index === null ? 0 : res.cursor_index;
      from = Math.max(0, Math.min(c - Math.floor(maxElements / 2), count - maxElements));
      to = from + maxElements;
    }
    // Paragraph of a selected drawing (so the AI understands "die markierte Zeile").
    var selectedIndex = -1;
    try {
      var sel = doc.GetSelectedDrawings ? doc.GetSelectedDrawings() : [];
      var sp = sel && sel.length && sel[0].GetParentParagraph ? sel[0].GetParentParagraph() : null;
      if (sp && sp.GetPosInParent) selectedIndex = sp.GetPosInParent();
    } catch (e) {}

    // Staves (images with ABC alt text) are numbered in document order:
    // "Notenzeile 1" = first staff. Counted over the whole document, also
    // outside the element window.
    var staffNo = 0;
    for (var i = 0; i < count; i++) {
      var el = doc.GetElement(i);
      if (!el) continue;
      var type = el.GetClassType ? el.GetClassType() : 'unknown';
      var staffAbc = null;
      var imageCount = 0;
      if (type === 'paragraph') {
        try {
          var drawings = el.GetAllDrawingObjects ? el.GetAllDrawingObjects() : [];
          imageCount = drawings ? drawings.length : 0;
          for (var d = 0; d < imageCount; d++) {
            var desc = describe(drawings[d]);
            if (desc && /^\s*X:\s*\d+/.test(desc)) { staffAbc = desc; break; }
          }
        } catch (e) {}
      }
      if (staffAbc) staffNo++;
      if (i < from || i >= to) continue;
      var item = { index: i, type: type };
      // GetText() of a real editor paragraph ends with the paragraph mark ("\r\n").
      var text = textOf(el).replace(/[\r\n]+$/, '').replace(/[\r\n]+/g, ' ');
      item.text = text.length > maxText ? text.slice(0, maxText) + '…' : text;
      if (type === 'paragraph') {
        var styleName = '';
        try { var st = el.GetStyle ? el.GetStyle() : null; styleName = st && st.GetName ? st.GetName() : ''; } catch (e) {}
        item.style = styleName;
        var lvl = null;
        try { if (el.GetOutlineLvl) { var o = el.GetOutlineLvl(); if (typeof o === 'number' && o >= 0 && o < 9) lvl = o + 1; } } catch (e) {}
        var m = /^(heading|überschrift|title|titel)\s*(\d*)/i.exec(styleName);
        if (m) lvl = lvl || (m[2] ? parseInt(m[2], 10) : 1);
        item.is_heading = lvl !== null;
        item.heading_level = lvl;
        if (imageCount) item.has_image = true;
        if (staffAbc) {
          item.staff_number = staffNo;
          item.abc = staffAbc.length > 2000 ? staffAbc.slice(0, 2000) + '…' : staffAbc;
        }
        if (i === selectedIndex) item.selected = true;
      }
      res.elements.push(item);
    }
    return res;
  }

  function cmdInsertImage() {
    var req = Asc.scope.req;
    var res = { ok: false, method: 'api', alt_text: false, index: null };

    function norm(s) {
      return String(s || '').toLowerCase().replace(/[\s\u00a0]+/g, ' ').replace(/[\s:.\-–—)]+$/, '').trim();
    }
    function isHeading(p) {
      try { var st = p.GetStyle ? p.GetStyle() : null; if (st && /^(heading|überschrift|title|titel)/i.test(st.GetName())) return true; } catch (e) {}
      try { if (p.GetOutlineLvl) { var o = p.GetOutlineLvl(); if (typeof o === 'number' && o >= 0 && o < 9) return true; } } catch (e) {}
      return false;
    }
    function setAlt(drawing) {
      try {
        if (drawing.SetDescription && drawing.SetDescription(req.alt)) {
          try { if (drawing.SetTitle) drawing.SetTitle(req.title); } catch (e) {}
          return 'api';
        }
      } catch (e) {}
      try {
        var pd = drawing.getParaDrawing ? drawing.getParaDrawing() : (drawing.Drawing && drawing.Drawing.parent);
        if (pd && pd.docPr && pd.docPr.setDescr) {
          pd.docPr.setDescr(req.alt);
          try { if (pd.docPr.setTitle) pd.docPr.setTitle(req.title); } catch (e) {}
          return 'internal';
        }
      } catch (e) {}
      return false;
    }

    try {
      var doc = Api.GetDocument();
      var count = doc.GetElementsCount();
      var target = null;
      var pos = req.position;
      if (pos && typeof pos === 'object' && pos.after_paragraph_index != null) {
        target = Number(pos.after_paragraph_index);
        if (!(target >= 0 && target < count)) {
          return { ok: false, fatal: true, error: 'after_paragraph_index ' + target + ' is out of range (0..' + (count - 1) + ')' };
        }
      } else if (pos && typeof pos === 'object' && pos.after_heading) {
        var needle = norm(pos.after_heading);
        var best = null;
        var bestScore = 0;
        for (var i = 0; i < count; i++) {
          var el = doc.GetElement(i);
          if (!el || !el.GetClassType || el.GetClassType() !== 'paragraph') continue;
          var t = norm(el.GetText ? el.GetText() : '');
          if (!t || !needle) continue;
          var score = t === needle ? 3 : t.indexOf(needle) === 0 ? 2 : t.indexOf(needle) !== -1 ? 1 : 0;
          if (score && isHeading(el)) score += 3;
          if (score > bestScore) { best = i; bestScore = score; }
        }
        if (best === null) return { ok: false, fatal: true, error: 'No paragraph matching "' + pos.after_heading + '" found' };
        target = best;
      }

      var img = Api.CreateImage(req.dataUrl, req.wEmu, req.hEmu);
      if (!img) return { ok: false, error: 'Api.CreateImage returned nothing' };
      try { if (img.SetWrappingStyle) img.SetWrappingStyle('inline'); } catch (e) {}
      res.alt_text = setAlt(img);
      var para = Api.CreateParagraph();
      para.AddDrawing(img);

      if (target === null) {
        // "cursor": insert as a new paragraph AFTER the paragraph containing the
        // cursor (or the selected drawing). Inserting at the exact cursor position
        // would split the paragraph – and replace selected text.
        var cur = null;
        try {
          var sel = doc.GetSelectedDrawings ? doc.GetSelectedDrawings() : [];
          var sp = sel && sel.length && sel[0].GetParentParagraph ? sel[0].GetParentParagraph() : null;
          if (sp && sp.Paragraph && sp.Paragraph.GetParent && sp.Paragraph.GetParent() === doc.Document) cur = sp.GetPosInParent();
        } catch (e) {}
        if (cur === null || cur < 0) {
          try {
            var cp = doc.GetCurrentParagraph ? doc.GetCurrentParagraph() : null;
            if (cp && cp.Paragraph && cp.Paragraph.GetParent && cp.Paragraph.GetParent() === doc.Document) cur = cp.GetPosInParent();
          } catch (e) {}
        }
        if (cur === null || cur < 0) {
          // Cursor in a table etc.: index of the top-level element (internal API).
          try {
            var ld = doc.Document;
            if (ld && ld.CurPos && typeof ld.CurPos.ContentPos === 'number') {
              cur = ld.CurPos.ContentPos;
              if (ld.IsSelectionUse && ld.IsSelectionUse() && ld.Selection) cur = Math.max(ld.Selection.StartPos, ld.Selection.EndPos);
            }
          } catch (e) {}
        }
        if (cur !== null && cur >= 0 && cur < count) {
          var curEl = doc.GetElement(cur);
          var isEmptyPara = false;
          try {
            isEmptyPara = curEl.GetClassType() === 'paragraph' && !String(curEl.GetText ? curEl.GetText() : '').replace(/[\r\n\s]+/g, '') &&
              !(curEl.GetAllDrawingObjects && curEl.GetAllDrawingObjects().length);
          } catch (e) {}
          if (isEmptyPara) {
            // Use the empty paragraph the cursor is in.
            curEl.AddDrawing(img);
            res.index = cur;
            res.position = 'cursor (empty paragraph ' + cur + ')';
          } else {
            doc.AddElement(cur + 1, para);
            res.index = cur + 1;
            res.position = 'cursor (after ' + cur + ')';
          }
        } else {
          // Last resort: exact cursor position, but never replace selected text.
          try { if (doc.RemoveSelection) doc.RemoveSelection(); } catch (e) {}
          doc.InsertContent([para]);
          try { var p = para.GetPosInParent ? para.GetPosInParent() : -1; if (p >= 0) res.index = p; } catch (e) {}
          res.position = 'cursor';
        }
      } else {
        doc.AddElement(target + 1, para);
        res.index = target + 1;
        res.position = 'after ' + target;
      }

      // Make sure the inserted drawing kept its alt text. Only drawings with
      // exactly our size and no description are touched, never other images.
      try {
        if (res.index !== null) {
          var inserted = doc.GetElement(res.index);
          var ds = inserted && inserted.GetAllDrawingObjects ? inserted.GetAllDrawingObjects() : [];
          for (var k = 0; k < ds.length; k++) {
            var cur = null;
            var w = null;
            try { cur = ds[k].GetDescription ? ds[k].GetDescription() : null; } catch (e) {}
            try { w = ds[k].GetWidth ? ds[k].GetWidth() : null; } catch (e) {}
            if (!cur && w !== null && Math.abs(w - req.wEmu) <= 2) { var a = setAlt(ds[k]); if (a) res.alt_text = a; }
          }
        }
      } catch (e) {}
      res.ok = true;
    } catch (e) {
      res.ok = false;
      res.error = String((e && e.message) || e);
    }
    return res;
  }

  /**
   * Place the cursor in a new empty paragraph after the target element (for
   * the cursor-only fallbacks). pos "cursor" = after the paragraph containing
   * the cursor or the selected drawing. This also clears a drawing selection,
   * which PutImageDataToSelection would otherwise replace.
   */
  function cmdPrepareCursor() {
    var pos = Asc.scope.pos;
    var res = { ok: false };
    try {
      var doc = Api.GetDocument();
      var count = doc.GetElementsCount();
      var target = null;
      if (pos === 'cursor') {
        try {
          var sel = doc.GetSelectedDrawings ? doc.GetSelectedDrawings() : [];
          var pp = sel && sel.length && sel[0].GetParentParagraph ? sel[0].GetParentParagraph() : null;
          if (pp && pp.GetPosInParent && pp.Paragraph && pp.Paragraph.GetParent && pp.Paragraph.GetParent() === doc.Document) target = pp.GetPosInParent();
        } catch (e) {}
        if (target === null || target < 0) {
          try {
            var cp = doc.GetCurrentParagraph ? doc.GetCurrentParagraph() : null;
            if (cp && cp.GetPosInParent && cp.Paragraph && cp.Paragraph.GetParent && cp.Paragraph.GetParent() === doc.Document) target = cp.GetPosInParent();
          } catch (e) {}
        }
        if (target === null || target < 0) {
          try { var ld = doc.Document; if (ld && ld.CurPos) target = ld.CurPos.ContentPos; } catch (e) {}
        }
      } else if (pos && pos.after_paragraph_index != null) target = Number(pos.after_paragraph_index);
      else if (pos && pos.after_heading) {
        var needle = String(pos.after_heading).toLowerCase().trim();
        for (var i = 0; i < count; i++) {
          var el = doc.GetElement(i);
          if (el && el.GetText && String(el.GetText()).toLowerCase().indexOf(needle) !== -1) { target = i; break; }
        }
      }
      if (target === null || !(target >= 0 && target < count)) return { ok: false, error: 'target not found' };
      // Clear a drawing selection first – PutImageDataToSelection would replace it.
      try { if (doc.RemoveSelection) doc.RemoveSelection(); } catch (e) {}
      try {
        var dObj = doc.Document && doc.Document.DrawingObjects;
        if (dObj && dObj.resetSelection) dObj.resetSelection();
      } catch (e) {}
      var p = Api.CreateParagraph();
      doc.AddElement(target + 1, p);
      var moved = false;
      try { if (p.Paragraph && p.Paragraph.Document_SetThisElementCurrent) { p.Paragraph.Document_SetThisElementCurrent(true); moved = true; } } catch (e) {}
      if (!moved) {
        try { var r = p.GetRange(); if (r && r.Select) { r.Select(); moved = true; } } catch (e) {}
      }
      res.ok = moved;
      res.index = target + 1;
    } catch (e) {
      res.error = String((e && e.message) || e);
    }
    return res;
  }

  /** Set alt text on the currently selected drawing (after cursor-only fallbacks). */
  function cmdSetAltOnSelection() {
    var req = Asc.scope.req;
    try {
      var doc = Api.GetDocument();
      var ds = doc.GetSelectedDrawings ? doc.GetSelectedDrawings() : [];
      if (!ds || !ds.length) return { ok: false };
      var d = ds[0];
      try { if (d.SetDescription && d.SetDescription(req.alt)) return { ok: true, alt_text: 'api' }; } catch (e) {}
      var pd = d.getParaDrawing ? d.getParaDrawing() : (d.Drawing && d.Drawing.parent);
      if (pd && pd.docPr && pd.docPr.setDescr) { pd.docPr.setDescr(req.alt); return { ok: true, alt_text: 'internal' }; }
    } catch (e) {}
    return { ok: false };
  }

  function cmdGetSelectedStaff() {
    try {
      var doc = Api.GetDocument();
      var ds = doc.GetSelectedDrawings ? doc.GetSelectedDrawings() : [];
      if (!ds || !ds.length) return { found: false };
      var d = ds[0];
      var desc = null;
      try { desc = d.GetDescription ? d.GetDescription() : null; } catch (e) {}
      if (!desc) {
        try {
          var pd = d.getParaDrawing ? d.getParaDrawing() : (d.Drawing && d.Drawing.parent);
          desc = pd && pd.docPr ? pd.docPr.descr : null;
        } catch (e) {}
      }
      var w = null;
      try { w = d.GetWidth ? d.GetWidth() : null; } catch (e) {}
      return { found: true, abc: desc || null, width_mm: w ? w / 36000 : null };
    } catch (e) {
      return { found: false, error: String((e && e.message) || e) };
    }
  }

  /** Staff (image with ABC alt text) in the top-level paragraph `Asc.scope.index`. */
  function cmdGetStaffAt() {
    var index = Asc.scope.index;
    try {
      var doc = Api.GetDocument();
      var count = doc.GetElementsCount();
      if (!(index >= 0 && index < count)) return { found: false, error: 'index ' + index + ' is out of range (0..' + (count - 1) + ')' };
      var el = doc.GetElement(index);
      var ds = el && el.GetAllDrawingObjects ? el.GetAllDrawingObjects() : [];
      for (var k = 0; k < ds.length; k++) {
        var desc = null;
        try { desc = ds[k].GetDescription ? ds[k].GetDescription() : null; } catch (e) {}
        if (!desc) {
          try {
            var pd = ds[k].getParaDrawing ? ds[k].getParaDrawing() : (ds[k].Drawing && ds[k].Drawing.parent);
            desc = pd && pd.docPr ? pd.docPr.descr : null;
          } catch (e) {}
        }
        if (desc && /^\s*X:\s*\d+/.test(desc)) {
          var w = null;
          try { w = ds[k].GetWidth ? ds[k].GetWidth() : null; } catch (e) {}
          return { found: true, drawing: k, abc: String(desc), width_mm: w ? w / 36000 : null };
        }
      }
      return { found: false, error: 'element ' + index + ' contains no staff (image with ABC alt text)' };
    } catch (e) {
      return { found: false, error: String((e && e.message) || e) };
    }
  }

  /** Replace the staff image in paragraph `req.index` (drawing number `req.drawing`). */
  function cmdReplaceStaffAt() {
    var req = Asc.scope.req;
    try {
      var doc = Api.GetDocument();
      var el = doc.GetElement(req.index);
      var ds = el && el.GetAllDrawingObjects ? el.GetAllDrawingObjects() : [];
      var old = ds[req.drawing || 0];
      if (!old) return { ok: false, fatal: true, error: 'staff not found at element ' + req.index };
      var img = Api.CreateImage(req.dataUrl, req.wEmu, req.hEmu);
      try { if (img.SetWrappingStyle) img.SetWrappingStyle('inline'); } catch (e) {}
      var alt = false;
      try { if (img.SetDescription && img.SetDescription(req.alt)) alt = 'api'; } catch (e) {}
      if (!alt) {
        try {
          var pd = img.getParaDrawing ? img.getParaDrawing() : (img.Drawing && img.Drawing.parent);
          if (pd && pd.docPr) { pd.docPr.setDescr(req.alt); try { pd.docPr.setTitle('ABC-Notation'); } catch (e) {} alt = 'internal'; }
        } catch (e) {}
      }
      // Was the old staff selected? Then select the new one afterwards – otherwise the
      // editor keeps drawing the selection frame with the old size.
      var wasSelected = false;
      try {
        var sel = doc.GetSelectedDrawings ? doc.GetSelectedDrawings() : [];
        var sp = sel && sel.length && sel[0].GetParentParagraph ? sel[0].GetParentParagraph() : null;
        wasSelected = !!(sp && sp.GetPosInParent && sp.GetPosInParent() === req.index);
      } catch (e) {}
      old.Delete();
      el.AddDrawing(img);
      if (wasSelected) {
        try { if (img.Select) img.Select(true); } catch (e) {}
      }
      return { ok: true, method: 'api', index: req.index, alt_text: alt, reselected: wasSelected };
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  }

  /** Select the staff drawing in paragraph `Asc.scope.req.index` (for the PutImageDataToSelection fallback). */
  function cmdSelectStaffAt() {
    var req = Asc.scope.req;
    try {
      var ds = Api.GetDocument().GetElement(req.index).GetAllDrawingObjects();
      var d = ds[req.drawing || 0];
      return { ok: !!(d && d.Select && d.Select(true)) };
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  }

  function cmdReplaceSelected() {
    var req = Asc.scope.req;
    try {
      var doc = Api.GetDocument();
      var ds = doc.GetSelectedDrawings ? doc.GetSelectedDrawings() : [];
      if (!ds || !ds.length) return { ok: false, fatal: true, error: 'no drawing selected' };
      var old = ds[0];
      var para = old.GetParentParagraph ? old.GetParentParagraph() : null;
      if (!para) return { ok: false, error: 'GetParentParagraph not available' };
      var img = Api.CreateImage(req.dataUrl, req.wEmu, req.hEmu);
      try { if (img.SetWrappingStyle) img.SetWrappingStyle('inline'); } catch (e) {}
      var alt = false;
      try { if (img.SetDescription && img.SetDescription(req.alt)) alt = 'api'; } catch (e) {}
      if (!alt) {
        try {
          var pd = img.getParaDrawing ? img.getParaDrawing() : (img.Drawing && img.Drawing.parent);
          if (pd && pd.docPr) { pd.docPr.setDescr(req.alt); alt = 'internal'; }
        } catch (e) {}
      }
      old.Delete();
      para.AddDrawing(img);
      return { ok: true, method: 'api', alt_text: alt };
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  }
  /* eslint-enable no-undef */

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  var EMU_PER_MM = 36000;

  function mmToCssPx(mm) { return mm / 25.4 * 96; }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function getOutline() {
    return callCommand(cmdOutline, { maxText: 300, maxElements: 300 }, false).then(function (r) {
      return r || { elements: [], total_elements: 0, cursor_index: null };
    });
  }

  function isCursor(position) {
    return !position || position === 'cursor' || (typeof position === 'object' && position.type === 'cursor');
  }

  /**
   * Insert a rendered staff image.
   * @param {{dataUrl:string, widthMm:number, heightMm:number, abc:string, position:any, method?:string}} img
   * @returns {Promise<{ok:boolean, method:string, index:?number, alt_text:any, warnings:string[], error?:string}>}
   */
  function insertImage(img) {
    var method = img.method || 'auto';
    var req = {
      dataUrl: img.dataUrl,
      wEmu: Math.round(img.widthMm * EMU_PER_MM),
      hEmu: Math.round(img.heightMm * EMU_PER_MM),
      alt: img.abc,
      title: 'ABC-Notation',
      position: isCursor(img.position) ? 'cursor' : img.position
    };
    var firstError = null;
    var chain = Promise.resolve(null);

    if (method === 'auto' || method === 'api') {
      chain = callCommand(cmdInsertImage, { req: req }, true).then(function (r) {
        if (r && r.ok) { r.warnings = []; return r; }
        // Invalid position etc.: report to the caller/model instead of silently falling back.
        if (r && r.fatal) { r.warnings = []; return r; }
        firstError = (r && r.error) || 'Api.CreateImage failed';
        return null;
      }, function (e) { firstError = e.message; return null; });
      if (method === 'api') {
        return chain.then(function (r) { return r || { ok: false, method: 'api', error: firstError }; });
      }
    }

    return chain.then(function (r) {
      if (r) return r;
      // Cursor-only fallbacks: move the cursor to the requested place first.
      var warnings = [];
      var prep = callCommand(cmdPrepareCursor, { pos: req.position }, true).catch(function () { return { ok: false }; });
      return prep.then(function (p) {
        if (!isCursor(req.position) && !(p && p.ok)) warnings.push('cursor');
        var index = p && p.ok ? p.index : null;
        var useHtml = method === 'html';
        var attempt = useHtml
          ? Promise.reject(new Error('skip'))
          : executeMethod('PutImageDataToSelection', [{
              src: req.dataUrl,
              width: Math.round(mmToCssPx(img.widthMm)),
              height: Math.round(mmToCssPx(img.heightMm))
            }]).then(function () { return 'PutImageDataToSelection'; });
        return attempt.catch(function () {
          var html = '<p><img src="' + req.dataUrl + '" alt="' + escapeHtml(req.alt) + '" width="' +
            Math.round(mmToCssPx(img.widthMm)) + '" height="' + Math.round(mmToCssPx(img.heightMm)) + '"></p>';
          return executeMethod('PasteHtml', [html]).then(function () { return 'PasteHtml'; });
        }).then(function (used) {
          return callCommand(cmdSetAltOnSelection, { req: req }, false).catch(function () { return { ok: false }; }).then(function (a) {
            if (!(a && a.ok) && used !== 'PasteHtml') warnings.push('alt');
            return { ok: true, method: used, index: index, alt_text: a && a.ok ? a.alt_text : used === 'PasteHtml' ? 'html' : false, warnings: warnings, primary_error: firstError };
          });
        });
      });
    }).catch(function (e) {
      return { ok: false, method: 'none', error: (firstError ? firstError + '; ' : '') + e.message, warnings: [] };
    });
  }

  function getSelectedStaff() {
    return callCommand(cmdGetSelectedStaff, {}, false);
  }

  function replaceSelected(img) {
    var req = {
      dataUrl: img.dataUrl,
      wEmu: Math.round(img.widthMm * EMU_PER_MM),
      hEmu: Math.round(img.heightMm * EMU_PER_MM),
      alt: img.abc
    };
    return callCommand(cmdReplaceSelected, { req: req }, true).then(function (r) {
      // Nothing selected: do not fall back (PutImageDataToSelection would insert a new image).
      if (r && (r.ok || r.fatal)) return r;
      // Fallback: PutImageDataToSelection replaces the selected drawing.
      return executeMethod('PutImageDataToSelection', [{
        src: req.dataUrl,
        width: Math.round(mmToCssPx(img.widthMm)),
        height: Math.round(mmToCssPx(img.heightMm))
      }]).then(function () {
        return callCommand(cmdSetAltOnSelection, { req: req }, false).then(function (a) {
          return { ok: true, method: 'PutImageDataToSelection', alt_text: a && a.ok ? a.alt_text : false };
        });
      });
    });
  }

  function getStaffAt(index) {
    return callCommand(cmdGetStaffAt, { index: index }, false);
  }

  /**
   * Replace the staff at a top-level element index.
   * @param {number} index
   * @param {number} drawing drawing number within the paragraph (from getStaffAt)
   * @param {{dataUrl:string, widthMm:number, heightMm:number, abc:string}} img
   */
  function replaceStaffAt(index, drawing, img) {
    var req = {
      index: index,
      drawing: drawing || 0,
      dataUrl: img.dataUrl,
      wEmu: Math.round(img.widthMm * EMU_PER_MM),
      hEmu: Math.round(img.heightMm * EMU_PER_MM),
      alt: img.abc
    };
    return callCommand(cmdReplaceStaffAt, { req: req }, true).then(function (r) {
      if (r && (r.ok || r.fatal)) return r;
      // Fallback: select the old staff and let PutImageDataToSelection replace it.
      return callCommand(cmdSelectStaffAt, { req: req }, false).then(function (s) {
        if (!s || !s.ok) return { ok: false, error: (r && r.error) || 'could not select the staff' };
        return executeMethod('PutImageDataToSelection', [{
          src: req.dataUrl,
          width: Math.round(mmToCssPx(img.widthMm)),
          height: Math.round(mmToCssPx(img.heightMm))
        }]).then(function () {
          return callCommand(cmdSetAltOnSelection, { req: req }, false);
        }).then(function (a) {
          return { ok: true, method: 'PutImageDataToSelection', index: index, alt_text: a && a.ok ? a.alt_text : false };
        });
      });
    });
  }

  window.MusicEditor = {
    callCommand: callCommand,
    executeMethod: executeMethod,
    getOutline: getOutline,
    insertImage: insertImage,
    getSelectedStaff: getSelectedStaff,
    replaceSelected: replaceSelected,
    getStaffAt: getStaffAt,
    replaceStaffAt: replaceStaffAt,
    // exported for the test harness
    _commands: {
      outline: cmdOutline,
      insertImage: cmdInsertImage,
      prepareCursor: cmdPrepareCursor,
      setAltOnSelection: cmdSetAltOnSelection,
      getSelectedStaff: cmdGetSelectedStaff,
      replaceSelected: cmdReplaceSelected,
      getStaffAt: cmdGetStaffAt,
      replaceStaffAt: cmdReplaceStaffAt,
      selectStaffAt: cmdSelectStaffAt
    }
  };
})(window);
