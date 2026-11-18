/*
 * worksheet-layout.js – turns worksheet blocks into a neutral document description (MIT License).
 *
 * compose(blocks, ctx) -> { elements, warnings }
 *
 * The result ("layout elements") is what the editor plugin builds with the
 * Euro-Office builder API (plugin/js/blocks.js) and what the chat preview
 * renders as HTML. All design decisions live here: fonts, colours and spacing
 * come from the theme (worksheet-themes.js), puzzles from worksheet-generators.js,
 * graphics from worksheet-svg.js, syllable colouring from german-syllables.js.
 * Pure and deterministic – used by the plugin (browser), by the proxy (to
 * validate blocks before they reach the editor) and by the unit tests.
 *
 * Layout elements
 *   paragraph { t:'p', runs, style?, jc?, indLeft?, indRight?, indFirst?, before?, after?, line?, keepNext?,
 *               keepLines?, tabs?, borders?, shd?, numbering?, pageBreak? }
 *       runs: { text, b?, i?, u?, color?, size? (pt), font? } | { br } | { tab } | { image } | { math }
 *       line: { value, rule: 'auto' (value = multiple) | 'exact' | 'atLeast' (value in twips) }
 *       borders: { top|bottom|left|right: { size (1/8 pt), color, space? (pt) } }
 *       numbering: { ref, type: 'bullet' | 'numbered' | 'letters' | 'checkbox' }
 *   table { t:'table', rows: [{ height?, cells: [{ content: [elements], shd?, valign?, borders?, width? }] }],
 *           widths? (percent), borders? (top…insideV: border or null = none), cellMargins?, description?, jc? }
 *   image runs: { image: { svg, widthMm, heightMm, alt } } or { image: { abc, widthCm, kind: 'staff' } };
 *           the plugin rasterises them and adds { dataUrl, wEmu, hEmu }.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Static requires, so bundlers (the companion app's esbuild bundle) can follow them.
    module.exports = factory(function (name) {
      switch (name) {
        case 'worksheet-themes': return require('./worksheet-themes.js');
        case 'worksheet-generators': return require('./worksheet-generators.js');
        case 'worksheet-svg': return require('./worksheet-svg.js');
        case 'german-syllables': return require('./german-syllables.js');
        default: return null;
      }
    });
  } else {
    var globals = {
      'worksheet-themes': 'WorksheetThemes',
      'worksheet-generators': 'WorksheetGen',
      'worksheet-svg': 'WorksheetSvg',
      'german-syllables': 'GermanSyllables'
    };
    root.WorksheetLayout = factory(function (name) { return root[globals[name]]; });
  }
})(typeof self !== 'undefined' ? self : this, function (load) {
  'use strict';

  var cache = {};
  function lib(name) {
    if (!cache[name]) {
      cache[name] = load(name);
      if (!cache[name]) throw new Error('module ' + name + ' is not loaded');
    }
    return cache[name];
  }

  var GRAPHIC_MARKER = 'WSGRAPHIC ';
  var TASK_MARKER = 'WSTASK ';
  var BLOCK_MARKER = 'WSBLOCK ';
  var CHECKBOX = '☐';
  var CHECKED = '☒';
  var SYMBOL_FONT = 'DejaVu Sans';

  var BLOCK_TYPES = [
    'title', 'name_line', 'heading', 'paragraph', 'task', 'list', 'table', 'lines', 'box', 'cloze', 'word_bank',
    'multiple_choice', 'true_false', 'matching', 'crossword', 'word_search', 'reading_text', 'formula',
    'number_line', 'coordinate_system', 'chart', 'mindmap', 'qr_code', 'svg', 'cut_line', 'self_assessment',
    'hint_cards', 'grade_key', 'columns', 'staff', 'empty_staves', 'page_break', 'spacer'
  ];
  var LINE_STYLES = ['plain', 'school1', 'school2', 'school3', 'school4', 'grid5', 'grid10'];
  var GRAPHIC_TYPES = ['lineature', 'crossword', 'word_search', 'number_line', 'coordinate_system', 'chart', 'mindmap',
    'qr_code', 'svg', 'cut_line'];

  // ---------------------------------------------------------------------------
  // Units and small helpers
  // ---------------------------------------------------------------------------
  function tw(mm) { return Math.round(mm * 1440 / 25.4); }
  function num(v, def) { var n = Number(v); return isFinite(n) ? n : def; }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function str(v) { return v == null ? '' : String(v); }
  function copy(o) { var c = {}; Object.keys(o || {}).forEach(function (k) { c[k] = o[k]; }); return c; }
  function border(size, color, space) { var b = { size: size, color: color || '#000000' }; if (space) b.space = space; return b; }

  function blockError(msg) { var e = new Error(msg); e.blockError = true; return e; }

  // ---------------------------------------------------------------------------
  // Inline text -> runs
  // ---------------------------------------------------------------------------
  // \( latex \), **bold**, __underline__ (not touching cloze gaps "____"), *italic*, [ ] / [x] checkboxes
  var INLINE_SPLIT = /(\\\([\s\S]+?\\\)|\*\*[^*]+\*\*|(?<!_)__(?=[^_\s])[^_]*[^_\s]__(?!_)|\*[^*\s][^*]*\*|\[[ xX]\])/;
  var UNDERLINE = /^__[^_\s]([^_]*[^_\s])?__$/;

  /**
   * Text with inline markup -> runs.
   * base: { font, size, color, b, i } applied to every run; opts: { syllables, theme }
   */
  function textRuns(text, base, opts) {
    opts = opts || {};
    var out = [];
    var lines = str(text).split('\n');
    for (var li = 0; li < lines.length; li++) {
      if (li > 0) out.push({ br: true });
      var parts = lines[li].split(INLINE_SPLIT);
      for (var k = 0; k < parts.length; k++) {
        var part = parts[k];
        if (!part) continue;
        var f = {};
        if (/^\\\([\s\S]+\\\)$/.test(part)) { out.push({ math: part.slice(2, -2).trim() }); continue; }
        if (/^\[[ xX]\]$/.test(part)) { out.push(run(part === '[ ]' ? CHECKBOX : CHECKED, base, { font: SYMBOL_FONT })); continue; }
        if (/^\*\*[^*]+\*\*$/.test(part)) { f.b = true; part = part.slice(2, -2); }
        else if (UNDERLINE.test(part)) { f.u = true; part = part.slice(2, -2); }
        else if (/^\*[^*\s][^*]*\*$/.test(part)) { f.i = true; part = part.slice(1, -1); }
        if (opts.syllables) pushSyllables(out, part, base, f, opts.theme);
        else out.push(run(part, base, f));
      }
    }
    return out;
  }

  function run(text, base, extra) {
    var r = { text: text };
    var keys = ['font', 'size', 'color', 'b', 'i', 'u'];
    keys.forEach(function (k) {
      var v = extra && extra[k] !== undefined ? extra[k] : base ? base[k] : undefined;
      if (v !== undefined && v !== null) r[k] = v;
    });
    return r;
  }

  /** Silbenfärbung: syllables of every word alternately in two colours (starting again with every word). */
  function pushSyllables(out, text, base, f, theme) {
    var tokens = lib('german-syllables').syllabifyText(text);
    var c1 = theme.colors.syllable1;
    var c2 = theme.colors.syllable2;
    tokens.forEach(function (tok) {
      if (!tok.word || !tok.syllables || tok.syllables.length === 0) {
        var plain = tok.word ? lib('german-syllables').stripMarkers(tok.text) : tok.text;
        if (plain) out.push(run(plain, base, f));
        return;
      }
      tok.syllables.forEach(function (s, i) {
        var ex = copy(f);
        ex.color = i % 2 === 0 ? c1 : c2;
        out.push(run(s, base, ex));
      });
    });
  }

  function plainText(text) {
    return str(text).replace(/\\\(([\s\S]+?)\\\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*\s][^*]*)\*/g, '$1')
      .replace(/(^|[^_])__([^_\s](?:[^_]*[^_\s])?)__(?!_)/g, '$1$2').replace(/\[ \]/g, CHECKBOX).replace(/\[[xX]\]/g, CHECKED);
  }

  // ---------------------------------------------------------------------------
  // Context
  // ---------------------------------------------------------------------------
  function makeContext(ctx) {
    ctx = ctx || {};
    var themes = lib('worksheet-themes');
    var theme = typeof ctx.theme === 'object' && ctx.theme ? ctx.theme : themes.getTheme(ctx.theme || 'modern');
    var c = {
      theme: theme,
      lang: ctx.lang || 'de',
      L: themes.labels(ctx.lang || 'de'),
      widthMm: clamp(num(ctx.textWidthMm, 170), 60, 400),
      staffWidthCm: ctx.staffWidthCm,
      warnings: [],
      taskCounter: num(ctx.taskStart, 0),
      listCounter: 0,
      listPrefix: ctx.listPrefix || ('l' + Math.floor(Math.random() * 1e9).toString(36)),
      nested: false
    };
    var doc = theme.id === 'document';
    c.body = { font: theme.font, size: theme.size, color: theme.colors.text };
    c.small = { font: theme.font, size: theme.sizes.small, color: theme.colors.muted };
    c.muted = { font: theme.font, size: theme.size, color: theme.colors.muted };
    c.headingBase = function (level) {
      var size = level === 1 ? theme.sizes.h1 : level === 2 ? theme.sizes.h2 : theme.sizes.h3;
      return doc ? { b: true } : { font: theme.headingFont, size: size, color: theme.colors.heading, b: true };
    };
    c.paraDefaults = function () {
      var p = {};
      if (theme.spaceAfter != null) p.after = theme.spaceAfter * 20;
      if (theme.lineSpacing != null) p.line = { value: theme.lineSpacing, rule: 'auto' };
      return p;
    };
    return c;
  }

  function para(runs, props) {
    var p = { t: 'p', runs: runs || [] };
    Object.keys(props || {}).forEach(function (k) { if (props[k] !== undefined) p[k] = props[k]; });
    return p;
  }

  function bodyPara(c, text, extra, opts) {
    var props = c.paraDefaults();
    Object.keys(extra || {}).forEach(function (k) { props[k] = extra[k]; });
    return para(textRuns(text, (opts && opts.base) || c.body, { syllables: opts && opts.syllables, theme: c.theme }), props);
  }

  function imageRun(svgResult, alt, extra) {
    var im = { svg: svgResult.svg, widthMm: svgResult.widthMm, heightMm: svgResult.heightMm, alt: alt || '' };
    Object.keys(extra || {}).forEach(function (k) { im[k] = extra[k]; });
    return { image: im };
  }

  /** Alt text of a generated graphic: a readable description plus the source parameters (for later edits). */
  function graphicAlt(description, source) {
    var json = JSON.stringify(source);
    if (json.length > 60000) json = JSON.stringify({ type: source.type, truncated: true });
    return description + '\n\n' + GRAPHIC_MARKER + json;
  }

  function parseMarker(text, marker) {
    var s = str(text);
    var i = s.indexOf(marker);
    if (i === -1) return null;
    try { return JSON.parse(s.slice(i + marker.length)); } catch (e) { return null; }
  }

  function svgLib() { return lib('worksheet-svg'); }
  function genLib() { return lib('worksheet-generators'); }

  function svgOpts(c, extra) {
    var t = c.theme;
    var o = { color: t.colors.text || '#1f2937', accentColor: t.colors.accent };
    if (t.font) o.font = "'" + t.font + "', 'DejaVu Sans', Arial, sans-serif";
    Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; });
    return o;
  }

  function imagePara(c, img, opts) {
    opts = opts || {};
    return para([img], { jc: opts.jc || 'left', after: opts.after != null ? opts.after : 120, before: opts.before, keepNext: opts.keepNext });
  }

  function captionPara(c, text) {
    return para(textRuns(text, c.small), { jc: 'center', after: 160 });
  }

  // ---------------------------------------------------------------------------
  // Tables
  // ---------------------------------------------------------------------------
  function cell(content, props) {
    var cl = { content: content && content.length ? content : [para([])] };
    Object.keys(props || {}).forEach(function (k) { if (props[k] !== undefined) cl[k] = props[k]; });
    return cl;
  }

  function noBorders() {
    return { top: null, bottom: null, left: null, right: null, insideH: null, insideV: null };
  }

  function gridBorders(color, size) {
    var b = border(size || 4, color);
    return { top: b, bottom: b, left: b, right: b, insideH: b, insideV: b };
  }

  function normWidths(ws, n) {
    if (!Array.isArray(ws) || ws.length !== n) return null;
    var nums = ws.map(function (w) { return Math.max(0.5, num(w, 1)); });
    var sum = nums.reduce(function (a, b) { return a + b; }, 0);
    return nums.map(function (w) { return Math.round(w / sum * 1000) / 10; });
  }

  // Paragraph inside a table cell: no spacing after, so cells stay compact.
  function cellPara(c, text, base, extra) {
    var props = { after: 0, before: 0 };
    if (c.theme.lineSpacing != null) props.line = { value: Math.min(c.theme.lineSpacing, 1.15), rule: 'auto' };
    Object.keys(extra || {}).forEach(function (k) { if (k !== 'syllables') props[k] = extra[k]; });
    return para(textRuns(text, base || c.body, { syllables: extra && extra.syllables, theme: c.theme }), props);
  }

  // ---------------------------------------------------------------------------
  // Blocks
  // ---------------------------------------------------------------------------
  var builders = {};

  builders.heading = function (b, c) {
    var level = clamp(Math.round(num(b.level, 2)), 1, 3);
    var props = { style: 'Heading ' + level, keepNext: true };
    if (c.theme.id !== 'document') {
      props.before = level === 1 ? 120 : 240;
      props.after = 80;
    }
    return [para(textRuns(b.text, c.headingBase(level)), props)];
  };

  builders.title = function (b, c) {
    var t = c.theme;
    var out = [];
    var meta = [b.subject, b.grade].filter(function (x) { return x != null && String(x).trim(); }).map(String).join('  ·  ');
    var center = t.titleStyle === 'band';
    if (meta) {
      out.push(para([run(meta.toUpperCase(), { font: t.headingFont, size: t.sizes.small || 9, color: t.colors.accent, b: true })],
        { after: 40, keepNext: true, jc: center ? 'center' : undefined }));
    }
    var titleBase = t.id === 'document' ? { b: true } : { font: t.headingFont, size: t.sizes.title, color: t.colors.heading, b: true };
    var props = { style: 'Heading 1', keepNext: !!b.subtitle, after: 120, before: 0, jc: center ? 'center' : undefined };
    if (t.titleStyle === 'rule') props.borders = { bottom: border(12, t.colors.titleRule, 4) };
    if (t.titleStyle === 'band') { props.shd = t.colors.accentLight; props.borders = { bottom: border(18, t.colors.titleRule, 2) }; }
    out.push(para(textRuns(b.text, titleBase), props));
    if (b.subtitle) out.push(para(textRuns(b.subtitle, c.muted), { after: 200, jc: center ? 'center' : undefined }));
    return out;
  };

  builders.name_line = function (b, c) {
    var L = c.L;
    var fields = Array.isArray(b.fields) && b.fields.length ? b.fields.slice(0, 5).map(String) : [L.name, L['class'], L.date];
    var size = c.theme.size || 11;
    // label cells as wide as their text (≈ 0.62 em per character plus cell margins), the rest for the fields
    var labelMm = fields.map(function (f) { return (f.length + 1) * size * 0.3528 * 0.62 + 3; });
    var weights = fields.map(function (f, i) { return i === 0 ? 3 : 1.4; });
    var rest = Math.max(c.widthMm * 0.4, c.widthMm - labelMm.reduce(function (a, x) { return a + x; }, 0));
    var wsum = weights.reduce(function (a, x) { return a + x; }, 0);
    var widths = [];
    var cells = [];
    var line = border(6, c.theme.colors.line || '#000000');
    fields.forEach(function (f, i) {
      widths.push(labelMm[i]);
      widths.push(rest * weights[i] / wsum);
      cells.push(cell([cellPara(c, f + ':', c.muted, { jc: i === 0 ? 'left' : 'right' })], { valign: 'bottom' }));
      cells.push(cell([cellPara(c, '', c.body)], { valign: 'bottom', borders: { bottom: line } }));
    });
    return [{
      t: 'table', widths: normWidths(widths, widths.length), borders: noBorders(),
      cellMargins: { left: 40, right: 40, top: 0, bottom: 0 },
      rows: [{ height: tw(8), cells: cells }]
    }, para([], { after: 120, before: 0, line: { value: tw(3), rule: 'exact' } })];
  };

  builders.paragraph = function (b, c) {
    var base = b.size === 'small' ? c.small : b.size === 'large' && c.theme.size ? run('', c.body, { size: c.theme.size + 2 }) : c.body;
    if (b.size === 'large' && !c.theme.size) base = c.body;
    var jc = b.align === 'justify' ? 'both' : b.align;
    return [bodyPara(c, b.text, { jc: jc }, { base: base, syllables: b.syllables })];
  };

  builders.list = function (b, c) {
    var type = b.style || (b.ordered ? 'numbered' : 'bullet');
    if (['bullet', 'numbered', 'letters', 'checkbox'].indexOf(type) === -1) type = 'bullet';
    var ref = c.listPrefix + '-' + (++c.listCounter);
    var items = (b.items || []).map(String);
    return items.map(function (item, i) {
      var props = c.paraDefaults();
      props.style = 'List Paragraph';
      props.numbering = { ref: ref, type: type };
      props.after = i === items.length - 1 ? (c.theme.spaceAfter != null ? c.theme.spaceAfter * 20 : undefined) : 40;
      return para(textRuns(item, c.body, { syllables: b.syllables, theme: c.theme }), props);
    });
  };

  builders.table = function (b, c) {
    var t = c.theme;
    var rows = (b.rows || []).map(function (r) { return (r || []).map(str); });
    var answerRows = clamp(Math.round(num(b.answer_rows, 0)), 0, 30);
    var cols = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 1);
    for (var a = 0; a < answerRows; a++) rows.push([]);
    var header = b.header !== false && rows.length > 1;
    var headerCol = b.header_column === true;
    var minH = b.row_height_cm != null ? tw(clamp(num(b.row_height_cm, 0.8), 0.5, 5) * 10) : (answerRows ? tw(9) : undefined);
    var out = {
      t: 'table', borders: gridBorders(t.colors.border, 4), widths: normWidths(b.widths, cols),
      cellMargins: { left: 100, right: 100, top: 40, bottom: 40 }, rows: []
    };
    rows.forEach(function (r, ri) {
      var isHead = header && ri === 0;
      var cells = [];
      for (var ci = 0; ci < cols; ci++) {
        var txt = r[ci] == null ? '' : r[ci];
        var isHeadCol = headerCol && ci === 0 && !isHead;
        var base = isHead ? { font: t.font, size: t.size, color: t.colors.tableHeaderText || t.colors.text, b: true } : isHeadCol ? run('', c.body, { b: true }) : c.body;
        var jc = isHead ? (b.align === 'center' ? 'center' : 'left') : (b.align === 'center' && ci > 0 ? 'center' : undefined);
        if (/^\s*\[[ xX]\]\s*$/.test(txt)) jc = 'center';
        cells.push(cell([cellPara(c, txt, base, { jc: jc })], {
          shd: isHead ? t.colors.tableHeader : isHeadCol ? t.colors.accentLight : undefined,
          valign: 'center'
        }));
      }
      var rowSpec = { cells: cells, header: isHead };
      if (!isHead && minH) rowSpec.height = minH;
      out.rows.push(rowSpec);
    });
    return [out];
  };

  builders.lines = function (b, c) {
    var t = c.theme;
    var out = [];
    var style = LINE_STYLES.indexOf(b.style) !== -1 ? b.style : 'plain';
    var count = clamp(Math.round(num(b.count, 3)), 1, 20);
    if (b.label) out.push(bodyPara(c, b.label, { keepNext: true }));
    if (style === 'plain') {
      var spacing = b.spacing_cm != null ? clamp(num(b.spacing_cm, 0.9), 0.6, 2) * 10 : t.writingLineMm;
      for (var i = 0; i < count; i++) {
        // Alternating border spacing keeps the editor from merging the lines into one bordered group.
        out.push(para([], {
          line: { value: tw(spacing), rule: 'exact' }, before: 0, after: 0,
          borders: { bottom: border(4, t.colors.line || '#000000', i % 2) }, keepNext: i < count - 1 && count <= 12
        }));
      }
      out.push(para([], { after: 0, line: { value: tw(3), rule: 'exact' } }));
      return out;
    }
    var grid = style === 'grid5' || style === 'grid10';
    var g = svgLib().lineature(svgOpts(c, {
      kind: style, rows: grid ? count * (style === 'grid5' ? 2 : 1) : count, widthMm: c.widthMm,
      color: t.id === 'classic' ? '#8a8a8a' : '#9ca3af', accentColor: t.id === 'classic' ? '#ededed' : '#e8eef7'
    }));
    var desc = grid ? 'Karopapier' : 'Lineatur ' + style.slice(-1);
    out.push(imagePara(c, imageRun(g, graphicAlt(desc, { type: 'lineature', style: style, count: count }))));
    return out;
  };

  function inferVariant(title) {
    var s = str(title).toLowerCase();
    if (/merk|regel|rule|remember/.test(s)) return 'rule';
    if (/tipp|tip|hinweis|hint|hilfe/.test(s)) return 'tip';
    if (/achtung|vorsicht|warn|caution|attention/.test(s)) return 'warning';
    if (/beispiel|example|muster/.test(s)) return 'example';
    if (/l(ö|oe)sung|solution|answer/.test(s)) return 'solution';
    if (/definition|begriff|fachwort|glossar/.test(s)) return 'definition';
    return 'info';
  }

  /** A framed box (1×1 table) with icon, title and content paragraphs. */
  function boxTable(c, variant, title, content, opts) {
    var t = c.theme;
    var v = t.boxes[variant] || t.boxes.info;
    opts = opts || {};
    var paras = [];
    if (title || opts.icon !== false) {
      var head = [];
      if (opts.icon !== false && t.id !== 'document') {
        var ic = svgLib().icon(v.icon, { color: v.title || t.colors.icon || '#1f2937', sizeMm: 5 });
        head.push(imageRun(ic, ''));
        if (title) head.push({ text: ' ' });
      }
      if (title) {
        textRuns(title, { font: t.headingFont, size: t.size, color: v.title || t.colors.heading, b: true }).forEach(function (r) { head.push(r); });
      }
      if (head.length && (title || content.length)) paras.push(para(head, { after: 60, keepNext: true }));
    }
    content.forEach(function (p) { paras.push(p); });
    var b = border(8, v.border);
    var borders;
    if (t.boxStyle === 'bar') borders = { top: null, bottom: null, right: null, left: border(24, v.border), insideH: null, insideV: null };
    else if (t.boxStyle === 'filled') borders = { top: border(8, v.border), bottom: border(8, v.border), left: border(8, v.border), right: border(8, v.border), insideH: null, insideV: null };
    else borders = { top: b, bottom: b, left: b, right: b, insideH: null, insideV: null };
    return {
      t: 'table', borders: borders, cellMargins: { left: 160, right: 160, top: 100, bottom: 100 },
      rows: [{ cells: [cell(paras, { shd: v.fill || undefined })] }]
    };
  }

  function boxContent(c, text, items, syllables) {
    var out = [];
    if (text != null && str(text) !== '') {
      str(text).split(/\n{2,}/).forEach(function (chunk) {
        out.push(cellPara(c, chunk, c.body, { after: 60, syllables: syllables }));
      });
    }
    if (Array.isArray(items) && items.length) {
      var ref = c.listPrefix + '-' + (++c.listCounter);
      items.forEach(function (it) {
        out.push(cellPara(c, String(it), c.body, { style: 'List Paragraph', numbering: { ref: ref, type: 'bullet' }, after: 20, syllables: syllables }));
      });
    }
    if (out.length) out[out.length - 1].after = 0;
    return out;
  }

  builders.box = function (b, c) {
    var variant = lib('worksheet-themes').BOX_VARIANTS.indexOf(b.variant) !== -1 ? b.variant : inferVariant(b.title);
    return [boxTable(c, variant, b.title, boxContent(c, b.text, b.items, b.syllables)), spacerAfterTable()];
  };

  function spacerAfterTable() {
    return para([], { after: 0, before: 0, line: { value: tw(3), rule: 'exact' } });
  }

  builders.task = function (b, c) {
    var t = c.theme;
    var numStr = b.number != null && String(b.number).trim() ? String(b.number).trim().slice(0, 4) : String(++c.taskCounter);
    var m = /^(\d+)/.exec(numStr);
    if (m) c.taskCounter = Math.max(c.taskCounter, Number(m[1]));
    var points = b.points != null && isFinite(Number(b.points)) ? Number(b.points) : null;
    var level = b.level != null ? clamp(Math.round(num(b.level, 1)), 1, 3) : null;
    var meta = { number: numStr, title: b.title ? String(b.title) : '', points: points, level: level };
    var badgeMm = t.id === 'primary' ? 8 : 6.5;
    var indent = tw(badgeMm + 3);
    var badge = svgLib().taskBadge(numStr, { fill: t.colors.badgeFill, color: t.colors.badgeText, sizeMm: badgeMm, shape: t.badgeShape });
    // [badge] tab [title or instruction] … right tab [symbols, stars, points]; wrapped lines align with the text.
    var head = [imageRun(badge, c.L.task + ' ' + numStr + '\n\n' + TASK_MARKER + JSON.stringify(meta)), { tab: true }];
    var hb = c.headingBase(2);
    if (!b.title && t.size) hb = run('', hb, { size: t.size + 1 });
    textRuns(b.title ? b.title : b.instruction, hb).forEach(function (r) { head.push(r); });
    var right = [];
    var icons = (Array.isArray(b.icons) ? b.icons : []).filter(function (n) { return svgLib().ICON_NAMES.indexOf(n) !== -1; }).slice(0, 4);
    icons.forEach(function (n, i) {
      if (i) right.push({ text: ' ' });
      right.push(imageRun(svgLib().icon(n, { color: t.colors.icon || '#1f2937', sizeMm: 4.5 }), n));
    });
    if (level) {
      if (right.length) right.push({ text: '  ' });
      right.push(imageRun(svgLib().stars(level, { color: t.colors.accent, sizeMm: 3.2 }), level + '/3'));
    }
    var extra = [];
    if (b.time_min) extra.push('\u23f1 ' + Math.round(num(b.time_min, 0)) + ' ' + c.L.minutes);
    if (points != null) extra.push('___ / ' + fmtNum(points) + ' ' + c.L.points);
    if (extra.length) {
      if (right.length) right.push({ text: '    ' });
      right.push(run(extra.join('    '), { font: t.font, size: t.size, color: t.colors.muted, b: false }));
    }
    var tabs = [{ pos: indent, type: 'left' }];
    if (right.length) {
      // Text too long for one line next to the symbols/points: put them on their own line, right-aligned
      // (otherwise the editor wraps them to the start of the next line).
      var headSize = (hb.size || c.theme.size || 11) * 0.3528 * 0.56;
      var rightMm = icons.length * 5.5 + (level ? 13 : 0) + (extra.length ? extra.join('    ').length * (t.size || 11) * 0.3528 * 0.5 + 4 : 0);
      if (plainText(b.title ? b.title : b.instruction).length * headSize > c.widthMm - (badgeMm + 3) - rightMm - 4) head.push({ br: true });
      head.push({ tab: true });
      right.forEach(function (r) { head.push(r); });
      tabs.push({ pos: tw(c.widthMm), type: 'right' });
    }
    var props = { style: 'Heading 2', keepNext: true, tabs: tabs, after: 100, indLeft: indent, indFirst: -indent };
    if (t.id !== 'document') props.before = 280;
    var out = [para(head, props)];
    if (b.title && b.instruction) {
      out.push(bodyPara(c, b.instruction, { indLeft: indent, keepNext: true }, { syllables: b.syllables }));
    }
    return out;
  };

  function fmtNum(n) {
    return String(Math.round(n * 100) / 100).replace('.', ',');
  }

  builders.cloze = function (b, c) {
    var gen = genLib();
    var parsed = gen.cloze(str(b.text));
    if (!parsed.gapCount) throw blockError('cloze needs gaps written as [[answer]] in "text".');
    var t = c.theme;
    var runs = [];
    parsed.parts.forEach(function (p) {
      if (p.type === 'text') { textRuns(p.text, c.body, { syllables: b.syllables, theme: t }).forEach(function (r) { runs.push(r); }); return; }
      if (b.show_answers) runs.push(run(p.answer, c.body, { u: true, color: t.colors.accent, b: true }));
      else runs.push(run(gen.gapString(p.answer), c.body, { color: t.colors.muted }));
    });
    var props = c.paraDefaults();
    props.line = { value: Math.max(t.lineSpacing || 1.15, 1.8), rule: 'auto' };
    var out = [para(runs, props)];
    if (b.word_bank !== false && !b.show_answers) {
      out.push(wordBankBox(c, gen.wordBank(parsed.answers, { order: 'alpha' }), b.bank_title));
      out.push(spacerAfterTable());
    }
    return out;
  };

  function wordBankBox(c, words, title) {
    var t = c.theme;
    var content = [cellPara(c, words.join('     '), c.body, { jc: 'center' })];
    var head = cellPara(c, title || c.L.wordBank, { font: t.headingFont, size: t.sizes.small || undefined, color: t.colors.muted, b: true }, { jc: 'center', after: 40 });
    var b = border(6, t.colors.border);
    return {
      t: 'table', borders: { top: b, bottom: b, left: b, right: b, insideH: null, insideV: null },
      description: BLOCK_MARKER + JSON.stringify({ type: 'word_bank', count: words.length }),
      cellMargins: { left: 160, right: 160, top: 80, bottom: 80 },
      rows: [{ cells: [cell([head].concat(content), { shd: t.id === 'classic' ? undefined : t.colors.accentLight })] }]
    };
  }

  builders.word_bank = function (b, c) {
    var words = (b.words || []).map(String).filter(function (w) { return w.trim(); });
    if (!words.length) throw blockError('word_bank needs "words".');
    var ordered = b.order === 'given' ? words : genLib().wordBank(words, { order: 'alpha' });
    return [wordBankBox(c, ordered, b.title), spacerAfterTable()];
  };

  function checkboxRun(c, checked) {
    return run(checked ? CHECKED : CHECKBOX, c.body, { font: SYMBOL_FONT, b: false, color: checked ? c.theme.colors.accent : c.body.color });
  }

  builders.multiple_choice = function (b, c) {
    var out = [];
    var qs = Array.isArray(b.questions) ? b.questions : [];
    if (!qs.length) throw blockError('multiple_choice needs "questions" [{question, options[], correct?}].');
    qs.forEach(function (q, qi) {
      var options = Array.isArray(q.options) ? q.options.map(String) : [];
      if (options.length < 2) throw blockError('question ' + (qi + 1) + ' needs at least 2 options.');
      var correct = Array.isArray(q.correct) ? q.correct.map(Number) : q.correct != null ? [Number(q.correct)] : [];
      var qRuns = [run((qi + 1) + '.  ', c.body, { b: true })].concat(textRuns(q.question, c.body));
      out.push(para(qRuns, { keepNext: true, after: 60, indLeft: tw(6), indFirst: -tw(6), line: c.paraDefaults().line }));
      var short = options.join('').length <= 60 && options.length <= 4 && !b.vertical;
      if (short) {
        var runs = [];
        options.forEach(function (o, oi) {
          if (oi) runs.push({ text: '        ' });
          var ok = b.show_answers && correct.indexOf(oi) !== -1;
          runs.push(checkboxRun(c, ok));
          runs.push({ text: ' ' });
          textRuns(o, c.body, {}).forEach(function (r) { if (ok) r.b = true; runs.push(r); });
        });
        out.push(para(runs, { indLeft: tw(6), after: qi === qs.length - 1 ? 160 : 120, line: c.paraDefaults().line }));
      } else {
        options.forEach(function (o, oi) {
          var ok = b.show_answers && correct.indexOf(oi) !== -1;
          var runs = [checkboxRun(c, ok), { text: '  ' }];
          textRuns(o, c.body, {}).forEach(function (r) { if (ok) r.b = true; runs.push(r); });
          out.push(para(runs, { indLeft: tw(6), after: oi === options.length - 1 ? 140 : 30, keepNext: oi < options.length - 1, line: c.paraDefaults().line }));
        });
      }
    });
    return out;
  };

  builders.true_false = function (b, c) {
    var t = c.theme;
    var st = Array.isArray(b.statements) ? b.statements : [];
    if (!st.length) throw blockError('true_false needs "statements" [{text, correct?}].');
    var labels = Array.isArray(b.labels) && b.labels.length === 2 ? b.labels.map(String) : [c.L['true'], c.L['false']];
    var headBase = { font: t.font, size: t.size, color: t.colors.tableHeaderText || t.colors.text, b: true };
    var rows = [{
      header: true,
      cells: [cell([cellPara(c, b.header || c.L.statement, headBase)], { shd: t.colors.tableHeader, valign: 'center' })].concat(labels.map(function (l) {
        return cell([cellPara(c, l, headBase, { jc: 'center' })], { shd: t.colors.tableHeader, valign: 'center' });
      }))
    }];
    st.forEach(function (s, i) {
      var text = typeof s === 'string' ? s : s.text;
      var correct = typeof s === 'object' && s.correct != null ? !!s.correct : null;
      var cells = [cell([cellPara(c, (i + 1) + '.  ' + str(text), c.body)], { valign: 'center' })];
      [true, false].forEach(function (v) {
        var ok = b.show_answers && correct === v;
        cells.push(cell([para([checkboxRun(c, ok)], { jc: 'center', after: 0, before: 0 })], { valign: 'center' }));
      });
      rows.push({ height: tw(8), cells: cells });
    });
    var lw = Math.max(10, Math.max(labels[0].length, labels[1].length) * 1.6 + 4);
    return [{
      t: 'table', borders: gridBorders(t.colors.border, 4), widths: normWidths([100 - 2 * lw, lw, lw], 3),
      cellMargins: { left: 100, right: 100, top: 40, bottom: 40 }, rows: rows
    }, spacerAfterTable()];
  };

  builders.matching = function (b, c) {
    var t = c.theme;
    var pairs = Array.isArray(b.pairs) ? b.pairs : [];
    if (pairs.length < 2 || pairs.length > 12) throw blockError('matching needs 2–12 "pairs" [{left, right}].');
    var m = genLib().matching(pairs.map(function (p) { return { left: str(p.left), right: str(p.right) }; }), { seed: JSON.stringify(pairs) });
    var mode = b.mode === 'letters' ? 'letters' : 'lines';
    var boxB = border(6, t.colors.border);
    var boxed = { top: boxB, bottom: boxB, left: boxB, right: boxB };
    var rows = [];
    var dot = function () { return cell([para([run('●', c.body, { color: t.colors.accent, font: SYMBOL_FONT })], { jc: 'center', after: 0 })], { valign: 'center' }); };
    for (var i = 0; i < m.left.length; i++) {
      var cells;
      if (mode === 'lines') {
        cells = [
          cell([cellPara(c, m.left[i], c.body)], { valign: 'center', borders: boxed }),
          dot(),
          cell([para([])], {}),
          dot(),
          cell([cellPara(c, m.right[i], c.body)], { valign: 'center', borders: boxed })
        ];
      } else {
        var ans = b.show_answers ? m.letters[m.key[i]] : '';
        cells = [
          cell([cellPara(c, (i + 1) + '.', run('', c.body, { b: true }))], { valign: 'center' }),
          cell([cellPara(c, m.left[i], c.body)], { valign: 'center', borders: boxed }),
          cell([cellPara(c, ans, run('', c.body, { b: true, color: t.colors.accent }), { jc: 'center' })], { valign: 'center', borders: boxed }),
          cell([para([])], {}),
          cell([cellPara(c, m.letters[i] + ')', run('', c.body, { b: true }))], { valign: 'center' }),
          cell([cellPara(c, m.right[i], c.body)], { valign: 'center', borders: boxed })
        ];
      }
      rows.push({ height: tw(mode === 'lines' ? 10 : 9), cells: cells });
      if (i < m.left.length - 1) rows.push({ height: tw(2), cells: cells.map(function () { return cell([para([], { line: { value: tw(1.5), rule: 'exact' } })]); }) });
    }
    var out = [{
      t: 'table', borders: noBorders(), cellMargins: { left: 100, right: 100, top: 40, bottom: 40 },
      widths: mode === 'lines' ? [38, 5, 14, 5, 38] : [6, 34, 8, 8, 6, 38], rows: rows
    }];
    if (b.show_answers && mode === 'lines') {
      var key = m.left.map(function (l, i) { return l + ' – ' + m.right[m.key[i]]; }).join(';  ');
      out.push(bodyPara(c, '**' + c.L.solution + ':** ' + key, { before: 120 }));
    } else {
      out.push(spacerAfterTable());
    }
    return out;
  };

  builders.crossword = function (b, c) {
    var t = c.theme;
    var entries = (b.entries || []).map(function (e) { return { answer: str(e.answer), clue: str(e.clue) }; });
    var layout = genLib().crossword(entries, { seed: JSON.stringify(entries), maxWidth: 17, maxHeight: 17 });
    if (layout.errors && layout.errors.length) throw blockError('crossword: ' + layout.errors.join(' '));
    if (layout.unplaced && layout.unplaced.length) {
      throw blockError('crossword: these answers could not be placed: ' + layout.unplaced.map(function (u) { return u.answer; }).join(', ') +
        '. Remove or replace them (words need shared letters).');
    }
    var cellMm = Math.min(8, Math.floor(c.widthMm / layout.width * 10) / 10);
    var g = svgLib().crosswordGrid(layout, svgOpts(c, { cellMm: cellMm, showAnswers: !!b.show_answers }));
    var out = [imagePara(c, imageRun(g, graphicAlt('Kreuzworträtsel (' + layout.words.length + ' Wörter)',
      { type: 'crossword', entries: entries, show_answers: !!b.show_answers })), { jc: 'center', after: 160 })];
    var col = function (title, list) {
      var ps = [cellPara(c, title, { font: t.headingFont, size: t.size, color: t.colors.heading, b: true }, { after: 60 })];
      list.forEach(function (w) {
        ps.push(cellPara(c, w.number + '  ' + w.clue, c.body, { indLeft: tw(6), indFirst: -tw(6), after: 40 }));
      });
      return cell(ps, {});
    };
    out.push({
      t: 'table', borders: noBorders(), widths: [50, 50], cellMargins: { left: 60, right: 160, top: 0, bottom: 0 },
      rows: [{ cells: [col(c.L.across, layout.across), col(c.L.down, layout.down)] }]
    });
    out.push(spacerAfterTable());
    return out;
  };

  builders.word_search = function (b, c) {
    var words = (b.words || []).map(String);
    var diff = ['easy', 'medium', 'hard'].indexOf(b.difficulty) !== -1 ? b.difficulty : 'medium';
    var r = genLib().wordSearch(words, { difficulty: diff, seed: JSON.stringify(words) + diff, size: b.size });
    if (r.errors && r.errors.length) throw blockError('word_search: ' + r.errors.join(' '));
    if (r.unplaced && r.unplaced.length) throw blockError('word_search: could not place ' + r.unplaced.join(', ') + ' – use fewer or shorter words.');
    var cellMm = Math.min(8, Math.floor(Math.min(c.widthMm, 150) / r.size * 10) / 10);
    var g = svgLib().wordSearchGrid(r, svgOpts(c, { cellMm: cellMm, showAnswers: !!b.show_answers }));
    var out = [imagePara(c, imageRun(g, graphicAlt('Suchsel (' + words.length + ' Wörter)', { type: 'word_search', words: words, difficulty: diff, show_answers: !!b.show_answers })), { jc: 'center', after: 160 })];
    if (b.show_words !== false) {
      out.push(bodyPara(c, '**' + c.L.words + '**  ' + words.join('  ·  ')));
    }
    return out;
  };

  builders.reading_text = function (b, c) {
    var t = c.theme;
    var out = [];
    if (b.title) out.push(para(textRuns(b.title, c.headingBase(3)), { keepNext: true, after: 80, style: 'Heading 3' }));
    var numbers = b.line_numbers !== false;
    var every = clamp(Math.round(num(b.every, 5)), 1, 10);
    var size = t.size || 11;
    var colMm = numbers ? 9 : 0;
    var charMm = size * 0.3528 * 0.54;
    var maxChars = Math.max(30, Math.floor((c.widthMm - colMm - 2) / charMm));
    var lines = genLib().wrapLines(plainText(b.text), maxChars);
    var n = 0;
    lines.forEach(function (line, i) {
      if (!line.trim()) { out.push(para([], { after: 0, line: { value: tw(2.5), rule: 'exact' } })); return; }
      n++;
      var runs = [];
      if (numbers) {
        runs.push(run(n % every === 0 ? String(n) : '', c.small));
        runs.push({ tab: true });
      }
      textRuns(line, c.body, { syllables: b.syllables, theme: t }).forEach(function (r) { runs.push(r); });
      out.push(para(runs, {
        indLeft: tw(colMm), indFirst: numbers ? -tw(colMm) : undefined, after: 0, before: 0,
        line: { value: t.lineSpacing || 1.15, rule: 'auto' }, keepLines: true, tabs: numbers ? [{ pos: tw(colMm), type: 'left' }] : undefined
      }));
    });
    if (out.length) out[out.length - 1].after = 160;
    return out;
  };

  builders.formula = function (b, c) {
    var latex = str(b.latex).trim();
    if (!latex) throw blockError('formula needs "latex".');
    return [para([{ math: latex }], { jc: b.align === 'left' ? 'left' : 'center', after: 120, before: 60 })];
  };

  function graphicBlock(c, b, svgResult, description, source, opts) {
    opts = opts || {};
    var out = [imagePara(c, imageRun(svgResult, graphicAlt(description, source)), { jc: opts.jc || 'center', after: b.caption ? 40 : 160 })];
    if (b.caption) out.push(captionPara(c, b.caption));
    return out;
  }

  function withWidth(c, b, def) {
    var w = b.width_cm != null ? clamp(num(b.width_cm, def / 10), 3, c.widthMm / 10) * 10 : Math.min(def, c.widthMm);
    return w;
  }

  builders.number_line = function (b, c) {
    var g = svgLib().numberLine(svgOpts(c, {
      from: num(b.from, 0), to: num(b.to, 10), step: num(b.step, 1), labelEvery: b.label_every, minorTicks: b.minor_ticks,
      marks: b.marks, blanks: b.blanks, hideLabels: b.hide_labels === true, widthMm: withWidth(c, b, c.widthMm)
    }));
    return graphicBlock(c, b, g, 'Zahlenstrahl von ' + b.from + ' bis ' + b.to, sourceOf(b, 'number_line'));
  };

  builders.coordinate_system = function (b, c) {
    var g = svgLib().coordinateSystem(svgOpts(c, {
      xMin: b.x_min, xMax: b.x_max, yMin: b.y_min, yMax: b.y_max, step: b.step, unitMm: b.unit_mm,
      grid: b.grid !== false, points: b.points, segments: b.segments, polygons: b.polygons, showLabels: b.show_labels !== false
    }));
    if (g.widthMm > c.widthMm) throw blockError('coordinate_system is ' + Math.round(g.widthMm) + ' mm wide but only ' + Math.round(c.widthMm) + ' mm fit – use a smaller range or unit_mm.');
    return graphicBlock(c, b, g, 'Koordinatensystem', sourceOf(b, 'coordinate_system'));
  };

  builders.chart = function (b, c) {
    var g = svgLib().chart(svgOpts(c, {
      type: b.chart_type || 'column', title: b.title, labels: b.labels, series: b.series, xLabel: b.x_label, yLabel: b.y_label,
      widthMm: withWidth(c, b, 150), heightMm: b.height_cm != null ? clamp(num(b.height_cm, 8.5), 4, 20) * 10 : undefined,
      blank: b.blank === true, colors: chartColors(c)
    }));
    return graphicBlock(c, b, g, 'Diagramm' + (b.title ? ': ' + b.title : ''), sourceOf(b, 'chart'));
  };

  function chartColors(c) {
    var t = c.theme;
    if (t.id === 'classic') return ['#1f2937', '#9ca3af', '#4b5563', '#d1d5db', '#6b7280'];
    if (t.id === 'primary') return ['#0d9488', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];
    return ['#2563eb', '#f59e0b', '#0d9488', '#dc2626', '#7c3aed'];
  }

  builders.mindmap = function (b, c) {
    var nb = Array.isArray(b.branches) ? b.branches.length : 0;
    var children = (b.branches || []).reduce(function (n, br) { return n + (br && Array.isArray(br.children) ? br.children.length : 0); }, 0) / 2;
    var g = svgLib().mindmap(svgOpts(c, {
      center: b.center, branches: b.branches, widthMm: withWidth(c, b, c.widthMm),
      // a small minimum height: the graphic grows to what its branches need (otherwise mostly white space)
      heightMm: b.height_cm != null ? clamp(num(b.height_cm, 10), 4, 24) * 10 : clamp(36 + nb * 3 + children, 40, 70), blank: b.blank === true, colors: chartColors(c)
    }));
    return graphicBlock(c, b, g, 'Mindmap: ' + str(b.center), sourceOf(b, 'mindmap'));
  };

  builders.qr_code = function (b, c) {
    var g = svgLib().qrCode(str(b.url), svgOpts(c, { sizeMm: b.size_cm != null ? clamp(num(b.size_cm, 2.5), 1.5, 8) * 10 : 25, label: b.caption, color: '#000000' }));
    return [imagePara(c, imageRun(g, graphicAlt('QR-Code: ' + str(b.url), sourceOf(b, 'qr_code'))), { jc: b.align === 'left' ? 'left' : b.align === 'right' ? 'right' : 'center', after: 160 })];
  };

  builders.svg = function (b, c) {
    var r = svgLib().sanitizeSvg(str(b.svg), { maxWidthMm: c.widthMm });
    if (!r.ok) throw blockError('svg: ' + r.errors.join(' '));
    if (b.width_cm != null) {
      var w = clamp(num(b.width_cm, 8), 1, c.widthMm / 10) * 10;
      r = { svg: r.svg, widthMm: w, heightMm: r.heightMm * w / r.widthMm };
    }
    if (r.removed && r.removed.length) c.warnings.push('svg: removed unsupported parts: ' + r.removed.slice(0, 5).join(', '));
    return graphicBlock(c, b, r, b.caption ? 'Grafik: ' + b.caption : 'Grafik', { type: 'svg', svg: str(b.svg).slice(0, 50000), caption: b.caption, width_cm: b.width_cm });
  };

  builders.cut_line = function (b, c) {
    var g = svgLib().cutLine(svgOpts(c, { widthMm: c.widthMm, label: b.label != null ? b.label : c.L.cut, color: c.theme.colors.muted }));
    return [imagePara(c, imageRun(g, graphicAlt('Schnittlinie', { type: 'cut_line' })), { after: 120, before: 120 })];
  };

  function sourceOf(b, type) {
    var s = { type: type };
    Object.keys(b).forEach(function (k) { if (k !== 'type' && k !== 'image') s[k] = b[k]; });
    return s;
  }

  builders.self_assessment = function (b, c) {
    var t = c.theme;
    var st = (b.statements || []).map(String);
    if (!st.length) throw blockError('self_assessment needs "statements".');
    var headBase = { font: t.font, size: t.sizes.small || undefined, color: t.colors.tableHeaderText || t.colors.text, b: true };
    var faces = [['smiley_good', c.L.selfGood], ['smiley_neutral', c.L.selfOk], ['smiley_bad', c.L.selfBad]];
    var head = [cell([cellPara(c, b.title || c.L.selfCan, { font: t.font, size: t.size, color: t.colors.tableHeaderText || t.colors.text, b: true })], { shd: t.colors.tableHeader, valign: 'center' })];
    faces.forEach(function (f) {
      var ic = svgLib().icon(f[0], { color: t.colors.icon || '#1f2937', sizeMm: 6 });
      head.push(cell([para([imageRun(ic, f[1])], { jc: 'center', after: 0 }), cellPara(c, f[1], headBase, { jc: 'center' })], { shd: t.colors.tableHeader, valign: 'center' }));
    });
    var rows = [{ header: true, cells: head }];
    st.forEach(function (s) {
      var cells = [cell([cellPara(c, s, c.body)], { valign: 'center' })];
      for (var k = 0; k < 3; k++) cells.push(cell([para([checkboxRun(c, false)], { jc: 'center', after: 0 })], { valign: 'center' }));
      rows.push({ height: tw(8), cells: cells });
    });
    return [{ t: 'table', borders: gridBorders(t.colors.border, 4), widths: [55, 15, 15, 15], cellMargins: { left: 100, right: 100, top: 40, bottom: 40 }, rows: rows }, spacerAfterTable()];
  };

  builders.hint_cards = function (b, c) {
    var t = c.theme;
    var cards = Array.isArray(b.cards) ? b.cards : [];
    if (!cards.length) throw blockError('hint_cards needs "cards" [{title?, text}].');
    var cols = clamp(Math.round(num(b.columns, 2)), 1, 3);
    var out = builders.cut_line({ label: b.cut_label }, c);
    var v = t.boxes.tip;
    var dash = border(6, t.colors.muted);
    var rows = [];
    for (var i = 0; i < cards.length; i += cols) {
      var cells = [];
      for (var k = 0; k < cols; k++) {
        var card = cards[i + k];
        if (!card) { cells.push(cell([para([])], { borders: { top: null, bottom: null, left: null, right: null } })); continue; }
        var title = card.title || (c.L.hint + ' ' + (i + k + 1));
        var head = [];
        if (t.id !== 'document') { head.push(imageRun(svgLib().icon('tip', { color: v.title || '#1f2937', sizeMm: 5 }), '')); head.push({ text: ' ' }); }
        textRuns(title, { font: t.headingFont, size: t.size, color: v.title || t.colors.heading, b: true }).forEach(function (r) { head.push(r); });
        cells.push(cell([para(head, { after: 60 })].concat(boxContent(c, card.text, card.items)), {
          shd: t.id === 'classic' ? undefined : v.fill, valign: 'top', borders: { top: dash, bottom: dash, left: dash, right: dash }
        }));
      }
      rows.push({ cells: cells, height: tw(25) });
    }
    out.push({ t: 'table', borders: noBorders(), widths: rows[0].cells.map(function () { return 100 / cols; }), cellMargins: { left: 160, right: 160, top: 120, bottom: 120 }, rows: rows });
    out.push(spacerAfterTable());
    return out;
  };

  builders.grade_key = function (b, c) {
    var t = c.theme;
    var key;
    try {
      key = genLib().gradeKey(num(b.total_points, 0), { thresholds: b.thresholds, step: b.step === 1 ? 1 : 0.5 });
    } catch (e) {
      throw blockError('grade_key: ' + e.message);
    }
    var headBase = { font: t.font, size: t.sizes.small || undefined, color: t.colors.tableHeaderText || t.colors.text, b: true };
    var small = c.small.size ? c.small : c.body;
    var row1 = [cell([cellPara(c, c.L.grade, headBase)], { shd: t.colors.tableHeader })];
    var row2 = [cell([cellPara(c, c.L.range, headBase)], { shd: t.colors.tableHeader })];
    key.forEach(function (k) {
      row1.push(cell([cellPara(c, String(k.grade), headBase, { jc: 'center' })], { shd: t.colors.tableHeader }));
      row2.push(cell([cellPara(c, k.max === k.min ? fmtNum(k.min) : fmtNum(k.max) + '–' + fmtNum(k.min), run('', small, { color: t.colors.text }), { jc: 'center' })], {}));
    });
    var out = [];
    if (b.title !== false) out.push(bodyPara(c, '**' + (typeof b.title === 'string' ? b.title : c.L.total + ': ___ / ' + fmtNum(num(b.total_points, 0)) + ' ' + c.L.pointsLong) + '**', { keepNext: true }));
    out.push({ t: 'table', borders: gridBorders(t.colors.border, 4), widths: [16, 14, 14, 14, 14, 14, 14], cellMargins: { left: 60, right: 60, top: 30, bottom: 30 }, rows: [{ cells: row1 }, { cells: row2 }] });
    out.push(spacerAfterTable());
    return out;
  };

  builders.columns = function (b, c) {
    var cols = Array.isArray(b.columns) ? b.columns : [];
    if (cols.length < 2 || cols.length > 3) throw blockError('columns needs 2–3 "columns" (each an array of blocks).');
    if (c.nested) throw blockError('columns cannot be nested.');
    var widths = normWidths(b.widths, cols.length) || cols.map(function () { return 100 / cols.length; });
    var gapMm = 6;
    var cells = cols.map(function (blocks, i) {
      var sub = Object.create(c);
      sub.nested = true;
      sub.widthMm = c.widthMm * widths[i] / 100 - gapMm;
      var content = [];
      (Array.isArray(blocks) ? blocks : []).forEach(function (blk, k) {
        if (!blk || ['columns', 'page_break', 'title', 'name_line', 'cut_line', 'hint_cards'].indexOf(blk.type) !== -1) {
          throw blockError('columns[' + i + '][' + k + ']: type "' + (blk && blk.type) + '" is not allowed inside columns.');
        }
        buildBlock(blk, sub).forEach(function (el) { content.push(el); });
      });
      // a table cell must not end with a table
      if (!content.length || content[content.length - 1].t === 'table') content.push(para([], { after: 0 }));
      return cell(content, { valign: 'top' });
    });
    return [{ t: 'table', borders: noBorders(), widths: widths, cellMargins: { left: 0, right: tw(gapMm), top: 0, bottom: 0 }, rows: [{ cells: cells }] }, spacerAfterTable()];
  };

  builders.staff = function (b, c) {
    var widthCm = b.width_cm != null ? num(b.width_cm, 16) : (c.staffWidthCm || Math.min(16, c.widthMm / 10));
    return [para([{ image: { kind: 'staff', abc: b.abc, widthCm: Math.min(widthCm, c.widthMm / 10) } }], { after: 120 })];
  };

  builders.empty_staves = function (b, c) {
    var widthCm = b.width_cm != null ? num(b.width_cm, 16) : (c.staffWidthCm || Math.min(16, c.widthMm / 10));
    return [para([{ image: { kind: 'empty_staves', clef: b.clef === 'bass' ? 'bass' : 'treble', count: b.count, measures: b.measures, widthCm: Math.min(widthCm, c.widthMm / 10) } }], { after: 120 })];
  };

  builders.page_break = function () {
    return [para([], { pageBreak: true })];
  };

  builders.spacer = function (b, c) {
    var n = clamp(Math.round(num(b.lines, 1)), 1, 10);
    var out = [];
    for (var i = 0; i < n; i++) out.push(para([], { after: 0 }));
    return out;
  };

  function buildBlock(b, c) {
    var fn = builders[b && b.type];
    if (!fn) throw blockError('unknown type "' + (b && b.type) + '". Allowed: ' + BLOCK_TYPES.join(', '));
    return fn(b, c);
  }

  /**
   * Blocks -> layout elements.
   * ctx: { theme (id or object), lang, textWidthMm, staffWidthCm, taskStart, listPrefix }
   * Throws an Error "blocks[i] (type): message" for invalid blocks.
   */
  function compose(blocks, ctx) {
    var c = makeContext(ctx);
    var elements = [];
    (blocks || []).forEach(function (b, i) {
      var els;
      try {
        els = buildBlock(b, c);
      } catch (e) {
        var err = new Error('blocks[' + i + '] (' + (b && b.type) + '): ' + (e && e.message ? e.message : String(e)));
        err.blockIndex = i;
        throw err;
      }
      els.forEach(function (el) {
        if (el.t === 'table' && !el.description) el.description = BLOCK_MARKER + JSON.stringify(blockTag(b));
      });
      // Two tables directly after each other would merge into one: keep a small paragraph between them.
      var last = elements[elements.length - 1];
      if (last && last.t === 'table' && els.length && els[0].t === 'table') elements.push(spacerAfterTable());
      // Keep a heading-like element together with what follows (no heading alone at the bottom of a page).
      if (last && last.t === 'p' && last.keepNext === undefined && els.length && /^Heading/.test(last.style || '')) last.keepNext = true;
      els.forEach(function (el) { elements.push(el); });
    });
    // Nothing after the last element should be kept with "next" (there is none).
    if (elements.length && elements[elements.length - 1].t === 'p') delete elements[elements.length - 1].keepNext;
    return { elements: elements, warnings: c.warnings, theme: c.theme.id, taskCount: c.taskCounter };
  }

  /** Short description of a block stored on its table (type and a few settings, no content). */
  function blockTag(b) {
    var tag = { type: b.type };
    ['variant', 'mode', 'show_answers'].forEach(function (k) { if (b[k] !== undefined) tag[k] = b[k]; });
    if (b.type === 'word_bank') tag.count = (b.words || []).length;
    if (b.type === 'cloze') tag.gaps = (str(b.text).match(/\[\[/g) || []).length;
    return tag;
  }

  /** All image runs (for rasterising), in document order. */
  function collectImages(elements) {
    var out = [];
    function walk(list) {
      (list || []).forEach(function (el) {
        if (el.t === 'p') el.runs.forEach(function (r) { if (r.image) out.push(r.image); });
        else if (el.t === 'table') el.rows.forEach(function (row) { row.cells.forEach(function (cl) { walk(cl.content); }); });
      });
    }
    walk(elements);
    return out;
  }

  return {
    BLOCK_TYPES: BLOCK_TYPES,
    LINE_STYLES: LINE_STYLES,
    GRAPHIC_TYPES: GRAPHIC_TYPES,
    GRAPHIC_MARKER: GRAPHIC_MARKER,
    TASK_MARKER: TASK_MARKER,
    BLOCK_MARKER: BLOCK_MARKER,
    compose: compose,
    collectImages: collectImages,
    textRuns: textRuns,
    plainText: plainText,
    parseMarker: parseMarker,
    tw: tw
  };
});
