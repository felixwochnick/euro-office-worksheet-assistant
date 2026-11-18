/*
 * worksheet-svg.js – SVG graphics for printable worksheets (MIT License).
 *
 * Used by both the editor plugin (browser, global `WorksheetSvg`) and Node.js
 * (CommonJS `require`). Keep it dependency-free and ES2015-compatible.
 *
 * Every graphic function returns { svg, widthMm, heightMm }. The SVG root has
 * width/height in px (96 dpi) and a viewBox in millimetres, so all drawing
 * coordinates are millimetres. No background (the rasteriser fills white).
 * Print rules: everything legible in grayscale, lines >= 0.25 mm, text >= 3 mm.
 *
 * Functions:
 *  - icon(name, opts)              small line icons (ICON_NAMES)
 *  - taskBadge(label, opts)        task number in a filled circle / square
 *  - stars(level, opts)            difficulty stars
 *  - lineature(opts)               writing paper: Lineatur 1–4, lines, 5/10 mm grid
 *  - numberLine(opts)              number line with ticks, marks and blanks
 *  - coordinateSystem(opts)        axes, grid, points, segments, polygons
 *  - chart(opts)                   column / bar / line / pie charts (also blank)
 *  - mindmap(opts)                 mind map with branches and children (also blank)
 *  - crosswordGrid(layout, opts)   crossword boxes with clue numbers
 *  - wordSearchGrid(result, opts)  word search letter grid (+ answer capsules)
 *  - cutLine(opts)                 dashed cut line with scissors
 *  - qrCode(text, opts)            QR code (needs the vendored qrcode-generator)
 *  - sanitizeSvg(svgText, opts)    whitelist-clean SVG written by an AI
 *  - escapeXml(s), DEFAULT_FONT
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
  } else {
    root.WorksheetSvg = factory(root);
  }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var DEFAULT_FONT = "'Open Sans', 'DejaVu Sans', Arial, sans-serif";
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var COLOR_RE = /^#[0-9a-f]{6}$/i;
  var INK = '#1f2937';          // text and dark lines
  var MUTED = '#4b5563';        // secondary text
  var AXIS = '#374151';         // chart axes
  var GRID = '#d1d5db';         // light grid lines
  var WHITE = '#ffffff';
  // Series colours: distinct hues AND lightness; series are also told apart by
  // patterns (charts) or marker shapes / dashes (line charts) for grayscale print.
  var PALETTE = ['#2563eb', '#f59e0b', '#059669', '#7c3aed', '#dc2626', '#0891b2', '#db2777', '#65a30d'];
  var MM_PER_PX = 25.4 / 96;
  var CAP = 0.72;   // cap height / font size (Open Sans, DejaVu Sans, Arial ≈ 0.71–0.73)
  var LH = 1.25;    // line height / font size
  var MINUS = '−';

  // ---------------------------------------------------------------------------
  // Basic helpers
  // ---------------------------------------------------------------------------

  function round3(n) {
    var r = Math.round(n * 1000) / 1000;
    return r === 0 ? 0 : r; // no "-0"
  }

  /** Number for SVG output: at most 3 decimals. */
  function f(n) {
    return String(round3(n));
  }

  function px(mm) {
    return String(Math.round(mm / 25.4 * 96 * 100) / 100);
  }

  function escapeXml(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function attrs(o) {
    var out = '';
    for (var k in o) {
      if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
      var v = o[k];
      if (v === undefined || v === null || v === false) continue;
      out += ' ' + k + '="' + (typeof v === 'number' ? f(v) : escapeXml(v)) + '"';
    }
    return out;
  }

  function el(tag, o, content) {
    if (content === undefined || content === null || content === '') return '<' + tag + attrs(o || {}) + '/>';
    return '<' + tag + attrs(o || {}) + '>' + content + '</' + tag + '>';
  }

  function doc(w, h, body, font) {
    var svg = '<svg xmlns="' + SVG_NS + '" width="' + px(w) + '" height="' + px(h) +
      '" viewBox="0 0 ' + f(w) + ' ' + f(h) + '">' +
      (font ? '<g font-family="' + escapeXml(font) + '">' + body + '</g>' : body) + '</svg>';
    return { svg: svg, widthMm: round3(w), heightMm: round3(h) };
  }

  /** Short deterministic id prefix (FNV-1a) so ids of different graphics do not clash. */
  function hashId(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return 'ws' + h.toString(36);
  }

  function hexRgb(c) {
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  }

  function rgbHex(rgb) {
    return '#' + rgb.map(function (v) {
      var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length < 2 ? '0' + s : s;
    }).join('');
  }

  /** Mix a colour with white (t = 0 … 1, share of white). */
  function tint(c, t) {
    return rgbHex(hexRgb(c).map(function (v) { return v + (255 - v) * t; }));
  }

  /** Relative luminance 0 … 1. */
  function luminance(c) {
    var rgb = hexRgb(c).map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  }

  // ---------------------------------------------------------------------------
  // Validation helpers
  // ---------------------------------------------------------------------------

  function fail(fn, msg) {
    return new Error(fn + ': ' + msg);
  }

  function show(v) {
    try {
      var s = JSON.stringify(v);
      if (s === undefined) return String(v);
      return s.length > 60 ? s.slice(0, 57) + '...' : s;
    } catch (e) {
      return String(v);
    }
  }

  function optsOf(opts, fn) {
    if (opts === undefined || opts === null) return {};
    if (typeof opts !== 'object' || Array.isArray(opts)) throw fail(fn, 'options must be an object.');
    return opts;
  }

  function toNum(v) {
    if (typeof v === 'string' && v.trim() !== '') return Number(v.replace(',', '.'));
    return v;
  }

  function num(v, def, min, max, fn, name) {
    if (v === undefined || v === null || v === '') return def;
    var n = toNum(v);
    if (typeof n !== 'number' || !isFinite(n)) throw fail(fn, '"' + name + '" must be a number (got ' + show(v) + ').');
    if (n < min || n > max) throw fail(fn, '"' + name + '" must be between ' + min + ' and ' + max + ' (got ' + n + ').');
    return n;
  }

  function int(v, def, min, max, fn, name) {
    var n = num(v, def, min, max, fn, name);
    if (Math.floor(n) !== n) throw fail(fn, '"' + name + '" must be a whole number (got ' + n + ').');
    return n;
  }

  function reqNum(v, fn, name) {
    var n = toNum(v);
    if (typeof n !== 'number' || !isFinite(n)) {
      throw fail(fn, '"' + name + '" is required and must be a number (got ' + show(v) + ').');
    }
    return n;
  }

  function colorOf(v, def) {
    return typeof v === 'string' && COLOR_RE.test(v) ? v.toLowerCase() : def;
  }

  function fontOf(v) {
    return typeof v === 'string' && v.trim() && v.length <= 200 && !/[<>{};\\]/.test(v) ? v.trim() : DEFAULT_FONT;
  }

  function textOf(v, fn, name, maxLen, required) {
    if (v === undefined || v === null) {
      if (required) throw fail(fn, '"' + name + '" is required.');
      return '';
    }
    if (typeof v !== 'string' && typeof v !== 'number') throw fail(fn, '"' + name + '" must be a string (got ' + show(v) + ').');
    var s = String(v).trim();
    if (required && !s) throw fail(fn, '"' + name + '" must not be empty.');
    if (s.length > maxLen) throw fail(fn, '"' + name + '" is too long (' + s.length + ' characters, max ' + maxLen + ').');
    return s;
  }

  function paletteOf(colors) {
    var out = PALETTE.slice();
    if (Array.isArray(colors)) {
      for (var i = 0; i < colors.length && i < 12; i++) out[i] = colorOf(colors[i], PALETTE[i % PALETTE.length]);
    }
    return out;
  }

  function seriesColor(pal, i) {
    return pal[i] || PALETTE[i % PALETTE.length];
  }

  // ---------------------------------------------------------------------------
  // Text measuring and layout (estimates – generous, so nothing overflows)
  // ---------------------------------------------------------------------------

  // Advance widths in em, close to DejaVu Sans (the widest likely fallback).
  var CHAR_W = {
    ' ': 0.32, 'i': 0.28, 'l': 0.28, 'j': 0.28, '.': 0.32, ',': 0.32, ':': 0.34, ';': 0.34, '!': 0.4,
    '|': 0.34, "'": 0.28, '`': 0.5, '’': 0.32, '‚': 0.32, '„': 0.5, '“': 0.5, '"': 0.46,
    'I': 0.3, 'J': 0.3, 'f': 0.36, 't': 0.4, 'r': 0.42, 's': 0.53, 'c': 0.56, 'z': 0.53, 'k': 0.58,
    'v': 0.59, 'x': 0.59, 'y': 0.59, 'm': 0.97, 'w': 0.82, 'M': 0.86, 'W': 0.99, 'L': 0.57, 'F': 0.58,
    'E': 0.63, 'P': 0.61, 'T': 0.62, 'Y': 0.62, 'S': 0.64, 'Z': 0.69, 'O': 0.79, 'Q': 0.79, 'G': 0.78,
    'D': 0.77, 'C': 0.7, 'N': 0.75, 'H': 0.75, 'U': 0.73, 'A': 0.69, 'V': 0.69, 'X': 0.69, 'K': 0.66,
    '(': 0.39, ')': 0.39, '[': 0.39, ']': 0.39, '{': 0.64, '}': 0.64, '-': 0.36, '–': 0.5,
    '—': 1.0, '/': 0.34, '\\': 0.34, '%': 0.95, '&': 0.78, '@': 1.0, '?': 0.53, '#': 0.84,
    '*': 0.5, '_': 0.5, '°': 0.5, '€': 0.64, '+': 0.75, '=': 0.75, '<': 0.75, '>': 0.75,
    '−': 0.7, 'ß': 0.63, '…': 1.0, '·': 0.32
  };

  function charWidth(ch) {
    if (CHAR_W.hasOwnProperty(ch)) return CHAR_W[ch];
    if (ch >= '0' && ch <= '9') return 0.64;
    var base = ch.normalize ? ch.normalize('NFD').charAt(0) : ch;
    if (base !== ch && CHAR_W.hasOwnProperty(base)) return CHAR_W[base];
    if (base >= 'a' && base <= 'z') return 0.62;
    if (base >= 'A' && base <= 'Z') return 0.72;
    var code = ch.charCodeAt(0);
    if (code < 0x2e80) return 0.65;
    return 1.0; // CJK, emoji …
  }

  function textWidth(str, size, bold) {
    var s = String(str);
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      if (code >= 0xdc00 && code <= 0xdfff) continue; // low surrogate: counted with its high surrogate
      w += charWidth(s.charAt(i));
    }
    return w * size * (bold ? 1.13 : 1);
  }

  /** Greedy word wrap. Breaks after hyphens and, if needed, inside overlong words. */
  function wrapText(str, maxW, size, bold, maxLines) {
    var lines = [];
    String(str).split(/\r?\n/).forEach(function (para) {
      var cur = '';
      var words = para.split(/\s+/).filter(Boolean);
      words.forEach(function (word) {
        var parts = word.match(/[^-]+-*|-+/g) || [word];
        parts.forEach(function (part, pi) {
          var sep = pi === 0 && cur ? ' ' : '';
          var cand = cur + sep + part;
          if (!cur || textWidth(cand, size, bold) <= maxW) {
            if (!cur && textWidth(part, size, bold) > maxW) {
              // overlong part on an empty line: split by characters
              var chunk = '';
              for (var i = 0; i < part.length; i++) {
                var ch = part.charAt(i);
                if (chunk && textWidth(chunk + ch + '-', size, bold) > maxW) {
                  lines.push(chunk + '-');
                  chunk = '';
                }
                chunk += ch;
              }
              cur = chunk;
            } else {
              cur = cand;
            }
          } else {
            lines.push(cur);
            cur = '';
            if (textWidth(part, size, bold) > maxW) {
              var chunk2 = '';
              for (var j = 0; j < part.length; j++) {
                var ch2 = part.charAt(j);
                if (chunk2 && textWidth(chunk2 + ch2 + '-', size, bold) > maxW) {
                  lines.push(chunk2 + '-');
                  chunk2 = '';
                }
                chunk2 += ch2;
              }
              cur = chunk2;
            } else {
              cur = part;
            }
          }
        });
      });
      lines.push(cur);
    });
    while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var last = lines[maxLines - 1];
      while (last && textWidth(last + '…', size, bold) > maxW) last = last.slice(0, -1);
      lines[maxLines - 1] = last.replace(/[\s-]+$/, '') + '…';
    }
    return lines;
  }

  /** True if no word (or hyphen part) is wider than maxW. */
  function wordsFit(str, maxW, size, bold) {
    return String(str).split(/\s+/).filter(Boolean).every(function (w) {
      return (w.match(/[^-]+-*|-+/g) || [w]).every(function (p) { return textWidth(p, size, bold) <= maxW; });
    });
  }

  function maxWidth(lines, size, bold) {
    var w = 0;
    lines.forEach(function (l) { w = Math.max(w, textWidth(l, size, bold)); });
    return w;
  }

  /** Height of a text block from the top of the capitals to the last baseline. */
  function blockHeight(n, size) {
    return n <= 0 ? 0 : (n - 1) * size * LH + size * CAP;
  }

  function text(x, y, str, o) {
    o = o || {};
    var a = { x: x, y: y, 'font-size': o.size || 3.5 };
    if (o.weight) a['font-weight'] = o.weight;
    if (o.italic) a['font-style'] = 'italic';
    if (o.anchor && o.anchor !== 'start') a['text-anchor'] = o.anchor;
    a.fill = o.fill || INK;
    if (o.halo) {
      a.stroke = o.halo;
      a['stroke-width'] = o.haloWidth || 0.8;
      a['stroke-linejoin'] = 'round';
      a['paint-order'] = 'stroke';
    }
    if (o.transform) a.transform = o.transform;
    return el('text', a, escapeXml(str));
  }

  /** Several lines; yTop = top of the capitals of the first line. */
  function textLines(lines, x, yTop, size, o) {
    var out = '';
    for (var i = 0; i < lines.length; i++) {
      if (lines[i] === '') continue;
      out += text(x, yTop + size * CAP + i * size * LH, lines[i], extend({ size: size }, o));
    }
    return out;
  }

  function extend(a, b) {
    var out = {};
    var k;
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) out[k] = a[k];
    for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) out[k] = b[k];
    return out;
  }

  function decimalsOf(v) {
    if (!isFinite(v) || Math.floor(v) === v) return 0;
    var s = String(Math.abs(v));
    var m = /e-(\d+)$/.exec(s);
    if (m) return Math.min(10, parseInt(m[1], 10) + ((s.split('e')[0].split('.')[1] || '').length));
    var i = s.indexOf('.');
    return i < 0 ? 0 : Math.min(10, s.length - i - 1);
  }

  /** Number label: fixed decimals, decimal comma by default, real minus sign. */
  function fmtNum(v, decimals, sep) {
    var s = Math.abs(v) < Math.pow(10, -decimals) / 2 ? (0).toFixed(decimals) : v.toFixed(decimals);
    var neg = s.charAt(0) === '-';
    if (neg) s = s.slice(1);
    var parts = s.split('.');
    if (parts[0].length > 4) {
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep === ',' ? '.' : ',');
    }
    s = parts.join(sep);
    return (neg ? MINUS : '') + s;
  }

  function sepOf(o) {
    return o.decimalSeparator === '.' ? '.' : ',';
  }

  // ---------------------------------------------------------------------------
  // Icons (24-unit grid, stroke 2, round caps/joins; "{c}" = colour)
  // ---------------------------------------------------------------------------

  function person(cx, headY, headR, top, base, hw) {
    var rr = Math.min(hw * 0.8, base - top);
    return '<circle cx="' + cx + '" cy="' + headY + '" r="' + headR + '"/>' +
      '<path d="M' + f(cx - hw) + ' ' + base + 'V' + f(top + rr) + 'A' + f(rr) + ' ' + f(rr) + ' 0 0 1 ' +
      f(cx - hw + rr) + ' ' + top + 'H' + f(cx + hw - rr) + 'A' + f(rr) + ' ' + f(rr) + ' 0 0 1 ' +
      f(cx + hw) + ' ' + f(top + rr) + 'V' + base + '"/>';
  }

  function starPath(cx, cy, R, r) {
    var pts = [];
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var rad = i % 2 === 0 ? R : r;
      pts.push(f(cx + rad * Math.cos(a)) + ' ' + f(cy + rad * Math.sin(a)));
    }
    return 'M' + pts.join('L') + 'Z';
  }

  var DOT = ' fill="{c}" stroke="none"';
  var ICONS = {
    // work forms
    single: person(12, 7, 4, 14, 21, 7),
    partner: person(6.5, 8.5, 3, 15, 20.5, 4) + person(17.5, 8.5, 3, 15, 20.5, 4),
    group: person(12, 10.3, 2.9, 16.2, 21, 5) +
      '<circle cx="4.6" cy="7.6" r="2.3"/><path d="M1.6 17.6V15.2A2.8 2.8 0 0 1 4.4 12.4H5.6"/>' +
      '<circle cx="19.4" cy="7.6" r="2.3"/><path d="M22.4 17.6V15.2A2.8 2.8 0 0 0 19.6 12.4H18.4"/>',
    'class': person(12, 11.2, 2.7, 16.6, 21, 4.6) +
      '<circle cx="4.6" cy="9" r="2.2"/><path d="M1.6 18V16.2A2.6 2.6 0 0 1 4.2 13.6H5.4"/>' +
      '<circle cx="19.4" cy="9" r="2.2"/><path d="M22.4 18V16.2A2.6 2.6 0 0 0 19.8 13.6H18.6"/>' +
      '<circle cx="8.3" cy="3.7" r="1.8"' + DOT + '/><circle cx="15.7" cy="3.7" r="1.8"' + DOT + '/>',
    // activities
    read: '<path d="M12 6.8C10.1 5.2 7.4 4.5 3 4.5v13.6c4.4 0 7.1.7 9 2.3 1.9-1.6 4.6-2.3 9-2.3V4.5c-4.4 0-7.1.7-9 2.3z"/>' +
      '<path d="M12 6.8v13.6"/>',
    write: '<path d="M15.6 4.4a2.1 2.1 0 0 1 3 0l1 1a2.1 2.1 0 0 1 0 3L8.4 19.6 3.4 20.6l1-5z"/><path d="M13.6 6.4l4 4"/>',
    listen: '<path d="M3.5 17.5V12.5a8.5 8.5 0 0 1 17 0v5"/>' +
      '<rect x="3" y="13.5" width="4.5" height="7" rx="1.6"/><rect x="16.5" y="13.5" width="4.5" height="7" rx="1.6"/>',
    speak: '<path d="M6 3.5h12a3 3 0 0 1 3 3v7.5a3 3 0 0 1-3 3h-6.5l-4.5 3.8V17H6a3 3 0 0 1-3-3V6.5a3 3 0 0 1 3-3z"/>' +
      '<path d="M7.5 8.6h9M7.5 12h6"/>',
    draw: '<path d="M11.8 10.6l7.1-7.1a1.9 1.9 0 0 1 2.7 2.7l-7.1 7.1"/><path d="M12.2 13.9l-2-2"/>' +
      '<path d="M10.2 11.9c-2.4-.3-4.6 1.3-4.6 4 0 1.9-1 3-2.6 3.6 1.5 1 3.2 1.5 4.9 1.5 3.1 0 5-2.3 4.3-5.2"/>',
    calculate: '<path d="M7.5 4.2v6.6M4.2 7.5h6.6M13.2 7.5h6.6M5.2 14.2l4.6 4.6M9.8 14.2l-4.6 4.6M13.2 15h6.6M13.2 18h6.6"/>',
    research: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3l5.2 5.2"/>',
    cut: '<circle cx="6" cy="6.5" r="3"/><circle cx="6" cy="17.5" r="3"/><path d="M8.6 8.1L20.5 17.5M8.6 15.9L20.5 6.5"/>',
    glue: '<rect x="5.5" y="10.5" width="11" height="10.5" rx="2"/><path d="M8 10.5V8h6v2.5"/><path d="M10 8l1-4.5L12 8"/>' +
      '<path d="M8.5 15h5"/><path d="M19 3.2c-1 1.4-1.6 2.3-1.6 3.1a1.6 1.6 0 0 0 3.2 0c0-.8-.6-1.7-1.6-3.1z"' + DOT + '/>',
    experiment: '<path d="M9 3h6"/><path d="M10 3v6.2L4.6 18.4A1.7 1.7 0 0 0 6.1 21h11.8a1.7 1.7 0 0 0 1.5-2.6L14 9.2V3"/>' +
      '<path d="M7 14.5h10"/>',
    computer: '<rect x="2.5" y="3.5" width="19" height="13" rx="1.6"/><path d="M12 16.5v4M8 20.5h8"/>',
    music: '<path d="M9 17.5V6l11-2.5v11.5"/><path d="M9 9.6l11-2.5"/>' +
      '<ellipse cx="6.6" cy="17.6" rx="2.7" ry="2.1" transform="rotate(-20 6.6 17.6)"' + DOT + '/>' +
      '<ellipse cx="17.6" cy="15.1" rx="2.7" ry="2.1" transform="rotate(-20 17.6 15.1)"' + DOT + '/>',
    // boxes and status
    info: '<circle cx="12" cy="12" r="9.5"/><path d="M12 11v5.8"/><circle cx="12" cy="7.4" r="1.3"' + DOT + '/>',
    important: '<circle cx="12" cy="12" r="9.5"/><path d="M12 6.8v6.2"/><circle cx="12" cy="16.7" r="1.3"' + DOT + '/>',
    rule: '<path d="M8.5 3h7"/><path d="M10 3v5.5l-3.5 4.3v1.7h11v-1.7L14 8.5V3"/><path d="M12 14.5V21"/>',
    tip: '<path d="M12 2.8A6.3 6.3 0 0 0 8.1 14.1c.6.5.9 1.1.9 1.8v1.6h6v-1.6c0-.7.3-1.3.9-1.8A6.3 6.3 0 0 0 12 2.8z"/>' +
      '<path d="M10 20.8h4"/>',
    warning: '<path d="M10.3 4.3L2.7 17.6a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/>' +
      '<path d="M12 9.3v4.6"/><circle cx="12" cy="17.1" r="1.25"' + DOT + '/>',
    example: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>' +
      '<path d="M8.5 12.5h7M8.5 16h4.5"/>',
    solution: '<circle cx="12" cy="12" r="9.5"/><path d="M7.6 12.4l3 3 5.8-6.2"/>',
    definition: '<path d="M5 19V5A2.5 2.5 0 0 1 7.5 2.5H19v14H7.5A2.5 2.5 0 0 0 5 19a2.5 2.5 0 0 0 2.5 2.5H19v-5"/>' +
      '<path d="M10 2.5v7l2.2-1.6 2.2 1.6v-7"/>',
    question: '<circle cx="12" cy="12" r="9.5"/>' +
      '<path d="M9.3 9.3a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2 1-1.2 1.9v.6"/><circle cx="12" cy="17.1" r="1.25"' + DOT + '/>',
    star: '<path d="' + starPath(12, 12.9, 10, 4.3) + '" fill="{c}"/>',
    star_outline: '<path d="' + starPath(12, 12.9, 10, 4.3) + '"/>',
    clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 6.8V12l3.6 2.4"/>',
    check: '<path d="M4.5 12.5l5 5 10-10.5"/>',
    smiley_good: '<circle cx="12" cy="12" r="9.5"/><circle cx="9" cy="9.8" r="1.25"' + DOT + '/><circle cx="15" cy="9.8" r="1.25"' + DOT + '/>' +
      '<path d="M8 14c.9 1.7 2.3 2.6 4 2.6s3.1-.9 4-2.6"/>',
    smiley_neutral: '<circle cx="12" cy="12" r="9.5"/><circle cx="9" cy="9.8" r="1.25"' + DOT + '/><circle cx="15" cy="9.8" r="1.25"' + DOT + '/>' +
      '<path d="M8.5 15.2h7"/>',
    smiley_bad: '<circle cx="12" cy="12" r="9.5"/><circle cx="9" cy="9.8" r="1.25"' + DOT + '/><circle cx="15" cy="9.8" r="1.25"' + DOT + '/>' +
      '<path d="M8 17c.9-1.7 2.3-2.6 4-2.6s3.1.9 4 2.6"/>',
    thumb_up: '<path d="M7.5 10.5v10"/>' +
      '<path d="M7.5 10.5L11 3.5c1.5 0 2.8 1.2 2.8 2.7v3.3H19a2 2 0 0 1 2 2.3l-1.2 6.9a2 2 0 0 1-2 1.8H4.5A1.5 1.5 0 0 1 3 19v-7a1.5 1.5 0 0 1 1.5-1.5z"/>',
    homework: '<path d="M3.5 11L12 3.8l8.5 7.2"/><path d="M5.8 9.2V20.5h12.4V9.2"/><path d="M10 20.5v-5.5h4v5.5"/>',
    target: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.6"' + DOT + '/>'
  };
  var ICON_NAMES = Object.keys(ICONS);

  function icon(name, opts) {
    var fn = 'icon';
    var o = optsOf(opts, fn);
    if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(ICONS, name)) {
      throw fail(fn, 'unknown icon ' + show(name) + '. Available: ' + ICON_NAMES.join(', ') + '.');
    }
    var c = colorOf(o.color, INK);
    var s = num(o.sizeMm, 8, 3, 100, fn, 'sizeMm');
    var body = ICONS[name].replace(/\{c\}/g, c);
    return doc(s, s, '<g transform="scale(' + f(s / 24) + ')" fill="none" stroke="' + c +
      '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + body + '</g>');
  }

  // ---------------------------------------------------------------------------
  // Task badge and stars
  // ---------------------------------------------------------------------------

  function taskBadge(label, opts) {
    var fn = 'taskBadge';
    var o = optsOf(opts, fn);
    var t = typeof label === 'number' && isFinite(label) ? String(label) : label;
    if (typeof t !== 'string' || !t.trim()) throw fail(fn, 'label must be a short text like "1", "12" or "2a" (got ' + show(label) + ').');
    t = t.trim();
    var n = Array.from(t).length;
    if (n > 3) throw fail(fn, 'label must have 1–3 characters (e.g. "1", "12", "2a"); got "' + t + '".');
    var s = num(o.sizeMm, 8, 4, 30, fn, 'sizeMm');
    var shape = o.shape === undefined ? 'circle' : o.shape;
    if (['circle', 'rounded', 'square'].indexOf(shape) < 0) {
      throw fail(fn, '"shape" must be circle, rounded or square (got ' + show(o.shape) + ').');
    }
    var fill = colorOf(o.fill, '#2563eb');
    var tc = colorOf(o.color, WHITE);
    var fs = s * (n === 1 ? 0.56 : n === 2 ? 0.5 : 0.46);
    var tw = textWidth(t, fs, true);
    var w = s;
    if (n === 3 || tw > s * 0.74) w = Math.max(s, tw + s * 0.5);
    var shapeEl;
    if (shape === 'circle' && w === s) shapeEl = el('circle', { cx: s / 2, cy: s / 2, r: s / 2, fill: fill });
    else {
      var rx = shape === 'circle' ? s / 2 : shape === 'rounded' ? s * 0.24 : 0;
      shapeEl = el('rect', { x: 0, y: 0, width: w, height: s, rx: rx || null, fill: fill });
    }
    var font = fontOf(o.font);
    var body = shapeEl + text(w / 2, s / 2 + fs * CAP / 2, t, { size: fs, weight: 700, anchor: 'middle', fill: tc });
    return doc(w, s, body, font);
  }

  function stars(level, opts) {
    var fn = 'stars';
    var o = optsOf(opts, fn);
    var max = int(o.max, 3, 1, 10, fn, 'max');
    var lv = toNum(level);
    if (typeof lv !== 'number' || !isFinite(lv) || Math.floor(lv) !== lv || lv < 0 || lv > max) {
      throw fail(fn, 'level must be a whole number from 0 to ' + max + ' (got ' + show(level) + ').');
    }
    var s = num(o.sizeMm, 4, 2, 30, fn, 'sizeMm');
    var c = colorOf(o.color, INK);
    var sw = Math.max(0.25, s * 0.075);
    var gap = s * 0.22;
    var R = (s - sw) / (2 * Math.sin(Math.PI * 2 / 5));      // star width = 2R·sin72°
    var cyOff = s / 2 + R * (1 - Math.cos(Math.PI / 5)) / 2;  // optical vertical centre
    var body = '';
    for (var i = 0; i < max; i++) {
      var cx = i * (s + gap) + s / 2;
      body += el('path', {
        d: starPath(cx, cyOff, R, R * 0.43),
        fill: i < lv ? c : 'none',
        stroke: c,
        'stroke-width': sw,
        'stroke-linejoin': 'round'
      });
    }
    return doc(max * s + (max - 1) * gap, s, body);
  }

  // ---------------------------------------------------------------------------
  // Lineature (writing paper)
  // ---------------------------------------------------------------------------

  /*
   * German primary school lineatures. There is no DIN standard; the values
   * follow common exercise books (Brunnen, Staufen, Herlitz):
   *   Lineatur 1 (grade 1): 4 lines 5 mm apart (ascender 5 | x-height 5 | descender 5),
   *                         tinted x-height band, 5 mm between the systems
   *   Lineatur 2 (grade 2): 4 lines 4 mm apart, tinted band, 4 mm between the systems
   *   Lineatur 3 (grade 3): 3.5 mm x-height band between two solid lines (tinted);
   *                         ascender/descender as light dashed helper lines 3.5 mm
   *                         above/below; 3 mm between the systems
   *   Lineatur 4 (grade 4): single writing lines 10 mm apart with a light dashed
   *                         helper line 3.5 mm above each (x-height)
   */
  var SCHOOL = {
    school1: { a: 5, x: 5, d: 5, gap: 5, helpers: false },
    school2: { a: 4, x: 4, d: 4, gap: 4, helpers: false },
    school3: { a: 3.5, x: 3.5, d: 3.5, gap: 3, helpers: true }
  };
  var LINEATURE_KINDS = ['school1', 'school2', 'school3', 'school4', 'lines', 'grid5', 'grid10'];

  function hline(x1, x2, y, color, w, dash) {
    return el('line', { x1: x1, y1: y, x2: x2, y2: y, stroke: color, 'stroke-width': w, 'stroke-dasharray': dash || null });
  }

  function lineature(opts) {
    var fn = 'lineature';
    var o = optsOf(opts, fn);
    var kind = o.kind === undefined ? 'lines' : o.kind;
    if (LINEATURE_KINDS.indexOf(kind) < 0) {
      throw fail(fn, '"kind" must be one of ' + LINEATURE_KINDS.join(', ') + ' (got ' + show(o.kind) + ').');
    }
    var rows = int(o.rows, 3, 1, 40, fn, 'rows');
    var W = num(o.widthMm, 160, 20, 190, fn, 'widthMm');
    var c = colorOf(o.color, '#9ca3af');
    var acc = colorOf(o.accentColor, '#cbd5e1');
    var thin = 0.25;
    var base = 0.35;
    var pad = 0.3;
    var body = '';
    var H;
    if (SCHOOL[kind]) {
      var L = SCHOOL[kind];
      var sys = L.a + L.x + L.d;
      H = rows * sys + (rows - 1) * L.gap + 2 * pad;
      for (var r = 0; r < rows; r++) {
        var top = pad + r * (sys + L.gap);
        var xTop = top + L.a;
        var bl = xTop + L.x;
        var bottom = bl + L.d;
        body += el('rect', { x: 0, y: xTop, width: W, height: L.x, fill: acc, 'fill-opacity': 0.45 });
        var outer = tint(c, 0.4);
        var helperDash = L.helpers ? '1.2 1' : null;
        body += hline(0, W, top, outer, thin, helperDash);
        body += hline(0, W, xTop, c, thin);
        body += hline(0, W, bl, c, base);
        body += hline(0, W, bottom, outer, thin, helperDash);
      }
    } else if (kind === 'school4' || kind === 'lines') {
      var sp = kind === 'school4' ? 10 : num(o.spacingMm, 9, 5, 25, fn, 'spacingMm');
      H = rows * sp;
      for (var i = 0; i < rows; i++) {
        var y = (i + 0.72) * sp;
        if (kind === 'school4') body += hline(0, W, y - 3.5, c, thin, '1.2 1');
        body += hline(0, W, y, c, kind === 'school4' ? base : 0.3);
      }
    } else {
      var cell = kind === 'grid5' ? 5 : 10;
      var cols = Math.floor((W - 2 * pad) / cell);
      var gw = cols * cell;
      var x0 = (W - gw) / 2;
      H = rows * cell + 2 * pad;
      var d = '';
      for (var gx = 0; gx <= cols; gx++) d += 'M' + f(x0 + gx * cell) + ' ' + f(pad) + 'V' + f(pad + rows * cell);
      for (var gy = 0; gy <= rows; gy++) d += 'M' + f(x0) + ' ' + f(pad + gy * cell) + 'H' + f(x0 + gw);
      body = el('path', { d: d, fill: 'none', stroke: c, 'stroke-width': thin, 'stroke-linecap': 'square' });
    }
    return doc(W, H, body);
  }

  // ---------------------------------------------------------------------------
  // Number line
  // ---------------------------------------------------------------------------

  function arrowHead(x, y, dir, len, hw, color) {
    // dir: 'right' | 'up'
    var pts = dir === 'right'
      ? [[x, y], [x - len, y - hw], [x - len * 0.82, y], [x - len, y + hw]]
      : [[x, y], [x - hw, y + len], [x, y + len * 0.82], [x + hw, y + len]];
    return el('path', {
      d: 'M' + pts.map(function (p) { return f(p[0]) + ' ' + f(p[1]); }).join('L') + 'Z',
      fill: color,
      stroke: color,
      'stroke-width': 0.2,
      'stroke-linejoin': 'round'
    });
  }

  function numberLine(opts) {
    var fn = 'numberLine';
    var o = optsOf(opts, fn);
    var from = reqNum(o.from, fn, 'from');
    var to = reqNum(o.to, fn, 'to');
    if (!(to > from)) throw fail(fn, '"to" must be greater than "from" (' + from + ' … ' + to + ').');
    var step = num(o.step, 1, 1e-6, 1e9, fn, 'step');
    var countF = (to - from) / step;
    var count = Math.round(countF);
    if (Math.abs(countF - count) > 1e-6 * Math.max(1, count)) {
      throw fail(fn, '(to − from) must be a multiple of step (' + from + ' … ' + to + ', step ' + step + ').');
    }
    if (count > 200) throw fail(fn, 'too many ticks (' + count + ', max 200); use a larger step or a smaller range.');
    var labelEvery = int(o.labelEvery, 1, 1, 200, fn, 'labelEvery');
    var minor = int(o.minorTicks, 0, 0, 9, fn, 'minorTicks');
    if (count * (minor + 1) > 1000) throw fail(fn, 'too many minor ticks; reduce minorTicks.');
    var W = num(o.widthMm, 160, 40, 190, fn, 'widthMm');
    var hide = !!o.hideLabels;
    var c = colorOf(o.color, INK);
    var acc = colorOf(o.accentColor, '#2563eb');
    var sep = sepOf(o);
    var font = fontOf(o.font);
    var dec = Math.max(decimalsOf(from), decimalsOf(step));
    var fs = 3.5;
    var capH = fs * CAP;
    var inRange = function (v) { return v >= from - step * 1e-6 && v <= to + step * 1e-6; };
    var label = function (v) { return fmtNum(v, Math.max(dec, decimalsOf(round3(v))), sep); };

    var marks = (o.marks || []);
    if (!Array.isArray(marks)) throw fail(fn, '"marks" must be an array of numbers or { value, label }.');
    marks = marks.map(function (m, i) {
      var v = m !== null && typeof m === 'object' ? m.value : m;
      var n = toNum(v);
      if (typeof n !== 'number' || !isFinite(n)) throw fail(fn, 'marks[' + i + '] is not a number (' + show(m) + ').');
      if (!inRange(n)) throw fail(fn, 'mark ' + n + ' lies outside ' + from + ' … ' + to + '.');
      var lab = m !== null && typeof m === 'object' && m.label !== undefined ? textOf(m.label, fn, 'marks[' + i + '].label', 12) : '';
      return { v: n, label: lab };
    });
    var blanks = (o.blanks || []);
    if (!Array.isArray(blanks)) throw fail(fn, '"blanks" must be an array of numbers.');
    blanks = blanks.map(function (b, i) {
      var n = toNum(b);
      if (typeof n !== 'number' || !isFinite(n)) throw fail(fn, 'blanks[' + i + '] is not a number (' + show(b) + ').');
      if (!inRange(n)) throw fail(fn, 'blank ' + n + ' lies outside ' + from + ' … ' + to + '.');
      return n;
    });
    var isBlank = function (v) {
      for (var i = 0; i < blanks.length; i++) if (Math.abs(blanks[i] - v) < step * 1e-6) return true;
      return false;
    };

    // Which ticks are "long" (labelled)?
    var ticks = [];
    var onGrid = Math.abs(from / step - Math.round(from / step)) < 1e-6;
    var maxLabelW = 0;
    for (var i = 0; i <= count; i++) {
      var v = Number((from + i * step).toFixed(Math.min(12, dec + 3)));
      var k = onGrid ? Math.round(v / step) : i;
      var long = ((k % labelEvery) + labelEvery) % labelEvery === 0;
      ticks.push({ i: i, v: v, long: long });
      maxLabelW = Math.max(maxLabelW, textWidth(label(v), fs));
    }
    var boxW = Math.max(7, maxLabelW + 3.5);
    var boxH = Math.max(6, capH + 3.4);

    // Horizontal layout
    var pad = 0.6;
    var firstW = textWidth(label(from), fs);
    var lastW = textWidth(label(to), fs);
    var leftHalf = Math.max(2.5, hide ? 0 : firstW / 2, isBlank(from) ? boxW / 2 : 0);
    var rightHalf = Math.max(hide ? 0 : lastW / 2, isBlank(to) ? boxW / 2 : 0, 6.5);
    var x0 = pad + leftHalf;
    var x1 = W - pad - rightHalf;
    if (x1 - x0 < 10) throw fail(fn, 'widthMm is too small.');
    var unit = (x1 - x0) / count;
    var X = function (val) { return x0 + (val - from) / step * unit; };

    // Bottom items: labels and boxes must not overlap
    var items = [];
    ticks.forEach(function (t) {
      if (isBlank(t.v)) items.push({ x: X(t.v), w: boxW });
      else if (!hide && t.long) items.push({ x: X(t.v), w: textWidth(label(t.v), fs) });
    });
    blanks.forEach(function (b) {
      var onTick = false;
      ticks.forEach(function (t) { if (Math.abs(t.v - b) < step * 1e-6) onTick = true; });
      if (!onTick) items.push({ x: X(b), w: boxW });
    });
    items.sort(function (a, b) { return a.x - b.x; });
    for (var j = 1; j < items.length; j++) {
      if (items[j - 1].x + items[j - 1].w / 2 + 1 > items[j].x - items[j].w / 2) {
        var need = Math.ceil((maxLabelW + 1.2) / unit);
        throw fail(fn, 'labels or blank boxes would overlap (' + f(unit) + ' mm per step); use labelEvery ≥ ' +
          Math.max(2, need) + ', fewer blanks next to each other, a larger step or a larger widthMm.');
      }
    }

    // Vertical layout
    var tickL = 2.4;
    var tickM = 1.7;
    var tickS = 1.0;
    var markLabels = marks.some(function (m) { return m.label; });
    var yAxis = pad + (markLabels ? capH + 1.6 : 0) + tickL;
    var bottom = yAxis + tickL;
    if (!hide && ticks.some(function (t) { return t.long; })) bottom = yAxis + tickL + 1.3 + capH + 0.6;
    if (blanks.length) bottom = Math.max(bottom, yAxis + tickL + 0.8 + boxH);
    var H = bottom + pad;

    var body = '';
    // axis line + arrow
    var xEnd = W - pad;
    body += el('line', { x1: x0 - 2.5, y1: yAxis, x2: xEnd - 1.5, y2: yAxis, stroke: c, 'stroke-width': 0.4 });
    body += arrowHead(xEnd, yAxis, 'right', 3, 1.5, c);
    // ticks
    var d = { L: '', M: '', S: '' };
    ticks.forEach(function (t, idx) {
      var x = X(t.v);
      var len = t.long || isBlank(t.v) ? 'L' : 'M';
      var h = len === 'L' ? tickL : tickM;
      d[len] += 'M' + f(x) + ' ' + f(yAxis - h) + 'V' + f(yAxis + h);
      if (minor && idx < count) {
        for (var m = 1; m <= minor; m++) {
          var xm = x + unit * m / (minor + 1);
          d.S += 'M' + f(xm) + ' ' + f(yAxis - tickS) + 'V' + f(yAxis + tickS);
        }
      }
    });
    blanks.forEach(function (b) {
      d.L += 'M' + f(X(b)) + ' ' + f(yAxis - tickL) + 'V' + f(yAxis + tickL);
    });
    if (d.S) body += el('path', { d: d.S, stroke: c, 'stroke-width': 0.25 });
    if (d.M) body += el('path', { d: d.M, stroke: c, 'stroke-width': 0.3 });
    if (d.L) body += el('path', { d: d.L, stroke: c, 'stroke-width': 0.4 });
    // labels and boxes
    var labelY = yAxis + tickL + 1.3 + capH;
    ticks.forEach(function (t) {
      if (isBlank(t.v)) return;
      if (!hide && t.long) body += text(X(t.v), labelY, label(t.v), { size: fs, anchor: 'middle', fill: c });
    });
    blanks.forEach(function (b) {
      body += el('rect', {
        x: X(b) - boxW / 2, y: yAxis + tickL + 0.8, width: boxW, height: boxH, rx: 0.8,
        fill: WHITE, stroke: c, 'stroke-width': 0.3
      });
    });
    // marks
    marks.forEach(function (m) {
      var x = X(m.v);
      body += el('circle', { cx: x, cy: yAxis, r: 1.35, fill: acc });
      if (m.label) body += text(x, yAxis - tickL - 1.0, m.label, { size: fs, anchor: 'middle', weight: 700, fill: acc });
    });
    return doc(W, H, body, font);
  }

  // ---------------------------------------------------------------------------
  // Coordinate system
  // ---------------------------------------------------------------------------

  function Bounds() {
    this.x0 = Infinity; this.y0 = Infinity; this.x1 = -Infinity; this.y1 = -Infinity;
  }
  Bounds.prototype.add = function (x0, y0, x1, y1) {
    this.x0 = Math.min(this.x0, x0, x1); this.x1 = Math.max(this.x1, x0, x1);
    this.y0 = Math.min(this.y0, y0, y1); this.y1 = Math.max(this.y1, y0, y1);
  };
  Bounds.prototype.addText = function (x, y, w, size, anchor) {
    var left = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
    this.add(left, y - size * CAP - 0.3, left + w, y + size * 0.22);
  };

  function boxesOverlap(a, b) {
    return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  }

  function segsCross(a, b, c, d) {
    var o = function (p, q, r) { return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); };
    var d1 = o(c, d, a);
    var d2 = o(c, d, b);
    var d3 = o(a, b, c);
    var d4 = o(a, b, d);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }

  /** Does the line segment [x1, y1, x2, y2] touch the box [x0, y0, x1, y1]? */
  function segHitsBox(ln, box) {
    var inside = function (x, y) { return x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3]; };
    if (inside(ln[0], ln[1]) || inside(ln[2], ln[3])) return true;
    var a = [ln[0], ln[1]];
    var b = [ln[2], ln[3]];
    var c = [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]];
    for (var i = 0; i < 4; i++) if (segsCross(a, b, c[i], c[(i + 1) % 4])) return true;
    return false;
  }

  function pairOf(p, fn, name) {
    if (!Array.isArray(p) || p.length !== 2) throw fail(fn, name + ' must be [x, y] (got ' + show(p) + ').');
    return [reqNum(p[0], fn, name + '[0]'), reqNum(p[1], fn, name + '[1]')];
  }

  function coordinateSystem(opts) {
    var fn = 'coordinateSystem';
    var o = optsOf(opts, fn);
    var xMin = num(o.xMin, -5, -1000, 1000, fn, 'xMin');
    var xMax = num(o.xMax, 5, -1000, 1000, fn, 'xMax');
    var yMin = num(o.yMin, -5, -1000, 1000, fn, 'yMin');
    var yMax = num(o.yMax, 5, -1000, 1000, fn, 'yMax');
    if (!(xMax > xMin)) throw fail(fn, '"xMax" must be greater than "xMin".');
    if (!(yMax > yMin)) throw fail(fn, '"yMax" must be greater than "yMin".');
    var step = num(o.step, 1, 1e-6, 1000, fn, 'step');
    var unit = num(o.unitMm, 8, 2, 40, fn, 'unitMm');
    if ((xMax - xMin) / step > 80 || (yMax - yMin) / step > 80) throw fail(fn, 'too many grid lines (max 80 per axis); use a larger step.');
    var pw = (xMax - xMin) * unit;
    var ph = (yMax - yMin) * unit;
    if (pw > 175) throw fail(fn, 'too wide (' + f(pw) + ' mm, max 175); reduce unitMm or the x range.');
    if (ph > 240) throw fail(fn, 'too tall (' + f(ph) + ' mm, max 240); reduce unitMm or the y range.');
    var grid = o.grid === undefined ? true : !!o.grid;
    var showLabels = o.showLabels === undefined ? true : !!o.showLabels;
    var c = colorOf(o.color, INK);
    var acc = colorOf(o.accentColor, '#2563eb');
    var gridC = colorOf(o.gridColor, '#cbd5e1');
    var sep = sepOf(o);
    var font = fontOf(o.font);
    var dec = decimalsOf(step);
    var fs = 3.2;
    var capH = fs * CAP;

    var X = function (x) { return (x - xMin) * unit; };
    var Y = function (y) { return (yMax - y) * unit; };
    var inX = function (x) { return x >= xMin - 1e-9 && x <= xMax + 1e-9; };
    var inY = function (y) { return y >= yMin - 1e-9 && y <= yMax + 1e-9; };
    var ax = inY(0) ? Y(0) : Y(yMin);   // y position of the x axis
    var ay = inX(0) ? X(0) : X(xMin);   // x position of the y axis
    var b = new Bounds();
    b.add(0, 0, pw, ph);
    var body = '';

    function multiples(lo, hi) {
      var out = [];
      for (var k = Math.ceil(lo / step - 1e-9); k * step <= hi + 1e-9; k++) out.push(Number((k * step).toFixed(dec + 2)));
      return out;
    }
    var xs = multiples(xMin, xMax);
    var ys = multiples(yMin, yMax);

    if (grid) {
      var gd = '';
      xs.forEach(function (x) { gd += 'M' + f(X(x)) + ' 0V' + f(ph); });
      ys.forEach(function (y) { gd += 'M0 ' + f(Y(y)) + 'H' + f(pw); });
      gd += 'M0 0H' + f(pw) + 'V' + f(ph) + 'H0Z';
      body += el('path', { d: gd, fill: 'none', stroke: gridC, 'stroke-width': 0.25 });
    }

    // axes with arrows
    var ext = Math.min(unit * 0.7, 6) + 3;
    body += el('line', { x1: Math.min(0, ay), y1: ax, x2: pw + ext - 1.5, y2: ax, stroke: c, 'stroke-width': 0.4 });
    body += arrowHead(pw + ext, ax, 'right', 3, 1.4, c);
    body += el('line', { x1: ay, y1: Math.max(ph, ax), x2: ay, y2: -ext + 1.5, stroke: c, 'stroke-width': 0.4 });
    body += arrowHead(ay, -ext, 'up', 3, 1.4, c);
    b.add(pw + ext, ax - 1.5, pw + ext, ax + 1.5);
    b.add(ay - 1.5, -ext, ay + 1.5, -ext);
    // axis names
    var xName = textOf(o.xName, fn, 'xName', 20) || 'x';
    var yName = textOf(o.yName, fn, 'yName', 20) || 'y';
    var nfs = 3.8;
    var xnY = ax + 1.6 + nfs * CAP;
    body += text(pw + ext, xnY, xName, { size: nfs, italic: true, anchor: 'end', fill: c });
    b.addText(pw + ext, xnY, textWidth(xName, nfs), nfs, 'end');
    body += text(ay + 2.2, -ext + nfs * CAP + 0.4, yName, { size: nfs, italic: true, fill: c });
    b.addText(ay + 2.2, -ext + nfs * CAP + 0.4, textWidth(yName, nfs), nfs, 'start');

    // ticks and numbers
    var td = '';
    var label = function (v) { return fmtNum(v, dec, sep); };
    var maxXW = 0;
    xs.forEach(function (x) { maxXW = Math.max(maxXW, textWidth(label(x), fs)); });
    var maxYLabelW = 0;
    ys.forEach(function (y) { maxYLabelW = Math.max(maxYLabelW, textWidth(label(y), fs)); });
    var everyX = Math.max(1, Math.ceil((maxXW + 1.4) / (step * unit)));
    var everyY = Math.max(1, Math.ceil((capH + 1.6) / (step * unit)));
    var bothZero = inX(0) && inY(0);
    xs.forEach(function (x) {
      td += 'M' + f(X(x)) + ' ' + f(ax - 0.9) + 'V' + f(ax + 0.9);
      var k = Math.round(x / step);
      if (!showLabels || k % everyX !== 0 || (x === 0 && bothZero)) return;
      var tx = X(x);
      if (Math.abs(tx - pw) < 0.01 && tx + textWidth(label(x), fs) / 2 > pw + ext - 4) return; // under the arrow
      var ty = ax + 1.4 + capH;
      body += text(tx, ty, label(x), { size: fs, anchor: 'middle', fill: c, halo: grid ? WHITE : null, haloWidth: 0.7 });
      b.addText(tx, ty, textWidth(label(x), fs), fs, 'middle');
    });
    ys.forEach(function (y) {
      td += 'M' + f(ay - 0.9) + ' ' + f(Y(y)) + 'H' + f(ay + 0.9);
      var k = Math.round(y / step);
      if (!showLabels || k % everyY !== 0 || (y === 0 && bothZero)) return;
      var ty = Y(y) + capH / 2;
      body += text(ay - 1.4, ty, label(y), { size: fs, anchor: 'end', fill: c, halo: grid ? WHITE : null, haloWidth: 0.7 });
      b.addText(ay - 1.4, ty, textWidth(label(y), fs), fs, 'end');
    });
    if (showLabels && bothZero) {
      body += text(ay - 1.2, ax + 1.4 + capH, '0', { size: fs, anchor: 'end', fill: c, halo: grid ? WHITE : null, haloWidth: 0.7 });
      b.addText(ay - 1.2, ax + 1.4 + capH, textWidth('0', fs), fs, 'end');
    }
    body += el('path', { d: td, stroke: c, 'stroke-width': 0.3 });

    // data
    var data = '';
    var labels = '';
    var lines = [];      // [x1, y1, x2, y2] in mm – obstacles for point labels
    var dots = [];       // [x, y]
    var placed = [];     // label boxes [x0, y0, x1, y1]
    var polygons = o.polygons || [];
    if (!Array.isArray(polygons)) throw fail(fn, '"polygons" must be an array of { points: [[x, y], …], label }.');
    polygons.forEach(function (pg, i) {
      if (!pg || !Array.isArray(pg.points) || pg.points.length < 2) throw fail(fn, 'polygons[' + i + '].points needs at least 2 points [[x, y], …].');
      var pts = pg.points.map(function (p, j) {
        var q = pairOf(p, fn, 'polygons[' + i + '].points[' + j + ']');
        if (!inX(q[0]) || !inY(q[1])) throw fail(fn, 'polygon point (' + q[0] + '|' + q[1] + ') lies outside the axes (x ' + xMin + ' … ' + xMax + ', y ' + yMin + ' … ' + yMax + ').');
        return q;
      });
      pts.forEach(function (q, j) {
        var r = pts[(j + 1) % pts.length];
        lines.push([X(q[0]), Y(q[1]), X(r[0]), Y(r[1])]);
      });
      data += el('path', {
        d: 'M' + pts.map(function (q) { return f(X(q[0])) + ' ' + f(Y(q[1])); }).join('L') + 'Z',
        fill: acc, 'fill-opacity': 0.12, stroke: acc, 'stroke-width': 0.45, 'stroke-linejoin': 'round'
      });
      var lab = textOf(pg.label, fn, 'polygons[' + i + '].label', 30);
      if (lab) {
        var cx = 0;
        var cy = 0;
        pts.forEach(function (q) { cx += X(q[0]); cy += Y(q[1]); });
        cx /= pts.length;
        cy /= pts.length;
        labels += text(cx, cy + 3.4 * CAP / 2, lab, { size: 3.4, anchor: 'middle', weight: 700, fill: acc, halo: WHITE, haloWidth: 0.8 });
        var pw0 = textWidth(lab, 3.4, true);
        placed.push([cx - pw0 / 2, cy - 3.4 * CAP / 2, cx + pw0 / 2, cy + 3.4 * CAP / 2]);
      }
    });
    var segments = o.segments || [];
    if (!Array.isArray(segments)) throw fail(fn, '"segments" must be an array of { from: [x, y], to: [x, y] }.');
    segments.forEach(function (sg, i) {
      if (!sg || typeof sg !== 'object') throw fail(fn, 'segments[' + i + '] must be { from: [x, y], to: [x, y] }.');
      var p = pairOf(sg.from, fn, 'segments[' + i + '].from');
      var q = pairOf(sg.to, fn, 'segments[' + i + '].to');
      [p, q].forEach(function (r) {
        if (!inX(r[0]) || !inY(r[1])) throw fail(fn, 'segment point (' + r[0] + '|' + r[1] + ') lies outside the axes.');
      });
      data += el('line', { x1: X(p[0]), y1: Y(p[1]), x2: X(q[0]), y2: Y(q[1]), stroke: acc, 'stroke-width': 0.5, 'stroke-linecap': 'round' });
      lines.push([X(p[0]), Y(p[1]), X(q[0]), Y(q[1])]);
    });
    var points = o.points || [];
    if (!Array.isArray(points)) throw fail(fn, '"points" must be an array of { x, y, label }.');
    var pointLabels = [];
    points.forEach(function (pt, i) {
      if (!pt || typeof pt !== 'object') throw fail(fn, 'points[' + i + '] must be { x, y, label }.');
      var x = Array.isArray(pt) ? reqNum(pt[0], fn, 'points[' + i + '][0]') : reqNum(pt.x, fn, 'points[' + i + '].x');
      var y = Array.isArray(pt) ? reqNum(pt[1], fn, 'points[' + i + '][1]') : reqNum(pt.y, fn, 'points[' + i + '].y');
      if (!inX(x) || !inY(y)) throw fail(fn, 'point (' + x + '|' + y + ') lies outside the axes (x ' + xMin + ' … ' + xMax + ', y ' + yMin + ' … ' + yMax + ').');
      data += el('circle', { cx: X(x), cy: Y(y), r: 1.1, fill: acc, stroke: WHITE, 'stroke-width': 0.35 });
      dots.push([X(x), Y(y)]);
      var lab = Array.isArray(pt) ? '' : textOf(pt.label, fn, 'points[' + i + '].label', 30);
      if (lab) pointLabels.push({ x: X(x), y: Y(y), text: lab });
    });
    // label placement: try 8 positions around the dot, avoid lines, dots, other labels and the axes
    var lfs = 3.4;
    var lcap = lfs * CAP;
    var axisBand = [
      [Math.min(0, ay) - 1, ax - 0.6, pw + ext, ax + (showLabels ? 1.6 + capH : 0.9)],     // x axis + numbers
      [ay - (showLabels ? 1.6 + maxYLabelW : 0.9), -ext, ay + 0.6, Math.max(ph, ax)]         // y axis + numbers
    ];
    pointLabels.forEach(function (pl) {
      var lw = textWidth(pl.text, lfs, true);
      var g = 1.4;
      var cands = [
        [pl.x + g, pl.y - g, 'start', 0], [pl.x - g, pl.y - g, 'end', 0.4],
        [pl.x + g, pl.y + g + lcap, 'start', 0.8], [pl.x - g, pl.y + g + lcap, 'end', 1.2],
        [pl.x + 1.9, pl.y + lcap / 2, 'start', 1.6], [pl.x - 1.9, pl.y + lcap / 2, 'end', 2],
        [pl.x, pl.y - 2, 'middle', 2.4], [pl.x, pl.y + 2 + lcap, 'middle', 2.8]
      ];
      var best = null;
      cands.forEach(function (cd) {
        var x0 = cd[2] === 'start' ? cd[0] : cd[2] === 'end' ? cd[0] - lw : cd[0] - lw / 2;
        var box = [x0 - 0.3, cd[1] - lcap - 0.3, x0 + lw + 0.3, cd[1] + 0.5];
        var score = cd[3];
        if (box[0] < -1.5 || box[2] > pw + 1.5 || box[1] < -1.5 || box[3] > ph + 1.5) score += 50;
        lines.forEach(function (ln) { if (segHitsBox(ln, box)) score += 10; });
        dots.forEach(function (dt) {
          if (dt[0] > box[0] - 1.1 && dt[0] < box[2] + 1.1 && dt[1] > box[1] - 1.1 && dt[1] < box[3] + 1.1) score += 12;
        });
        placed.forEach(function (pb) { if (boxesOverlap(pb, box)) score += 30; });
        axisBand.forEach(function (ab) { if (boxesOverlap(ab, box)) score += 6; });
        if (!best || score < best.score) best = { score: score, cd: cd, box: box };
      });
      placed.push(best.box);
      labels += text(best.cd[0], best.cd[1], pl.text, { size: lfs, weight: 700, anchor: best.cd[2], fill: acc, halo: WHITE, haloWidth: 0.8 });
      b.add(best.box[0], best.box[1], best.box[2], best.box[3]);
    });
    body += data + labels;

    var pad = 1;
    var W = b.x1 - b.x0 + 2 * pad;
    var H = b.y1 - b.y0 + 2 * pad;
    return doc(W, H, '<g transform="translate(' + f(pad - b.x0) + ' ' + f(pad - b.y0) + ')">' + body + '</g>', font);
  }

  // ---------------------------------------------------------------------------
  // Charts
  // ---------------------------------------------------------------------------

  /** Nice axis: ticks in 1-2-5 steps. */
  function niceScale(lo, hi, target) {
    if (hi <= lo) hi = lo + 1;
    var rough = (hi - lo) / Math.max(1, target);
    var exp = Math.floor(Math.log(rough) / Math.LN10);
    var base = Math.pow(10, exp);
    var fr = rough / base;
    var st = (fr <= 1 ? 1 : fr <= 2 ? 2 : fr <= 5 ? 5 : 10) * base;
    var min = Math.floor(lo / st + 1e-9) * st;
    var max = Math.ceil(hi / st - 1e-9) * st;
    var dec = Math.max(0, -Math.floor(Math.log(st) / Math.LN10 + 1e-9));
    var ticks = [];
    for (var v = min; v <= max + st * 1e-6; v += st) ticks.push(Number(v.toFixed(dec)));
    return { min: Number(min.toFixed(dec)), max: Number(max.toFixed(dec)), step: st, ticks: ticks, dec: dec };
  }

  // Pattern kinds by series index: solid, diagonal, dots, back-diagonal, cross-hatch, horizontal
  function patternDef(id, kind, fill) {
    var dark = luminance(fill) < 0.3;
    var ov = dark ? WHITE : '#111827';
    var op = dark ? 0.55 : 0.4;
    var t = 2;
    var inner = '';
    var rot = null;
    if (kind === 1 || kind === 3) {
      rot = kind === 1 ? 45 : -45;
      inner = el('path', { d: 'M1 0V2', stroke: ov, 'stroke-opacity': op, 'stroke-width': 0.55 });
    } else if (kind === 2) {
      inner = el('circle', { cx: 0.5, cy: 0.5, r: 0.36, fill: ov, 'fill-opacity': op }) +
        el('circle', { cx: 1.5, cy: 1.5, r: 0.36, fill: ov, 'fill-opacity': op });
    } else if (kind === 4) {
      rot = 45;
      inner = el('path', { d: 'M1 0V2M0 1H2', stroke: ov, 'stroke-opacity': op, 'stroke-width': 0.4 });
    } else {
      inner = el('path', { d: 'M0 1H2', stroke: ov, 'stroke-opacity': op, 'stroke-width': 0.55 });
    }
    return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="' + t + '" height="' + t + '"' +
      (rot ? ' patternTransform="rotate(' + rot + ')"' : '') + '>' +
      el('rect', { width: t, height: t, fill: fill }) + inner + '</pattern>';
  }

  function makeFills(prefix, colors, n) {
    var defs = '';
    var fills = [];
    for (var i = 0; i < n; i++) {
      var kind = i % 6;
      if (kind === 0) fills.push(colors[i]);
      else {
        var id = prefix + '-p' + i;
        defs += patternDef(id, kind, colors[i]);
        fills.push('url(#' + id + ')');
      }
    }
    return { defs: defs, fills: fills };
  }

  var LINE_DASH = [null, '2.4 1.2', '0.9 1', '3 1 0.9 1', null, '2.4 1.2'];

  function marker(shape, x, y, s, fill) {
    var h = s / 2;
    var a = { fill: fill, stroke: WHITE, 'stroke-width': 0.3, 'stroke-linejoin': 'round' };
    if (shape === 1) return el('rect', extend({ x: x - h * 0.85, y: y - h * 0.85, width: h * 1.7, height: h * 1.7 }, a));
    if (shape === 2) return el('path', extend({ d: 'M' + f(x) + ' ' + f(y - h * 1.1) + 'L' + f(x + h) + ' ' + f(y + h * 0.75) + 'L' + f(x - h) + ' ' + f(y + h * 0.75) + 'Z' }, a));
    if (shape === 3) return el('path', extend({ d: 'M' + f(x) + ' ' + f(y - h * 1.15) + 'L' + f(x + h * 1.15) + ' ' + f(y) + 'L' + f(x) + ' ' + f(y + h * 1.15) + 'L' + f(x - h * 1.15) + ' ' + f(y) + 'Z' }, a));
    if (shape === 4) return el('circle', { cx: x, cy: y, r: h * 0.85, fill: WHITE, stroke: fill, 'stroke-width': 0.45 });
    if (shape === 5) return el('rect', { x: x - h * 0.8, y: y - h * 0.8, width: h * 1.6, height: h * 1.6, fill: WHITE, stroke: fill, 'stroke-width': 0.45 });
    return el('circle', extend({ cx: x, cy: y, r: h }, a));
  }

  /** Path for a bar with rounded data end. dir: 'up' | 'right'. */
  function barPath(x, y, w, h, r, dir) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    if (r < 0.05) return 'M' + f(x) + ' ' + f(y) + 'h' + f(w) + 'v' + f(h) + 'h' + f(-w) + 'Z';
    if (dir === 'up') {
      return 'M' + f(x) + ' ' + f(y + h) + 'V' + f(y + r) + 'Q' + f(x) + ' ' + f(y) + ' ' + f(x + r) + ' ' + f(y) +
        'H' + f(x + w - r) + 'Q' + f(x + w) + ' ' + f(y) + ' ' + f(x + w) + ' ' + f(y + r) + 'V' + f(y + h) + 'Z';
    }
    return 'M' + f(x) + ' ' + f(y) + 'H' + f(x + w - r) + 'Q' + f(x + w) + ' ' + f(y) + ' ' + f(x + w) + ' ' + f(y + r) +
      'V' + f(y + h - r) + 'Q' + f(x + w) + ' ' + f(y + h) + ' ' + f(x + w - r) + ' ' + f(y + h) + 'H' + f(x) + 'Z';
  }

  function chart(opts) {
    var fn = 'chart';
    var o = optsOf(opts, fn);
    var type = o.type === undefined ? 'column' : o.type;
    if (['bar', 'column', 'line', 'pie'].indexOf(type) < 0) {
      throw fail(fn, '"type" must be bar, column, line or pie (got ' + show(o.type) + ').');
    }
    var W = num(o.widthMm, 150, 50, 190, fn, 'widthMm');
    var H = num(o.heightMm, 85, 35, 250, fn, 'heightMm');
    var blank = !!o.blank;
    var font = fontOf(o.font);
    var sep = sepOf(o);
    var ink = colorOf(o.color, INK);
    var title = textOf(o.title, fn, 'title', 150);
    var xLabel = textOf(o.xLabel, fn, 'xLabel', 60);
    var yLabel = textOf(o.yLabel, fn, 'yLabel', 60);
    var showValues = !!o.showValues && !blank;
    if (!Array.isArray(o.labels) || !o.labels.length) throw fail(fn, '"labels" must be a non-empty array of category names.');
    if (o.labels.length > 40) throw fail(fn, 'too many labels (' + o.labels.length + ', max 40).');
    var labels = o.labels.map(function (l, i) { return textOf(l, fn, 'labels[' + i + ']', 60); });
    var series = o.series === undefined || o.series === null ? [] : o.series;
    if (!Array.isArray(series)) throw fail(fn, '"series" must be an array like [{ name, values: [...] }].');
    if (!blank && !series.length) throw fail(fn, '"series" needs at least one entry (or set blank: true).');
    if (series.length > 8) throw fail(fn, 'too many series (' + series.length + ', max 8).');
    if (type === 'pie' && series.length > 1) throw fail(fn, 'a pie chart takes exactly one series (got ' + series.length + ').');
    if (type === 'pie' && labels.length > 12) throw fail(fn, 'a pie chart can show at most 12 slices (got ' + labels.length + ').');
    series = series.map(function (s, i) {
      if (!s || typeof s !== 'object' || Array.isArray(s)) throw fail(fn, 'series[' + i + '] must be { name, values: [...] }.');
      var vals = s.values;
      if (vals === undefined && blank) vals = null;
      else if (!Array.isArray(vals)) throw fail(fn, 'series[' + i + '].values must be an array of numbers.');
      if (vals) {
        if (vals.length !== labels.length) {
          throw fail(fn, '"labels" and every series need the same length (' + labels.length + ' vs ' + vals.length +
            (s.name ? ' in "' + s.name + '"' : ' in series[' + i + ']') + ').');
        }
        vals = vals.map(function (v, j) {
          var n = toNum(v);
          if (typeof n !== 'number' || !isFinite(n)) throw fail(fn, 'series[' + i + '].values[' + j + '] is not a number (' + show(v) + ').');
          if (type !== 'line' && n < 0) throw fail(fn, 'negative values are only possible in line charts (series[' + i + '].values[' + j + '] = ' + n + ').');
          return n;
        });
      }
      return { name: textOf(s.name, fn, 'series[' + i + '].name', 40), values: vals };
    });
    if (type === 'pie' && !blank) {
      var total = series[0].values.reduce(function (a, v) { return a + v; }, 0);
      if (!(total > 0)) throw fail(fn, 'a pie chart needs a positive sum of values.');
    }
    var pal = paletteOf(o.colors);
    var colors = [];
    var nColors = type === 'pie' ? labels.length : Math.max(1, series.length);
    for (var ci = 0; ci < nColors; ci++) colors.push(seriesColor(pal, ci));
    var prefix = hashId(JSON.stringify([type, labels, series, colors, W, H, blank]));
    var fl = makeFills(prefix, colors, nColors);

    var pad = 1.5;
    var y = pad;
    var body = '';
    var titleFs = 4.2;
    if (title) {
      var tl = wrapText(title, W - 2 * pad, titleFs, true, 2);
      body += textLines(tl, W / 2, y, titleFs, { anchor: 'middle', weight: 700, fill: ink });
      y += blockHeight(tl.length, titleFs) + titleFs * 0.3 + 2.6;
    }
    var lfs = 3.2;
    var lcap = lfs * CAP;

    if (type === 'pie') {
      body += pieChart();
      return doc(W, H, (fl.defs ? '<defs>' + fl.defs + '</defs>' : '') + body, font);
    }

    // Legend (only with several series)
    if (series.length > 1) {
      var items = series.map(function (s, i) {
        var name = s.name || 'Reihe ' + (i + 1);
        var sw = type === 'line' ? 7 : 4.2;
        return { name: name, sw: sw, w: sw + 1.4 + textWidth(name, lfs) };
      });
      var rowsL = [];
      var cur = [];
      var curW = 0;
      items.forEach(function (it, i) {
        it.i = i;
        var add = (cur.length ? 5 : 0) + it.w;
        if (cur.length && curW + add > W - 2 * pad) { rowsL.push({ items: cur, w: curW }); cur = []; curW = 0; add = it.w; }
        cur.push(it);
        curW += add;
      });
      rowsL.push({ items: cur, w: curW });
      rowsL.forEach(function (row) {
        var x = (W - row.w) / 2;
        var cyL = y + lcap / 2;
        row.items.forEach(function (it) {
          if (type === 'line') {
            if (!blank) {
              body += el('line', { x1: x, y1: cyL, x2: x + it.sw, y2: cyL, stroke: colors[it.i], 'stroke-width': 0.6, 'stroke-dasharray': LINE_DASH[it.i % 6] });
              body += marker(it.i % 6, x + it.sw / 2, cyL, 1.9, colors[it.i]);
            } else {
              body += el('line', { x1: x, y1: cyL, x2: x + it.sw, y2: cyL, stroke: MUTED, 'stroke-width': 0.3, 'stroke-dasharray': '0.8 0.8' });
            }
          } else {
            body += el('rect', {
              x: x, y: cyL - 1.6, width: it.sw, height: 3.2, rx: 0.5,
              fill: blank ? WHITE : fl.fills[it.i], stroke: blank ? MUTED : null, 'stroke-width': blank ? 0.25 : null
            });
          }
          body += text(x + it.sw + 1.4, y + lcap, it.name, { size: lfs, fill: ink });
          x += it.w + 5;
        });
        y += lfs * LH + 0.6;
      });
      y += 1.6;
    }

    // Value range
    var all = [];
    series.forEach(function (s) { if (s.values) all = all.concat(s.values); });
    var lo = all.length ? Math.min.apply(null, all) : 0;
    var hi = all.length ? Math.max.apply(null, all) : 10;
    if (type !== 'line' || lo > 0) lo = Math.min(0, lo);
    if (o.min !== undefined) lo = Math.min(lo, num(o.min, 0, -1e12, 1e12, fn, 'min'));
    if (o.max !== undefined) hi = Math.max(hi, num(o.max, 0, -1e12, 1e12, fn, 'max'));
    if (hi <= lo) hi = lo + (lo === 0 ? 10 : Math.abs(lo));
    if (showValues) hi += (hi - lo) * 0.08;

    var tfs = 3.2;
    var tcap = tfs * CAP;
    var cfs = 3.3;
    var axisTitleFs = 3.4;
    var n = labels.length;
    var scale;
    var fmtTick = function (v) { return fmtNum(v, scale.dec, sep); };
    var maxTickW = function () {
      var m = 0;
      scale.ticks.forEach(function (v) { m = Math.max(m, textWidth(fmtTick(v), tfs)); });
      return m;
    };

    if (type === 'bar') {
      // horizontal bars: categories on the left, values along the bottom
      var bottomH = 1.2 + tcap + (xLabel ? 1.8 + axisTitleFs * CAP + axisTitleFs * 0.25 : 0) + 0.4;
      var plotTop = y + 0.5;
      var plotBottom = H - pad - bottomH;
      var plotH = plotBottom - plotTop;
      if (plotH < 12) throw fail(fn, 'heightMm is too small for the title, legend and ' + n + ' bars.');
      var band = plotH / n;
      var yTitleW = yLabel ? axisTitleFs + 2 : 0;
      var maxCatW = Math.min(W * 0.34, 45);
      var catLines = labels.map(function (l) {
        var maxL = Math.max(1, Math.floor((band - 0.6) / (cfs * LH)));
        return wrapText(l, maxCatW, cfs, false, Math.min(3, maxL));
      });
      var catW = 0;
      catLines.forEach(function (ls) { catW = Math.max(catW, maxWidth(ls, cfs)); });
      var plotLeft = pad + yTitleW + catW + 2;
      scale = niceScale(lo, hi, 5);
      var plotRight = W - pad - textWidth(fmtTick(scale.max), tfs) / 2 - 0.5;
      var plotW = plotRight - plotLeft;
      scale = niceScale(lo, hi, Math.max(2, Math.min(10, Math.round(plotW / 22))));
      plotRight = W - pad - textWidth(fmtTick(scale.max), tfs) / 2 - 0.5;
      plotW = plotRight - plotLeft;
      if (plotW < 20) throw fail(fn, 'widthMm is too small for the category labels.');
      var XV = function (v) { return plotLeft + (v - scale.min) / (scale.max - scale.min) * plotW; };
      // grid + tick labels
      var gd = '';
      scale.ticks.forEach(function (v) {
        if (v !== scale.min) gd += 'M' + f(XV(v)) + ' ' + f(plotTop) + 'V' + f(plotBottom);
        body += text(XV(v), plotBottom + 1.2 + tcap, fmtTick(v), { size: tfs, anchor: 'middle', fill: MUTED });
      });
      body += el('path', { d: gd, stroke: GRID, 'stroke-width': 0.25 });
      // bars
      var ns = Math.max(1, series.length);
      var groupH = band * (ns === 1 ? 0.62 : 0.78);
      var gapB = ns > 1 ? Math.min(0.6, groupH * 0.06) : 0;
      var barH = (groupH - gapB * (ns - 1)) / ns;
      var x0v = XV(Math.max(0, scale.min));
      series.forEach(function (s, si) {
        if (!s.values || blank) return;
        s.values.forEach(function (v, j) {
          var by = plotTop + j * band + (band - groupH) / 2 + si * (barH + gapB);
          var bw = XV(v) - x0v;
          if (bw > 0.01) body += el('path', { d: barPath(x0v, by, bw, barH, 0.7, 'right'), fill: fl.fills[si] });
          if (showValues) body += text(XV(v) + 1, by + barH / 2 + tcap / 2, fmtNum(v, decimalsOf(v) > 2 ? 2 : decimalsOf(v), sep), { size: 3, fill: ink });
        });
      });
      // category labels
      catLines.forEach(function (ls, j) {
        var cy = plotTop + (j + 0.5) * band;
        body += textLines(ls, plotLeft - 2, cy - blockHeight(ls.length, cfs) / 2, cfs, { anchor: 'end', fill: ink });
      });
      // axes
      body += el('path', {
        d: 'M' + f(x0v) + ' ' + f(plotTop) + 'V' + f(plotBottom) + 'M' + f(plotLeft) + ' ' + f(plotBottom) + 'H' + f(plotRight),
        stroke: AXIS, 'stroke-width': 0.35, fill: 'none'
      });
      if (xLabel) body += text((plotLeft + plotRight) / 2, H - pad - axisTitleFs * 0.25, xLabel, { size: axisTitleFs, anchor: 'middle', fill: ink, weight: 600 });
      if (yLabel) {
        var yx = pad + axisTitleFs * CAP;
        var yy = (plotTop + plotBottom) / 2;
        body += text(yx, yy, yLabel, { size: axisTitleFs, anchor: 'middle', fill: ink, weight: 600, transform: 'rotate(-90 ' + f(yx) + ' ' + f(yy) + ')' });
      }
      return doc(W, H, (fl.defs ? '<defs>' + fl.defs + '</defs>' : '') + body, font);
    }

    // column and line: categories along the bottom, values on the left
    var plotTop2 = y + tcap / 2 + 0.6;
    scale = niceScale(lo, hi, Math.max(2, Math.min(10, Math.round((H * 0.6) / 12))));
    var yTitleW2 = yLabel ? axisTitleFs + 2 : 0;
    var plotLeft2 = pad + yTitleW2 + maxTickW() + 1.8;
    var plotRight2 = W - pad - 0.5;
    var plotW2 = plotRight2 - plotLeft2;
    var band2 = plotW2 / n;
    // Category labels: wrapped at the band width without breaking words. A label may be wider
    // than its band when the neighbours leave room; otherwise a smaller font, then rotated labels.
    function catLines(fs, band) {
      return labels.map(function (l) {
        var lw = 0;
        l.split(/\s+/).forEach(function (w) {
          (w.match(/[^-]+-*|-+/g) || [w]).forEach(function (p) { lw = Math.max(lw, textWidth(p, fs)); });
        });
        return wrapText(l, Math.max(band - 1.2, lw), fs, false);
      });
    }
    function catFit(ls, fs, band, left) {
      var ws = ls.map(function (x) { return maxWidth(x, fs); });
      for (var i = 0; i < ws.length; i++) {
        var cx = left + (i + 0.5) * band;
        if (ls[i].length > 3) return false;
        if (i === 0 && cx - ws[i] / 2 < pad) return false;
        if (i === ws.length - 1 && cx + ws[i] / 2 > W - pad) return false;
        if (i > 0 && (ws[i - 1] + ws[i]) / 2 + 1.2 > band) return false;
      }
      return true;
    }
    function layoutCats(band, left) {
      var l1 = catLines(cfs, band);
      if (catFit(l1, cfs, band, left)) return { fs: cfs, lines: l1, rotated: false };
      var l2 = catLines(3, band);
      if (catFit(l2, 3, band, left)) return { fs: 3, lines: l2, rotated: false };
      return { fs: 3.1, rotated: true, lines: labels.map(function (l) { return wrapText(l, 32, 3.1, false, 1); }) };
    }
    var cat = layoutCats(band2, plotLeft2);
    var catH;
    if (cat.rotated) {
      var rotW = 0;
      cat.lines.forEach(function (ls) { rotW = Math.max(rotW, textWidth(ls[0], cat.fs)); });
      catH = rotW * Math.SQRT1_2 + cat.fs + 1.5;
    } else {
      var maxLines = 1;
      cat.lines.forEach(function (ls) { maxLines = Math.max(maxLines, ls.length); });
      catH = 1.6 + blockHeight(maxLines, cat.fs) + cat.fs * 0.25;
    }
    var plotBottom2 = H - pad - catH - (xLabel ? 1.8 + axisTitleFs * CAP + axisTitleFs * 0.25 : 0);
    var plotH2 = plotBottom2 - plotTop2;
    if (plotH2 < 15) throw fail(fn, 'heightMm is too small for the title, legend and labels (plot height ' + f(plotH2) + ' mm).');
    scale = niceScale(lo, hi, Math.max(2, Math.min(10, Math.round(plotH2 / 11))));
    plotLeft2 = pad + yTitleW2 + maxTickW() + 1.8;
    if (cat.rotated) {
      // rotated labels hang down to the left: keep the first ones inside the graphic
      for (var it2 = 0; it2 < 2; it2++) {
        var bnd = (plotRight2 - plotLeft2) / n;
        var extra = 0;
        cat.lines.forEach(function (ls, i) {
          extra = Math.max(extra, pad + textWidth(ls[0], cat.fs) * Math.SQRT1_2 - 0.6 - (plotLeft2 + (i + 0.5) * bnd));
        });
        plotLeft2 += extra;
      }
    }
    plotW2 = plotRight2 - plotLeft2;
    band2 = plotW2 / n;
    if (!cat.rotated) cat.lines = catLines(cat.fs, band2);
    var YV = function (v) { return plotBottom2 - (v - scale.min) / (scale.max - scale.min) * plotH2; };
    var gd2 = '';
    scale.ticks.forEach(function (v) {
      if (v !== scale.min && v !== 0) gd2 += 'M' + f(plotLeft2) + ' ' + f(YV(v)) + 'H' + f(plotRight2);
      body += text(plotLeft2 - 1.8, YV(v) + tcap / 2, fmtTick(v), { size: tfs, anchor: 'end', fill: MUTED });
    });
    body += el('path', { d: gd2, stroke: GRID, 'stroke-width': 0.25 });
    var zeroY = YV(scale.min <= 0 && scale.max >= 0 ? 0 : scale.min);

    if (type === 'column' && !blank) {
      var ns2 = Math.max(1, series.length);
      var groupW = band2 * (ns2 === 1 ? 0.58 : 0.8);
      var gapC = ns2 > 1 ? Math.min(0.6, groupW * 0.06) : 0;
      var barW = (groupW - gapC * (ns2 - 1)) / ns2;
      series.forEach(function (s, si) {
        s.values.forEach(function (v, j) {
          var bx = plotLeft2 + j * band2 + (band2 - groupW) / 2 + si * (barW + gapC);
          var bh = zeroY - YV(v);
          if (bh > 0.01) body += el('path', { d: barPath(bx, YV(v), barW, bh, 0.7, 'up'), fill: fl.fills[si] });
          if (showValues) {
            body += text(bx + barW / 2, YV(v) - 1, fmtNum(v, decimalsOf(v) > 2 ? 2 : decimalsOf(v), sep), { size: 3, anchor: 'middle', fill: ink });
          }
        });
      });
    }
    if (type === 'line' && !blank) {
      series.forEach(function (s, si) {
        var pts = s.values.map(function (v, j) { return [plotLeft2 + (j + 0.5) * band2, YV(v)]; });
        body += el('path', {
          d: 'M' + pts.map(function (p) { return f(p[0]) + ' ' + f(p[1]); }).join('L'),
          fill: 'none', stroke: colors[si], 'stroke-width': 0.6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
          'stroke-dasharray': LINE_DASH[si % 6]
        });
      });
      series.forEach(function (s, si) {
        s.values.forEach(function (v, j) {
          var px0 = plotLeft2 + (j + 0.5) * band2;
          body += marker(si % 6, px0, YV(v), 2.1, colors[si]);
          if (showValues) body += text(px0, YV(v) - 2, fmtNum(v, decimalsOf(v) > 2 ? 2 : decimalsOf(v), sep), { size: 3, anchor: 'middle', fill: ink, halo: WHITE, haloWidth: 0.7 });
        });
      });
    }
    // axes and category ticks
    var ad = 'M' + f(plotLeft2) + ' ' + f(plotTop2 - 0.6) + 'V' + f(plotBottom2) + 'M' + f(plotLeft2) + ' ' + f(zeroY) + 'H' + f(plotRight2);
    if (zeroY !== plotBottom2) ad += 'M' + f(plotLeft2) + ' ' + f(plotBottom2) + 'H' + f(plotRight2);
    for (var j = 0; j <= n; j++) {
      if (type === 'line') {
        if (j < n) ad += 'M' + f(plotLeft2 + (j + 0.5) * band2) + ' ' + f(plotBottom2) + 'v1';
      } else if (j > 0) ad += 'M' + f(plotLeft2 + j * band2) + ' ' + f(plotBottom2) + 'v1';
    }
    scale.ticks.forEach(function (v) { ad += 'M' + f(plotLeft2 - 0.9) + ' ' + f(YV(v)) + 'H' + f(plotLeft2); });
    body += el('path', { d: ad, stroke: AXIS, 'stroke-width': 0.35, fill: 'none' });
    cat.lines.forEach(function (ls, j2) {
      var cx = plotLeft2 + (j2 + 0.5) * band2;
      if (cat.rotated) {
        var ry = plotBottom2 + 2 + cat.fs * CAP / 2;
        body += text(cx + 0.6, ry, ls[0], { size: cat.fs, anchor: 'end', fill: ink, transform: 'rotate(-45 ' + f(cx + 0.6) + ' ' + f(ry) + ')' });
      } else {
        body += textLines(ls, cx, plotBottom2 + 1.6, cat.fs, { anchor: 'middle', fill: ink });
      }
    });
    if (xLabel) body += text((plotLeft2 + plotRight2) / 2, H - pad - axisTitleFs * 0.25, xLabel, { size: axisTitleFs, anchor: 'middle', fill: ink, weight: 600 });
    if (yLabel) {
      var yx2 = pad + axisTitleFs * CAP;
      var yy2 = (plotTop2 + plotBottom2) / 2;
      body += text(yx2, yy2, yLabel, { size: axisTitleFs, anchor: 'middle', fill: ink, weight: 600, transform: 'rotate(-90 ' + f(yx2) + ' ' + f(yy2) + ')' });
    }
    return doc(W, H, (fl.defs ? '<defs>' + fl.defs + '</defs>' : '') + body, font);

    function pieChart() {
      var out = '';
      var vals = !blank ? series[0].values : null;
      var sum = vals ? vals.reduce(function (a, v) { return a + v; }, 0) : 0;
      // percentages (largest remainder, so they add up to 100)
      var pct = [];
      if (vals) {
        var raw = vals.map(function (v) { return v / sum * 100; });
        pct = raw.map(Math.floor);
        var rest = 100 - pct.reduce(function (a, v) { return a + v; }, 0);
        raw.map(function (v, i) { return { i: i, r: v - Math.floor(v) }; })
          .sort(function (a, b) { return b.r - a.r || a.i - b.i; })
          .slice(0, rest).forEach(function (e) { pct[e.i] += 1; });
      }
      // legend on the right
      var lgW = 0;
      var lg = labels.map(function (l) {
        var ls = wrapText(l, Math.min(W * 0.36, 50), lfs, false, 2);
        lgW = Math.max(lgW, maxWidth(ls, lfs));
        return ls;
      });
      lgW += 6;
      var availH = H - pad - y;
      var smallSlices = vals ? pct.some(function (p, i) { return vals[i] > 0 && vals[i] / sum * 360 < 26; }) : false;
      var ring = smallSlices ? 7 : 1;
      var D = Math.min(availH - 2 * ring, W - 2 * pad - lgW - 8 - 2 * ring);
      if (D < 20) throw fail(fn, 'not enough space for the pie; increase widthMm/heightMm or shorten the labels.');
      var r = D / 2;
      var groupW = D + 2 * ring + 8 + lgW;
      var left = (W - groupW) / 2;
      var cx = left + ring + r;
      var cy = y + availH / 2;
      if (blank) {
        out += el('circle', { cx: cx, cy: cy, r: r, fill: 'none', stroke: AXIS, 'stroke-width': 0.4 });
        var td = '';
        for (var k = 0; k < 100; k += 5) {
          var a = -Math.PI / 2 + k / 100 * 2 * Math.PI;
          var len = k % 25 === 0 ? 3 : k % 10 === 0 ? 2 : 1.2;
          td += 'M' + f(cx + r * Math.cos(a)) + ' ' + f(cy + r * Math.sin(a)) + 'L' + f(cx + (r - len) * Math.cos(a)) + ' ' + f(cy + (r - len) * Math.sin(a));
        }
        out += el('path', { d: td, stroke: AXIS, 'stroke-width': 0.3 });
        out += el('circle', { cx: cx, cy: cy, r: 0.6, fill: AXIS });
      } else {
        var acc = -Math.PI / 2;
        var nonZero = vals.filter(function (v) { return v > 0; }).length;
        var labelsSvg = '';
        vals.forEach(function (v, i) {
          if (v <= 0) return;
          var ang = v / sum * 2 * Math.PI;
          var a0 = acc;
          var a1 = acc + ang;
          acc = a1;
          if (nonZero === 1) out += el('circle', { cx: cx, cy: cy, r: r, fill: fl.fills[i], stroke: WHITE, 'stroke-width': 0.5 });
          else {
            out += el('path', {
              d: 'M' + f(cx) + ' ' + f(cy) + 'L' + f(cx + r * Math.cos(a0)) + ' ' + f(cy + r * Math.sin(a0)) +
                'A' + f(r) + ' ' + f(r) + ' 0 ' + (ang > Math.PI ? 1 : 0) + ' 1 ' + f(cx + r * Math.cos(a1)) + ' ' + f(cy + r * Math.sin(a1)) + 'Z',
              fill: fl.fills[i], stroke: WHITE, 'stroke-width': 0.5, 'stroke-linejoin': 'round'
            });
          }
          var mid = (a0 + a1) / 2;
          var ptxt = pct[i] === 0 ? '<1 %' : pct[i] + ' %';
          var tw = textWidth(ptxt, 3.3, true);
          var inside = ang * 180 / Math.PI >= 26 && r * 0.62 * ang > tw * 0.8;
          if (inside) {
            var lx0 = cx + r * 0.63 * Math.cos(mid);
            var ly0 = cy + r * 0.63 * Math.sin(mid);
            var chipH = 3.3 * CAP + 1.8;
            labelsSvg += el('rect', {
              x: lx0 - tw / 2 - 1, y: ly0 - chipH / 2, width: tw + 2, height: chipH, rx: chipH / 2,
              fill: WHITE, 'fill-opacity': 0.92
            });
            labelsSvg += text(lx0, ly0 + 3.3 * CAP / 2, ptxt, { size: 3.3, weight: 700, anchor: 'middle', fill: '#111827' });
          } else {
            var ox = cx + (r + 1.6) * Math.cos(mid);
            var oy = cy + (r + 1.6) * Math.sin(mid);
            var anchor = Math.cos(mid) > 0.3 ? 'start' : Math.cos(mid) < -0.3 ? 'end' : 'middle';
            var dy = Math.sin(mid) > 0.3 ? 3.3 * CAP + 0.2 : Math.sin(mid) < -0.3 ? -0.3 : 3.3 * CAP / 2;
            labelsSvg += text(ox, oy + dy, ptxt, { size: 3.3, weight: 700, anchor: anchor, fill: ink });
          }
        });
        out += labelsSvg;
      }
      // legend
      var lx = left + 2 * ring + D + 8;
      var lh = 0;
      lg.forEach(function (ls) { lh += blockHeight(ls.length, lfs) + 2.4; });
      lh -= 2.4;
      var ly = cy - lh / 2;
      lg.forEach(function (ls, i) {
        out += el('rect', {
          x: lx, y: ly + lcap / 2 - 1.7, width: 4.2, height: 3.4, rx: 0.5,
          fill: blank ? WHITE : fl.fills[i], stroke: blank ? MUTED : null, 'stroke-width': blank ? 0.25 : null
        });
        out += textLines(ls, lx + 5.8, ly, lfs, { fill: ink });
        ly += blockHeight(ls.length, lfs) + 2.4;
      });
      return out;
    }
  }

  // ---------------------------------------------------------------------------
  // Mind map
  // ---------------------------------------------------------------------------

  function cubic(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
    ];
  }

  /** Filled, tapering bezier ribbon from width w0 to w1. */
  function taperedCurve(p0, p1, p2, p3, w0, w1) {
    var N = 24;
    var left = [];
    var right = [];
    for (var i = 0; i <= N; i++) {
      var t = i / N;
      var p = cubic(p0, p1, p2, p3, t);
      var q = cubic(p0, p1, p2, p3, Math.min(1, t + 0.01));
      var q0 = cubic(p0, p1, p2, p3, Math.max(0, t - 0.01));
      var dx = q[0] - q0[0];
      var dy = q[1] - q0[1];
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len;
      var ny = dx / len;
      var w = (w0 + (w1 - w0) * t) / 2;
      left.push(f(p[0] + nx * w) + ' ' + f(p[1] + ny * w));
      right.push(f(p[0] - nx * w) + ' ' + f(p[1] - ny * w));
    }
    return 'M' + left.join('L') + 'L' + right.reverse().join('L') + 'Z';
  }

  function mindmap(opts) {
    var fn = 'mindmap';
    var o = optsOf(opts, fn);
    var W = num(o.widthMm, 160, 80, 190, fn, 'widthMm');
    var Hmin = num(o.heightMm, 100, 40, 260, fn, 'heightMm');
    var blank = !!o.blank;
    var font = fontOf(o.font);
    var center = textOf(o.center, fn, 'center', 80, true);
    if (!Array.isArray(o.branches) || o.branches.length < 2 || o.branches.length > 8) {
      throw fail(fn, '"branches" needs 2–8 entries like { text, children: [...] } (got ' +
        (Array.isArray(o.branches) ? o.branches.length : show(o.branches)) + ').');
    }
    var branches = o.branches.map(function (b, i) {
      if (typeof b === 'string') b = { text: b };
      if (!b || typeof b !== 'object' || Array.isArray(b)) throw fail(fn, 'branches[' + i + '] must be { text, children: [...] }.');
      var t = textOf(b.text, fn, 'branches[' + i + '].text', 60);
      if (!blank && !t) throw fail(fn, 'branches[' + i + '].text is empty (use blank: true for empty bubbles).');
      var ch = b.children === undefined || b.children === null ? [] : b.children;
      if (typeof ch === 'number' && Math.floor(ch) === ch && ch >= 0 && ch <= 6) {
        var arr = [];
        for (var k = 0; k < ch; k++) arr.push('');
        ch = arr;
      }
      if (!Array.isArray(ch)) throw fail(fn, 'branches[' + i + '].children must be an array of strings.');
      if (ch.length > 6) throw fail(fn, 'branches[' + i + '] has ' + ch.length + ' children (max 6).');
      ch = ch.map(function (c, j) {
        var s = textOf(c, fn, 'branches[' + i + '].children[' + j + ']', 80);
        if (!blank && !s) throw fail(fn, 'branches[' + i + '].children[' + j + '] is empty.');
        return s;
      });
      return { text: t, children: ch };
    });
    var pal = paletteOf(o.colors);
    var pad = 2;

    var nRight = Math.ceil(branches.length / 2);
    var sides = [
      { dir: 1, items: branches.slice(0, nRight).map(function (b, i) { return { b: b, idx: i }; }) },
      { dir: -1, items: branches.slice(nRight).map(function (b, i) { return { b: b, idx: nRight + i }; }).reverse() }
    ];
    var half = W / 2 - pad;
    var cfs = 4.6;
    // Layout levels: from roomy to compact (all text stays >= 3 mm). Children sit beside their
    // branch; with "stack" a branch whose children do not fit beside it gets them below instead.
    var L1 = { cMax: 34, g1: 8, g2: 6, bfs: 3.8, bMax: 32, kfs: 3.3 };
    var L2 = { cMax: 30, g1: 6.5, g2: 5, bfs: 3.5, bMax: 30, kfs: 3.2 };
    var L3 = { cMax: 26, g1: 5, g2: 4, bfs: 3.2, bMax: 26, kfs: 3.0 };
    var LEVELS = [L1, L2, extend(L1, { stack: true }), extend(L3, { stack: true }), extend(L3, { stack: true, breakWords: true })];
    var INDENT = 4.5;
    var lv;
    var cLines;
    var rx;
    var ry;
    var ch0;

    function measureBranch(b) {
      if (blank) return { lines: [], w: 30, h: 11 };
      var wrapW = Math.max(lv.bMax, longestWord([b.text], lv.bfs, true));
      if (lv.breakWords) wrapW = Math.min(wrapW, Math.max(lv.bMax, half - rx - lv.g1 - 5.4 - (b.children.length ? 16 + lv.g2 : 0)));
      var ls = wrapText(b.text, wrapW, lv.bfs, true, 3);
      return { lines: ls, w: Math.max(18, maxWidth(ls, lv.bfs, true) + 5.4), h: blockHeight(ls.length, lv.bfs) + lv.bfs * 0.25 + 4.2 };
    }
    function measureChild(t, maxW) {
      if (blank) return { lines: [], w: Math.min(26, maxW), h: 8 };
      var ls = wrapText(t, maxW - 4.4, lv.kfs, false, 3);
      return { lines: ls, w: Math.max(14, maxWidth(ls, lv.kfs) + 4.4), h: blockHeight(ls.length, lv.kfs) + lv.kfs * 0.25 + 3.4 };
    }
    function longestWord(list, size, bold) {
      var m = 0;
      list.forEach(function (t) {
        t.split(/\s+/).forEach(function (w) {
          (w.match(/[^-]+-*|-+/g) || [w]).forEach(function (p) { m = Math.max(m, textWidth(p, size, bold)); });
        });
      });
      return m;
    }
    var fitted = false;
    var worst = 0;
    for (var li = 0; li < LEVELS.length && !fitted; li++) {
      lv = LEVELS[li];
      cLines = wrapText(center, lv.cMax, cfs, true, 3);
      ch0 = blockHeight(cLines.length, cfs);
      rx = Math.max(15, maxWidth(cLines, cfs, true) / 2 * Math.SQRT2 + 2);
      ry = Math.max(8, (ch0 + cfs * 0.25) / 2 * Math.SQRT2 + 2);
      fitted = true;
      worst = Infinity;
      sides.forEach(function (side) {
        side.items.forEach(function (it) {
          it.m = measureBranch(it.b);
          it.stack = false;
          var column = half - rx - lv.g1;
          // children start right after their own branch box
          it.childW = column - it.m.w - lv.g2;
          if (column - it.m.w < 0) { fitted = false; worst = Math.min(worst, column - it.m.w); }
          if (!it.b.children.length) return;
          var need = blank ? 20 : Math.min(30, Math.max(16, longestWord(it.b.children, lv.kfs) + 4.4));
          if (lv.breakWords) need = 16;
          if (it.childW >= need) return;
          if (lv.stack && column - INDENT >= need) {
            it.stack = true;
            it.childW = column - INDENT;
            return;
          }
          worst = Math.min(worst, it.childW - need);
          fitted = false;
        });
      });
    }
    if (!fitted) {
      throw fail(fn, 'not enough width for the texts (' + f(-worst) + ' mm missing); increase widthMm (max 190), ' +
        'shorten the branch texts or use fewer children.');
    }
    var bfs = lv.bfs;
    var kfs = lv.kfs;
    sides.forEach(function (side) {
      side.g1 = lv.g1;
      side.g2 = lv.g2;
      side.items.forEach(function (it) {
        it.kids = it.b.children.map(function (t) { return measureChild(t, Math.min(it.childW, 44)); });
        var kh = 0;
        it.kids.forEach(function (k, j) { kh += k.h + (j ? 2.2 : 0); });
        it.gh = it.stack ? it.m.h + 2.4 + kh : Math.max(it.m.h, kh);
        it.kh = kh;
      });
      side.h = 0;
      side.items.forEach(function (it, j) { side.h += it.gh + (j ? 4 : 0); });
    });
    var H = Math.max(Hmin, sides[0].h + 2 * pad, sides[1].h + 2 * pad, 2 * ry + 2 * pad);
    if (H > 260) throw fail(fn, 'too much content (needs ' + f(H) + ' mm height); use fewer children or shorter texts.');
    var cx = W / 2;
    var cy = H / 2;

    var conn = '';
    var kidConn = '';
    var boxes = '';
    var texts = '';
    sides.forEach(function (side) {
      var yy = (H - side.h) / 2;
      var d = side.dir;
      var bx = cx + d * (rx + side.g1);          // inner edge of the branch boxes
      side.items.forEach(function (it) {
        var kx = bx + d * (it.m.w + side.g2);    // inner edge of this branch's children
        var col = seriesColor(pal, it.idx);
        var by = it.stack ? yy + it.m.h / 2 : yy + it.gh / 2;
        if (it.stack) kx = bx + d * INDENT;
        var m = it.m;
        var bOuter = bx + d * m.w;
        // main connector (from the centre, hidden under the bubble)
        var dx = bx - cx;
        conn += el('path', {
          d: taperedCurve([cx, cy], [cx + dx * 0.55, cy], [cx + dx * 0.45, by], [bx + d * 0.6, by], 2.2, 0.8),
          fill: col
        });
        boxes += el('rect', {
          x: d > 0 ? bx : bx - m.w, y: by - m.h / 2, width: m.w, height: m.h, rx: 2.2,
          fill: tint(col, 0.86), stroke: col, 'stroke-width': 0.5
        });
        if (m.lines.length) {
          texts += textLines(m.lines, bx + d * m.w / 2, by - blockHeight(m.lines.length, bfs) / 2, bfs, { anchor: 'middle', weight: 700, fill: INK });
        }
        var ky = it.stack ? by + m.h / 2 + 2.4 : by - it.kh / 2;
        it.kids.forEach(function (k) {
          var kcy = ky + k.h / 2;
          if (it.stack) {
            // elbow from the bottom of the branch box down to the child
            var rx0 = bx + d * 2.2;
            kidConn += el('path', {
              d: 'M' + f(rx0) + ' ' + f(by + m.h / 2) + 'V' + f(kcy - 1.2) + 'Q' + f(rx0) + ' ' + f(kcy) + ' ' + f(rx0 + d * 1.2) + ' ' + f(kcy) + 'H' + f(kx),
              fill: 'none', stroke: col, 'stroke-width': 0.4
            });
          } else {
            var kdx = kx - bOuter;
            kidConn += el('path', {
              d: 'M' + f(bOuter) + ' ' + f(by) + 'C' + f(bOuter + kdx * 0.5) + ' ' + f(by) + ' ' + f(bOuter + kdx * 0.5) + ' ' + f(kcy) + ' ' + f(kx) + ' ' + f(kcy),
              fill: 'none', stroke: col, 'stroke-width': 0.4
            });
          }
          boxes += el('rect', {
            x: d > 0 ? kx : kx - k.w, y: ky, width: k.w, height: k.h, rx: 1.6,
            fill: WHITE, stroke: col, 'stroke-width': 0.35
          });
          if (k.lines.length) {
            texts += textLines(k.lines, kx + d * k.w / 2, kcy - blockHeight(k.lines.length, kfs) / 2, kfs, { anchor: 'middle', fill: INK });
          }
          ky += k.h + 2.2;
        });
        yy += it.gh + 4;
      });
    });
    var centerSvg = el('ellipse', { cx: cx, cy: cy, rx: rx, ry: ry, fill: '#f3f4f6', stroke: INK, 'stroke-width': 0.6 }) +
      textLines(cLines, cx, cy - ch0 / 2, cfs, { anchor: 'middle', weight: 700, fill: INK });
    return doc(W, H, conn + kidConn + centerSvg + boxes + texts, font);
  }

  // ---------------------------------------------------------------------------
  // Crossword and word search
  // ---------------------------------------------------------------------------

  function gridOf(g, rows, cols, fn, name) {
    if (!Array.isArray(g) || g.length !== rows) throw fail(fn, name + ' must have ' + rows + ' rows (got ' + (Array.isArray(g) ? g.length : show(g)) + ').');
    g.forEach(function (row, r) {
      if (!Array.isArray(row) || row.length !== cols) throw fail(fn, name + '[' + r + '] must have ' + cols + ' columns.');
    });
    return g;
  }

  function crosswordGrid(layout, opts) {
    var fn = 'crosswordGrid';
    var o = optsOf(opts, fn);
    if (!layout || typeof layout !== 'object') throw fail(fn, 'layout must be { width, height, cells, numbers }.');
    var cols = int(layout.width, undefined, 1, 40, fn, 'layout.width');
    var rows = int(layout.height, undefined, 1, 40, fn, 'layout.height');
    if (cols === undefined || rows === undefined) throw fail(fn, 'layout.width and layout.height are required.');
    var cells = gridOf(layout.cells, rows, cols, fn, 'layout.cells');
    var numbers = layout.numbers === undefined ? null : gridOf(layout.numbers, rows, cols, fn, 'layout.numbers');
    var cell = num(o.cellMm, 7, 4, 15, fn, 'cellMm');
    var showAnswers = !!o.showAnswers;
    var c = colorOf(o.color, INK);
    var acc = colorOf(o.accentColor, '#2563eb');
    var font = fontOf(o.font);
    var sw = 0.35;
    var pad = sw / 2 + 0.1;
    var W = cols * cell + 2 * pad;
    var H = rows * cell + 2 * pad;
    if (W > 190) throw fail(fn, 'too wide (' + f(W) + ' mm, max 190); reduce cellMm.');
    var d = '';
    var nums = '';
    var letters = '';
    var nfs = Math.max(3, cell * 0.3);
    var lfs = cell * 0.56;
    var count = 0;
    for (var r = 0; r < rows; r++) {
      for (var k = 0; k < cols; k++) {
        var v = cells[r][k];
        if (v === null || v === undefined) v = '';
        if (typeof v !== 'string') throw fail(fn, 'layout.cells[' + r + '][' + k + '] must be a letter or "".');
        v = v.trim();
        if (!v) continue;
        count++;
        var x = pad + k * cell;
        var y = pad + r * cell;
        d += 'M' + f(x) + ' ' + f(y) + 'h' + f(cell) + 'v' + f(cell) + 'h' + f(-cell) + 'Z';
        var nm = numbers ? numbers[r][k] : 0;
        if (nm) {
          if (typeof nm !== 'number' || Math.floor(nm) !== nm || nm < 0) throw fail(fn, 'layout.numbers[' + r + '][' + k + '] must be a whole number.');
          nums += text(x + 0.5, y + 0.45 + nfs * CAP, String(nm), { size: nfs, fill: c });
        }
        if (showAnswers) {
          letters += text(x + cell / 2, y + cell / 2 + lfs * CAP / 2 + cell * 0.06, v.toUpperCase(), { size: lfs, anchor: 'middle', weight: 600, fill: acc });
        }
      }
    }
    if (!count) throw fail(fn, 'layout.cells contains no letters.');
    var body = el('path', { d: d, fill: WHITE, stroke: c, 'stroke-width': sw, 'stroke-linejoin': 'miter' }) + nums + letters;
    return doc(W, H, body, font);
  }

  function wordSearchGrid(result, opts) {
    var fn = 'wordSearchGrid';
    var o = optsOf(opts, fn);
    if (!result || typeof result !== 'object') throw fail(fn, 'result must be { size, grid, placements }.');
    var size = int(result.size, undefined, 2, 30, fn, 'result.size');
    if (size === undefined) throw fail(fn, 'result.size is required.');
    var grid = gridOf(result.grid, size, size, fn, 'result.grid');
    var placements = result.placements === undefined ? [] : result.placements;
    if (!Array.isArray(placements)) throw fail(fn, 'result.placements must be an array.');
    var cell = num(o.cellMm, 7, 4, 15, fn, 'cellMm');
    var showAnswers = !!o.showAnswers;
    var borders = o.borders === undefined ? true : !!o.borders;
    var c = colorOf(o.color, INK);
    var acc = colorOf(o.accentColor, '#2563eb');
    var font = fontOf(o.font);
    var pad = 0.4;
    var S = size * cell;
    var W = S + 2 * pad;
    if (W > 190) throw fail(fn, 'too wide (' + f(W) + ' mm, max 190); reduce cellMm.');
    var body = '';
    if (borders) {
      var d = '';
      for (var i = 1; i < size; i++) {
        d += 'M' + f(pad + i * cell) + ' ' + f(pad) + 'V' + f(pad + S) + 'M' + f(pad) + ' ' + f(pad + i * cell) + 'H' + f(pad + S);
      }
      body += el('path', { d: d, stroke: GRID, 'stroke-width': 0.25 });
      body += el('rect', { x: pad, y: pad, width: S, height: S, rx: 0.8, fill: 'none', stroke: '#9ca3af', 'stroke-width': 0.35 });
    }
    if (showAnswers) {
      var caps = '';
      placements.forEach(function (p, i) {
        if (!p || typeof p !== 'object') throw fail(fn, 'placements[' + i + '] must be { normalized, row, col, dr, dc }.');
        var word = typeof p.normalized === 'string' ? p.normalized : typeof p.word === 'string' ? p.word : '';
        var len = Array.from(word).length;
        if (!len) throw fail(fn, 'placements[' + i + '].normalized is empty.');
        var r0 = int(p.row, undefined, 0, size - 1, fn, 'placements[' + i + '].row');
        var c0 = int(p.col, undefined, 0, size - 1, fn, 'placements[' + i + '].col');
        var dr = int(p.dr, 0, -1, 1, fn, 'placements[' + i + '].dr');
        var dc = int(p.dc, 0, -1, 1, fn, 'placements[' + i + '].dc');
        if (r0 === undefined || c0 === undefined) throw fail(fn, 'placements[' + i + '] needs row and col.');
        if (!dr && !dc) throw fail(fn, 'placements[' + i + ']: dr and dc must not both be 0.');
        var r1 = r0 + dr * (len - 1);
        var c1 = c0 + dc * (len - 1);
        if (r1 < 0 || r1 >= size || c1 < 0 || c1 >= size) throw fail(fn, 'placements[' + i + '] ("' + word + '") runs outside the grid.');
        var x0 = pad + (c0 + 0.5) * cell;
        var y0 = pad + (r0 + 0.5) * cell;
        var x1 = pad + (c1 + 0.5) * cell;
        var y1 = pad + (r1 + 0.5) * cell;
        var dist = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
        var th = cell * 0.74;
        var L = dist + th;
        var ang = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
        var mx = (x0 + x1) / 2;
        var my = (y0 + y1) / 2;
        caps += el('rect', {
          x: mx - L / 2, y: my - th / 2, width: L, height: th, rx: th / 2,
          fill: acc, 'fill-opacity': 0.13, stroke: acc, 'stroke-width': 0.4,
          transform: Math.abs(ang) > 0.01 ? 'rotate(' + f(ang) + ' ' + f(mx) + ' ' + f(my) + ')' : null
        });
      });
      body += caps;
    }
    var lfs = cell * 0.56;
    var letters = '';
    for (var r = 0; r < size; r++) {
      for (var k = 0; k < size; k++) {
        var v = grid[r][k];
        if (typeof v !== 'string' || !v.trim()) throw fail(fn, 'result.grid[' + r + '][' + k + '] must be a letter.');
        letters += text(pad + (k + 0.5) * cell, pad + (r + 0.5) * cell + lfs * CAP / 2, v.trim().toUpperCase(), { size: lfs, anchor: 'middle', fill: c });
      }
    }
    body += letters;
    return doc(W, W, body, font);
  }

  // ---------------------------------------------------------------------------
  // Cut line
  // ---------------------------------------------------------------------------

  function cutLine(opts) {
    var fn = 'cutLine';
    var o = optsOf(opts, fn);
    var W = num(o.widthMm, 160, 20, 190, fn, 'widthMm');
    var label = textOf(o.label, fn, 'label', 60);
    var c = colorOf(o.color, MUTED);
    var font = fontOf(o.font);
    var H = 6;
    var y = H / 2;
    var s = 5.5;
    var body = '<g transform="translate(0 ' + f(y - s / 2) + ') scale(' + f(s / 24) + ')" fill="none" stroke="' + c +
      '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + ICONS.cut + '</g>';
    var x = s + 1.2;
    var fs = 3;
    if (label) {
      var lw = Math.min(textWidth(label, fs), W - x - 8);
      var lines = wrapText(label, W - x - 8, fs, false, 1);
      body += text(x + 0.8, y + fs * CAP / 2, lines[0], { size: fs, fill: c });
      x += 0.8 + lw + 1.6;
    }
    var dash = 2;
    var gap = 1.4;
    var len = W - x - 0.3;
    var n = Math.max(1, Math.floor((len + gap) / (dash + gap)));
    var d = '';
    for (var i = 0; i < n; i++) d += 'M' + f(x + i * (dash + gap)) + ' ' + f(y) + 'h' + f(dash);
    body += el('path', { d: d, stroke: c, 'stroke-width': 0.35 });
    return doc(W, H, body, font);
  }

  // ---------------------------------------------------------------------------
  // QR code
  // ---------------------------------------------------------------------------

  function utf8Bytes(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        var c2 = s.charCodeAt(i + 1);
        if (c2 >= 0xdc00 && c2 <= 0xdfff) {
          c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
          i++;
        }
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  function defaultQrFactory() {
    if (root && typeof root.qrcode === 'function') return root.qrcode;
    if (typeof globalThis !== 'undefined' && typeof globalThis.qrcode === 'function') return globalThis.qrcode;
    if (typeof require === 'function') {
      try {
        return require('../vendor/qrcode-generator/qrcode.js');
      } catch (e) { /* not available */ }
    }
    return null;
  }

  function qrCode(textIn, opts) {
    var fn = 'qrCode';
    var o = optsOf(opts, fn);
    if (typeof textIn !== 'string' && typeof textIn !== 'number') throw fail(fn, 'text must be a string (e.g. a URL).');
    var t = String(textIn).trim();
    if (!t) throw fail(fn, 'text must not be empty.');
    var bytes = utf8Bytes(t);
    if (bytes.length > 800) throw fail(fn, 'text is too long (' + bytes.length + ' bytes, max 800); use a shorter URL.');
    var size = num(o.sizeMm, 25, 10, 120, fn, 'sizeMm');
    var label = textOf(o.label, fn, 'label', 120);
    var c = colorOf(o.color, '#000000');
    var font = fontOf(o.font);
    var factory = typeof o.qrcode === 'function' ? o.qrcode : defaultQrFactory();
    if (!factory) throw fail(fn, 'the QR code library (qrcode-generator, vendor/qrcode.js) is not loaded.');
    var qr = factory(0, 'M');
    // Encode as UTF-8 bytes without touching the library's global setting.
    var saved = factory.stringToBytes;
    factory.stringToBytes = function () { return bytes.slice(); };
    try {
      qr.addData(t, 'Byte');
      qr.make();
    } catch (e) {
      throw fail(fn, 'text cannot be encoded (' + (e && e.message ? e.message : e) + ').');
    } finally {
      factory.stringToBytes = saved;
    }
    var n = qr.getModuleCount();
    var quiet = 4;
    var total = n + 2 * quiet;
    var m = size / total;
    if (m < 0.3) {
      throw fail(fn, 'text too long for ' + size + ' mm (module ' + f(m) + ' mm < 0.3 mm, hard to scan); use sizeMm ≥ ' +
        Math.ceil(total * 0.3) + ' or a shorter text.');
    }
    var d = '';
    for (var r = 0; r < n; r++) {
      var k = 0;
      while (k < n) {
        if (!qr.isDark(r, k)) { k++; continue; }
        var start = k;
        while (k < n && qr.isDark(r, k)) k++;
        d += 'M' + (start + quiet) + ' ' + (r + quiet) + 'h' + (k - start) + 'v1h-' + (k - start) + 'z';
      }
    }
    var Wd = size;
    var H = size;
    var lines = [];
    var fs = 3;
    if (label) {
      lines = wrapText(label, Math.max(size - 1, 50), fs, false, 3);
      Wd = Math.max(size, maxWidth(lines, fs) + 1);
      H = size + 0.4 + blockHeight(lines.length, fs) + fs * 0.3 + 0.4;
    }
    var ox = (Wd - size) / 2;
    var body = '<g transform="translate(' + f(ox) + ' 0) scale(' + f(m) + ')">' +
      el('path', { d: d, fill: c, 'shape-rendering': 'crispEdges' }) + '</g>';
    if (lines.length) body += textLines(lines, Wd / 2, size + 0.4, fs, { anchor: 'middle', fill: INK });
    return doc(Wd, H, body, font);
  }

  // ---------------------------------------------------------------------------
  // SVG sanitizer (strict tokenizer, whitelist)
  // ---------------------------------------------------------------------------

  var SAFE_ELEMENTS = {
    svg: 1, g: 1, path: 1, rect: 1, circle: 1, ellipse: 1, line: 1, polyline: 1, polygon: 1, text: 1, tspan: 1,
    defs: 1, linearGradient: 1, radialGradient: 1, stop: 1, title: 1, desc: 1, marker: 1, use: 1, clipPath: 1,
    pattern: 1, symbol: 1
  };
  var TEXT_ELEMENTS = { text: 1, tspan: 1, title: 1, desc: 1 };
  var PRESENTATION = [
    'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray',
    'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'opacity', 'color',
    'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant', 'font-stretch', 'text-anchor',
    'dominant-baseline', 'alignment-baseline', 'baseline-shift', 'letter-spacing', 'word-spacing',
    'text-decoration', 'writing-mode', 'visibility', 'display', 'stop-color', 'stop-opacity', 'clip-rule',
    'clip-path', 'marker-start', 'marker-mid', 'marker-end', 'vector-effect', 'shape-rendering',
    'text-rendering', 'paint-order'
  ];
  var SAFE_ATTRS = {};
  ('x y x1 y1 x2 y2 cx cy r rx ry fx fy fr width height d points viewBox preserveAspectRatio transform dx dy ' +
    'rotate textLength lengthAdjust pathLength offset gradientUnits gradientTransform spreadMethod patternUnits ' +
    'patternContentUnits patternTransform markerWidth markerHeight markerUnits refX refY orient clipPathUnits ' +
    'id xml:space').split(' ').forEach(function (a) { SAFE_ATTRS[a] = 1; });
  PRESENTATION.forEach(function (a) { SAFE_ATTRS[a] = 1; });
  var STYLE_PROPS = {};
  PRESENTATION.forEach(function (a) { STYLE_PROPS[a] = 1; });

  var HTML_ENTITIES = {
    nbsp: 160, ndash: 8211, mdash: 8212, hellip: 8230, shy: 173, auml: 228, ouml: 246, uuml: 252, Auml: 196,
    Ouml: 214, Uuml: 220, szlig: 223, euro: 8364, copy: 169, reg: 174, deg: 176, times: 215, divide: 247,
    middot: 183, laquo: 171, raquo: 187, bdquo: 8222, ldquo: 8220, rdquo: 8221, lsquo: 8216, rsquo: 8217,
    sbquo: 8218, minus: 8722, plusmn: 177, frac12: 189, frac14: 188, frac34: 190, sup2: 178, sup3: 179,
    eacute: 233, egrave: 232, agrave: 224, ccedil: 231, larr: 8592, rarr: 8594, uarr: 8593, darr: 8595
  };

  function decodeEntities(s, warn) {
    return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]*);/g, function (all, e) {
      var code;
      if (e.charAt(0) === '#') code = e.charAt(1) === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      else if (e === 'amp') return '&';
      else if (e === 'lt') return '<';
      else if (e === 'gt') return '>';
      else if (e === 'quot') return '"';
      else if (e === 'apos') return "'";
      else if (HTML_ENTITIES.hasOwnProperty(e)) code = HTML_ENTITIES[e];
      else {
        warn('unknown entity &' + e + '; kept as text');
        return all;
      }
      if (!(code > 0 && code <= 0x10ffff)) return '';
      return String.fromCodePoint ? String.fromCodePoint(code) : String.fromCharCode(code);
    });
  }

  function parseXml(src, warn) {
    var i = 0;
    var n = src.length;
    var top = { name: '#root', attrs: [], children: [] };
    var stack = [top];
    var elements = 0;
    var NAME = /[A-Za-z_][\w.\-:]*/y;
    var ATTR = /\s+([A-Za-z_][\w.\-:]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;
    var END = /\s*(\/?)>/y;
    var CLOSE = /<\/([A-Za-z_][\w.\-:]*)\s*>/y;
    function err(msg) {
      throw new Error(msg + ' (at character ' + i + ')');
    }
    function addText(t, raw) {
      var cur = stack[stack.length - 1];
      if (stack.length === 1) {
        if (/\S/.test(t)) err('text outside the root element');
        return;
      }
      cur.children.push({ text: raw ? t : decodeEntities(t, warn) });
    }
    while (i < n) {
      var lt = src.indexOf('<', i);
      if (lt < 0) lt = n;
      if (lt > i) {
        addText(src.slice(i, lt));
        i = lt;
        if (i >= n) break;
      }
      if (src.substr(i, 4) === '<!--') {
        var e1 = src.indexOf('-->', i + 4);
        if (e1 < 0) err('unclosed comment');
        i = e1 + 3;
        continue;
      }
      if (src.substr(i, 9) === '<![CDATA[') {
        var e2 = src.indexOf(']]>', i + 9);
        if (e2 < 0) err('unclosed CDATA section');
        addText(src.slice(i + 9, e2), true);
        i = e2 + 3;
        continue;
      }
      if (src.substr(i, 2) === '<?') {
        var e3 = src.indexOf('?>', i + 2);
        if (e3 < 0) err('unclosed processing instruction');
        i = e3 + 2;
        continue;
      }
      if (src.substr(i, 2) === '<!') {
        var j = i + 2;
        var depth = 0;
        for (; j < n; j++) {
          var ch = src.charAt(j);
          if (ch === '[') depth++;
          else if (ch === ']') depth--;
          else if (ch === '>' && depth <= 0) break;
        }
        if (j >= n) err('unclosed declaration');
        i = j + 1;
        continue;
      }
      if (src.charAt(i + 1) === '/') {
        CLOSE.lastIndex = i;
        var cm = CLOSE.exec(src);
        if (!cm) err('malformed closing tag');
        var open = stack[stack.length - 1];
        if (stack.length === 1 || open.name !== cm[1]) err('unexpected </' + cm[1] + '>' + (stack.length > 1 ? ' (expected </' + open.name + '>)' : ''));
        stack.pop();
        i = CLOSE.lastIndex;
        continue;
      }
      NAME.lastIndex = i + 1;
      var nm = NAME.exec(src);
      if (!nm) err('malformed tag');
      var node = { name: nm[0], attrs: [], children: [] };
      i = NAME.lastIndex;
      for (;;) {
        ATTR.lastIndex = i;
        var am = ATTR.exec(src);
        if (!am) break;
        node.attrs.push([am[1], decodeEntities(am[2] !== undefined ? am[2] : am[3], warn)]);
        i = ATTR.lastIndex;
      }
      END.lastIndex = i;
      var em = END.exec(src);
      if (!em) err('malformed attributes in <' + node.name + '> (values must be quoted)');
      i = END.lastIndex;
      if (++elements > 20000) err('too many elements');
      if (stack.length === 1 && top.children.some(function (c) { return c.name; })) err('more than one root element');
      stack[stack.length - 1].children.push(node);
      if (!em[1]) {
        stack.push(node);
        if (stack.length > 200) err('nesting too deep');
      }
    }
    if (stack.length > 1) err('unclosed <' + stack[stack.length - 1].name + '>');
    var roots = top.children.filter(function (c) { return c.name; });
    if (!roots.length) throw new Error('no element found');
    return roots[0];
  }

  var BAD_VALUE = /javascript:|vbscript:|data:|expression\s*\(|@import|behavior\s*:|-moz-binding|[<>]/i;

  function safeValue(v) {
    if (BAD_VALUE.test(v)) return false;
    var urls = v.match(/url\s*\([^)]*\)/gi);
    if (urls) {
      for (var i = 0; i < urls.length; i++) {
        if (!/^url\s*\(\s*['"]?#[\w.\-:]+['"]?\s*\)$/i.test(urls[i])) return false;
      }
    }
    return true;
  }

  function parseDecls(s) {
    var out = [];
    String(s).replace(/\/\*[\s\S]*?\*\//g, '').split(';').forEach(function (d) {
      var k = d.indexOf(':');
      if (k < 0) return;
      var prop = d.slice(0, k).trim().toLowerCase();
      var val = d.slice(k + 1).trim().replace(/\s*!important$/i, '');
      if (prop && val) out.push([prop, val]);
    });
    return out;
  }

  /** Very small CSS parser: simple selectors (tag, .class, #id, tag.class, *) only. */
  function parseCss(css) {
    var rules = [];
    var s = css.replace(/\/\*[\s\S]*?\*\//g, '');
    var i = 0;
    var order = 0;
    while (i < s.length) {
      while (i < s.length && /\s/.test(s.charAt(i))) i++;
      if (s.charAt(i) === '@') {
        // block-less at-rule (@import …;) – skip it
        var semi = s.indexOf(';', i);
        var brace = s.indexOf('{', i);
        if (semi >= 0 && (brace < 0 || semi < brace)) {
          i = semi + 1;
          continue;
        }
      }
      var open = s.indexOf('{', i);
      if (open < 0) break;
      var sel = s.slice(i, open).trim();
      var depth = 1;
      var j = open + 1;
      while (j < s.length && depth > 0) {
        if (s.charAt(j) === '{') depth++;
        else if (s.charAt(j) === '}') depth--;
        j++;
      }
      var block = s.slice(open + 1, j - 1);
      i = j;
      if (sel.charAt(0) === '@') continue;
      var decls = parseDecls(block);
      sel.split(',').forEach(function (one) {
        var m = /^([A-Za-z][\w-]*|\*)?((?:\.[\w-]+)*)(#[\w-]+)?((?:\.[\w-]+)*)$/.exec(one.trim());
        if (!m || !one.trim()) return;
        var classes = (m[2] + m[4]).split('.').filter(Boolean);
        var tag = m[1] && m[1] !== '*' ? m[1] : null;
        var id = m[3] ? m[3].slice(1) : null;
        rules.push({
          tag: tag, id: id, classes: classes, decls: decls, order: order++,
          spec: (id ? 100 : 0) + classes.length * 10 + (tag ? 1 : 0)
        });
      });
    }
    return rules;
  }

  function lengthToMm(v) {
    if (v === undefined || v === null) return null;
    var m = /^\s*\+?((?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(mm|cm|in|px|pt|pc|q)?\s*$/i.exec(String(v));
    if (!m) return null;
    var n = parseFloat(m[1]);
    if (!(n > 0)) return null;
    var u = (m[2] || 'px').toLowerCase();
    var factor = { mm: 1, cm: 10, 'in': 25.4, px: MM_PER_PX, pt: 25.4 / 72, pc: 25.4 / 6, q: 0.25 }[u];
    return n * factor;
  }

  function parseViewBox(v) {
    if (!v) return null;
    var p = String(v).trim().split(/[\s,]+/).map(Number);
    if (p.length !== 4 || p.some(function (x) { return !isFinite(x); }) || !(p[2] > 0) || !(p[3] > 0)) return null;
    return p;
  }

  function byteLength(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      n += c < 0x80 ? 1 : c < 0x800 ? 2 : c >= 0xd800 && c <= 0xdfff ? 2 : 3;
    }
    return n;
  }

  function sanitizeSvg(svgText, opts) {
    var o = opts && typeof opts === 'object' ? opts : {};
    var maxBytes = typeof o.maxBytes === 'number' && o.maxBytes > 0 ? o.maxBytes : 200000;
    var maxW = typeof o.maxWidthMm === 'number' && o.maxWidthMm > 0 ? o.maxWidthMm : 180;
    var maxH = typeof o.maxHeightMm === 'number' && o.maxHeightMm > 0 ? o.maxHeightMm : 250;
    var errors = [];
    var removedCount = {};
    var removedOrder = [];
    function removed(what) {
      if (!removedCount[what]) { removedCount[what] = 0; removedOrder.push(what); }
      removedCount[what]++;
    }
    function bad(msg) {
      return { ok: false, svg: '', widthMm: 0, heightMm: 0, errors: [msg], removed: [] };
    }
    if (typeof svgText !== 'string' || !svgText.trim()) return bad('svg: empty input.');
    if (byteLength(svgText) > maxBytes) return bad('svg: too big (' + byteLength(svgText) + ' bytes, max ' + maxBytes + ').');
    var src = svgText.replace(/^﻿/, '').trim();
    // tolerate Markdown code fences around the SVG
    src = src.replace(/^```[\w-]*\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    var warnings = {};
    var rootNode;
    try {
      rootNode = parseXml(src, function (w) { warnings[w] = 1; });
    } catch (e) {
      return bad('svg: not well-formed XML – ' + e.message + '.');
    }
    var localName = function (nm) { return nm.indexOf('svg:') === 0 ? nm.slice(4) : nm; };
    if (localName(rootNode.name) !== 'svg') return bad('svg: the root element must be <svg> (got <' + rootNode.name + '>).');
    Object.keys(warnings).forEach(function (w) { errors.push(w); });

    // collect <style> rules
    var rules = [];
    (function collect(node) {
      if (!node.name) return;
      if (localName(node.name) === 'style') {
        var css = node.children.map(function (c) { return c.text || ''; }).join('');
        rules = rules.concat(parseCss(css));
        return;
      }
      node.children.forEach(collect);
    })(rootNode);

    function attrValue(node, name) {
      for (var i = 0; i < node.attrs.length; i++) if (node.attrs[i][0] === name) return node.attrs[i][1];
      return undefined;
    }

    function cleanStyle(node, tag) {
      var merged = {};
      var keys = [];
      var put = function (k, v) {
        if (!STYLE_PROPS[k]) { removed('style property ' + k); return; }
        if (!safeValue(v)) { removed('unsafe style value for ' + k); return; }
        if (!merged.hasOwnProperty(k)) keys.push(k);
        merged[k] = v;
      };
      if (rules.length) {
        var cls = (attrValue(node, 'class') || '').split(/\s+/).filter(Boolean);
        var id = attrValue(node, 'id');
        rules.filter(function (r) {
          if (r.tag && r.tag !== tag) return false;
          if (r.id && r.id !== id) return false;
          for (var i = 0; i < r.classes.length; i++) if (cls.indexOf(r.classes[i]) < 0) return false;
          return true;
        }).sort(function (a, b) { return a.spec - b.spec || a.order - b.order; }).forEach(function (r) {
          r.decls.forEach(function (d) { put(d[0], d[1]); });
        });
      }
      var inline = attrValue(node, 'style');
      if (inline) parseDecls(inline).forEach(function (d) { put(d[0], d[1]); });
      return keys.map(function (k) { return k + ':' + merged[k]; }).join(';');
    }

    function cleanAttrs(node, tag, isRoot) {
      var out = '';
      node.attrs.forEach(function (a) {
        var k = a[0];
        var v = a[1];
        if (k === 'style' || k === 'class') return;
        if (/^xmlns(:|$)/.test(k)) return;
        if (isRoot && (k === 'width' || k === 'height' || k === 'viewBox' || k === 'x' || k === 'y')) return;
        if (k === 'href' || k === 'xlink:href') {
          if (/^#[\w.\-:]+$/.test(v.trim())) out += ' href="' + escapeXml(v.trim()) + '"';
          else removed('external reference ' + k + '="' + (v.length > 40 ? v.slice(0, 37) + '...' : v) + '"');
          return;
        }
        if (!SAFE_ATTRS[k]) {
          removed(/^on/i.test(k) ? 'event handler ' + k : 'attribute ' + k);
          return;
        }
        if (v.length > (k === 'd' || k === 'points' ? 500000 : 2000) || !safeValue(v)) {
          removed('unsafe value in ' + k);
          return;
        }
        if (k === 'id' && !/^[A-Za-z_][\w.\-:]*$/.test(v)) {
          removed('invalid id');
          return;
        }
        out += ' ' + k + '="' + escapeXml(v) + '"';
      });
      var st = cleanStyle(node, tag);
      if (st) out += ' style="' + escapeXml(st) + '"';
      return out;
    }

    function serialize(node, parentTag) {
      if (!node.name) {
        return TEXT_ELEMENTS[parentTag] ? escapeXml(node.text) : '';
      }
      var tag = localName(node.name);
      if (tag === 'style') {
        removed('<style> (simple rules were inlined)');
        return '';
      }
      if (tag === 'a') {
        removed('<a> link (content kept)');
        tag = 'g';
        node = { name: 'g', attrs: node.attrs.filter(function (a) { return a[0] === 'transform'; }), children: node.children };
      }
      if (!SAFE_ELEMENTS[tag]) {
        removed('<' + node.name + '>');
        return '';
      }
      if (tag === 'use') {
        var href = attrValue(node, 'href') || attrValue(node, 'xlink:href') || '';
        if (!/^#[\w.\-:]+$/.test(href.trim())) {
          removed('<use> with external or missing href');
          return '';
        }
      }
      var inner = node.children.map(function (c) { return serialize(c, tag); }).join('');
      var a = cleanAttrs(node, tag, false);
      return inner ? '<' + tag + a + '>' + inner + '</' + tag + '>' : '<' + tag + a + '/>';
    }

    // physical size
    var vb = parseViewBox(attrValue(rootNode, 'viewBox'));
    var wMm = lengthToMm(attrValue(rootNode, 'width'));
    var hMm = lengthToMm(attrValue(rootNode, 'height'));
    if (wMm && hMm) {
      if (!vb) vb = [0, 0, wMm / MM_PER_PX, hMm / MM_PER_PX];
    } else if (wMm && vb) {
      hMm = wMm * vb[3] / vb[2];
    } else if (hMm && vb) {
      wMm = hMm * vb[2] / vb[3];
    } else if (vb) {
      wMm = vb[2] * MM_PER_PX;
      hMm = vb[3] * MM_PER_PX;
    } else {
      wMm = 300 * MM_PER_PX;
      hMm = 150 * MM_PER_PX;
      vb = [0, 0, 300, 150];
      errors.push('svg has no width/height/viewBox – assumed 300 × 150 px; add a viewBox.');
    }
    if (wMm > maxW) {
      hMm *= maxW / wMm;
      wMm = maxW;
    }
    if (hMm > maxH) {
      wMm *= maxH / hMm;
      hMm = maxH;
    }
    var inner = rootNode.children.map(function (c) { return serialize(c, 'svg'); }).join('');
    var rootAttrs = cleanAttrs(rootNode, 'svg', true);
    var svg = '<svg xmlns="' + SVG_NS + '" width="' + px(wMm) + '" height="' + px(hMm) + '" viewBox="' +
      vb.map(function (v) { return String(round3(v)); }).join(' ') + '"' + rootAttrs + '>' + inner + '</svg>';
    if (!inner) errors.push('svg contains no drawable content.');
    return {
      ok: true,
      svg: svg,
      widthMm: round3(wMm),
      heightMm: round3(hMm),
      errors: errors,
      removed: removedOrder.map(function (w) { return removedCount[w] > 1 ? w + ' (' + removedCount[w] + '×)' : w; })
    };
  }

  return {
    DEFAULT_FONT: DEFAULT_FONT,
    ICON_NAMES: ICON_NAMES,
    LINEATURE_KINDS: LINEATURE_KINDS,
    PALETTE: PALETTE,
    escapeXml: escapeXml,
    icon: icon,
    taskBadge: taskBadge,
    stars: stars,
    lineature: lineature,
    numberLine: numberLine,
    coordinateSystem: coordinateSystem,
    chart: chart,
    mindmap: mindmap,
    crosswordGrid: crosswordGrid,
    wordSearchGrid: wordSearchGrid,
    cutLine: cutLine,
    qrCode: qrCode,
    sanitizeSvg: sanitizeSvg,
    textWidth: textWidth,
    wrapText: wrapText
  };
});
