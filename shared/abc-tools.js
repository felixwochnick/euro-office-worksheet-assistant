/*
 * abc-tools.js – shared helpers for ABC notation (MIT License).
 *
 * Used by both the editor plugin (browser, global `MusicAbc`) and the proxy
 * (Node.js, CommonJS `require`). Keep it dependency-free and ES2015-compatible.
 *
 * Features:
 *  - normalizeAbc():      clean up ABC produced by humans or LLMs (code fences, quotes, missing X:)
 *  - validateAbc():       structural validation (headers, clef, body characters, brackets)
 *  - parseGermanNote():   German note names (c, cis, es, h, b, c', C, c1 …) -> pitch
 *  - germanToAbc():       a whole sequence of German note names -> ABC note tokens
 *  - buildAbc():          wrap ABC note tokens into a complete tune with header
 *  - emptyStavesAbc():    empty staves (invisible rests "x") for students to write in
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MusicAbc = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_ABC_LENGTH = 20000;
  var SUPPORTED_CLEFS = ['treble', 'bass'];

  // ---------------------------------------------------------------------------
  // German note names
  // ---------------------------------------------------------------------------

  /**
   * German note names (lower-case) -> [ABC letter, accidental in semitones].
   * Note the German specialities: h = B, b = B flat, es = E flat, as = A flat.
   */
  var GERMAN_NAMES = (function () {
    var map = {};
    var letters = { c: 'C', d: 'D', e: 'E', f: 'F', g: 'G', a: 'A', h: 'B' };
    Object.keys(letters).forEach(function (l) {
      map[l] = [letters[l], 0];
      map[l + 'is'] = [letters[l], 1];
      map[l + 'isis'] = [letters[l], 2];
    });
    ['c', 'd', 'f', 'g'].forEach(function (l) {
      map[l + 'es'] = [letters[l], -1];
      map[l + 'eses'] = [letters[l], -2];
    });
    // Vowels contract: e + es = es, a + es = as.
    map.es = ['E', -1];
    map.eses = ['E', -2];
    map.as = ['A', -1];
    map.ases = ['A', -2];
    map.asas = ['A', -2];
    // h / b: b is B flat, heses is B double flat. "hes" is non-standard but common.
    map.b = ['B', -1];
    map.heses = ['B', -2];
    map.hes = ['B', -1];
    return map;
  })();

  var SUPERSCRIPTS = { '¹': 1, '²': 2, '³': 3, '⁴': 4 };
  var SUBSCRIPTS = { '₁': 1, '₂': 2, '₃': 3 };
  var REST_WORDS = { p: true, pause: true, r: true, rest: true, z: true };

  /**
   * Convert a pitch to an ABC note token.
   * @param {string} letter  ABC letter A–G (upper case)
   * @param {number} accidental semitones (-2..2)
   * @param {number} octave scientific octave (4 = octave of middle C)
   * @param {object} [opts] { explicitNatural: boolean }
   */
  function pitchToAbc(letter, accidental, octave, opts) {
    var acc = '';
    if (accidental === 1) acc = '^';
    else if (accidental === 2) acc = '^^';
    else if (accidental === -1) acc = '_';
    else if (accidental === -2) acc = '__';
    else if (opts && opts.explicitNatural) acc = '=';
    var note;
    if (octave >= 5) {
      note = letter.toLowerCase() + new Array(octave - 5 + 1).join("'");
    } else {
      note = letter.toUpperCase() + new Array(4 - octave + 1).join(',');
    }
    return acc + note;
  }

  /**
   * Parse a single German note name (Helmholtz octave notation).
   *
   * Octaves (Helmholtz -> scientific):
   *   C,  / C1 / C₁  = Kontra-C   (C1)
   *   C              = großes C   (C2)
   *   c              = kleines c  (C3)
   *   c' / c1 / c¹   = eingestrichenes c (C4, middle C)
   *   c'' / c2 / c²  = zweigestrichenes c (C5)
   *
   * A bare lower-case name without octave marks is ambiguous in everyday school
   * language ("c – f – g im Violinschlüssel" usually means c' f' g'). It is
   * therefore placed in `opts.bareOctave` (default 3 = strict Helmholtz).
   * `germanToAbc` sets a clef-dependent default (treble 4, bass 3).
   *
   * An optional ABC length can be appended after a colon: "c':2", "g:/2".
   *
   * @param {string} token
   * @param {object} [opts] { bareOctave: number, explicitNatural: boolean }
   * @returns {{ok:true, input:string, letter:string, accidental:number, octave:number|null, rest:boolean, length:string, abc:string} | {ok:false, input:string, error:string}}
   */
  function parseGermanNote(token, opts) {
    opts = opts || {};
    var input = String(token == null ? '' : token).trim();
    if (!input) return { ok: false, input: input, error: 'empty note name' };

    var length = '';
    var colon = input.indexOf(':');
    var core = input;
    if (colon !== -1) {
      length = input.slice(colon + 1);
      core = input.slice(0, colon);
      if (!/^(\d+)?(\/\d*)*$/.test(length) || length === '') {
        return { ok: false, input: input, error: 'invalid length "' + length + '"' };
      }
    }

    if (REST_WORDS[core.toLowerCase()]) {
      return { ok: true, input: input, letter: 'z', accidental: 0, octave: null, rest: true, length: length, abc: 'z' + length };
    }

    // Accept typographic apostrophes and unicode accidentals.
    core = core.replace(/[’‘´`′]/g, "'").replace(/♯/g, '#').replace(/♭/g, 'b');

    var m = /^([A-Ha-h][a-zA-Z]*?)(#{1,2}|b{1,2}(?=$|[',0-9¹²³⁴₀₁₂₃]))?('+|,+|[0-9]|[¹²³⁴]|[₁₂₃])?$/.exec(core);
    if (!m) return { ok: false, input: input, error: 'unknown note name "' + input + '"' };

    var name = m[1];
    var symbolAcc = m[2] || '';
    var marks = m[3] || '';
    var isUpper = name.charAt(0) === name.charAt(0).toUpperCase();
    var lower = name.toLowerCase();

    // "b" alone is B flat; "bb" as symbol accidental is only allowed after a letter.
    var entry = GERMAN_NAMES[lower];
    if (!entry && symbolAcc === '' && /^[a-h]b{1,2}$/.test(lower) && lower !== 'b') {
      // e.g. "eb" (English-ish) -> treat "b" suffix as flat symbol
      entry = GERMAN_NAMES[lower.charAt(0)];
      symbolAcc = lower.slice(1);
    }
    if (!entry) return { ok: false, input: input, error: 'unknown note name "' + input + '"' };

    var accidental = entry[1];
    if (symbolAcc) {
      if (accidental !== 0 && !(lower === 'b')) {
        return { ok: false, input: input, error: 'double accidental notation in "' + input + '"' };
      }
      if (lower === 'b') return { ok: false, input: input, error: 'ambiguous note name "' + input + '"' };
      accidental = symbolAcc.charAt(0) === '#' ? symbolAcc.length : -symbolAcc.length;
    }

    var octave;
    if (isUpper) {
      octave = 2;
      if (marks) {
        if (marks.charAt(0) === ',') octave -= marks.length;
        else if (/^[0-9]$/.test(marks)) octave -= parseInt(marks, 10);
        else if (SUBSCRIPTS[marks]) octave -= SUBSCRIPTS[marks];
        else return { ok: false, input: input, error: 'upper-case note names take "," or subscripts, not "' + marks + '"' };
      }
    } else {
      if (!marks) {
        octave = typeof opts.bareOctave === 'number' ? opts.bareOctave : 3;
      } else if (marks.charAt(0) === "'") {
        octave = 3 + marks.length;
      } else if (/^[0-9]$/.test(marks)) {
        octave = 3 + parseInt(marks, 10);
      } else if (SUPERSCRIPTS[marks]) {
        octave = 3 + SUPERSCRIPTS[marks];
      } else {
        return { ok: false, input: input, error: 'lower-case note names take "\'" or superscripts, not "' + marks + '"' };
      }
    }
    if (octave < 0 || octave > 8) return { ok: false, input: input, error: 'octave out of range in "' + input + '"' };

    return {
      ok: true,
      input: input,
      letter: entry[0],
      accidental: accidental,
      octave: octave,
      rest: false,
      length: length,
      abc: pitchToAbc(entry[0], accidental, octave, opts) + length
    };
  }

  /**
   * Split free text like "c – f – g", "c, f, g", "c' d' e' | f'" into tokens.
   * Bar lines ("|", "||", "|]") are kept as separate tokens.
   * A comma followed by whitespace or the end of input is treated as a list
   * separator; commas glued to an upper-case note ("C,,") are octave marks.
   */
  function tokenizeGermanNotes(text) {
    var s = String(text == null ? '' : text)
      .replace(/[–—−-]/g, ' ')
      .replace(/\s+(und|and|dann|then)\s+/gi, ' ')
      .replace(/;/g, ' ')
      .replace(/(\|\]|\|\||\|)/g, ' $1 ');
    return s.split(/\s+/).filter(Boolean);
  }

  /**
   * Convert a sequence of German note names to ABC note tokens.
   * @param {string} text e.g. "c – f – g", "fis' g' a'", "C, F, G"
   * @param {object} [opts] { clef: 'treble'|'bass', bareOctave: number, explicitNatural: boolean }
   * @returns {{abc:string, notes:Array, errors:Array<{token:string,error:string}>, ok:boolean}}
   */
  function germanToAbc(text, opts) {
    opts = opts || {};
    var clef = opts.clef === 'bass' ? 'bass' : 'treble';
    var bareOctave = typeof opts.bareOctave === 'number' ? opts.bareOctave : (clef === 'bass' ? 3 : 4);
    var tokens = tokenizeGermanNotes(text);
    var isList = tokens.length > 1 && tokens.some(function (t) { return /,$/.test(t); });
    var out = [];
    var notes = [];
    var errors = [];
    tokens.forEach(function (tok) {
      if (tok === '|' || tok === '||' || tok === '|]') {
        out.push(tok);
        return;
      }
      var t = tok;
      // In a comma separated list, one trailing comma is a separator.
      if (isList && /,$/.test(t)) t = t.slice(0, -1);
      if (/^[a-h].*,+$/.test(t)) t = t.replace(/,+$/, ''); // lower-case never takes commas
      if (!t) return;
      var res = parseGermanNote(t, { bareOctave: bareOctave, explicitNatural: opts.explicitNatural });
      if (res.ok) {
        notes.push(res);
        out.push(res.abc);
      } else {
        errors.push({ token: tok, error: res.error });
      }
    });
    return { ok: errors.length === 0 && notes.length > 0, abc: out.join(' '), notes: notes, errors: errors };
  }

  // ---------------------------------------------------------------------------
  // ABC normalisation & validation
  // ---------------------------------------------------------------------------

  /**
   * Normalise ABC text: strip Markdown code fences, unify line endings and
   * quotes, trim lines, remove leading prose before the first header and make
   * sure the tune starts with an X: line.
   */
  function normalizeAbc(abc) {
    var s = String(abc == null ? '' : abc);
    // Literal "\n" sequences (double-escaped JSON from some models).
    if (s.indexOf('\n') === -1 && s.indexOf('\\n') !== -1) s = s.replace(/\\n/g, '\n');
    s = s.replace(/\r\n?/g, '\n');
    var fence = /```[a-zA-Z]*\n([\s\S]*?)```/.exec(s);
    if (fence) s = fence[1];
    s = s.replace(/[’‘]/g, "'").replace(/[“”„]/g, '"');
    var lines = s.split('\n').map(function (l) { return l.replace(/\s+$/, ''); });
    // Drop leading blank lines and prose before the first header line.
    var first = -1;
    for (var i = 0; i < lines.length; i++) {
      if (/^\s*[A-Za-z]:/.test(lines[i]) || /^%%/.test(lines[i])) { first = i; break; }
    }
    if (first > 0) lines = lines.slice(first);
    lines = lines.map(function (l) { return l.replace(/^\s+(?=[A-Za-z]:)/, ''); });
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    if (!lines.length || !/^X:/.test(lines[0])) lines.unshift('X:1');
    return lines.join('\n');
  }

  var HEADER_RE = /^([A-Za-z]):\s*(.*)$/;
  var KEY_RE = /^(none|HP|Hp|[A-G][#b]?\s*(maj|major|ion|ionian|min|minor|m|aeo|aeolian|dor|dorian|phr|phrygian|lyd|lydian|mix|mixolydian|loc|locrian)?)$/i;

  function parseKeyField(value) {
    var parts = value.trim().split(/\s+/);
    var keyTokens = [];
    var clef = null;
    var other = [];
    parts.forEach(function (p) {
      var m = /^clef=(\S+)$/i.exec(p);
      if (m) clef = m[1].toLowerCase();
      else if (/^(treble|bass|alto|tenor|perc|none)$/i.test(p) && clef === null && keyTokens.length > 0) clef = p.toLowerCase();
      else if (/=/.test(p)) other.push(p);
      else keyTokens.push(p);
    });
    // Explicit accidentals after the key ("K:D exp _b ^f") are tolerated.
    var key = keyTokens.length ? keyTokens[0] : '';
    if (keyTokens.length > 1 && /^(maj|major|min|minor|m|dor|dorian|phr|phrygian|lyd|lydian|mix|mixolydian|loc|locrian|aeo|aeolian|ion|ionian)$/i.test(keyTokens[1])) {
      key = keyTokens[0] + ' ' + keyTokens[1];
    }
    return { key: key, clef: clef, other: other };
  }

  function stripBodyNoise(line) {
    return line
      .replace(/%.*$/, '')                 // comments
      .replace(/"[^"]*"/g, ' ')            // chord symbols / annotations
      .replace(/![^!\n]*!/g, ' ')          // !decorations!
      .replace(/\+[^+\n]*\+/g, ' ')        // +decorations+
      .replace(/\[[A-Za-z]:[^\]]*\]/g, ' ') // inline fields [K:...]
      .replace(/\|\]|\[\||\[(?=[0-9])/g, '|') // bar lines |] [| and endings [1 [2
      .replace(/\\$/, '');                 // line continuation
  }

  var ALLOWED_BODY = /[A-Ga-gzZxXy^_=,'0-9\/<>()[\]{}|:.\-~ \tHLMOPSTuv&$]/;

  /**
   * Validate ABC notation (one tune) for use in this plugin.
   * @param {string} abc
   * @param {object} [opts] { requireClef: boolean }
   * @returns {{valid:boolean, errors:Array<{code:string,message:string,line?:number}>, warnings:Array<{code:string,message:string,line?:number}>, headers:Object, clef:string, normalized:string}}
   */
  function validateAbc(abc, opts) {
    opts = opts || {};
    var errors = [];
    var warnings = [];
    var headers = {};
    function err(code, message, line) { errors.push({ code: code, message: message, line: line }); }
    function warn(code, message, line) { warnings.push({ code: code, message: message, line: line }); }

    if (typeof abc !== 'string' || !abc.trim()) {
      err('empty', 'ABC text is empty.');
      return { valid: false, errors: errors, warnings: warnings, headers: headers, clef: 'treble', normalized: '' };
    }
    if (abc.length > MAX_ABC_LENGTH) {
      err('too_long', 'ABC text is longer than ' + MAX_ABC_LENGTH + ' characters.');
      return { valid: false, errors: errors, warnings: warnings, headers: headers, clef: 'treble', normalized: '' };
    }

    var normalized = normalizeAbc(abc);
    var lines = normalized.split('\n');
    var i = 0;
    var headerOrder = [];

    // --- header ------------------------------------------------------------
    if (!/^X:\s*\d+\s*$/.test(lines[0])) err('bad_x', 'The first line must be "X:<number>".', 1);
    for (; i < lines.length; i++) {
      var line = lines[i];
      if (/^%/.test(line) || line.trim() === '') {
        if (line.trim() === '' && headerOrder.indexOf('K') === -1) {
          err('blank_in_header', 'Blank line inside the header (before K:).', i + 1);
        }
        if (headerOrder.indexOf('K') !== -1) { i++; break; }
        continue;
      }
      var m = HEADER_RE.exec(line);
      if (!m) {
        if (headerOrder.indexOf('K') === -1) err('k_not_last', 'Music starts before the K: header line. K: must be the last header line.', i + 1);
        break;
      }
      var field = m[1];
      var value = m[2].trim();
      if (field === 'X' && headerOrder.length) {
        err('multiple_tunes', 'Only one tune (one X: header) is allowed.', i + 1);
      }
      headerOrder.push(field);
      if (!(field in headers)) headers[field] = value;
      if (field === 'K') { i++; break; }
    }

    ['X', 'M', 'L', 'K'].forEach(function (f) {
      if (!(f in headers)) err('missing_' + f.toLowerCase(), 'Missing header field ' + f + ':.');
    });

    if ('M' in headers && !/^(C\|?|none|\d+(\+\d+)*\/\d+)$/i.test(headers.M)) {
      err('bad_meter', 'Invalid meter "M:' + headers.M + '" (use e.g. 4/4, 3/4, 6/8, C or none).');
    }
    if ('L' in headers) {
      var lm = /^(\d+)\/(\d+)$/.exec(headers.L);
      if (!lm || (parseInt(lm[2], 10) & (parseInt(lm[2], 10) - 1)) !== 0) {
        err('bad_length', 'Invalid unit note length "L:' + headers.L + '" (use e.g. 1/4 or 1/8).');
      }
    }

    var clef = 'treble';
    if ('K' in headers) {
      var k = parseKeyField(headers.K);
      if (!k.key) err('bad_key', 'K: needs a key, e.g. "K:C clef=treble".');
      else if (!KEY_RE.test(k.key)) err('bad_key', 'Invalid key "' + k.key + '". German "H" is "B" in ABC, "B" (German) is "Bb".');
      if (k.clef === null) {
        if (opts.requireClef) err('missing_clef', 'K: must contain clef=treble or clef=bass.');
        else warn('missing_clef', 'No clef given in K:, treble clef is assumed.');
      } else if (SUPPORTED_CLEFS.indexOf(k.clef) === -1) {
        err('bad_clef', 'Unsupported clef "' + k.clef + '" (use clef=treble or clef=bass).');
      } else {
        clef = k.clef;
      }
    }

    // --- body --------------------------------------------------------------
    var body = lines.slice(i);
    var hasMusic = false;
    var depth = { '[': 0, '(': 0, '{': 0 };
    for (var b = 0; b < body.length; b++) {
      var lineNo = i + b + 1;
      var raw = body[b];
      if (/^\s*%/.test(raw) || raw.trim() === '') continue;
      if (/^X:/.test(raw)) { err('multiple_tunes', 'Only one tune (one X: header) is allowed.', lineNo); continue; }
      if (/^[wW]:/.test(raw)) continue;            // lyrics
      if (/^[A-Za-z]:/.test(raw)) continue;        // header field inside the body (e.g. K: change)
      if ((raw.match(/"/g) || []).length % 2) err('unbalanced_quotes', 'Unbalanced double quotes.', lineNo);
      var clean = stripBodyNoise(raw);
      var reportedH = false;
      for (var c = 0; c < clean.length; c++) {
        var ch = clean.charAt(c);
        if (ch === '[' || ch === '(' || ch === '{') depth[ch]++;
        else if (ch === ']') depth['[']--;
        else if (ch === ')') depth['(']--;
        else if (ch === '}') depth['{']--;
        if (/[A-Ga-gzZxX]/.test(ch)) hasMusic = true;
        if (!ALLOWED_BODY.test(ch)) {
          if (ch === 'h' && !reportedH) {
            reportedH = true;
            err('german_h', 'The German note "h" does not exist in ABC – write B (b for the higher octave).', lineNo);
          } else if (ch === '#' || ch === 's' || ch === 'i') {
            if (!reportedH) err('german_accidental', 'Invalid character "' + ch + '". Accidentals are written before the note in ABC: ^f (F sharp), _e (E flat), =f (natural).', lineNo);
            reportedH = true;
          } else {
            err('bad_char', 'Invalid character "' + ch + '" in the music.', lineNo);
          }
        }
      }
    }
    if (depth['['] !== 0) err('unbalanced_brackets', 'Unbalanced square brackets [ ].');
    if (depth['('] < 0) err('unbalanced_parens', 'Unbalanced parentheses ( ).');
    if (depth['{'] !== 0) err('unbalanced_braces', 'Unbalanced braces { }.');
    if (!hasMusic) err('no_music', 'The tune contains no notes or rests after the K: line.');

    return { valid: errors.length === 0, errors: errors, warnings: warnings, headers: headers, clef: clef, normalized: normalized };
  }

  /** Human-readable one-line summary of validation errors. */
  function formatValidationErrors(result) {
    return result.errors.map(function (e) {
      return (e.line ? 'line ' + e.line + ': ' : '') + e.message;
    }).join(' ');
  }

  // ---------------------------------------------------------------------------
  // Builders
  // ---------------------------------------------------------------------------

  function clefOf(clef) { return clef === 'bass' ? 'bass' : 'treble'; }

  /**
   * Build a complete ABC tune.
   * @param {object} o { notes: string (ABC note tokens), clef, meter, length, key, title }
   */
  function buildAbc(o) {
    o = o || {};
    var lines = ['X:1'];
    if (o.title) lines.push('T:' + String(o.title).replace(/\n/g, ' '));
    lines.push('M:' + (o.meter || 'none'));
    lines.push('L:' + (o.length || '1/4'));
    lines.push('K:' + (o.key || 'C') + ' clef=' + clefOf(o.clef));
    lines.push(String(o.notes || '').trim());
    return lines.join('\n');
  }

  /**
   * ABC for empty staves (one system per line) made of invisible rests.
   * @param {object} o { clef: 'treble'|'bass', count: 1..12, measures: 0..8 }
   */
  function emptyStavesAbc(o) {
    o = o || {};
    var count = Math.max(1, Math.min(12, Math.floor(Number(o.count) || 1)));
    var measures = o.measures == null ? 4 : Math.max(0, Math.min(8, Math.floor(Number(o.measures) || 0)));
    var line;
    if (measures === 0) {
      line = 'x x x x x x x x x x x x x x x x';
    } else {
      var bars = [];
      for (var i = 0; i < measures; i++) bars.push('x4');
      line = bars.join(' | ') + ' |';
    }
    var body = [];
    for (var n = 0; n < count; n++) {
      body.push(n === count - 1 ? line.replace(/\|$/, '|]') : line);
    }
    if (measures === 0) body[body.length - 1] = body[body.length - 1] + ' |]';
    return ['X:1', 'M:none', 'L:1/4', 'K:C clef=' + clefOf(o.clef)].concat(body).join('\n');
  }

  /** True if a string looks like ABC created by this plugin (used to detect alt texts). */
  function looksLikeAbc(text) {
    return typeof text === 'string' && /^\s*X:\s*\d+/m.test(text) && /^\s*K:/m.test(text);
  }

  return {
    MAX_ABC_LENGTH: MAX_ABC_LENGTH,
    SUPPORTED_CLEFS: SUPPORTED_CLEFS,
    pitchToAbc: pitchToAbc,
    parseGermanNote: parseGermanNote,
    tokenizeGermanNotes: tokenizeGermanNotes,
    germanToAbc: germanToAbc,
    normalizeAbc: normalizeAbc,
    validateAbc: validateAbc,
    formatValidationErrors: formatValidationErrors,
    buildAbc: buildAbc,
    emptyStavesAbc: emptyStavesAbc,
    looksLikeAbc: looksLikeAbc
  };
});
