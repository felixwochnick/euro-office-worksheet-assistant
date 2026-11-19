/*
 * worksheet-diagrams.js – diagrams for computer science worksheets (MIT License).
 *
 * UML class, object, sequence, state (also finite automata), activity and use case diagrams,
 * structograms (Nassi-Shneiderman, DIN 66261), flowcharts (Programmablaufplan, DIN 66001) and ER
 * diagrams (Chen, (min,max), crow's foot). Ported from and extended beyond the diagrams of Klonk
 * (github.com/felixwochnick/klonk, same author).
 *
 * Used by the editor plugin (browser, global `WorksheetDiagrams`; needs `WorksheetSvg` and the
 * vendored dagre, global `dagre`) and by Node.js (CommonJS; `@dagrejs/dagre` from npm).
 *
 * Every function takes options and returns { svg, widthMm, heightMm } like worksheet-svg.js: the
 * SVG has width/height in px (96 dpi) and a viewBox in millimetres. Invalid input throws
 * "<function>: <message>" errors that tell the caller (often an AI) what to fix.
 *
 * Fill-in versions (all diagrams):
 *  - "[[answer]]" in any text is a gap: a dotted writing line on the sheet, the answer in the
 *    accent colour with showAnswers. A text that is only a gap becomes a full writing line.
 *  - blank: true on relations, links, messages and transitions leaves them out for students to
 *    draw; showAnswers draws them in the accent colour.
 *  - A number instead of a list of attributes/methods/values gives that many empty lines.
 *  The layout never depends on showAnswers, so the student and the solution version match.
 *
 * Common options: color (lines and text), mutedColor, accentColor (answers), headerFill, font,
 * showAnswers, widthMm (explicit width) or maxWidthMm (scale down to fit), labels (structogram).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./worksheet-svg.js'), function () { return require('@dagrejs/dagre'); });
  } else {
    root.WorksheetDiagrams = factory(root.WorksheetSvg, function () { return root.dagre; });
  }
})(typeof self !== 'undefined' ? self : this, function (svgLib, loadDagre) {
  'use strict';

  var U = svgLib.util;
  var f = U.f;
  var el = U.el;
  var fail = U.fail;
  var show = U.show;

  var FS = 3.4;              // text size (mm)
  var SMALL = 2.9;           // stereotypes, multiplicities, guards, labels on lines
  var ROW = FS * 1.5;        // line pitch in boxes
  var PAD = 2;               // horizontal padding in boxes
  var LW = 0.3;              // line width
  var MIN_GAP = 9;           // minimal width of an inline gap
  var FULL_MIN_W = 32;       // minimal width of a full writing line
  var WRITE_H = 7;           // height of a writing line (handwriting)
  var MIN_SCALE = 0.76;      // smallest scale: FS * 0.76 ≈ 2.6 mm text
  var MAX_SCALE = 1.6;
  var MAX_H = 250;
  // a gap [[answer]]; "[[[x]]]" is a bracket, the gap x and a bracket (a guard such as [x > 0] to fill in)
  var GAP_RE = /(\[?)\[\[([\s\S]*?)\]\](\]?)/g;

  // ---------------------------------------------------------------------------
  // dagre
  // ---------------------------------------------------------------------------

  var dagreLib = null;
  function getDagre() {
    if (!dagreLib) {
      var d = null;
      try { d = loadDagre(); } catch (e) { d = null; }
      if (d && typeof d.layout !== 'function' && d['default']) d = d['default'];
      if (!d || typeof d.layout !== 'function') throw new Error('diagrams need the dagre library (vendor/dagre.min.js), which is not loaded.');
      dagreLib = d;
    }
    return dagreLib;
  }

  /**
   * Layered layout. nodes [{id, width, height}], edges [{v, w, lw?, lh?, minlen?, weight?}].
   * Returns { nodes: {id: {x, y, width, height}}, edges: [{points, label}] } (centres, millimetres).
   */
  function layoutGraph(nodes, edges, o) {
    var dagre = getDagre();
    var g = new dagre.graphlib.Graph({ multigraph: true });
    g.setGraph({ rankdir: o.rankdir, nodesep: o.nodesep, ranksep: o.ranksep, edgesep: o.edgesep || 4, marginx: 0, marginy: 0 });
    g.setDefaultEdgeLabel(function () { return {}; });
    nodes.forEach(function (n) { g.setNode(n.id, { width: n.width, height: n.height }); });
    edges.forEach(function (e, i) {
      g.setEdge(e.v, e.w, { width: e.lw || 0, height: e.lh || 0, labelpos: 'c', minlen: e.minlen || 1, weight: e.weight || 1 }, 'e' + i);
    });
    dagre.layout(g);
    var out = { nodes: {}, edges: [] };
    nodes.forEach(function (n) {
      var p = g.node(n.id);
      out.nodes[n.id] = { x: p.x, y: p.y, width: n.width, height: n.height };
    });
    edges.forEach(function (e, i) {
      var p = g.edge({ v: e.v, w: e.w, name: 'e' + i }) || {};
      var pts = (p.points || []).filter(function (q) { return q && isFinite(q.x) && isFinite(q.y); })
        .map(function (q) { return { x: q.x, y: q.y }; });
      out.edges.push({ points: pts, label: isFinite(p.x) && isFinite(p.y) ? { x: p.x, y: p.y } : null });
    });
    return out;
  }

  // ---------------------------------------------------------------------------
  // Text lines with gaps
  // ---------------------------------------------------------------------------

  /** Text with gaps -> segments [{t, gap}]. */
  function segmentsOf(s) {
    var segs = [];
    var last = 0;
    var m;
    GAP_RE.lastIndex = 0;
    while ((m = GAP_RE.exec(s))) {
      if (m.index > last || m[1]) segs.push({ t: s.slice(last, m.index) + m[1], gap: false });
      segs.push({ t: m[2].trim(), gap: true });
      if (m[3]) segs.push({ t: m[3], gap: false });
      last = m.index + m[0].length;
    }
    if (last < s.length) segs.push({ t: s.slice(last), gap: false });
    return segs;
  }

  /**
   * One line of text. o: {size, bold, italic, underline, muted, full: allow a full writing line}.
   * A string that is only "[[…]]" becomes a full writing line (answer = its content).
   */
  function mkLine(s, o) {
    o = o || {};
    s = String(s === undefined || s === null ? '' : s).replace(/\s+/g, ' ').trim();
    var L = { size: o.size || FS, bold: !!o.bold, italic: !!o.italic, underline: !!o.underline, muted: !!o.muted, segs: [] };
    var full = /^\[\[([\s\S]*)\]\]$/.exec(s);
    if (o.full && full && full[1].indexOf('[[') < 0 && full[1].indexOf(']]') < 0 && !/^\[\[\[[\s\S]*\]\]\]$/.test(s)) {
      L.full = true;
      L.answer = full[1].trim();
      return L;
    }
    L.segs = segmentsOf(s);
    return L;
  }

  function emptyLine(o) {
    var L = mkLine('', o);
    L.empty = true;
    return L;
  }

  function hasGap(L) {
    return !!(L.full || L.empty || L.segs.some(function (s) { return s.gap; }));
  }

  function plainOf(s) {
    return String(s === undefined || s === null ? '' : s).replace(GAP_RE, '$1$2$3').replace(/\s+/g, ' ').trim();
  }

  function segWidth(seg, L) {
    if (seg.gap) return Math.max(U.textWidth(seg.t, L.size, true) + 1.2, MIN_GAP * L.size / FS);
    return U.textWidth(seg.t, L.size, L.bold) * (L.italic ? 1.02 : 1);
  }

  function lineWidth(L) {
    if (L.empty) return FULL_MIN_W;
    if (L.full) return Math.max(U.textWidth(L.answer, L.size, true) + 2, FULL_MIN_W);
    var w = 0;
    L.segs.forEach(function (s) { w += segWidth(s, L); });
    return w;
  }

  function lineHeight(L, row) {
    if (L.full || L.empty) return Math.max(WRITE_H, row);
    return hasGap(L) ? row * 1.2 : row;
  }

  function lineIsEmpty(L) {
    return !L.full && !L.empty && !L.segs.some(function (s) { return s.gap || s.t.trim(); });
  }

  /**
   * Draw a line. Normal lines: x = anchor point, baseline y. Full/empty writing lines are drawn
   * from o.x1 to o.x2 (o.x1/o.x2 default to x … x + lineWidth).
   */
  function drawLine(ctx, L, x, y, o) {
    o = o || {};
    var anchor = o.anchor || 'start';
    var fill = o.fill || (L.muted ? ctx.muted : ctx.ink);
    var out = '';
    var base = { 'font-size': L.size, fill: fill };
    if (L.bold) base['font-weight'] = 700;
    if (L.italic) base['font-style'] = 'italic';
    if (L.underline) base['text-decoration'] = 'underline';
    if (o.halo && !L.full && !L.empty) {
      // labels on lines: a white box behind the text keeps the line out of the word gaps
      var tw0 = lineWidth(L);
      var bx0 = anchor === 'middle' ? x - tw0 / 2 : anchor === 'end' ? x - tw0 : x;
      out += el('rect', { x: bx0 - 0.6, y: y - L.size * U.CAP - 0.8, width: tw0 + 1.2, height: L.size * U.CAP + 1.8, fill: '#ffffff' });
    }
    if (L.full || L.empty) {
      var x1 = o.x1 !== undefined ? o.x1 : x;
      var x2 = o.x2 !== undefined ? o.x2 : x + lineWidth(L);
      if (L.full && ctx.show) {
        var a = attrsWith(base, { x: anchor === 'middle' ? (x1 + x2) / 2 : x1 + 0.5, y: y - 0.4, fill: ctx.accent, 'font-weight': 700 });
        if (anchor === 'middle') a['text-anchor'] = 'middle';
        return out + el('text', a, U.escapeXml(L.answer));
      }
      return out + writingLine(ctx, x1, x2, y + 0.4);
    }
    var total = lineWidth(L);
    var gaps = L.segs.some(function (s) { return s.gap; });
    if (!gaps || ctx.show) {
      var a2 = attrsWith(base, { x: x, y: y });
      if (anchor !== 'start') a2['text-anchor'] = anchor;
      var content = L.segs.map(function (s) {
        if (!s.gap) return U.escapeXml(s.t);
        return el('tspan', { fill: ctx.accent, 'font-weight': 700 }, U.escapeXml(s.t));
      }).join('');
      return content ? out + el('text', a2, content) : out;
    }
    // student version with gaps: place the pieces one by one
    var cx = anchor === 'middle' ? x - total / 2 : anchor === 'end' ? x - total : x;
    L.segs.forEach(function (s) {
      var w = segWidth(s, L);
      if (s.gap) {
        out += writingLine(ctx, cx + 0.3, cx + w - 0.3, y + 0.5);
      } else if (s.t) {
        out += el('text', attrsWith(base, { x: cx, y: y, 'xml:space': 'preserve' }), U.escapeXml(s.t));
      }
      cx += w;
    });
    return out;
  }

  function writingLine(ctx, x1, x2, y) {
    return el('line', { x1: x1, y1: y, x2: x2, y2: y, stroke: ctx.muted, 'stroke-width': 0.3, 'stroke-dasharray': '0.9 0.7' });
  }

  function attrsWith(a, b) {
    var o = {};
    var k;
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) o[k] = a[k];
    for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) o[k] = b[k];
    return o;
  }

  /** Baseline of a line centred in a row from top to top + h. */
  function baselineIn(top, h, L) {
    if (L.full || L.empty) return top + h - 1.4;
    return top + (h + L.size * U.CAP) / 2;
  }

  // ---------------------------------------------------------------------------
  // Context, bounds, output
  // ---------------------------------------------------------------------------

  function context(o, fn) {
    var ink = U.colorOf(o.color, U.INK);
    var accent = U.colorOf(o.accentColor, '#2563eb');
    return {
      fn: fn,
      ink: ink,
      muted: U.colorOf(o.mutedColor, U.MUTED),
      accent: accent,
      fill: U.colorOf(o.headerFill, U.tint(accent === '#000000' ? '#9ca3af' : accent, 0.88)),
      font: U.fontOf(o.font),
      show: !!o.showAnswers,
      widthMm: o.widthMm !== undefined && o.widthMm !== null ? U.num(o.widthMm, 0, 20, 400, fn, 'widthMm') : 0,
      maxWidthMm: Math.max(15, Math.min(400, Number(o.maxWidthMm) || 170))
    };
  }

  function Bounds() {
    this.x0 = Infinity;
    this.y0 = Infinity;
    this.x1 = -Infinity;
    this.y1 = -Infinity;
  }
  Bounds.prototype.pt = function (x, y) {
    if (!isFinite(x) || !isFinite(y)) return;
    this.x0 = Math.min(this.x0, x);
    this.y0 = Math.min(this.y0, y);
    this.x1 = Math.max(this.x1, x);
    this.y1 = Math.max(this.y1, y);
  };
  Bounds.prototype.rect = function (x, y, w, h) {
    this.pt(x, y);
    this.pt(x + w, y + h);
  };
  /** A text line with baseline y, width w and anchor. */
  Bounds.prototype.text = function (x, y, w, size, anchor) {
    var x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
    this.rect(x0, y - size * U.CAP - 0.6, w, size * U.CAP + 1.6);
  };

  /** Wrap the body into an SVG; scale to widthMm or down to maxWidthMm. */
  function finish(ctx, body, B, hint, fixedWidth) {
    if (!isFinite(B.x0)) throw fail(ctx.fn, 'nothing to draw.');
    var M = 1.2;
    var x0 = B.x0 - M;
    var y0 = B.y0 - M;
    var w = B.x1 - B.x0 + 2 * M;
    var h = B.y1 - B.y0 + 2 * M;
    var s = 1;
    if (ctx.widthMm && !fixedWidth) s = ctx.widthMm / w;
    else if (w > ctx.maxWidthMm) s = ctx.maxWidthMm / w;
    if (s > MAX_SCALE) s = MAX_SCALE;
    var avail = ctx.widthMm && !fixedWidth ? ctx.widthMm : ctx.maxWidthMm;
    if (s < MIN_SCALE - 1e-9) {
      throw fail(ctx.fn, 'too wide: the diagram needs at least ' + Math.ceil(w * MIN_SCALE) + ' mm, but only ' +
        Math.floor(avail) + ' mm are available. ' + hint);
    }
    if (h * s > MAX_H) {
      throw fail(ctx.fn, 'too tall (' + Math.round(h * s) + ' mm, max ' + MAX_H + ' mm). ' + hint);
    }
    var svg = '<svg xmlns="' + U.SVG_NS + '" width="' + U.px(w * s) + '" height="' + U.px(h * s) + '" viewBox="' +
      f(x0) + ' ' + f(y0) + ' ' + f(w) + ' ' + f(h) + '"><g font-family="' + U.escapeXml(ctx.font) + '">' + body + '</g></svg>';
    return { svg: svg, widthMm: U.round3(w * s), heightMm: U.round3(h * s) };
  }

  // ---------------------------------------------------------------------------
  // Geometry and markers
  // ---------------------------------------------------------------------------

  function polyline(pts) {
    return pts.map(function (p, i) { return (i ? 'L' : 'M') + f(p.x) + ' ' + f(p.y); }).join('');
  }

  /** Smooth curve through the points (Catmull-Rom as cubic Béziers). */
  function smoothPath(p) {
    if (p.length < 3) return polyline(p);
    var d = 'M' + f(p[0].x) + ' ' + f(p[0].y);
    for (var i = 0; i < p.length - 1; i++) {
      var p0 = p[i - 1] || p[i];
      var p1 = p[i];
      var p2 = p[i + 1];
      var p3 = p[i + 2] || p2;
      d += 'C' + f(p1.x + (p2.x - p0.x) / 6) + ' ' + f(p1.y + (p2.y - p0.y) / 6) + ' ' +
        f(p2.x - (p3.x - p1.x) / 6) + ' ' + f(p2.y - (p3.y - p1.y) / 6) + ' ' + f(p2.x) + ' ' + f(p2.y);
    }
    return d;
  }

  /** End point and unit direction of the last segment. */
  function endDir(pts) {
    var end = pts[pts.length - 1];
    var before = pts[pts.length - 2] || end;
    var dx = end.x - before.x;
    var dy = end.y - before.y;
    var l = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: end.x, y: end.y, ux: dx / l, uy: dy / l };
  }

  function startDir(pts) {
    return endDir(pts.slice().reverse());
  }

  function clipShape(shape, dx, dy) {
    if (dx === 0 && dy === 0) return { x: shape.x, y: shape.y };
    var s;
    if (shape.kind === 'circle') {
      s = shape.r / Math.sqrt(dx * dx + dy * dy);
    } else if (shape.kind === 'diamond') {
      s = 1 / (Math.abs(dx) / (shape.w / 2) + Math.abs(dy) / (shape.h / 2));
    } else if (shape.kind === 'ellipse') {
      s = 1 / Math.sqrt(Math.pow(dx / (shape.w / 2), 2) + Math.pow(dy / (shape.h / 2), 2));
    } else {
      s = Math.min(dx === 0 ? Infinity : (shape.w / 2) / Math.abs(dx), dy === 0 ? Infinity : (shape.h / 2) / Math.abs(dy));
    }
    return { x: shape.x + dx * s, y: shape.y + dy * s };
  }

  /** Move the end points of an edge onto the real outline of its nodes (circles, diamonds). */
  function fixEnds(pts, from, to) {
    if (pts.length < 2) return pts;
    var p = pts.slice();
    var a = pts[1];
    var b = pts[pts.length - 2];
    if (from) p[0] = clipShape(from, a.x - from.x, a.y - from.y);
    if (to) p[p.length - 1] = clipShape(to, b.x - to.x, b.y - to.y);
    return p;
  }

  function strokeOf(color, dashed) {
    var a = { fill: 'none', stroke: color, 'stroke-width': LW, 'stroke-linejoin': 'round' };
    if (dashed) a['stroke-dasharray'] = '1.6 1.1';
    return a;
  }

  /** Open arrow head (association, transition, reply). */
  function openArrow(e, color) {
    var len = 2.6;
    var hw = 1.4;
    return el('path', attrsWith(strokeOf(color), {
      d: 'M' + f(e.x - e.ux * len - e.uy * hw) + ' ' + f(e.y - e.uy * len + e.ux * hw) + 'L' + f(e.x) + ' ' + f(e.y) +
        'L' + f(e.x - e.ux * len + e.uy * hw) + ' ' + f(e.y - e.uy * len - e.ux * hw)
    }));
  }

  /** Filled arrow head (synchronous call, automaton). */
  function filledArrow(e, color) {
    var len = 2.6;
    var hw = 1.1;
    return el('path', {
      d: 'M' + f(e.x) + ' ' + f(e.y) + 'L' + f(e.x - e.ux * len - e.uy * hw) + ' ' + f(e.y - e.uy * len + e.ux * hw) +
        'L' + f(e.x - e.ux * len + e.uy * hw) + ' ' + f(e.y - e.uy * len - e.ux * hw) + 'Z',
      fill: color, stroke: color, 'stroke-width': 0.2, 'stroke-linejoin': 'round'
    });
  }

  /** Hollow triangle (inheritance, implementation). */
  function triangle(e, color) {
    var len = 3.4;
    var hw = 1.9;
    return el('path', {
      d: 'M' + f(e.x) + ' ' + f(e.y) + 'L' + f(e.x - e.ux * len - e.uy * hw) + ' ' + f(e.y - e.uy * len + e.ux * hw) +
        'L' + f(e.x - e.ux * len + e.uy * hw) + ' ' + f(e.y - e.uy * len - e.ux * hw) + 'Z',
      fill: '#ffffff', stroke: color, 'stroke-width': LW, 'stroke-linejoin': 'round'
    });
  }

  /** Diamond at the start of an edge (aggregation: hollow, composition: filled). s = startDir (pointing outwards). */
  function diamond(s, color, filled) {
    var len = 4.6;
    var hw = 1.5;
    var ux = -s.ux;
    var uy = -s.uy;
    var mx = s.x + ux * len / 2;
    var my = s.y + uy * len / 2;
    return el('path', {
      d: 'M' + f(s.x) + ' ' + f(s.y) + 'L' + f(mx - uy * hw) + ' ' + f(my + ux * hw) + 'L' + f(s.x + ux * len) + ' ' +
        f(s.y + uy * len) + 'L' + f(mx + uy * hw) + ' ' + f(my - ux * hw) + 'Z',
      fill: filled ? color : '#ffffff', stroke: color, 'stroke-width': LW, 'stroke-linejoin': 'round'
    });
  }

  /** A label at the end of an edge (multiplicity, cardinality), beside the line. */
  function endLabel(ctx, L, e, back, side, color, B) {
    var w = lineWidth(L);
    var nx = -e.uy * side;
    var ny = e.ux * side;
    var along = back + Math.abs(e.ux) * w / 2 + 0.6;
    var off = 1.2 + Math.abs(nx) * w / 2 + Math.abs(ny) * L.size * 0.55;
    var cx = e.x - e.ux * along + nx * off;
    var cy = e.y - e.uy * along + ny * off + L.size * U.CAP / 2;
    B.text(cx, cy, w, L.size, 'middle');
    return drawLine(ctx, L, cx, cy, { anchor: 'middle', fill: color, halo: true });
  }

  // ---------------------------------------------------------------------------
  // Input helpers
  // ---------------------------------------------------------------------------

  function listOf(v, fn, name, min, max, example) {
    if (!Array.isArray(v) || v.length < min || v.length > max) {
      throw fail(fn, '"' + name + '" needs ' + (min === max ? min : min + '–' + max) + ' entries' + (example ? ' like ' + example : '') +
        ' (got ' + (Array.isArray(v) ? v.length : show(v)) + ').');
    }
    return v;
  }

  function objOf(v, fn, name, example) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw fail(fn, name + ' must be an object like ' + example + ' (got ' + show(v) + ').');
    return v;
  }

  function str(v, fn, name, maxLen, required) {
    return U.textOf(v, fn, name, maxLen, required);
  }

  /** Name as used in references: gap brackets removed, spaces collapsed. */
  function keyOf(s) {
    return plainOf(s).toLowerCase();
  }

  function lookup(map, ref, fn, name, what) {
    var k = keyOf(ref);
    if (!k) throw fail(fn, '"' + name + '" is missing.');
    if (!Object.prototype.hasOwnProperty.call(map, k)) {
      throw fail(fn, '"' + name + '" is "' + plainOf(ref) + '", which is not one of the ' + what + ': ' +
        Object.keys(map).map(function (x) { return map[x].label; }).join(', ') + '.');
    }
    return map[k];
  }

  /** Lines from an array of strings or a number of empty lines. */
  function linesOf(v, fn, name, maxN, mk) {
    if (v === undefined || v === null) return [];
    if (typeof v === 'number') {
      if (Math.floor(v) !== v || v < 0 || v > maxN) throw fail(fn, '"' + name + '" as a number must be 0–' + maxN + ' (empty lines).');
      var out = [];
      for (var i = 0; i < v; i++) out.push(emptyLine());
      return out;
    }
    if (typeof v === 'string') v = [v];
    if (!Array.isArray(v)) throw fail(fn, '"' + name + '" must be a list of strings or a number of empty lines (got ' + show(v) + ').');
    if (v.length > maxN) throw fail(fn, '"' + name + '" has ' + v.length + ' entries (max ' + maxN + ').');
    return v.map(function (s, j) { return mk(str(s, fn, name + '[' + j + ']', 160)); });
  }

  function directionOf(v, def, fn) {
    if (v === undefined || v === null || v === '' || v === 'auto') return def;
    var s = String(v).toLowerCase();
    if (s === 'vertical' || s === 'tb' || s === 'bt' || s === 'down' || s === 'top-down') return 'TB';
    if (s === 'horizontal' || s === 'lr' || s === 'rl' || s === 'right' || s === 'left-right') return 'LR';
    throw fail(fn, '"direction" must be "vertical" or "horizontal" (got ' + show(v) + ').');
  }

  /** map[key] only for the map's own entries (not "constructor", "__proto__" …). */
  function own(map, key) {
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
  }

  function blankOf(o) {
    return o.blank === true || o.hidden === true;
  }

  // ---------------------------------------------------------------------------
  // Boxes with compartments (classes, objects, tables)
  // ---------------------------------------------------------------------------

  /** box: { head: [lines], parts: [[lines]] } -> measured box (width, height, rows). */
  function measureBox(box, minW) {
    var w = minW || 26;
    box.head.forEach(function (L) { w = Math.max(w, lineWidth(L) + 2 * PAD); });
    box.parts.forEach(function (part) { part.forEach(function (L) { w = Math.max(w, lineWidth(L) + 2 * PAD); }); });
    var headH = 1.2;
    box.head.forEach(function (L) { headH += lineHeight(L, ROW); });
    var h = headH;
    var partH = box.parts.map(function (part) {
      var ph = part.length ? 1.2 : 3;
      part.forEach(function (L) { ph += lineHeight(L, ROW); });
      h += ph;
      return ph;
    });
    box.width = w;
    box.headH = headH;
    box.partH = partH;
    box.height = h;
    return box;
  }

  function drawBox(ctx, box, cx, cy, B, o) {
    o = o || {};
    var x = cx - box.width / 2;
    var y = cy - box.height / 2;
    var out = el('rect', { x: x, y: y, width: box.width, height: box.height, fill: '#ffffff', stroke: ctx.ink, 'stroke-width': LW, 'stroke-dasharray': o.dashed ? '1.6 1.1' : null });
    out += el('rect', { x: x + LW / 2, y: y + LW / 2, width: box.width - LW, height: box.headH - LW, fill: ctx.fill });
    out += el('line', { x1: x, y1: y + box.headH, x2: x + box.width, y2: y + box.headH, stroke: ctx.ink, 'stroke-width': LW });
    var ty = y + 0.6;
    box.head.forEach(function (L) {
      var h = lineHeight(L, ROW);
      out += drawLine(ctx, L, cx, baselineIn(ty, h, L), { anchor: 'middle', x1: x + PAD, x2: x + box.width - PAD });
      ty += h;
    });
    var py = y + box.headH;
    box.parts.forEach(function (part, i) {
      if (i > 0) out += el('line', { x1: x, y1: py, x2: x + box.width, y2: py, stroke: ctx.ink, 'stroke-width': LW });
      var ly = py + 0.6;
      part.forEach(function (L) {
        var h = lineHeight(L, ROW);
        out += drawLine(ctx, L, x + PAD, baselineIn(ly, h, L), { x1: x + PAD, x2: x + box.width - PAD });
        ly += h;
      });
      py += box.partH[i];
    });
    B.rect(x, y, box.width, box.height);
    return out;
  }

  /**
   * Self-reference of a box (e.g. Element –next→ Element): an orthogonal loop over its top right corner, from the
   * right side to the top. j = 0, 1 … for several loops on one box. Returns the points and the label position.
   */
  function boxLoop(p, box, j) {
    var right = p.x + box.width / 2;
    var top = p.y - box.height / 2;
    var out = 6 + j * 3.5;
    var up = 6 + j * 3.5;
    var y0 = top + Math.min(box.height / 2, 4 + j * 1.5);
    var x1 = right - Math.min(box.width / 2, 9 + j * 3.5);
    return {
      pts: [{ x: right, y: y0 }, { x: right + out, y: y0 }, { x: right + out, y: top - up }, { x: x1, y: top - up }, { x: x1, y: top }],
      label: { x: (x1 + right + out) / 2, y: top - up - 1.2 - SMALL * U.CAP / 2 }
    };
  }

  /** The real outline of a box (dagre may know it bigger, with room for self-loops). */
  function boxShape(lay, box) {
    var p = lay.nodes[box.id];
    return { kind: 'rect', x: p.x, y: p.y, w: box.width, h: box.height };
  }

  /** dagre size of a box with n self-loops (room for the loops and their labels; centred, so on both sides). */
  function loopPadded(box, n) {
    if (!n) return { width: box.width, height: box.height };
    var ext = 6 + (n - 1) * 3.5;
    return { width: box.width + 2 * (ext + 3), height: box.height + 2 * (ext + SMALL * 1.6 + 1) };
  }

  // ---------------------------------------------------------------------------
  // Class diagram
  // ---------------------------------------------------------------------------

  var CLASS_KINDS = { 'class': 'class', 'abstract': 'abstract', 'abstract class': 'abstract', 'interface': 'interface',
    'enum': 'enum', 'enumeration': 'enum' };
  var REL_KINDS = { inheritance: 'inheritance', generalization: 'inheritance', 'extends': 'inheritance', vererbung: 'inheritance',
    implementation: 'implementation', realization: 'implementation', 'implements': 'implementation',
    association: 'association', assoziation: 'association', aggregation: 'aggregation', composition: 'composition',
    komposition: 'composition', dependency: 'dependency', abhaengigkeit: 'dependency', 'abhängigkeit': 'dependency', uses: 'dependency' };

  /** "+ static getX(): int", "{abstract} + f()" -> {text, isStatic, isAbstract}. */
  function memberFlags(s) {
    var t = s;
    var st = false;
    var ab = false;
    var re = /^\s*(?:([+\-#~])\s*)?(?:\{(static|abstract)\}|\b(static|abstract)\b)\s*/i;
    for (var k = 0; k < 3; k++) {
      var m = re.exec(t);
      if (!m || !(m[2] || m[3])) break;
      var word = (m[2] || m[3]).toLowerCase();
      if (word === 'static') st = true;
      else ab = true;
      t = (m[1] ? m[1] + ' ' : '') + t.slice(m[0].length);
    }
    return { text: t.trim(), isStatic: st, isAbstract: ab };
  }

  function memberLine(s) {
    var full = /^\s*\[\[([\s\S]*)\]\]\s*$/.exec(s);
    if (full && full[1].indexOf('[[') < 0) {
      var inner = memberFlags(full[1]);
      return mkLine('[[' + inner.text + ']]', { full: true, underline: inner.isStatic, italic: inner.isAbstract });
    }
    var fl = memberFlags(s);
    return mkLine(fl.text, { underline: fl.isStatic, italic: fl.isAbstract });
  }

  function classDiagram(opts) {
    var fn = 'classDiagram';
    var o = U.optsOf(opts, fn);
    var ctx = context(o, fn);
    listOf(o.classes, fn, 'classes', 1, 16, '{ name, attributes: [...], methods: [...] }');
    var byKey = Object.create(null);
    var classes = o.classes.map(function (c, i) {
      if (typeof c === 'string') c = { name: c };
      objOf(c, fn, 'classes[' + i + ']', '{ name, kind?, attributes: [...], methods: [...] }');
      var nm = str(c.name, fn, 'classes[' + i + '].name', 80, true);
      var kindIn = c.kind === undefined || c.kind === null ? (c.abstract === true ? 'abstract' : 'class') : String(c.kind).toLowerCase().trim();
      var kind = own(CLASS_KINDS, kindIn);
      if (!kind) throw fail(fn, 'classes[' + i + '].kind must be class, abstract, interface or enum (got ' + show(c.kind) + ').');
      var k = keyOf(nm);
      if (byKey[k]) throw fail(fn, 'two classes are named "' + plainOf(nm) + '".');
      var head = [];
      if (kind === 'interface') head.push(mkLine('«interface»', { size: SMALL, muted: true }));
      if (kind === 'abstract') head.push(mkLine('«abstract»', { size: SMALL, muted: true }));
      if (kind === 'enum') head.push(mkLine('«enumeration»', { size: SMALL, muted: true }));
      head.push(mkLine(nm, { bold: true, italic: kind === 'abstract', full: true }));
      var attrs = linesOf(c.attributes, fn, 'classes[' + i + '].attributes', 15, memberLine);
      var methods = linesOf(c.methods !== undefined ? c.methods : c.operations, fn, 'classes[' + i + '].methods', 15, memberLine);
      var values = linesOf(c.values !== undefined ? c.values : c.literals, fn, 'classes[' + i + '].values', 15, function (s) { return mkLine(s, { full: true }); });
      var parts = [];
      if (kind === 'enum') {
        parts.push(values);
        if (attrs.length) parts.push(attrs);
        if (methods.length) parts.push(methods);
      } else if (kind === 'interface') {
        if (attrs.length) parts.push(attrs);
        parts.push(methods);
      } else {
        parts.push(attrs, methods);
      }
      var box = measureBox({ head: head, parts: parts }, 30);
      box.id = 'c' + i;
      box.label = plainOf(nm);
      byKey[k] = box;
      return box;
    });

    var rels = (o.relations === undefined || o.relations === null ? [] : listOf(o.relations, fn, 'relations', 0, 30)).map(function (r, i) {
      var nm = 'relations[' + i + ']';
      objOf(r, fn, nm, '{ from, to, kind: "inheritance" }');
      var kindIn = String(r.kind === undefined || r.kind === null ? 'association' : r.kind).toLowerCase().trim();
      var kind = own(REL_KINDS, kindIn);
      if (!kind) {
        throw fail(fn, nm + '.kind must be inheritance, implementation, association, aggregation, composition or dependency (got ' + show(r.kind) + ').');
      }
      var from = lookup(byKey, r.from, fn, nm + '.from', 'classes');
      var to = lookup(byKey, r.to, fn, nm + '.to', 'classes');
      var label = r.label !== undefined && r.label !== null ? str(r.label, fn, nm + '.label', 60) : '';
      return {
        kind: kind, from: from, to: to, blank: blankOf(r), directed: r.directed === true || kind === 'dependency',
        label: label ? mkLine(label, { size: SMALL }) : null,
        fromMult: r.from_mult !== undefined && r.from_mult !== null && String(r.from_mult) !== '' ? mkLine(str(r.from_mult, fn, nm + '.from_mult', 20), { size: SMALL }) : null,
        toMult: r.to_mult !== undefined && r.to_mult !== null && String(r.to_mult) !== '' ? mkLine(str(r.to_mult, fn, nm + '.to_mult', 20), { size: SMALL }) : null
      };
    });

    var hierarchy = rels.some(function (r) { return r.kind === 'inheritance' || r.kind === 'implementation'; });
    var rankdir = directionOf(o.direction, hierarchy ? 'TB' : 'LR', fn);
    // dagre edges run from the upper (left) to the lower (right) class: superclass above its subclass,
    // the whole above its parts, otherwise from -> to.
    // self-references are drawn as loops; dagre lays out the other relations
    var loops = {};
    rels.forEach(function (r) {
      if (r.from === r.to) r.loop = loops[r.from.id] = (loops[r.from.id] || 0) + 1;
    });
    var flow = rels.filter(function (r) { return !r.loop; });
    var edges = flow.map(function (r) {
      var up = r.kind === 'inheritance' || r.kind === 'implementation';
      return {
        v: up ? r.to.id : r.from.id, w: up ? r.from.id : r.to.id, reversed: up,
        lw: r.label ? lineWidth(r.label) + 2 : 0, lh: r.label ? SMALL * 1.6 : 0, weight: up ? 4 : 1
      };
    });
    var lay = layoutGraph(classes.map(function (b) {
      var sz = loopPadded(b, loops[b.id]);
      return { id: b.id, width: sz.width, height: sz.height };
    }), edges, { rankdir: rankdir, nodesep: 10, ranksep: rankdir === 'TB' ? 13 : 18, edgesep: 5 });
    var B = new Bounds();
    var lines = '';
    var marks = '';
    rels.forEach(function (r) {
      // a blank element is laid out like the others (same size in both versions), but only drawn in the solution
      var hide = r.blank && !ctx.show;
      var snap = [lines.length, marks.length];
      (function () {
        var pts;
        var lp;
        if (r.loop) {
          var lo = boxLoop(lay.nodes[r.from.id], r.from, r.loop - 1);
          pts = lo.pts;
          lp = r.label ? lo.label : null;
        } else {
          var i = flow.indexOf(r);
          pts = lay.edges[i].points;
          if (edges[i].reversed) pts = pts.slice().reverse();
          if (loops[r.from.id] || loops[r.to.id]) pts = fixEnds(pts, boxShape(lay, r.from), boxShape(lay, r.to));
          lp = lay.edges[i].label;
        }
        if (pts.length < 2) return;
        var color = r.blank ? ctx.accent : ctx.ink;
        pts.forEach(function (p) { B.pt(p.x, p.y); });
        lines += el('path', attrsWith(strokeOf(color, r.kind === 'implementation' || r.kind === 'dependency'), { d: polyline(pts) }));
        var e = endDir(pts);
        var s = startDir(pts);
        var endBack = 1.5;
        if (r.kind === 'inheritance' || r.kind === 'implementation') {
          marks += triangle(e, color);
          endBack = 3.6;
        } else if (r.directed) {
          marks += openArrow(e, color);
          endBack = 2.8;
        }
        var startBack = 1.5;
        if (r.kind === 'aggregation' || r.kind === 'composition') {
          marks += diamond(s, color, r.kind === 'composition');
          startBack = 4.8;
        }
        if (r.label && lp) {
          var lb = lp.y + SMALL * U.CAP / 2;
          B.text(lp.x, lb, lineWidth(r.label), SMALL, 'middle');
          marks += drawLine(ctx, r.label, lp.x, lb, { anchor: 'middle', fill: r.blank ? ctx.accent : null, halo: true });
        }
        if (r.toMult) marks += endLabel(ctx, r.toMult, e, endBack, r.loop ? -1 : 1, r.blank ? ctx.accent : ctx.ink, B);
        if (r.fromMult) marks += endLabel(ctx, r.fromMult, s, startBack, -1, r.blank ? ctx.accent : ctx.ink, B);
      })();
      if (hide) { lines = lines.slice(0, snap[0]); marks = marks.slice(0, snap[1]); }
    });
    var boxes = '';
    classes.forEach(function (b) {
      var p = lay.nodes[b.id];
      boxes += drawBox(ctx, b, p.x, p.y, B);
    });
    return finish(ctx, lines + boxes + marks, B, 'Use fewer or shorter members, fewer classes, or direction "vertical"/"horizontal".');
  }

  // ---------------------------------------------------------------------------
  // Object diagram
  // ---------------------------------------------------------------------------

  function objectDiagram(opts) {
    var fn = 'objectDiagram';
    var o = U.optsOf(opts, fn);
    var ctx = context(o, fn);
    listOf(o.objects, fn, 'objects', 1, 16, '{ name, class, values: ["attr = value"] }');
    var byKey = Object.create(null);
    var objects = o.objects.map(function (ob, i) {
      objOf(ob, fn, 'objects[' + i + ']', '{ name, class, values: [...] }');
      var nm = str(ob.name, fn, 'objects[' + i + '].name', 60);
      var cls = str(ob['class'] !== undefined ? ob['class'] : ob.type, fn, 'objects[' + i + '].class', 60);
      if (!nm && !cls) throw fail(fn, 'objects[' + i + '] needs a name or a class.');
      var title = (nm ? nm + ' ' : '') + ': ' + (cls || '');
      var box = measureBox({
        head: [mkLine(title.trim(), { bold: true, underline: true })],
        parts: [linesOf(ob.values !== undefined ? ob.values : ob.attributes, fn, 'objects[' + i + '].values', 15, function (s) { return mkLine(s, { full: true }); })]
      }, 26);
      box.id = 'o' + i;
      box.label = plainOf(title.trim());
      var k = nm ? keyOf(nm) : keyOf(':' + cls);
      if (byKey[k]) throw fail(fn, 'two objects are called "' + plainOf(nm || title) + '" – give them different names.');
      byKey[k] = box;
      return box;
    });
    // links may name an object by its name ("k1"), by "k1 : Konto" or, without a name, by ": Konto"
    var refs = Object.create(null);
    objects.forEach(function (b) { refs[keyOf(b.label)] = b; });
    function ref(v, name) {
      var k = keyOf(v);
      if (Object.prototype.hasOwnProperty.call(refs, k)) return refs[k];
      if (Object.prototype.hasOwnProperty.call(refs, keyOf(String(v).replace(/^\s*:?/, ': ')))) return refs[keyOf(String(v).replace(/^\s*:?/, ': '))];
      return lookup(byKey, v, fn, name, 'objects');
    }

    var links = (o.links === undefined || o.links === null ? [] : listOf(o.links, fn, 'links', 0, 30)).map(function (l, i) {
      var nm = 'links[' + i + ']';
      objOf(l, fn, nm, '{ from, to, label? }');
      var from = ref(l.from, nm + '.from');
      var to = ref(l.to, nm + '.to');
      var label = l.label !== undefined && l.label !== null ? str(l.label, fn, nm + '.label', 60) : '';
      return { from: from, to: to, blank: blankOf(l), directed: l.directed === true, label: label ? mkLine(label, { size: SMALL }) : null };
    });
    var rankdir = directionOf(o.direction, 'LR', fn);
    var loops = {};
    links.forEach(function (l) {
      if (l.from === l.to) l.loop = loops[l.from.id] = (loops[l.from.id] || 0) + 1;
    });
    var flow = links.filter(function (l) { return !l.loop; });
    var edges = flow.map(function (l) {
      return { v: l.from.id, w: l.to.id, lw: l.label ? lineWidth(l.label) + 2 : 0, lh: l.label ? SMALL * 1.6 : 0 };
    });
    var lay = layoutGraph(objects.map(function (b) {
      var sz = loopPadded(b, loops[b.id]);
      return { id: b.id, width: sz.width, height: sz.height };
    }), edges, { rankdir: rankdir, nodesep: 9, ranksep: 16, edgesep: 5 });
    var B = new Bounds();
    var lines = '';
    var marks = '';
    links.forEach(function (l) {
      // a blank element is laid out like the others (same size in both versions), but only drawn in the solution
      var hide = l.blank && !ctx.show;
      var snap = [lines.length, marks.length];
      (function () {
        var pts;
        var lp;
        if (l.loop) {
          var lo = boxLoop(lay.nodes[l.from.id], l.from, l.loop - 1);
          pts = lo.pts;
          lp = lo.label;
        } else {
          var i = flow.indexOf(l);
          pts = lay.edges[i].points;
          if (loops[l.from.id] || loops[l.to.id]) pts = fixEnds(pts, boxShape(lay, l.from), boxShape(lay, l.to));
          lp = lay.edges[i].label;
        }
        if (pts.length < 2) return;
        var color = l.blank ? ctx.accent : ctx.ink;
        pts.forEach(function (p) { B.pt(p.x, p.y); });
        lines += el('path', attrsWith(strokeOf(color), { d: polyline(pts) }));
        if (l.directed) marks += openArrow(endDir(pts), color);
        if (l.label && lp) {
          var lb = lp.y + SMALL * U.CAP / 2;
          B.text(lp.x, lb, lineWidth(l.label), SMALL, 'middle');
          marks += drawLine(ctx, l.label, lp.x, lb, { anchor: 'middle', fill: l.blank ? ctx.accent : null, halo: true });
        }
      })();
      if (hide) { lines = lines.slice(0, snap[0]); marks = marks.slice(0, snap[1]); }
    });
    var boxes = '';
    objects.forEach(function (b) {
      var p = lay.nodes[b.id];
      boxes += drawBox(ctx, b, p.x, p.y, B);
    });
    return finish(ctx, lines + boxes + marks, B, 'Use fewer objects or values, or direction "vertical".');
  }

  // ---------------------------------------------------------------------------
  // State diagram / finite automaton
  // ---------------------------------------------------------------------------

  function stateDiagram(opts) {
    var fn = 'stateDiagram';
    var o = U.optsOf(opts, fn);
    var ctx = context(o, fn);
    var notation = o.notation === undefined || o.notation === null ? 'uml' : String(o.notation).toLowerCase();
    if (notation === 'automat' || notation === 'dfa' || notation === 'nfa' || notation === 'dea' || notation === 'nea') notation = 'automaton';
    if (notation !== 'uml' && notation !== 'automaton') throw fail(fn, '"notation" must be "uml" or "automaton" (got ' + show(o.notation) + ').');
    var auto = notation === 'automaton';
    listOf(o.states, fn, 'states', 1, 20, '"Bereit" or { name, activities: ["entry / …"] }');
    var byKey = Object.create(null);
    var accepting = Object.create(null);
    (Array.isArray(o.accepting) ? o.accepting : o.accepting ? [o.accepting] : []).forEach(function (a) { accepting[keyOf(a)] = true; });
    var states = o.states.map(function (s, i) {
      if (typeof s === 'string' || typeof s === 'number') s = { name: String(s) };
      objOf(s, fn, 'states[' + i + ']', '{ name, activities?: [...] }');
      var nm = str(s.name, fn, 'states[' + i + '].name', 60, !auto);
      var k = keyOf(nm);
      if (k === '[*]') throw fail(fn, '"[*]" is not a state name – use it only in transitions (initial/final state).');
      if (k && byKey[k]) throw fail(fn, 'two states are named "' + plainOf(nm) + '".');
      var kind = s.kind === 'choice' ? 'choice' : 'state';
      var st = { id: 's' + i, name: mkLine(nm, { full: true }), kind: kind, label: plainOf(nm) || ('#' + (i + 1)) };
      if (auto) {
        st.accepting = s.accepting === true || s['final'] === true || !!accepting[k];
        st.r = Math.max(5, lineWidth(st.name) / 2 + 2);
        if (st.name.full) st.r = Math.max(6, U.textWidth(st.name.answer, FS, true) / 2 + 2.5);
        st.width = st.height = 2 * (st.r + (st.accepting ? 1.1 : 0));
      } else if (kind === 'choice') {
        st.width = 8;
        st.height = 8;
      } else {
        st.acts = linesOf(s.activities, fn, 'states[' + i + '].activities', 6, function (t) { return mkLine(t, { size: SMALL * 1.07, full: true }); });
        var w = Math.max(20, lineWidth(st.name) + 2 * PAD + 2);
        var h = ROW + 2.4;
        st.acts.forEach(function (L) { w = Math.max(w, lineWidth(L) + 2 * PAD); h += lineHeight(L, SMALL * 1.07 * 1.45); });
        if (st.acts.length) h += 1.2;
        st.width = w;
        st.height = h;
      }
      byKey[k || st.id] = st;
      return st;
    });
    Object.keys(accepting).forEach(function (k) {
      if (!byKey[k]) throw fail(fn, '"accepting" names "' + k + '", which is not a state.');
    });
    var pseudo = Object.create(null);
    function pseudoNode(kind) {
      if (!pseudo[kind]) {
        var size = kind === 'initial' ? (auto ? 0.2 : 3.6) : 5.2;
        pseudo[kind] = { id: kind, kind: kind, width: size, height: size, label: '[*]' };
        states.push(pseudo[kind]);
      }
      return pseudo[kind];
    }
    var trans = [];
    var initName = o.initial !== undefined && o.initial !== null ? o.initial : o.start;
    if (initName !== undefined && initName !== null && initName !== '') {
      trans.push({ from: pseudoNode('initial'), to: lookup(byKey, initName, fn, 'initial', 'states'), label: null, blank: false });
    }
    (o.transitions === undefined || o.transitions === null ? [] : listOf(o.transitions, fn, 'transitions', 0, 40)).forEach(function (t, i) {
      var nm = 'transitions[' + i + ']';
      objOf(t, fn, nm, '{ from, to, label }');
      var fromK = keyOf(t.from);
      var toK = keyOf(t.to);
      var from = fromK === '[*]' ? pseudoNode('initial') : lookup(byKey, t.from, fn, nm + '.from', 'states');
      var to;
      if (toK === '[*]') {
        if (auto) throw fail(fn, nm + '.to "[*]": an automaton has no final pseudo-state – list the accepting states in "accepting".');
        to = pseudoNode('final');
      } else {
        to = lookup(byKey, t.to, fn, nm + '.to', 'states');
      }
      if (to.kind === 'initial') throw fail(fn, nm + ': no transition can lead to the initial state "[*]".');
      var label = t.label !== undefined && t.label !== null ? t.label : t.text !== undefined ? t.text : t.event;
      label = label !== undefined && label !== null ? str(label, fn, nm + '.label', 80) : '';
      trans.push({ from: from, to: to, src: label, label: label ? mkLine(label, { size: SMALL * 1.07 }) : null, blank: blankOf(t) });
    });
    var rankdir = directionOf(o.direction, 'LR', fn);
    // self-transitions are drawn as loops (above the state, or to its right when vertical); dagre gets the rest
    var loops = {};
    var normal = [];
    trans.forEach(function (t) {
      if (t.from === t.to) (loops[t.from.id] = loops[t.from.id] || []).push(t);
      else normal.push(t);
    });
    if (auto) {
      // an automaton writes several symbols on one loop: "a, b"
      Object.keys(loops).forEach(function (id) {
        var plain = loops[id].filter(function (t) { return !t.blank && t.label && !hasGap(t.label); });
        if (plain.length < 2) return;
        var merged = { from: plain[0].from, to: plain[0].to, blank: false, label: mkLine(plain.map(function (t) { return t.src; }).join(', '), { size: SMALL * 1.07 }) };
        loops[id] = [merged].concat(loops[id].filter(function (t) { return plain.indexOf(t) < 0; }));
      });
    }
    var LOOP_H = 5;
    var LOOP_STEP = 5.5;
    var LBL_H = SMALL * 1.07 * U.CAP + 1.8;
    states.forEach(function (st) {
      var ls = loops[st.id];
      if (!ls) return;
      var lw = 0;
      ls.forEach(function (t) { if (t.label) lw = Math.max(lw, lineWidth(t.label)); });
      var ext = LOOP_H + (ls.length - 1) * LOOP_STEP + LBL_H + 1;
      if (rankdir === 'LR') st.lay = { width: Math.max(st.width, lw + 3), height: st.height + 2 * ext };
      else st.lay = { width: st.width + 2 * (LOOP_H + (ls.length - 1) * LOOP_STEP + lw + 3), height: Math.max(st.height, ls.length * 4 + 4) };
    });
    var edges = normal.map(function (t) {
      return { v: t.from.id, w: t.to.id, lw: t.label ? lineWidth(t.label) + 2 : 0.1, lh: t.label ? SMALL * 1.07 * 1.5 : 0.1 };
    });
    var lay = layoutGraph(states.map(function (s) { return { id: s.id, width: s.lay ? s.lay.width : s.width, height: s.lay ? s.lay.height : s.height }; }), edges,
      { rankdir: rankdir, nodesep: 8, ranksep: 12, edgesep: 4 });
    function shapeOf(s) {
      var p = lay.nodes[s.id];
      if (s.kind === 'initial') return { kind: 'circle', x: p.x, y: p.y, r: auto ? 0.1 : 1.8 };
      if (s.kind === 'final') return { kind: 'circle', x: p.x, y: p.y, r: 2.6 };
      if (s.kind === 'choice') return { kind: 'diamond', x: p.x, y: p.y, w: s.width, h: s.height };
      if (auto) return { kind: 'circle', x: p.x, y: p.y, r: s.width / 2 };
      return { kind: 'rect', x: p.x, y: p.y, w: s.width, h: s.height };
    }
    var B = new Bounds();
    var lines = '';
    var marks = '';
    Object.keys(loops).forEach(function (id) {
      loops[id].forEach(function (t, j) {
        // a blank element is laid out like the others (same size in both versions), but only drawn in the solution
        var hide = t.blank && !ctx.show;
        var snap = [lines.length, marks.length];
        (function () {
          var color = t.blank ? ctx.accent : ctx.ink;
          var sh = shapeOf(t.from);
          var p = lay.nodes[id];
          var reach = LOOP_H + j * LOOP_STEP;
          var spread = 2.5 + j * 1.5;
          var a;
          var b;
          var c1;
          var c2;
          if (rankdir === 'LR') {
            var top = p.y - (sh.kind === 'circle' ? sh.r : t.from.height / 2);
            if (sh.kind === 'circle') {
              var ang = 0.7 + j * 0.08;
              a = { x: p.x - sh.r * Math.sin(ang), y: p.y - sh.r * Math.cos(ang) };
              b = { x: p.x + sh.r * Math.sin(ang), y: a.y };
            } else {
              var dx = Math.min(t.from.width / 2 - 1.5, 3 + j * 1.2);
              a = { x: p.x - dx, y: top };
              b = { x: p.x + dx, y: top };
            }
            var cy = a.y - (a.y - (top - reach)) / 0.75;
            c1 = { x: a.x - spread, y: cy };
            c2 = { x: b.x + spread, y: cy };
            if (t.label) {
              var lb = top - reach - 1.2;
              B.text(p.x, lb, lineWidth(t.label), t.label.size, 'middle');
              marks += drawLine(ctx, t.label, p.x, lb, { anchor: 'middle', fill: t.blank ? ctx.accent : null, halo: true });
            }
            B.pt(p.x, top - reach);
          } else {
            var right = p.x + (sh.kind === 'circle' ? sh.r : t.from.width / 2);
            if (sh.kind === 'circle') {
              var ang2 = 0.7 + j * 0.08;
              a = { x: p.x + sh.r * Math.cos(ang2), y: p.y - sh.r * Math.sin(ang2) };
              b = { x: a.x, y: p.y + sh.r * Math.sin(ang2) };
            } else {
              var dy = Math.min(t.from.height / 2 - 1.2, 2.5 + j * 1);
              a = { x: right, y: p.y - dy };
              b = { x: right, y: p.y + dy };
            }
            var cx = a.x + ((right + reach) - a.x) / 0.75;
            c1 = { x: cx, y: a.y - spread };
            c2 = { x: cx, y: b.y + spread };
            if (t.label) {
              var lx = right + reach + 1.2;
              var lb2 = p.y + t.label.size * U.CAP / 2;
              B.text(lx, lb2, lineWidth(t.label), t.label.size, 'start');
              marks += drawLine(ctx, t.label, lx, lb2, { fill: t.blank ? ctx.accent : null, halo: true });
            }
            B.pt(right + reach, p.y);
          }
          lines += el('path', attrsWith(strokeOf(color), { d: 'M' + f(a.x) + ' ' + f(a.y) + 'C' + f(c1.x) + ' ' + f(c1.y) + ' ' + f(c2.x) + ' ' + f(c2.y) + ' ' + f(b.x) + ' ' + f(b.y) }));
          var e = endDir([c2, b]);
          marks += auto ? filledArrow(e, color) : openArrow(e, color);
        })();
        if (hide) { lines = lines.slice(0, snap[0]); marks = marks.slice(0, snap[1]); }
      });
    });
    normal.forEach(function (t, i) {
      // a blank element is laid out like the others (same size in both versions), but only drawn in the solution
      var hide = t.blank && !ctx.show;
      var snap = [lines.length, marks.length];
      (function () {
        var pts = lay.edges[i].points;
        if (pts.length < 2) return;
        pts = fixEnds(pts, shapeOf(t.from), shapeOf(t.to));
        if (auto && t.from.kind === 'initial') {
          // start arrow: a short arrow into the start state
          var e0 = endDir(pts);
          pts = [{ x: e0.x - e0.ux * 7, y: e0.y - e0.uy * 7 }, { x: e0.x, y: e0.y }];
        }
        var color = t.blank ? ctx.accent : ctx.ink;
        pts.forEach(function (p) { B.pt(p.x, p.y); });
        lines += el('path', attrsWith(strokeOf(color), { d: smoothPath(pts) }));
        marks += auto ? filledArrow(endDir(pts), color) : openArrow(endDir(pts), color);
        if (t.label && lay.edges[i].label) {
          var lp = lay.edges[i].label;
          var lb = lp.y + t.label.size * U.CAP / 2;
          B.text(lp.x, lb, lineWidth(t.label), t.label.size, 'middle');
          marks += drawLine(ctx, t.label, lp.x, lb, { anchor: 'middle', fill: t.blank ? ctx.accent : null, halo: true });
        }
      })();
      if (hide) { lines = lines.slice(0, snap[0]); marks = marks.slice(0, snap[1]); }
    });
    var nodes = '';
    states.forEach(function (s) {
      var p = lay.nodes[s.id];
      var x = p.x - s.width / 2;
      var y = p.y - s.height / 2;
      if (s.kind === 'initial') {
        if (!auto) {
          nodes += el('circle', { cx: p.x, cy: p.y, r: 1.8, fill: ctx.ink });
          B.rect(p.x - 1.8, p.y - 1.8, 3.6, 3.6);
        }
        return;
      }
      if (s.kind === 'final') {
        nodes += el('circle', { cx: p.x, cy: p.y, r: 2.6, fill: '#ffffff', stroke: ctx.ink, 'stroke-width': LW }) +
          el('circle', { cx: p.x, cy: p.y, r: 1.6, fill: ctx.ink });
        B.rect(x, y, s.width, s.height);
        return;
      }
      B.rect(x, y, s.width, s.height);
      if (s.kind === 'choice') {
        nodes += el('path', { d: 'M' + f(p.x) + ' ' + f(y) + 'L' + f(x + s.width) + ' ' + f(p.y) + 'L' + f(p.x) + ' ' + f(y + s.height) + 'L' + f(x) + ' ' + f(p.y) + 'Z', fill: '#ffffff', stroke: ctx.ink, 'stroke-width': LW });
        return;
      }
      if (auto) {
        var r = s.width / 2;
        nodes += el('circle', { cx: p.x, cy: p.y, r: r, fill: ctx.fill, stroke: ctx.ink, 'stroke-width': LW });
        if (s.accepting) nodes += el('circle', { cx: p.x, cy: p.y, r: r - 1.1, fill: 'none', stroke: ctx.ink, 'stroke-width': LW });
        nodes += drawLine(ctx, s.name, p.x, p.y + FS * U.CAP / 2, { anchor: 'middle', x1: p.x - r + 2, x2: p.x + r - 2 });
        return;
      }
      nodes += el('rect', { x: x, y: y, width: s.width, height: s.height, rx: 2.4, fill: ctx.fill, stroke: ctx.ink, 'stroke-width': LW });
      nodes += drawLine(ctx, s.name, p.x, baselineIn(y + 1.2, ROW, s.name), { anchor: 'middle', x1: x + PAD, x2: x + s.width - PAD });
      if (s.acts.length) {
        var ly = y + ROW + 2.4;
        nodes += el('line', { x1: x, y1: ly - 0.6, x2: x + s.width, y2: ly - 0.6, stroke: ctx.ink, 'stroke-width': LW });
        s.acts.forEach(function (L) {
          var h = lineHeight(L, L.size * 1.45);
          nodes += drawLine(ctx, L, x + PAD, baselineIn(ly, h, L), { x1: x + PAD, x2: x + s.width - PAD });
          ly += h;
        });
      }
    });
    return finish(ctx, lines + nodes + marks, B, 'Use fewer states, shorter labels or direction "vertical".');
  }

  // ---------------------------------------------------------------------------
  // Sequence diagram
  // ---------------------------------------------------------------------------

  var MSG_KINDS = { call: 'call', sync: 'call', synchronous: 'call', async: 'async', asynchronous: 'async', signal: 'async',
    'return': 'return', reply: 'return', response: 'return', answer: 'return', create: 'create', 'new': 'create' };
  var FRAGMENTS = ['alt', 'opt', 'loop', 'par', 'break', 'critical', 'ref'];
  var BAR_W = 2.4;
  var BAR_OFF = 1.2;
  var SELF_W = 7;
  var SELF_H = 5;

  function sequenceDiagram(opts) {
    var fn = 'sequenceDiagram';
    var o = U.optsOf(opts, fn);
    var ctx = context(o, fn);
    var withBars = o.activations !== false;
    listOf(o.participants, fn, 'participants', 1, 10, '":Kunde" or { name, kind: "actor" }');
    var byKey = Object.create(null);
    var parts = o.participants.map(function (p, i) {
      if (typeof p === 'string') p = { name: p };
      objOf(p, fn, 'participants[' + i + ']', '{ name, kind?: "object" | "actor" }');
      var nm = str(p.name, fn, 'participants[' + i + '].name', 60, true);
      var kind = p.kind === undefined || p.kind === null ? 'object' : String(p.kind).toLowerCase();
      if (kind !== 'object' && kind !== 'actor') throw fail(fn, 'participants[' + i + '].kind must be "object" or "actor".');
      var k = keyOf(nm);
      if (byKey[k]) throw fail(fn, 'two participants are named "' + plainOf(nm) + '".');
      var L = mkLine(nm, { full: true });
      var P = { i: i, label: plainOf(nm), kind: kind, line: L, w: kind === 'actor' ? Math.max(10, lineWidth(L) + 2) : Math.max(16, lineWidth(L) + 2 * PAD + 1) };
      P.h = kind === 'actor' ? 14 : 7.5;
      byKey[k] = P;
      return P;
    });

    // parse items (messages and fragments)
    var count = 0;
    var msgs = [];
    function parseItems(list, path, depth) {
      if (!Array.isArray(list)) throw fail(fn, '"' + path + '" must be a list of messages.');
      return list.map(function (it, i) {
        var nm = path + '[' + i + ']';
        objOf(it, fn, nm, '{ from, to, text, kind? }');
        if (it.fragment !== undefined) {
          var kind = String(it.fragment).toLowerCase();
          if (FRAGMENTS.indexOf(kind) < 0) throw fail(fn, nm + '.fragment must be one of ' + FRAGMENTS.join(', ') + ' (got ' + show(it.fragment) + ').');
          if (depth >= 3) throw fail(fn, nm + ': fragments can be nested at most 3 deep.');
          var guard = it.label !== undefined ? it.label : it.guard !== undefined ? it.guard : it.condition;
          var sections = [{ guard: guardLine(guard, fn, nm + '.label'), items: parseItems(it.messages || [], nm + '.messages', depth + 1) }];
          var els = it['else'] === undefined || it['else'] === null ? [] : Array.isArray(it['else']) ? it['else'] : [it['else']];
          if (els.length && kind !== 'alt' && kind !== 'par') throw fail(fn, nm + ': only alt and par fragments have an else part.');
          els.forEach(function (s, j) {
            objOf(s, fn, nm + '.else', '{ label, messages: [...] }');
            sections.push({ guard: guardLine(s.label !== undefined ? s.label : s.guard, fn, nm + '.else[' + j + '].label'), items: parseItems(s.messages || [], nm + '.else[' + j + '].messages', depth + 1) });
          });
          return { frag: kind, sections: sections, depth: depth };
        }
        if (++count > 60) throw fail(fn, 'too many messages (max 60).');
        var mk = own(MSG_KINDS, String(it.kind === undefined || it.kind === null ? 'call' : it.kind).toLowerCase());
        if (!mk) throw fail(fn, nm + '.kind must be call, async, return or create (got ' + show(it.kind) + ').');
        var text = it.text !== undefined ? it.text : it.label !== undefined ? it.label : it.message;
        var m = {
          from: lookup(byKey, it.from, fn, nm + '.from', 'participants'),
          to: lookup(byKey, it.to, fn, nm + '.to', 'participants'),
          kind: mk, blank: blankOf(it),
          text: mkLine(text === undefined || text === null ? '' : str(text, fn, nm + '.text', 100), { size: SMALL * 1.07 })
        };
        if (mk === 'create') {
          if (m.to === m.from) throw fail(fn, nm + ': an object cannot create itself.');
          if (m.to.created) throw fail(fn, nm + ': "' + m.to.label + '" is created twice.');
          if (m.to.used) throw fail(fn, nm + ': "' + m.to.label + '" receives or sends messages before it is created – put the create message first.');
          m.to.created = m;
        }
        m.from.used = true;
        if (mk !== 'create') m.to.used = true;
        msgs.push(m);
        return m;
      });
    }
    function guardLine(v, fn2, name) {
      if (v === undefined || v === null || v === '') return null;
      var s = str(v, fn2, name, 80);
      var plain = plainOf(s);
      if (!/^\[[\s\S]*\]$/.test(plain)) s = '[' + s + ']';
      return mkLine(s, { size: SMALL });
    }
    var items = parseItems(o.messages === undefined ? [] : o.messages, 'messages', 0);
    if (!msgs.length) throw fail(fn, '"messages" needs at least one message like { from, to, text }.');

    // horizontal positions: gaps between neighbouring lifelines
    var n = parts.length;
    var gaps = [];
    for (var gi = 0; gi < n - 1; gi++) gaps.push((parts[gi].w + parts[gi + 1].w) / 2 + 8);
    var rightExtra = parts[n - 1].w / 2;
    var leftExtra = parts[0].w / 2;
    var needs = [];
    msgs.forEach(function (m) {
      var lw = lineWidth(m.text);
      if (m.from === m.to) {
        var need = Math.max(lw + 3, SELF_W + 3);
        if (m.from.i === n - 1) rightExtra = Math.max(rightExtra, need + BAR_W);
        else needs.push({ a: m.from.i, b: m.from.i + 1, d: need + parts[m.from.i + 1].w / 2 + BAR_W });
        return;
      }
      var a = Math.min(m.from.i, m.to.i);
      var b = Math.max(m.from.i, m.to.i);
      needs.push({ a: a, b: b, d: lw + 7 + (m.kind === 'create' ? m.to.w / 2 : 0) });
    });
    needs.sort(function (p, q) { return (p.b - p.a) - (q.b - q.a); });
    needs.forEach(function (nd) {
      var have = 0;
      for (var k = nd.a; k < nd.b; k++) have += gaps[k];
      if (have < nd.d) for (var k2 = nd.a; k2 < nd.b; k2++) gaps[k2] += (nd.d - have) / (nd.b - nd.a);
    });
    var xs = [0];
    for (var xi = 1; xi < n; xi++) xs.push(xs[xi - 1] + gaps[xi - 1]);
    parts.forEach(function (P, i) { P.x = xs[i]; });

    // vertical positions
    var headH = 0;
    parts.forEach(function (P) { if (!P.created) headH = Math.max(headH, P.h); });
    if (!headH) headH = 7.5;
    var y = headH + 4;
    var frames = [];
    var LBL = SMALL * 1.07 * U.CAP + 2.2;
    function place(list) {
      list.forEach(function (it) {
        if (it.frag) {
          var fr = { kind: it.frag, depth: it.depth, top: y, seps: [], cols: colsOf(it) };
          frames.push(fr);
          y += 5;
          it.sections.forEach(function (sec, si) {
            if (si > 0) {
              fr.seps.push({ y: y, guard: sec.guard });
              y += sec.guard ? 4.5 : 2;
            } else {
              fr.guard = sec.guard;
            }
            place(sec.items);
          });
          y += 2.5;
          fr.bottom = y;
          y += 2.5;
          return;
        }
        if (it.kind === 'create') y += Math.max(LBL, it.to.h / 2 + 1);
        else y += LBL;
        it.y = y;
        y += it.from === it.to ? SELF_H + 3.5 : 3.2;
        if (it.kind === 'create') y += it.to.h / 2;
      });
    }
    function colsOf(it) {
      var lo = Infinity;
      var hi = -Infinity;
      var selfAt = {};
      (function walk(list) {
        list.forEach(function (x) {
          if (x.frag) { x.sections.forEach(function (s) { walk(s.items); }); return; }
          lo = Math.min(lo, x.from.i, x.to.i);
          hi = Math.max(hi, x.from.i, x.to.i);
          if (x.from === x.to) selfAt[x.from.i] = Math.max(selfAt[x.from.i] || 0, lineWidth(x.text) + 1.2, SELF_W);
        });
      })(it.sections.reduce(function (a, s) { return a.concat(s.items); }, []));
      if (!isFinite(lo)) { lo = 0; hi = n - 1; }
      return { lo: lo, hi: hi, selfHi: selfAt[hi] || 0 };
    }
    place(items);
    var endY = y + 3;

    // activation bars
    var bars = [];
    var stack = [];
    function depthOf(P) {
      var d = 0;
      stack.forEach(function (fr) { if (fr.p === P) d++; });
      return d;
    }
    function close(k, at) {
      var fr = stack.splice(k, 1)[0];
      fr.y1 = Math.max(at, fr.y0 + 3);
      bars.push(fr);
    }
    msgs.forEach(function (m) {
      var k;
      if (m.kind === 'return') {
        m.sd = depthOf(m.from);
        var idx = -1;
        for (k = stack.length - 1; k >= 0; k--) {
          if (stack[k].p === m.from && (stack[k].caller === m.to || idx < 0)) {
            idx = k;
            if (stack[k].caller === m.to) break;
          }
        }
        if (idx >= 0) {
          while (stack.length - 1 > idx) close(stack.length - 1, m.y - 1);
          close(idx, m.y);
        }
        m.rd = depthOf(m.to);
        return;
      }
      // the sender continues: activations opened after its own have returned (implicitly). A sender without an open
      // activation (an actor, an object created or called asynchronously) ends none.
      var own = -1;
      for (k = stack.length - 1; k >= 0; k--) if (stack[k].p === m.from) { own = k; break; }
      if (own >= 0) while (stack.length - 1 > own) close(stack.length - 1, m.y - 1);
      m.sd = depthOf(m.from);
      if (m.kind === 'call') {
        var d = depthOf(m.to) + 1;
        stack.push({ p: m.to, caller: m.from, y0: m.y + (m.from === m.to ? SELF_H : 0), depth: d, blank: m.blank });
        m.rd = d;
      } else {
        m.rd = depthOf(m.to);
      }
    });
    while (stack.length) close(stack.length - 1, endY - 2);
    if (!withBars) {
      bars = [];
      msgs.forEach(function (m) { m.sd = 0; m.rd = 0; });
    }
    function barX(P, d, side) {
      return d <= 0 ? P.x : P.x + (d - 1) * BAR_OFF + side * BAR_W / 2;
    }

    var B = new Bounds();
    var out = '';
    var frameLabels = '';
    // frames: the frame behind everything, its labels on top (over lifelines and bars)
    frames.forEach(function (fr) {
      var margin = 6 - fr.depth * 1.6;
      var x1 = parts[fr.cols.lo].x - Math.max(parts[fr.cols.lo].w / 2, BAR_W) - margin + 2;
      var x2 = parts[fr.cols.hi].x + Math.max(parts[fr.cols.hi].w / 2, BAR_W) + margin - 2;
      if (fr.cols.selfHi) {
        x2 = Math.max(x2, parts[fr.cols.hi].x + BAR_W + fr.cols.selfHi + margin - 1);
        if (fr.cols.hi < n - 1) x2 = Math.min(x2, parts[fr.cols.hi + 1].x - 2);
      }
      out += el('rect', { x: x1, y: fr.top, width: x2 - x1, height: fr.bottom - fr.top, fill: 'none', stroke: ctx.ink, 'stroke-width': LW });
      var kw = U.textWidth(fr.kind, SMALL, true) + 3;
      frameLabels += el('path', { d: 'M' + f(x1) + ' ' + f(fr.top) + 'H' + f(x1 + kw + 1.5) + 'V' + f(fr.top + 3) + 'L' + f(x1 + kw) + ' ' + f(fr.top + 4.4) + 'H' + f(x1) + 'Z', fill: ctx.fill, stroke: ctx.ink, 'stroke-width': LW });
      frameLabels += el('text', { x: x1 + 1.3, y: fr.top + 3.2, 'font-size': SMALL, 'font-weight': 700, fill: ctx.ink }, U.escapeXml(fr.kind));
      if (fr.guard) {
        frameLabels += drawLine(ctx, fr.guard, x1 + kw + 3.5, fr.top + 3.2, { halo: true });
        B.text(x1 + kw + 3.5, fr.top + 3.2, lineWidth(fr.guard), SMALL, 'start');
      }
      fr.seps.forEach(function (sp) {
        out += el('line', { x1: x1, y1: sp.y, x2: x2, y2: sp.y, stroke: ctx.ink, 'stroke-width': LW, 'stroke-dasharray': '1.6 1.1' });
        if (sp.guard) {
          frameLabels += drawLine(ctx, sp.guard, x1 + 1.5, sp.y + 3.4, { halo: true });
          B.text(x1 + 1.5, sp.y + 3.4, lineWidth(sp.guard), SMALL, 'start');
        }
      });
      B.rect(x1, fr.top, x2 - x1, fr.bottom - fr.top);
    });
    // lifelines and heads
    var heads = '';
    parts.forEach(function (P) {
      var top = P.created ? P.created.y - P.h / 2 : 0;
      var bottom = top + P.h;
      out += el('line', { x1: P.x, y1: bottom, x2: P.x, y2: endY, stroke: ctx.muted, 'stroke-width': 0.25, 'stroke-dasharray': '1.2 1' });
      B.rect(P.x - P.w / 2, top, P.w, endY - top);
      if (P.kind === 'actor') {
        var hx = P.x;
        heads += el('circle', { cx: hx, cy: top + 1.8, r: 1.5, fill: '#ffffff', stroke: ctx.ink, 'stroke-width': LW });
        heads += el('path', { d: 'M' + f(hx) + ' ' + f(top + 3.3) + 'V' + f(top + 7) + 'M' + f(hx - 2.4) + ' ' + f(top + 4.6) + 'H' + f(hx + 2.4) +
          'M' + f(hx - 2.2) + ' ' + f(top + 9.6) + 'L' + f(hx) + ' ' + f(top + 7) + 'L' + f(hx + 2.2) + ' ' + f(top + 9.6), fill: 'none', stroke: ctx.ink, 'stroke-width': LW, 'stroke-linecap': 'round' });
        heads += drawLine(ctx, P.line, P.x, top + 13, { anchor: 'middle', x1: P.x - P.w / 2, x2: P.x + P.w / 2 });
      } else {
        heads += el('rect', { x: P.x - P.w / 2, y: top, width: P.w, height: P.h, fill: ctx.fill, stroke: ctx.ink, 'stroke-width': LW });
        heads += drawLine(ctx, P.line, P.x, baselineIn(top, P.h, P.line), { anchor: 'middle', x1: P.x - P.w / 2 + PAD, x2: P.x + P.w / 2 - PAD });
      }
    });
    // activation bars
    bars.forEach(function (b) {
      // a blank element is laid out like the others (same size in both versions), but only drawn in the solution
      var hide = b.blank && !ctx.show;
      var snap = [out.length];
      (function () {
        var bx = barX(b.p, b.depth, -1);
        out += el('rect', { x: bx, y: b.y0, width: BAR_W, height: b.y1 - b.y0, fill: b.blank ? U.tint(ctx.accent, 0.8) : '#ffffff', stroke: b.blank ? ctx.accent : ctx.ink, 'stroke-width': LW });
      })();
      if (hide) { out = out.slice(0, snap[0]); }
    });
    // messages
    msgs.forEach(function (m) {
      // a blank element is laid out like the others (same size in both versions), but only drawn in the solution
      var hide = m.blank && !ctx.show;
      var snap = [out.length];
      (function () {
        var color = m.blank ? ctx.accent : ctx.ink;
        var dashed = m.kind === 'return' || m.kind === 'create';
        var tw = lineWidth(m.text);
        var lb = m.y - 1.1;
        if (m.from === m.to) {
          var sx = barX(m.from, m.sd, 1);
          var ex = barX(m.from, m.kind === 'call' ? m.rd : m.sd, 1);
          var pts = [{ x: sx, y: m.y }, { x: sx + SELF_W, y: m.y }, { x: sx + SELF_W, y: m.y + SELF_H }, { x: ex, y: m.y + SELF_H }];
          out += el('path', attrsWith(strokeOf(color, dashed), { d: polyline(pts) }));
          out += m.kind === 'call' ? filledArrow(endDir(pts), color) : openArrow(endDir(pts), color);
          out += drawLine(ctx, m.text, sx + 1.2, lb, { fill: m.blank ? ctx.accent : null });
          B.text(sx + 1.2, lb, tw, m.text.size, 'start');
          B.rect(sx, m.y, SELF_W + 1, SELF_H);
          return;
        }
        var dir = m.to.x > m.from.x ? 1 : -1;
        var x1 = barX(m.from, m.sd, dir);
        var x2 = m.kind === 'create' ? m.to.x - dir * m.to.w / 2 : barX(m.to, m.rd, -dir);
        var pts2 = [{ x: x1, y: m.y }, { x: x2, y: m.y }];
        out += el('path', attrsWith(strokeOf(color, dashed), { d: polyline(pts2) }));
        out += m.kind === 'call' ? filledArrow(endDir(pts2), color) : openArrow(endDir(pts2), color);
        out += drawLine(ctx, m.text, (x1 + x2) / 2, lb, { anchor: 'middle', fill: m.blank ? ctx.accent : null, halo: Math.abs(m.to.i - m.from.i) > 1 });
        B.text((x1 + x2) / 2, lb, tw, m.text.size, 'middle');
      })();
      if (hide) { out = out.slice(0, snap[0]); }
    });
    B.pt(xs[0] - leftExtra, 0);
    B.pt(xs[n - 1] + rightExtra, endY);
    return finish(ctx, out + heads + frameLabels, B, 'Use fewer participants or shorter message texts.');
  }

  // ---------------------------------------------------------------------------
  // Structogram (Nassi-Shneiderman, DIN 66261)
  // ---------------------------------------------------------------------------

  var S_ROW = FS * 2;
  var S_INDENT = 6;
  var S_PAD = 1.8;

  function structogram(opts) {
    var fn = 'structogram';
    var o = U.optsOf(opts, fn);
    var ctx = context(o, fn);
    var labels = o.labels || {};
    var yes = mkLine(labels.yes || 'wahr', { size: SMALL, muted: true });
    var no = mkLine(labels.no || 'falsch', { size: SMALL, muted: true });
    var otherwise = labels.otherwise || 'sonst';
    var count = 0;

    function textLine(v, name, allowEmpty) {
      var s = v === undefined || v === null ? '' : str(v, fn, name, 120);
      if (!s) {
        if (!allowEmpty) throw fail(fn, '"' + name + '" must not be empty.');
        return emptyLine();
      }
      return mkLine(s, { full: true });
    }
    function seq(list, name, depth) {
      if (list === undefined || list === null) return [];
      if (!Array.isArray(list)) throw fail(fn, '"' + name + '" must be a list of statements.');
      if (depth > 6) throw fail(fn, 'nested too deep (max 6 levels).');
      return list.map(function (b, i) { return node(b, name + '[' + i + ']', depth); });
    }
    function node(b, name, depth) {
      if (++count > 80) throw fail(fn, 'too many statements (max 80).');
      if (typeof b === 'string' || typeof b === 'number') return { k: 'action', L: textLine(String(b), name, true) };
      objOf(b, fn, name, '"Anweisung" or { if, then, else } / { while, do } / { repeat, until } / { switch, cases }');
      if (b['if'] !== undefined) return { k: 'if', L: textLine(b['if'], name + '.if'), a: seq(b.then, name + '.then', depth + 1), b: seq(b['else'], name + '.else', depth + 1) };
      if (b['while'] !== undefined) return { k: 'pre', L: textLine(b['while'], name + '.while'), body: seq(b['do'], name + '.do', depth + 1) };
      if (b['for'] !== undefined) return { k: 'pre', L: textLine(b['for'], name + '.for'), body: seq(b['do'], name + '.do', depth + 1) };
      if (b.repeat !== undefined) {
        return { k: 'post', L: textLine(b.until !== undefined ? b.until : b['while_post'], name + '.until'), body: seq(b.repeat, name + '.repeat', depth + 1) };
      }
      if (b.loop !== undefined || b.forever !== undefined) {
        return { k: 'pre', endless: true, L: b.text ? textLine(b.text, name + '.text') : null, body: seq(b.loop !== undefined ? b.loop : b.forever, name + '.loop', depth + 1) };
      }
      if (b['switch'] !== undefined) {
        listOf(b.cases, fn, name + '.cases', 1, 6, '{ label, do: [...] }');
        var cases = b.cases.map(function (c, j) {
          objOf(c, fn, name + '.cases[' + j + ']', '{ label, do: [...] }');
          return { L: textLine(c.label !== undefined ? c.label : c['case'], name + '.cases[' + j + '].label', true), body: seq(c['do'] !== undefined ? c['do'] : c.then, name + '.cases[' + j + '].do', depth + 1) };
        });
        if (b['default'] !== undefined && b['default'] !== null) cases.push({ L: mkLine(otherwise, { size: SMALL, muted: true }), body: seq(b['default'], name + '.default', depth + 1) });
        return { k: 'switch', L: textLine(b['switch'], name + '.switch'), cases: cases };
      }
      if (b.call !== undefined) return { k: 'call', L: textLine(b.call, name + '.call') };
      var ex = b.exit !== undefined ? b.exit : b['break'] !== undefined ? b['break'] : b['return'];
      if (ex !== undefined) return { k: 'exit', L: textLine(ex, name + '.exit') };
      var act = b.action !== undefined ? b.action : b.text;
      if (act !== undefined) return { k: 'action', L: textLine(act, name + '.action', true) };
      throw fail(fn, name + ' is not a statement: use a string or one of if, while, for, repeat/until, loop, switch, call, exit (got ' + show(b) + ').');
    }

    var steps = o.steps !== undefined ? o.steps : o.blocks;
    listOf(steps, fn, 'steps', 1, 80, '["Anweisung", { if: "x > 0", then: [...], else: [...] }]');
    var body = seq(steps, 'steps', 0);
    var title = o.title !== undefined && o.title !== null && String(o.title).trim() ? mkLine(str(o.title, fn, 'title', 100), { bold: true }) : null;

    var emptyW = U.textWidth('∅', FS) + 2 * S_PAD;
    function tw(L) { return lineWidth(L) + 2 * S_PAD; }
    function rowH(L) { return L && (L.full || L.empty) ? Math.max(S_ROW, WRITE_H + 1) : S_ROW; }
    function seqMin(list) {
      var m = emptyW;
      list.forEach(function (b) { m = Math.max(m, minW(b)); });
      return m;
    }
    function minW(b) {
      switch (b.k) {
        case 'action': return Math.max(tw(b.L), b.L.empty ? 24 : 0);
        case 'call': return tw(b.L) + 2 * S_PAD + 2;
        case 'exit': return tw(b.L) + 4;
        case 'if': return Math.max((tw(b.L) + tw(yes) + tw(no)) * 1.15, seqMin(b.a) + seqMin(b.b));
        case 'switch': {
          var sum = 0;
          b.cases.forEach(function (c) { sum += Math.max(seqMin(c.body), tw(c.L)); });
          return Math.max(sum, tw(b.L) * 1.6);
        }
        default: return Math.max(b.L ? tw(b.L) : 12, S_INDENT + seqMin(b.body));
      }
    }
    function split(mins, width) {
      var total = mins.reduce(function (a, b) { return a + b; }, 0);
      var ws = mins.map(function (m) { return m / total * width; });
      return ws;
    }
    function seqH(list, w) {
      if (!list.length) return S_ROW;
      var h = 0;
      list.forEach(function (b) { h += height(b, w); });
      return h;
    }
    function height(b, w) {
      switch (b.k) {
        case 'action':
        case 'call':
        case 'exit': return rowH(b.L);
        case 'if': {
          var ws = split([seqMin(b.a), seqMin(b.b)], w);
          return rowH(b.L) + S_ROW * 0.9 + Math.max(seqH(b.a, ws[0]), seqH(b.b, ws[1]));
        }
        case 'switch': {
          var ws2 = split(b.cases.map(function (c) { return Math.max(seqMin(c.body), tw(c.L)); }), w);
          var m = 0;
          b.cases.forEach(function (c, i) { m = Math.max(m, seqH(c.body, ws2[i])); });
          return rowH(b.L) + S_ROW * 0.9 + m;
        }
        default: return (b.L ? rowH(b.L) : S_ROW * 0.6) + seqH(b.body, w - S_INDENT);
      }
    }

    var out = '';
    var ink = ctx.ink;
    function rect(x, y, w, h, fill) {
      out += el('rect', { x: x, y: y, width: w, height: h, fill: fill || '#ffffff', stroke: ink, 'stroke-width': LW });
    }
    function text(L, x, y, h, anchor, x1, x2) {
      out += drawLine(ctx, L, x, baselineIn(y, h, L), { anchor: anchor, x1: x1, x2: x2 });
    }
    function drawSeq(list, x, y, w, h) {
      if (!list.length) {
        rect(x, y, w, h);
        out += el('text', { x: x + w / 2, y: y + Math.min(h, S_ROW) / 2 + FS * U.CAP / 2, 'font-size': FS, fill: ctx.muted, 'text-anchor': 'middle' }, '∅');
        return;
      }
      var cy = y;
      list.forEach(function (b, i) {
        var bh = i === list.length - 1 ? y + h - cy : height(b, w);
        draw(b, x, cy, w, bh);
        cy += bh;
      });
    }
    function draw(b, x, y, w, h) {
      var rh;
      switch (b.k) {
        case 'action':
          rect(x, y, w, h);
          text(b.L, x + S_PAD, y, rowH(b.L), 'start', x + S_PAD, x + w - S_PAD);
          break;
        case 'call':
          rect(x, y, w, h);
          out += el('path', { d: 'M' + f(x + 1.4) + ' ' + f(y) + 'V' + f(y + h) + 'M' + f(x + w - 1.4) + ' ' + f(y) + 'V' + f(y + h), stroke: ink, 'stroke-width': LW, fill: 'none' });
          text(b.L, x + 1.4 + S_PAD, y, rowH(b.L), 'start', x + 1.4 + S_PAD, x + w - 1.4 - S_PAD);
          break;
        case 'exit':
          rect(x, y, w, h);
          out += el('path', { d: 'M' + f(x + 3) + ' ' + f(y) + 'L' + f(x) + ' ' + f(y + h / 2) + 'L' + f(x + 3) + ' ' + f(y + h), stroke: ink, 'stroke-width': LW, fill: 'none' });
          text(b.L, x + 3 + S_PAD, y, rowH(b.L), 'start', x + 3 + S_PAD, x + w - S_PAD);
          break;
        case 'if': {
          var ws = split([seqMin(b.a), seqMin(b.b)], w);
          rh = rowH(b.L) + S_ROW * 0.9;
          rect(x, y, w, rh);
          out += el('path', { d: 'M' + f(x) + ' ' + f(y) + 'L' + f(x + ws[0]) + ' ' + f(y + rh) + 'L' + f(x + w) + ' ' + f(y), stroke: ink, 'stroke-width': LW, fill: 'none' });
          var cw = lineWidth(b.L);
          var cx = Math.min(Math.max(x + ws[0], x + S_PAD + cw / 2), x + w - S_PAD - cw / 2);
          text(b.L, cx, y, rowH(b.L), 'middle', x + S_PAD, x + w - S_PAD);
          out += drawLine(ctx, yes, x + S_PAD, y + rh - 1.4);
          out += drawLine(ctx, no, x + w - S_PAD, y + rh - 1.4, { anchor: 'end' });
          drawSeq(b.a, x, y + rh, ws[0], h - rh);
          drawSeq(b.b, x + ws[0], y + rh, ws[1], h - rh);
          break;
        }
        case 'switch': {
          var ws2 = split(b.cases.map(function (c) { return Math.max(seqMin(c.body), tw(c.L)); }), w);
          var last = ws2[ws2.length - 1];
          rh = rowH(b.L) + S_ROW * 0.9;
          rect(x, y, w, rh);
          var apex = b.cases.length > 1 ? w - last : w;
          out += el('path', { d: 'M' + f(x) + ' ' + f(y) + 'L' + f(x + apex) + ' ' + f(y + rh) + (apex < w ? 'L' + f(x + w) + ' ' + f(y) : ''), stroke: ink, 'stroke-width': LW, fill: 'none' });
          var sw = lineWidth(b.L);
          var sx = Math.min(Math.max(x + apex, x + S_PAD + sw / 2), x + w - S_PAD - sw / 2);
          text(b.L, sx, y, rowH(b.L), 'middle', x + S_PAD, x + w - S_PAD);
          var kx = x;
          b.cases.forEach(function (c, i) {
            var cw2 = ws2[i];
            if (i > 0 && i < b.cases.length - 1) out += el('line', { x1: kx, y1: y + rh * (kx - x) / apex, x2: kx, y2: y + rh, stroke: ink, 'stroke-width': LW });
            // labels left of the apex sit at the left of their column (away from the diagonal)
            var right = kx + 0.01 >= x + apex;
            out += drawLine(ctx, c.L, right ? kx + cw2 / 2 : kx + S_PAD, y + rh - (c.L.full || c.L.empty ? 0.6 : 1.4), { anchor: right ? 'middle' : 'start', x1: kx + 1, x2: kx + cw2 - 1 });
            drawSeq(c.body, kx, y + rh, cw2, h - rh);
            kx += cw2;
          });
          break;
        }
        default: {
          rect(x, y, w, h);
          rh = b.L ? rowH(b.L) : S_ROW * 0.6;
          if (b.k === 'post') {
            if (b.L) text(b.L, x + S_PAD, y + h - rh, rh, 'start', x + S_PAD, x + w - S_PAD);
            drawSeq(b.body, x + S_INDENT, y, w - S_INDENT, h - rh);
          } else {
            if (b.L) text(b.L, x + S_PAD, y, rh, 'start', x + S_PAD, x + w - S_PAD);
            drawSeq(b.body, x + S_INDENT, y + rh, w - S_INDENT, h - rh);
            if (b.endless) out += el('line', { x1: x + S_INDENT, y1: y + h, x2: x + w, y2: y + h, stroke: ink, 'stroke-width': LW });
          }
        }
      }
    }

    var minWidth = Math.max(seqMin(body), title ? tw(title) : 0);
    var W;
    if (ctx.widthMm) W = Math.max(ctx.widthMm, minWidth);
    else W = Math.max(minWidth, Math.min(ctx.maxWidthMm, 110));
    var y0 = 0;
    if (title) {
      rect(0, 0, W, S_ROW, ctx.fill);
      text(title, S_PAD, 0, S_ROW, 'start', S_PAD, W - S_PAD);
      y0 = S_ROW;
    }
    var bh = seqH(body, W);
    drawSeq(body, 0, y0, W, bh);
    out += el('rect', { x: 0, y: 0, width: W, height: y0 + bh, fill: 'none', stroke: ink, 'stroke-width': LW * 2 });
    var B = new Bounds();
    B.rect(0, 0, W, y0 + bh);
    var s = finish(ctx, out, B, 'Shorten the texts or split the algorithm into two structograms.', true);
    return s;
  }

  // ---------------------------------------------------------------------------
  // ER diagram
  // ---------------------------------------------------------------------------

  /** "__id__" -> key; "klasse_id (FK)" / "↑klasse_id" -> foreign key. */
  function erAttr(s) {
    var key = false;
    var fk = false;
    var t = s.trim();
    var m = /^__(.+)__$/.exec(t);
    if (m) {
      key = true;
      t = m[1].trim();
    }
    if (/\s*\((FK|fk)\)\s*$/.test(t)) {
      fk = true;
      t = t.replace(/\s*\((FK|fk)\)\s*$/, '');
    } else if (/^↑/.test(t)) {
      fk = true;
      t = t.slice(1).trim();
    }
    var L = mkLine(t, { underline: key, full: true });
    L.key = key;
    L.fk = fk;
    return L;
  }

  /** Crow's foot end from a cardinality text: {many, min} or null. */
  function footOf(s) {
    var t = plainOf(s).toLowerCase().replace(/\s+/g, '');
    if (!t) return null;
    if (t === '1' || t === '(1,1)' || t === '1..1') return { many: false, min: 1 };
    if (t === 'c' || t === '0..1' || t === '(0,1)') return { many: false, min: 0 };
    if (/^(1\.\.(\*|n|m)|\(1,(\*|n|m)\))$/.test(t)) return { many: true, min: 1 };
    if (/^(n|m|\*|0\.\.(\*|n|m)|\(0,(\*|n|m)\))$/.test(t)) return { many: true, min: 0 };
    return null;
  }

  function erDiagram(opts) {
    var fn = 'erDiagram';
    var o = U.optsOf(opts, fn);
    var ctx = context(o, fn);
    var notation = o.notation === undefined || o.notation === null ? 'chen' : String(o.notation).toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z]/g, '');
    if (notation === 'crowfoot' || notation === 'crowsfoot' || notation === 'kraehenfuss') notation = 'crowsfoot';
    if (notation === 'minmax') notation = 'chen';
    if (notation !== 'chen' && notation !== 'crowsfoot') throw fail(fn, '"notation" must be "chen", "minmax" or "crowsfoot" (got ' + show(o.notation) + ').');
    listOf(o.entities, fn, 'entities', 1, 12, '{ name, attributes: ["__id__", "name"] }');
    var byKey = Object.create(null);
    var ents = o.entities.map(function (e, i) {
      if (typeof e === 'string') e = { name: e };
      objOf(e, fn, 'entities[' + i + ']', '{ name, attributes: [...] }');
      var nm = str(e.name, fn, 'entities[' + i + '].name', 60, true);
      var k = keyOf(nm);
      if (byKey[k]) throw fail(fn, 'two entities are named "' + plainOf(nm) + '".');
      var E = { id: 'e' + i, name: mkLine(nm, { bold: true, full: true }), label: plainOf(nm), attrs: linesOf(e.attributes, fn, 'entities[' + i + '].attributes', 12, erAttr) };
      byKey[k] = E;
      return E;
    });
    var rels = (o.relationships === undefined || o.relationships === null ? [] : listOf(o.relationships, fn, 'relationships', 0, 16)).map(function (r, i) {
      var nm = 'relationships[' + i + ']';
      objOf(r, fn, nm, '{ name, from, to, from_card, to_card }');
      var card = function (v, n2) { return v === undefined || v === null || String(v) === '' ? null : mkLine(str(v, fn, nm + '.' + n2, 20), { size: SMALL * 1.07, bold: true }); };
      return {
        id: 'r' + i, rawName: r.name !== undefined && r.name !== null ? str(r.name, fn, nm + '.name', 60) : '',
        name: mkLine(r.name !== undefined && r.name !== null ? str(r.name, fn, nm + '.name', 60) : '', { full: true }),
        from: lookup(byKey, r.from, fn, nm + '.from', 'entities'), to: lookup(byKey, r.to, fn, nm + '.to', 'entities'),
        fromCard: card(r.from_card, 'from_card'), toCard: card(r.to_card, 'to_card'), blank: blankOf(r),
        attrs: linesOf(r.attributes, fn, nm + '.attributes', 6, erAttr)
      };
    });
    return notation === 'crowsfoot' ? erCrowsFoot(ctx, ents, rels) : erChen(ctx, ents, rels);
  }

  function erChen(ctx, ents, rels) {
    var ATTR_H = 6.6;
    var GAPX = 2.5;
    var SIDE = 6;
    function ellipse(L) { return { L: L, w: Math.max(15, lineWidth(L) + 7), h: ATTR_H }; }
    function cluster(id, kind, nameL, attrs) {
      var items = attrs.map(ellipse);
      var top = items.slice(0, Math.ceil(items.length / 2));
      var bottom = items.slice(top.length);
      function rowW(list) {
        var w = 0;
        list.forEach(function (e, i) { w += e.w + (i ? GAPX : 0); });
        return w;
      }
      var coreW = kind === 'entity' ? Math.max(22, lineWidth(nameL) + 2 * PAD + 3) : Math.max(24, (lineWidth(nameL) + 2 * PAD) * 1.7);
      var coreH = kind === 'entity' ? ROW + 3 : ROW + 6;
      var side = items.length ? ATTR_H + SIDE : 0;
      return { id: id, kind: kind, nameL: nameL, coreW: coreW, coreH: coreH, top: top, bottom: bottom,
        width: Math.max(coreW, rowW(top), rowW(bottom)), height: coreH + 2 * side, rowW: rowW };
    }
    var clusters = ents.map(function (e) { var c = cluster(e.id, 'entity', e.name, e.attrs); c.blank = false; return c; })
      .concat(rels.map(function (r) { var c = cluster(r.id, 'rel', r.name, r.attrs); c.blank = r.blank; return c; }));
    var byId = {};
    clusters.forEach(function (c) { byId[c.id] = c; });
    var edges = [];
    rels.forEach(function (r) {
      edges.push({ v: r.from.id, w: r.id });
      edges.push({ v: r.id, w: r.to.id });
    });
    var lay = layoutGraph(clusters.map(function (c) { return { id: c.id, width: c.width, height: c.height }; }), edges,
      { rankdir: 'LR', nodesep: 7, ranksep: 13, edgesep: 4 });
    var B = new Bounds();
    var lines = '';
    var marks = '';
    rels.forEach(function (r) {
      // a blank element is laid out like the others (same size in both versions), but only drawn in the solution
      var hide = r.blank && !ctx.show;
      var snap = [lines.length, marks.length];
      (function () {
        var color = r.blank ? ctx.accent : ctx.ink;
        var d = lay.nodes[r.id];
        var dc = byId[r.id];
        [[r.from, r.fromCard], [r.to, r.toCard]].forEach(function (end, side) {
          var en = lay.nodes[end[0].id];
          var ec = byId[end[0].id];
          var off = r.from === r.to ? (side === 0 ? -2.6 : 2.6) : 0;
          var dx = d.x - en.x;
          var dy = d.y - en.y;
          var a = clipShape({ kind: 'rect', x: en.x, y: en.y + off, w: ec.coreW, h: ec.coreH }, dx, dy);
          var b = clipShape({ kind: 'diamond', x: d.x, y: d.y + off, w: dc.coreW, h: dc.coreH }, -dx, -dy);
          if (r.from === r.to) {
            // self relationship: two lines from the top/bottom corner area
            a = { x: en.x + ec.coreW / 2 * (dx >= 0 ? 1 : -1), y: en.y + off };
          }
          lines += el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: color, 'stroke-width': LW });
          B.pt(a.x, a.y);
          B.pt(b.x, b.y);
          if (end[1]) {
            var l = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y)) || 1;
            var e = { x: a.x, y: a.y, ux: -(b.x - a.x) / l, uy: -(b.y - a.y) / l };
            // a self relationship has two parallel lines: their cardinalities go above and below
            marks += endLabel(ctx, end[1], e, 1.6, (side === 0 ? -1 : 1) * (r.from === r.to ? -1 : 1), color, B);
          }
        });
      })();
      if (hide) { lines = lines.slice(0, snap[0]); marks = marks.slice(0, snap[1]); }
    });
    var nodes = '';
    clusters.forEach(function (k) {
      // a blank element is laid out like the others (same size in both versions), but only drawn in the solution
      var hide = k.blank && !ctx.show;
      var snap = [lines.length, nodes.length];
      (function () {
        var p = lay.nodes[k.id];
        var color = k.blank ? ctx.accent : ctx.ink;
        function placeRow(list, cy) {
          var x = p.x - k.rowW(list) / 2;
          list.forEach(function (it) {
            var ex = x + it.w / 2;
            var toCore = clipShape({ kind: k.kind === 'entity' ? 'rect' : 'diamond', x: p.x, y: p.y, w: k.coreW, h: k.coreH }, ex - p.x, cy - p.y);
            var fromEll = clipShape({ kind: 'ellipse', x: ex, y: cy, w: it.w, h: it.h }, toCore.x - ex, toCore.y - cy);
            lines += el('line', { x1: fromEll.x, y1: fromEll.y, x2: toCore.x, y2: toCore.y, stroke: color, 'stroke-width': LW });
            nodes += el('ellipse', { cx: ex, cy: cy, rx: it.w / 2, ry: it.h / 2, fill: '#ffffff', stroke: color, 'stroke-width': LW });
            nodes += drawLine(ctx, it.L, ex, cy + FS * U.CAP / 2 - (it.L.full || it.L.empty ? -1 : 0), { anchor: 'middle', x1: ex - it.w / 2 + 3, x2: ex + it.w / 2 - 3 });
            B.rect(ex - it.w / 2, cy - it.h / 2, it.w, it.h);
            x += it.w + GAPX;
          });
        }
        var rowOff = k.coreH / 2 + SIDE + ATTR_H / 2;
        placeRow(k.top, p.y - rowOff);
        placeRow(k.bottom, p.y + rowOff);
        var hw = k.coreW / 2;
        var hh = k.coreH / 2;
        if (k.kind === 'entity') {
          nodes += el('rect', { x: p.x - hw, y: p.y - hh, width: k.coreW, height: k.coreH, fill: ctx.fill, stroke: color, 'stroke-width': LW * 1.6 });
        } else {
          nodes += el('path', { d: 'M' + f(p.x - hw) + ' ' + f(p.y) + 'L' + f(p.x) + ' ' + f(p.y - hh) + 'L' + f(p.x + hw) + ' ' + f(p.y) + 'L' + f(p.x) + ' ' + f(p.y + hh) + 'Z', fill: '#ffffff', stroke: color, 'stroke-width': LW * 1.6 });
        }
        nodes += drawLine(ctx, k.nameL, p.x, p.y + FS * U.CAP / 2 + (k.nameL.full ? 1.2 : 0), { anchor: 'middle', x1: p.x - hw * (k.kind === 'entity' ? 1 : 0.6) + 1.5, x2: p.x + hw * (k.kind === 'entity' ? 1 : 0.6) - 1.5, fill: k.blank ? ctx.accent : null });
        B.rect(p.x - hw, p.y - hh, k.coreW, k.coreH);
      })();
      if (hide) { lines = lines.slice(0, snap[0]); nodes = nodes.slice(0, snap[1]); }
    });
    return finish(ctx, lines + nodes + marks, B, 'Use fewer entities or attributes, or shorter names.');
  }

  function erCrowsFoot(ctx, ents, rels) {
    var boxes = ents.map(function (e) {
      var box = measureBox({ head: [e.name], parts: [e.attrs] }, 28);
      // room for the PK/FK column
      box.keyW = e.attrs.some(function (L) { return L.key || L.fk; }) ? 7 : 0;
      box.width += box.keyW;
      box.id = e.id;
      return box;
    });
    var byId = {};
    boxes.forEach(function (b) { byId[b.id] = b; });
    var edges = rels.map(function (r) {
      r.edgeName = r.rawName ? mkLine(r.rawName, { size: SMALL, full: true }) : null;
      return { v: r.from.id, w: r.to.id, lw: r.edgeName ? lineWidth(r.edgeName) + 2 : 0, lh: r.edgeName ? SMALL * 1.6 : 0 };
    });
    var lay = layoutGraph(boxes.map(function (b) { return { id: b.id, width: b.width, height: b.height }; }), edges,
      { rankdir: 'LR', nodesep: 10, ranksep: 24, edgesep: 5 });
    var B = new Bounds();
    var lines = '';
    var marks = '';
    rels.forEach(function (r, i) {
      // a blank element is laid out like the others (same size in both versions), but only drawn in the solution
      var hide = r.blank && !ctx.show;
      var snap = [lines.length, marks.length];
      (function () {
        var pts = lay.edges[i].points;
        if (pts.length < 2) return;
        var color = r.blank ? ctx.accent : ctx.ink;
        pts.forEach(function (p) { B.pt(p.x, p.y); });
        lines += el('path', attrsWith(strokeOf(color), { d: polyline(pts) }));
        // 1, n, 0..1, 1..* … at an entity say how many of it belong to one of the other (read across): the foot goes
        // there. A (min,max) pair says how often this entity takes part: its foot goes to the other end.
        var ends = [endDir(pts), startDir(pts)];
        [[r.toCard, 0], [r.fromCard, 1]].forEach(function (card) {
          if (!card[0]) return;
          var L = card[0];
          var gap = hasGap(L);
          var txt = L.full ? L.answer : L.segs.map(function (sg) { return sg.t; }).join('');
          var foot = footOf(txt);
          if (foot) {
            if (!gap || ctx.show) marks += footEnd(ends[/^\s*\(/.test(txt) ? 1 - card[1] : card[1]], foot, gap ? ctx.accent : color);
          } else {
            marks += endLabel(ctx, L, ends[card[1]], 1.5, 1, color, B);
          }
        });
        if (r.edgeName && lay.edges[i].label) {
          var lp = lay.edges[i].label;
          var L = r.edgeName;
          var lb = lp.y + SMALL * U.CAP / 2;
          B.text(lp.x, lb, lineWidth(L), SMALL, 'middle');
          marks += drawLine(ctx, L, lp.x, lb, { anchor: 'middle', halo: true, fill: r.blank ? ctx.accent : null, x1: lp.x - lineWidth(L) / 2, x2: lp.x + lineWidth(L) / 2 });
        }
      })();
      if (hide) { lines = lines.slice(0, snap[0]); marks = marks.slice(0, snap[1]); }
    });
    var nodes = '';
    boxes.forEach(function (b) {
      var p = lay.nodes[b.id];
      nodes += drawBox(ctx, b, p.x, p.y, B);
      // PK/FK markers in front of the attributes
      if (b.keyW) {
        var x = p.x - b.width / 2;
        var y = p.y - b.height / 2 + b.headH + 0.6;
        b.parts[0].forEach(function (L) {
          var h = lineHeight(L, ROW);
          if (L.key || L.fk) {
            nodes += el('text', { x: x + b.width - PAD, y: baselineIn(y, h, L) - (L.full || L.empty ? 0.4 : 0), 'font-size': SMALL * 0.9, 'font-weight': 700, fill: ctx.muted, 'text-anchor': 'end' }, L.key ? 'PK' : 'FK');
          }
          y += h;
        });
      }
    });
    return finish(ctx, lines + nodes + marks, B, 'Use fewer entities or attributes, or shorter names.');
  }

  /** Crow's foot end: many = crow's foot, else a bar; min 0 = circle, 1 = second bar. */
  function footEnd(e, foot, color) {
    var px = -e.uy;
    var py = e.ux;
    var out = '';
    var a = strokeOf(color);
    if (foot.many) {
      var bx = e.x - e.ux * 3.2;
      var by = e.y - e.uy * 3.2;
      out += el('path', attrsWith(a, { d: 'M' + f(bx) + ' ' + f(by) + 'L' + f(e.x + px * 1.8) + ' ' + f(e.y + py * 1.8) + 'M' + f(bx) + ' ' + f(by) + 'L' + f(e.x - px * 1.8) + ' ' + f(e.y - py * 1.8) }));
    } else {
      var ax = e.x - e.ux * 2.2;
      var ay = e.y - e.uy * 2.2;
      out += el('path', attrsWith(a, { d: 'M' + f(ax + px * 1.8) + ' ' + f(ay + py * 1.8) + 'L' + f(ax - px * 1.8) + ' ' + f(ay - py * 1.8) }));
    }
    var mx = e.x - e.ux * 5.2;
    var my = e.y - e.uy * 5.2;
    if (foot.min === 0) out += el('circle', { cx: e.x - e.ux * 5.6, cy: e.y - e.uy * 5.6, r: 1.15, fill: '#ffffff', stroke: color, 'stroke-width': LW });
    else out += el('path', attrsWith(a, { d: 'M' + f(mx + px * 1.8) + ' ' + f(my + py * 1.8) + 'L' + f(mx - px * 1.8) + ' ' + f(my - py * 1.8) }));
    return out;
  }

  // ---------------------------------------------------------------------------
  // Multi-line text in shapes (activity diagrams, flowcharts, use cases)
  // ---------------------------------------------------------------------------

  /**
   * A text that may wrap onto several lines. Without gaps it is wrapped at maxW; a text with gaps stays one
   * line; "" gives an empty writing line when o.allowEmpty, otherwise no line.
   */
  function textBlock(s, maxW, o) {
    o = o || {};
    s = String(s === undefined || s === null ? '' : s).replace(/\s+/g, ' ').trim();
    if (!s) return o.allowEmpty ? [emptyLine(o)] : [];
    if (s.indexOf('[[') >= 0) return [mkLine(s, attrsWith(o, { full: true }))];
    var size = o.size || FS;
    // a single long word widens the shape instead of being split
    s.split(' ').forEach(function (w) { maxW = Math.max(maxW, Math.min(90, U.textWidth(w, size, !!o.bold) + 0.5)); });
    var lines = U.wrapText(s, maxW, size, !!o.bold);
    var max = o.maxLines || 4;
    if (lines.length > max) {
      throw fail(o.fn || 'diagram', '"' + (o.name || 'text') + '" is too long for its shape (' + lines.length + ' lines, max ' + max +
        '): "' + s.slice(0, 50) + (s.length > 50 ? '…' : '') + '" – shorten it.');
    }
    return lines.map(function (t) { return mkLine(t, o); });
  }

  function blockWidth(lines) {
    var w = 0;
    lines.forEach(function (L) { w = Math.max(w, lineWidth(L)); });
    return w;
  }

  function blockHeight(lines, row) {
    var h = 0;
    lines.forEach(function (L) { h += lineHeight(L, row); });
    return h;
  }

  /** Lines centred around (cx, cy); writing lines span x1 … x2. */
  function drawBlock(ctx, lines, cx, cy, row, x1, x2, fill) {
    var out = '';
    var y = cy - blockHeight(lines, row) / 2;
    lines.forEach(function (L) {
      var h = lineHeight(L, row);
      out += drawLine(ctx, L, cx, baselineIn(y, h, L), { anchor: 'middle', x1: x1, x2: x2, fill: fill });
      y += h;
    });
    return out;
  }

  // ---------------------------------------------------------------------------
  // Activity diagram (UML) and flowchart (Programmablaufplan, DIN 66001)
  // ---------------------------------------------------------------------------

  var FLOW_KINDS = {
    activity: {
      start: 'start', initial: 'start', end: 'end', 'final': 'end', flow_end: 'flow_end', flow_final: 'flow_end',
      action: 'action', activity: 'action', decision: 'decision', merge: 'merge', fork: 'fork', join: 'join', object: 'object'
    },
    pap: {
      start: 'start', end: 'end', stop: 'end', operation: 'action', action: 'action', process: 'action',
      decision: 'decision', branch: 'decision', io: 'io', input: 'io', output: 'io', subroutine: 'call', call: 'call',
      connector: 'connector', merge: 'merge'
    }
  };

  function flowDiagram(opts, notation) {
    var pap = notation === 'pap';
    var fn = pap ? 'flowchart' : 'activityDiagram';
    var o = U.optsOf(opts, fn);
    var ctx = context(o, fn);
    var labels = o.labels || {};
    var kinds = FLOW_KINDS[notation];
    var kindNames = Object.keys(kinds).filter(function (k, i, a) { return a.indexOf(k) === i; });
    listOf(o.nodes, fn, 'nodes', 1, 40, pap ? '{ id?, kind: "operation", text }' : '{ id?, kind: "action", text }');
    var byKey = Object.create(null);
    var byKind = Object.create(null);
    var nodes = o.nodes.map(function (n, i) {
      var nm = 'nodes[' + i + ']';
      if (typeof n === 'string' || typeof n === 'number') n = { text: String(n) };
      objOf(n, fn, nm, '{ id?, kind, text }');
      var kindIn = n.kind === undefined || n.kind === null ? 'action' : String(n.kind).toLowerCase().trim();
      var kind = own(kinds, kindIn);
      if (!kind) throw fail(fn, nm + '.kind must be one of ' + kindNames.join(', ') + ' (got ' + show(n.kind) + ').');
      var hasText = n.text !== undefined && n.text !== null;
      var text = hasText ? str(n.text, fn, nm + '.text', 160) : '';
      var N = { id: 'n' + i, kind: kind, label: '' };
      // texts and sizes (millimetres; TB layout, the bars of fork/join are turned for LR below)
      if (kind === 'start' || kind === 'end') {
        if (pap) {
          N.lines = textBlock(hasText ? text : (kind === 'start' ? labels.start || 'Start' : labels.end || 'Ende'), 40, { allowEmpty: true, fn: fn, name: nm + '.text', maxLines: 2 });
          N.width = Math.max(22, blockWidth(N.lines) + 10);
          N.height = Math.max(8, blockHeight(N.lines, ROW) + 3);
        } else {
          N.lines = [];
          N.width = N.height = kind === 'start' ? 4.4 : 6;
        }
      } else if (kind === 'flow_end') {
        N.lines = [];
        N.width = N.height = 5.2;
      } else if (kind === 'fork' || kind === 'join') {
        N.lines = [];
      } else if (kind === 'merge') {
        N.lines = [];
        N.width = N.height = pap ? 1.6 : 8;
      } else if (kind === 'decision') {
        N.lines = textBlock(text, 34, { allowEmpty: hasText, fn: fn, name: nm + '.text', maxLines: 4 });
        if (N.lines.length) {
          // the text box (bw × bh) fits into the diamond when bw/w + bh/h ≤ 1
          var bw = blockWidth(N.lines) + 2;
          var bh = blockHeight(N.lines, ROW) + 1.5;
          N.height = Math.max(10, bh * 2 + 3);
          N.width = Math.max(16, bw / (1 - bh / N.height) + 3);
        } else {
          N.width = N.height = 8;
        }
      } else if (kind === 'connector') {
        N.lines = textBlock(text, 14, { fn: fn, name: nm + '.text', maxLines: 1 });
        N.width = N.height = Math.max(7, blockWidth(N.lines) + 3);
      } else {
        if (!hasText && kind !== 'object') throw fail(fn, nm + ' needs "text" (use "" for an empty box to fill in).');
        N.lines = textBlock(text, 46, { allowEmpty: true, fn: fn, name: nm + '.text', maxLines: 6 });
        N.width = Math.max(24, blockWidth(N.lines) + 2 * PAD + 2 + (kind === 'io' ? 6 : kind === 'call' ? 4 : 0));
        N.height = Math.max(8, blockHeight(N.lines, ROW) + 3);
      }
      N.label = plainOf(text) || kind;
      var keys = [];
      if (n.id !== undefined && n.id !== null && String(n.id).trim()) keys.push(keyOf(String(n.id)));
      else if (plainOf(text)) keys.push(keyOf(text));
      else if (pap && (kind === 'start' || kind === 'end')) keys.push(keyOf(plainOf(N.lines.map(function (L) { return L.segs.map(function (sg) { return sg.t; }).join(''); }).join(' '))));
      keys.forEach(function (k) { byKey[k] = byKey[k] ? 'ambiguous' : N; });
      byKind[kind] = byKind[kind] ? 'ambiguous' : N;
      return N;
    });
    function ref(v, name) {
      var k = keyOf(v);
      if (!k) throw fail(fn, '"' + name + '" is missing.');
      var N = own(byKey, k) !== undefined ? byKey[k] : undefined;
      var kind = own(kinds, k);
      if (!N && kind && byKind[kind]) {
        N = byKind[kind];
        if (N === 'ambiguous') throw fail(fn, '"' + name + '": there are several ' + kind + ' nodes – give them an "id" and use it in the edges.');
      }
      if (N === 'ambiguous') throw fail(fn, '"' + name + '": several nodes are called "' + plainOf(v) + '" – give them an "id" and use it in the edges.');
      if (!N) {
        var known = Object.keys(byKey).filter(function (x) { return byKey[x] !== 'ambiguous'; })
          .concat(Object.keys(byKind).filter(function (x) { return byKind[x] !== 'ambiguous'; }));
        throw fail(fn, '"' + name + '" is "' + plainOf(v) + '", which is not a node. Refer to a node by its id, its text or (if there is only one) its kind: ' +
          known.filter(function (x, i) { return known.indexOf(x) === i; }).join(', ') + '.');
      }
      return N;
    }
    var edges;
    if (o.edges === undefined || o.edges === null) {
      // no edges: the nodes in order form a sequence
      edges = nodes.slice(1).map(function (N, i) { return { from: nodes[i], to: N, label: null, blank: false }; });
    } else {
      edges = listOf(o.edges, fn, 'edges', 0, 60).map(function (e, i) {
        var nm = 'edges[' + i + ']';
        objOf(e, fn, nm, '{ from, to, label? }');
        var label = e.label !== undefined && e.label !== null ? str(e.label, fn, nm + '.label', 60) : '';
        var E = { from: ref(e.from, nm + '.from'), to: ref(e.to, nm + '.to'), label: label ? mkLine(label, { size: SMALL * 1.07 }) : null, blank: blankOf(e) };
        if (E.from === E.to && ['action', 'object', 'io', 'call'].indexOf(E.from.kind) < 0) {
          throw fail(fn, nm + ' leads from the ' + E.from.kind + ' node "' + E.from.label + '" to itself – a loop goes back to an earlier node.');
        }
        return E;
      });
    }
    var rankdir = directionOf(o.direction, 'TB', fn);
    nodes.forEach(function (N) {
      if (N.kind !== 'fork' && N.kind !== 'join') return;
      var deg = 0;
      var din = 0;
      edges.forEach(function (e) {
        if (e.from === N) deg++;
        if (e.to === N) din++;
      });
      var len = Math.max(18, 14 * Math.max(deg, din));
      N.width = rankdir === 'TB' ? len : 1.8;
      N.height = rankdir === 'TB' ? 1.8 : len;
    });
    // an edge from a node to itself is drawn as a loop over its corner; dagre lays out the others
    var loops = {};
    edges.forEach(function (e) {
      if (e.from === e.to) e.loop = loops[e.from.id] = (loops[e.from.id] || 0) + 1;
    });
    var flow = edges.filter(function (e) { return !e.loop; });
    var lay = layoutGraph(nodes.map(function (N) {
      var sz = loopPadded(N, loops[N.id]);
      return { id: N.id, width: sz.width, height: sz.height };
    }), flow.map(function (e) { return { v: e.from.id, w: e.to.id, lw: e.label ? lineWidth(e.label) + 2 : 0, lh: e.label ? SMALL * 1.07 * 1.6 : 0 }; }),
      { rankdir: rankdir, nodesep: 9, ranksep: 9, edgesep: 5 });
    function shapeOf(N) {
      var p = lay.nodes[N.id];
      if (N.kind === 'start' && !pap) return { kind: 'circle', x: p.x, y: p.y, r: 2.2 };
      if (N.kind === 'end' && !pap) return { kind: 'circle', x: p.x, y: p.y, r: 3 };
      if (N.kind === 'flow_end') return { kind: 'circle', x: p.x, y: p.y, r: 2.6 };
      if (N.kind === 'connector') return { kind: 'circle', x: p.x, y: p.y, r: N.width / 2 };
      if (N.kind === 'merge' && pap) return { kind: 'circle', x: p.x, y: p.y, r: 0.8 };
      if (N.kind === 'decision' || N.kind === 'merge') return { kind: 'diamond', x: p.x, y: p.y, w: N.width, h: N.height };
      return { kind: 'rect', x: p.x, y: p.y, w: N.width, h: N.height };
    }
    var B = new Bounds();
    var lines = '';
    var marks = '';
    edges.forEach(function (e) {
      var hide = e.blank && !ctx.show;
      var snap = [lines.length, marks.length];
      var pts;
      var lp;
      if (e.loop) {
        var lo = boxLoop(lay.nodes[e.from.id], e.from, e.loop - 1);
        pts = lo.pts;
        lp = lo.label;
      } else {
        var i = flow.indexOf(e);
        pts = fixEnds(lay.edges[i].points, shapeOf(e.from), shapeOf(e.to));
        lp = lay.edges[i].label;
      }
      if (pts.length >= 2) {
        var color = e.blank ? ctx.accent : ctx.ink;
        pts.forEach(function (q) { B.pt(q.x, q.y); });
        lines += el('path', attrsWith(strokeOf(color), { d: polyline(pts) }));
        // in a PAP, flows join at a junction without arrow heads
        if (!(pap && e.to.kind === 'merge')) marks += pap ? filledArrow(endDir(pts), color) : openArrow(endDir(pts), color);
        if (e.label && lp) {
          var lb = lp.y + e.label.size * U.CAP / 2;
          B.text(lp.x, lb, lineWidth(e.label), e.label.size, 'middle');
          marks += drawLine(ctx, e.label, lp.x, lb, { anchor: 'middle', fill: e.blank ? ctx.accent : null, halo: true });
        }
      }
      if (hide) { lines = lines.slice(0, snap[0]); marks = marks.slice(0, snap[1]); }
    });
    var shapes = '';
    nodes.forEach(function (N) {
      var p = lay.nodes[N.id];
      var x = p.x - N.width / 2;
      var y = p.y - N.height / 2;
      var w = N.width;
      var h = N.height;
      var line = { stroke: ctx.ink, 'stroke-width': LW };
      B.rect(x, y, w, h);
      var inner = [x + PAD, x + w - PAD];
      switch (N.kind) {
        case 'start':
          if (!pap) { shapes += el('circle', { cx: p.x, cy: p.y, r: 2.2, fill: ctx.ink }); return; }
          shapes += el('rect', attrsWith(line, { x: x, y: y, width: w, height: h, rx: h / 2, fill: ctx.fill }));
          inner = [x + h / 2, x + w - h / 2];
          break;
        case 'end':
          if (!pap) { shapes += el('circle', attrsWith(line, { cx: p.x, cy: p.y, r: 3, fill: '#ffffff' })) + el('circle', { cx: p.x, cy: p.y, r: 1.9, fill: ctx.ink }); return; }
          shapes += el('rect', attrsWith(line, { x: x, y: y, width: w, height: h, rx: h / 2, fill: ctx.fill }));
          inner = [x + h / 2, x + w - h / 2];
          break;
        case 'flow_end':
          shapes += el('circle', attrsWith(line, { cx: p.x, cy: p.y, r: 2.6, fill: '#ffffff' })) +
            el('path', attrsWith(line, { d: 'M' + f(p.x - 1.8) + ' ' + f(p.y - 1.8) + 'L' + f(p.x + 1.8) + ' ' + f(p.y + 1.8) + 'M' + f(p.x - 1.8) + ' ' + f(p.y + 1.8) + 'L' + f(p.x + 1.8) + ' ' + f(p.y - 1.8), fill: 'none' }));
          return;
        case 'fork':
        case 'join':
          shapes += el('rect', { x: x, y: y, width: w, height: h, rx: 0.4, fill: ctx.ink });
          return;
        case 'merge':
          if (pap) { shapes += el('circle', { cx: p.x, cy: p.y, r: 0.8, fill: ctx.ink }); return; }
          shapes += el('path', attrsWith(line, { d: diamondPath(p.x, p.y, w, h), fill: '#ffffff' }));
          return;
        case 'decision':
          shapes += el('path', attrsWith(line, { d: diamondPath(p.x, p.y, w, h), fill: '#ffffff' }));
          inner = [p.x - w / 4 - 1, p.x + w / 4 + 1];
          break;
        case 'connector':
          shapes += el('circle', attrsWith(line, { cx: p.x, cy: p.y, r: w / 2, fill: '#ffffff' }));
          break;
        case 'io':
          shapes += el('path', attrsWith(line, { d: 'M' + f(x + 3) + ' ' + f(y) + 'H' + f(x + w) + 'L' + f(x + w - 3) + ' ' + f(y + h) + 'H' + f(x) + 'Z', fill: ctx.fill }));
          inner = [x + 3 + PAD, x + w - 3 - PAD];
          break;
        case 'call':
          shapes += el('rect', attrsWith(line, { x: x, y: y, width: w, height: h, fill: ctx.fill })) +
            el('path', attrsWith(line, { d: 'M' + f(x + 1.6) + ' ' + f(y) + 'V' + f(y + h) + 'M' + f(x + w - 1.6) + ' ' + f(y) + 'V' + f(y + h), fill: 'none' }));
          inner = [x + 1.6 + PAD, x + w - 1.6 - PAD];
          break;
        case 'object':
          shapes += el('rect', attrsWith(line, { x: x, y: y, width: w, height: h, fill: '#ffffff' }));
          break;
        default:
          shapes += el('rect', attrsWith(line, { x: x, y: y, width: w, height: h, rx: pap ? 0 : Math.min(3.5, h / 2), fill: ctx.fill }));
      }
      shapes += drawBlock(ctx, N.lines, p.x, p.y, ROW, inner[0], inner[1]);
    });
    return finish(ctx, lines + shapes + marks, B, 'Use fewer nodes, shorter texts or direction "horizontal".');
  }

  function diamondPath(cx, cy, w, h) {
    return 'M' + f(cx) + ' ' + f(cy - h / 2) + 'L' + f(cx + w / 2) + ' ' + f(cy) + 'L' + f(cx) + ' ' + f(cy + h / 2) + 'L' + f(cx - w / 2) + ' ' + f(cy) + 'Z';
  }

  function activityDiagram(opts) { return flowDiagram(opts, 'activity'); }
  function flowchart(opts) { return flowDiagram(opts, 'pap'); }

  // ---------------------------------------------------------------------------
  // Use case diagram (UML)
  // ---------------------------------------------------------------------------

  var UC_KINDS = { association: 'association', include: 'include', includes: 'include', extend: 'extend', extends: 'extend',
    generalization: 'generalization', inheritance: 'generalization' };

  function useCaseDiagram(opts) {
    var fn = 'useCaseDiagram';
    var o = U.optsOf(opts, fn);
    var ctx = context(o, fn);
    var byKey = Object.create(null);
    var actors = (o.actors === undefined || o.actors === null ? [] : listOf(o.actors, fn, 'actors', 0, 10)).map(function (a, i) {
      if (typeof a === 'string' || typeof a === 'number') a = { name: String(a) };
      objOf(a, fn, 'actors[' + i + ']', '{ name, side?: "left" | "right" }');
      var nm = str(a.name, fn, 'actors[' + i + '].name', 60, true);
      var side = a.side === undefined || a.side === null ? 'left' : String(a.side).toLowerCase();
      if (side !== 'left' && side !== 'right') throw fail(fn, 'actors[' + i + '].side must be "left" or "right".');
      var A = { id: 'a' + i, actor: true, side: side, label: plainOf(nm), lines: textBlock(nm, 30, { maxLines: 3, fn: fn, name: 'actors[' + i + '].name' }) };
      A.width = Math.max(10, blockWidth(A.lines) + 2);
      A.height = 12.5 + blockHeight(A.lines, ROW);
      var k = keyOf(nm);
      if (byKey[k]) throw fail(fn, 'two elements are named "' + plainOf(nm) + '".');
      byKey[k] = A;
      return A;
    });
    listOf(o.use_cases !== undefined ? o.use_cases : o.useCases, fn, 'use_cases', 1, 16, '"Geld abheben"');
    var cases = (o.use_cases !== undefined ? o.use_cases : o.useCases).map(function (u, i) {
      if (typeof u === 'string' || typeof u === 'number') u = { name: String(u) };
      objOf(u, fn, 'use_cases[' + i + ']', '{ name }');
      var nm = str(u.name, fn, 'use_cases[' + i + '].name', 80, true);
      var U2 = { id: 'u' + i, label: plainOf(nm), lines: textBlock(nm, 38, { maxLines: 4, fn: fn, name: 'use_cases[' + i + '].name' }) };
      U2.width = Math.max(26, blockWidth(U2.lines) * 1.22 + 8);
      U2.height = Math.max(9, blockHeight(U2.lines, ROW) * 1.3 + 3.5);
      var k = keyOf(nm);
      if (byKey[k]) throw fail(fn, 'two elements are named "' + plainOf(nm) + '" – actors and use cases need different names.');
      byKey[k] = U2;
      return U2;
    });
    var links = (o.links === undefined || o.links === null ? [] : listOf(o.links, fn, 'links', 0, 40)).map(function (l, i) {
      var nm = 'links[' + i + ']';
      objOf(l, fn, nm, '{ from, to, kind? }');
      var kind = own(UC_KINDS, String(l.kind === undefined || l.kind === null ? 'association' : l.kind).toLowerCase().trim());
      if (!kind) throw fail(fn, nm + '.kind must be association, include, extend or generalization (got ' + show(l.kind) + ').');
      var from = lookup(byKey, l.from, fn, nm + '.from', 'actors and use cases');
      var to = lookup(byKey, l.to, fn, nm + '.to', 'actors and use cases');
      if (from === to) throw fail(fn, nm + ' connects "' + from.label + '" with itself.');
      if ((kind === 'include' || kind === 'extend') && (from.actor || to.actor)) throw fail(fn, nm + ': ' + kind + ' connects two use cases, not actors.');
      if (kind === 'generalization' && from.actor !== to.actor) throw fail(fn, nm + ': a generalization connects two actors or two use cases.');
      var text = l.label !== undefined && l.label !== null && String(l.label).trim() ? str(l.label, fn, nm + '.label', 60) :
        kind === 'include' ? '«include»' : kind === 'extend' ? '«extend»' : '';
      return { kind: kind, from: from, to: to, blank: blankOf(l), label: text ? mkLine(text, { size: SMALL }) : null };
    });
    // Layout: the use cases in columns (include/extend/generalization lead to the right), the actors as one more
    // column on the left and on the right, so that dagre routes their lines around the use cases.
    var ucLinks = links.filter(function (l) { return !l.from.actor && !l.to.actor; });
    var actorLinks = links.filter(function (l) { return l.from.actor !== l.to.actor; });
    function ucEdge(l) {
      // extend: the extending use case to the right of its base
      var flip = l.kind === 'extend';
      return { v: flip ? l.to.id : l.from.id, w: flip ? l.from.id : l.to.id, lw: l.label ? lineWidth(l.label) + 2 : 0, lh: l.label ? SMALL * 1.6 : 0 };
    }
    var dopts = { rankdir: 'LR', nodesep: 6, ranksep: 16, edgesep: 4 };
    var ucNodes = cases.map(function (u) { return { id: u.id, width: u.width, height: u.height }; });
    // pass 1: the columns of the use cases
    var first = layoutGraph(ucNodes, ucLinks.map(ucEdge), dopts);
    var xs = [];
    var col = Object.create(null);
    cases.forEach(function (u) {
      var x = Math.round(first.nodes[u.id].x * 10);
      if (xs.indexOf(x) < 0) xs.push(x);
    });
    xs.sort(function (p, q) { return p - q; });
    cases.forEach(function (u) { col[u.id] = xs.indexOf(Math.round(first.nodes[u.id].x * 10)); });
    var maxCol = xs.length - 1;
    var lastCol = cases.filter(function (u) { return col[u.id] === maxCol; })[0];
    // pass 2: with the actors (left ones before column 0, right ones after the last column)
    var edges2 = ucLinks.map(ucEdge).concat(actorLinks.map(function (l) {
      var a = l.from.actor ? l.from : l.to;
      var u = l.from.actor ? l.to : l.from;
      return a.side === 'left' ? { v: a.id, w: u.id, minlen: col[u.id] + 1 } : { v: u.id, w: a.id, minlen: maxCol - col[u.id] + 1 };
    }));
    var hidden = [];
    var leftActors = actors.filter(function (a) { return a.side === 'left'; });
    function linked(n) { return actorLinks.some(function (l) { return l.from === n || l.to === n; }); }
    // use cases and actors without a line still keep their place (invisible edges)
    cases.forEach(function (u) { if (!linked(u) && leftActors.length) hidden.push({ v: leftActors[0].id, w: u.id, minlen: col[u.id] + 1, weight: 0.1 }); });
    actors.forEach(function (a) {
      if (linked(a)) return;
      if (a.side === 'left') hidden.push({ v: a.id, w: cases[0].id, minlen: col[cases[0].id] + 1, weight: 0.1 });
      else hidden.push({ v: lastCol.id, w: a.id, minlen: 1, weight: 0.1 });
    });
    var lay = layoutGraph(ucNodes.concat(actors.map(function (a) { return { id: a.id, width: a.width, height: a.height }; })), edges2.concat(hidden), dopts);
    var pos = Object.create(null);
    var ux0 = Infinity;
    var uy0 = Infinity;
    var ux1 = -Infinity;
    var uy1 = -Infinity;
    cases.forEach(function (u) {
      var p = lay.nodes[u.id];
      pos[u.id] = { x: p.x, y: p.y };
      ux0 = Math.min(ux0, p.x - u.width / 2);
      ux1 = Math.max(ux1, p.x + u.width / 2);
      uy0 = Math.min(uy0, p.y - u.height / 2);
      uy1 = Math.max(uy1, p.y + u.height / 2);
    });
    var system = o.system !== undefined && o.system !== null && String(o.system).trim() ?
      textBlock(str(o.system, fn, 'system', 80), 400, { bold: true, maxLines: 1, fn: fn, name: 'system' }) : [];
    var box = { x0: ux0 - 6, y0: uy0 - (system.length ? ROW + 5 : 5), x1: ux1 + 6, y1: uy1 + 5 };
    if (system.length && box.x1 - box.x0 < blockWidth(system) + 8) {
      var grow = (blockWidth(system) + 8 - (box.x1 - box.x0)) / 2;
      box.x0 -= grow;
      box.x1 += grow;
    }
    // actors: top of the figure; keep them clear of the system boundary
    actors.forEach(function (a) {
      var p = lay.nodes[a.id];
      var x = p.x;
      if (a.side === 'left') x = Math.min(x, box.x0 - 6 - a.width / 2);
      else x = Math.max(x, box.x1 + 6 + a.width / 2);
      pos[a.id] = { x: x, y: p.y - a.height / 2 };
    });
    function figureShape(a) {
      return { kind: 'rect', x: pos[a.id].x, y: pos[a.id].y + 6, w: 7, h: 12 };
    }
    var B = new Bounds();
    var lines = '';
    var marks = '';
    links.forEach(function (l) {
      var hide = l.blank && !ctx.show;
      var snap = [lines.length, marks.length];
      var color = l.blank ? ctx.accent : ctx.ink;
      var pts;
      var lp = null;
      var i;
      if (!l.from.actor && !l.to.actor) {
        i = ucLinks.indexOf(l);
        pts = lay.edges[i].points;
        if (l.kind === 'extend') pts = pts.slice().reverse();
        pts = fixEnds(pts, ellipseShape(l.from), ellipseShape(l.to));
        lp = lay.edges[i].label;
      } else if (l.from.actor !== l.to.actor) {
        // actor – use case: routed by dagre (v = the left one)
        i = ucLinks.length + actorLinks.indexOf(l);
        pts = lay.edges[i].points;
        var a = l.from.actor ? l.from : l.to;
        var u = l.from.actor ? l.to : l.from;
        pts = a.side === 'left' ? fixEnds(pts, figureShape(a), ellipseShape(u)) : fixEnds(pts, ellipseShape(u), figureShape(a));
        if ((a.side === 'left') !== (l.from === a)) pts = pts.slice().reverse();
        if (l.label) lp = lay.edges[i].label || { x: (pts[0].x + pts[pts.length - 1].x) / 2, y: (pts[0].y + pts[pts.length - 1].y) / 2 };
      } else {
        // actor – actor (generalization): from figure to figure
        var fa = pos[l.from.id];
        var ta = pos[l.to.id];
        var below = ta.y > fa.y;
        pts = [{ x: fa.x, y: fa.y + (below ? l.from.height : 0) }, { x: ta.x, y: ta.y + (below ? 0 : l.to.height) }];
        if (Math.abs(fa.y - ta.y) < 1) pts = [{ x: fa.x + (ta.x > fa.x ? 1 : -1) * l.from.width / 2, y: fa.y + 6 }, { x: ta.x - (ta.x > fa.x ? 1 : -1) * l.to.width / 2, y: ta.y + 6 }];
        if (l.label) lp = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      }
      if (pts.length >= 2) {
        pts.forEach(function (q) { B.pt(q.x, q.y); });
        lines += el('path', attrsWith(strokeOf(color, l.kind === 'include' || l.kind === 'extend'), { d: polyline(pts) }));
        if (l.kind === 'generalization') marks += triangle(endDir(pts), color);
        else if (l.kind !== 'association') marks += openArrow(endDir(pts), color);
        if (l.label && lp) {
          var lb = lp.y + SMALL * U.CAP / 2;
          B.text(lp.x, lb, lineWidth(l.label), SMALL, 'middle');
          marks += drawLine(ctx, l.label, lp.x, lb, { anchor: 'middle', fill: l.blank ? ctx.accent : null, halo: true });
        }
      }
      if (hide) { lines = lines.slice(0, snap[0]); marks = marks.slice(0, snap[1]); }
    });
    function ellipseShape(u) {
      return { kind: 'ellipse', x: pos[u.id].x, y: pos[u.id].y, w: u.width, h: u.height };
    }
    var out = '';
    if (system.length) {
      out += el('rect', { x: box.x0, y: box.y0, width: box.x1 - box.x0, height: box.y1 - box.y0, fill: 'none', stroke: ctx.ink, 'stroke-width': LW });
      out += drawLine(ctx, system[0], (box.x0 + box.x1) / 2, box.y0 + 1.2 + FS * U.CAP + 0.8, { anchor: 'middle', x1: box.x0 + 3, x2: box.x1 - 3 });
      B.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
    }
    var figures = '';
    cases.forEach(function (u) {
      var p = pos[u.id];
      figures += el('ellipse', { cx: p.x, cy: p.y, rx: u.width / 2, ry: u.height / 2, fill: ctx.fill, stroke: ctx.ink, 'stroke-width': LW });
      figures += drawBlock(ctx, u.lines, p.x, p.y, ROW, p.x - u.width / 2 + 4, p.x + u.width / 2 - 4);
      B.rect(p.x - u.width / 2, p.y - u.height / 2, u.width, u.height);
    });
    actors.forEach(function (a) {
      var p = pos[a.id];
      var stroke = { fill: 'none', stroke: ctx.ink, 'stroke-width': LW, 'stroke-linecap': 'round' };
      figures += el('circle', { cx: p.x, cy: p.y + 1.8, r: 1.6, fill: '#ffffff', stroke: ctx.ink, 'stroke-width': LW });
      figures += el('path', attrsWith(stroke, { d: 'M' + f(p.x) + ' ' + f(p.y + 3.4) + 'V' + f(p.y + 8) + 'M' + f(p.x - 3) + ' ' + f(p.y + 5) + 'H' + f(p.x + 3) +
        'M' + f(p.x - 2.6) + ' ' + f(p.y + 11.5) + 'L' + f(p.x) + ' ' + f(p.y + 8) + 'L' + f(p.x + 2.6) + ' ' + f(p.y + 11.5) }));
      var y = p.y + 12.6;
      a.lines.forEach(function (L) {
        var h = lineHeight(L, ROW);
        figures += drawLine(ctx, L, p.x, baselineIn(y, h, L), { anchor: 'middle', x1: p.x - a.width / 2, x2: p.x + a.width / 2 });
        y += h;
      });
      B.rect(p.x - a.width / 2, p.y, a.width, a.height);
    });
    return finish(ctx, out + lines + figures + marks, B, 'Use fewer use cases or shorter names.');
  }

  return {
    classDiagram: classDiagram,
    objectDiagram: objectDiagram,
    sequenceDiagram: sequenceDiagram,
    stateDiagram: stateDiagram,
    structogram: structogram,
    erDiagram: erDiagram,
    activityDiagram: activityDiagram,
    flowchart: flowchart,
    useCaseDiagram: useCaseDiagram
  };
});
