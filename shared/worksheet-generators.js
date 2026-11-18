/*
 * worksheet-generators.js – deterministic generators for worksheet exercises (MIT License).
 *
 * Used by both the editor plugin (browser, global `WorksheetGen`) and the proxy
 * (Node.js, CommonJS `require`). Keep it dependency-free and ES2015-compatible.
 *
 * Every function is pure: the same input and seed give the same output in every
 * JS engine (no Math.random, no Date, no locale-dependent APIs). Error and warning
 * messages are English, short and actionable – they are shown to an AI model.
 *
 * Features:
 *  - hashSeed(), seededRandom(), shuffle(): seeded randomness (FNV-1a + mulberry32)
 *  - normalizeGridWord(): answers for letter grids (ß -> SS, upper case, A–Z ÄÖÜ)
 *  - crossword():         crossword layout with numbering and clue lists
 *  - wordSearch():        word search grid (easy / medium / hard directions)
 *  - cloze(), gapString(): gap texts with the [[answer]] syntax
 *  - wordBank():          answer box in German alphabetical order or shuffled
 *  - matching():          matching exercise with a deranged right column and key
 *  - wrapLines():         word wrap for reading texts with line numbers
 *  - gradeKey():          German grade key (Notenschlüssel 1–6)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WorksheetGen = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_SEED = 'worksheet';

  function seedOf(seed) {
    return seed === undefined || seed === null ? DEFAULT_SEED : seed;
  }

  function describe(value) {
    if (typeof value === 'string') return '"' + value + '"';
    if (value === undefined) return 'nothing';
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }

  function isIntIn(value, min, max) {
    return typeof value === 'number' && Math.floor(value) === value && value >= min && value <= max;
  }

  function repeatChar(ch, n) {
    var s = '';
    for (var i = 0; i < n; i++) s += ch;
    return s;
  }

  // ---------------------------------------------------------------------------
  // Seeded randomness
  // ---------------------------------------------------------------------------

  /** FNV-1a (32 bit) over the string form of the value; undefined/null -> 'worksheet'. */
  function hashSeed(value) {
    var s = String(seedOf(value));
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  /** mulberry32 seeded with hashSeed(seed): returns a function producing floats in [0, 1). */
  function seededRandom(seed) {
    var a = hashSeed(seed);
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomInt(rng, n) {
    return Math.floor(rng() * n);
  }

  function permutation(n, rng) {
    var p = [];
    for (var i = 0; i < n; i++) p.push(i);
    for (var k = n - 1; k > 0; k--) {
      var j = randomInt(rng, k + 1);
      var tmp = p[k];
      p[k] = p[j];
      p[j] = tmp;
    }
    return p;
  }

  function isDerangement(p) {
    for (var i = 0; i < p.length; i++) if (p[i] === i) return false;
    return true;
  }

  var DERANGE_RETRIES = 50;

  /** Shuffled indices 0..n-1; with derange no index stays in place (n >= 2). */
  function shuffledIndices(n, seed, derange) {
    var s = String(seedOf(seed));
    var p = permutation(n, seededRandom(s));
    if (derange && n >= 2) {
      for (var k = 1; k <= DERANGE_RETRIES && !isDerangement(p); k++) {
        p = permutation(n, seededRandom(s + '/derange/' + k));
      }
      if (!isDerangement(p)) {
        p = [];
        for (var i = 0; i < n; i++) p.push((i + 1) % n);
      }
    }
    return p;
  }

  /** Fisher–Yates shuffle into a NEW array. opts.derange: no element keeps its index. */
  function shuffle(array, seed, opts) {
    if (!Array.isArray(array)) throw new TypeError('shuffle() expects an array, got ' + describe(array) + '.');
    var p = shuffledIndices(array.length, seed, !!(opts && opts.derange === true));
    return p.map(function (i) {
      return array[i];
    });
  }

  // ---------------------------------------------------------------------------
  // Grid words
  // ---------------------------------------------------------------------------

  var COMBINING_UMLAUT = { a: 'ä', o: 'ö', u: 'ü', A: 'Ä', O: 'Ö', U: 'Ü' };
  var GRID_WORD_RE = /^[A-ZÄÖÜ]+$/;

  /** Normalise an answer for letter grids: no spaces/hyphens/apostrophes/dots, ß -> SS, upper case. */
  function normalizeGridWord(word) {
    if (typeof word !== 'string') {
      return { ok: false, word: '', error: 'Word must be a string, got ' + describe(word) + '.' };
    }
    var given = word.trim();
    var w = given
      .replace(/([aouAOU])\u0308/g, function (m, base) {
        return COMBINING_UMLAUT[base];
      })
      .replace(/[\s\-\u00ad\u2010-\u2015'`\u00b4\u2018\u2019\u02bc.\u00b7\u2026]/g, '')
      .replace(/[\u00df\u1e9e]/g, 'SS')
      .replace(/ä/g, 'Ä')
      .replace(/ö/g, 'Ö')
      .replace(/ü/g, 'Ü')
      .toUpperCase();
    if (!w) {
      return { ok: false, word: '', error: 'Word ' + describe(word) + ' is empty – give at least one letter.' };
    }
    if (!GRID_WORD_RE.test(w)) {
      var bad = [];
      for (var i = 0; i < w.length; i++) {
        if (!GRID_WORD_RE.test(w[i]) && bad.indexOf(w[i]) < 0) bad.push(w[i]);
      }
      return {
        ok: false,
        word: '',
        error: 'Word "' + given + '" contains invalid characters (' + bad.join(' ') +
          ') – use only the letters A–Z, Ä, Ö, Ü (no digits, accents or punctuation).'
      };
    }
    return { ok: true, word: w, error: null };
  }

  // ---------------------------------------------------------------------------
  // Crossword
  // ---------------------------------------------------------------------------

  var CROSSWORD_ATTEMPTS = 40;
  var CROSSWORD_MIN_ENTRIES = 2;
  var CROSSWORD_MAX_ENTRIES = 30;
  var CROSSWORD_MIN_LETTERS = 2;
  var CROSSWORD_MAX_LETTERS = 20;
  var CROSSWORD_MIN_SIZE = 3;
  var CROSSWORD_MAX_SIZE = 40;
  var ACROSS = 0;
  var DOWN = 1;

  function emptyCrossword() {
    return {
      ok: false, width: 0, height: 0, cells: [], numbers: [], words: [], across: [], down: [],
      unplaced: [], errors: [], warnings: []
    };
  }

  function betterPlacement(a, b) {
    if (a.crossings !== b.crossings) return a.crossings > b.crossings;
    if (a.area !== b.area) return a.area < b.area;
    if (a.square !== b.square) return a.square < b.square;
    return a.tie < b.tie;
  }

  function betterLayout(a, b) {
    if (a.placed.length !== b.placed.length) return a.placed.length > b.placed.length;
    if (a.area !== b.area) return a.area < b.area;
    if (a.square !== b.square) return a.square < b.square;
    return a.crossings > b.crossings;
  }

  /**
   * Greedy layout of the items in the given order on a canvas that is large enough for
   * any bounding box of maxW × maxH around the first word.
   */
  function layoutCrossword(items, order, maxW, maxH, rng) {
    var CW = maxW * 3 + 4;
    var CH = maxH * 3 + 4;
    var letters = [];
    var usedAcross = [];
    var usedDown = [];
    for (var i = 0; i < CW * CH; i++) {
      letters.push('');
      usedAcross.push(false);
      usedDown.push(false);
    }
    var byLetter = {};
    var placed = [];
    var box = null;
    var totalCrossings = 0;

    function at(r, c) {
      return r < 0 || c < 0 || r >= CH || c >= CW ? '' : letters[r * CW + c];
    }

    // Returns the placement (with score) or null if the word may not go there.
    function evaluate(word, r, c, dir) {
      var dr = dir === DOWN ? 1 : 0;
      var dc = dir === ACROSS ? 1 : 0;
      var len = word.length;
      var endR = r + dr * (len - 1);
      var endC = c + dc * (len - 1);
      var minR = Math.min(box.minR, r);
      var maxR = Math.max(box.maxR, endR);
      var minC = Math.min(box.minC, c);
      var maxC = Math.max(box.maxC, endC);
      var h = maxR - minR + 1;
      var w = maxC - minC + 1;
      if (h > maxH || w > maxW) return null;
      if (at(r - dr, c - dc) !== '' || at(endR + dr, endC + dc) !== '') return null;
      var crossings = 0;
      for (var k = 0; k < len; k++) {
        var rr = r + dr * k;
        var cc = c + dc * k;
        var idx = rr * CW + cc;
        var ch = letters[idx];
        if (ch !== '') {
          if (ch !== word[k]) return null;
          if (dir === ACROSS ? usedAcross[idx] : usedDown[idx]) return null;
          crossings++;
        } else if (at(rr - dc, cc - dr) !== '' || at(rr + dc, cc + dr) !== '') {
          return null; // would touch a parallel neighbour
        }
      }
      if (crossings === 0 || crossings === len) return null;
      return { r: r, c: c, dir: dir, crossings: crossings, area: w * h, square: Math.abs(w - h), tie: 0 };
    }

    function put(item, r, c, dir, crossings) {
      var dr = dir === DOWN ? 1 : 0;
      var dc = dir === ACROSS ? 1 : 0;
      var word = item.answer;
      for (var k = 0; k < word.length; k++) {
        var rr = r + dr * k;
        var cc = c + dc * k;
        var idx = rr * CW + cc;
        if (letters[idx] === '') {
          letters[idx] = word[k];
          (byLetter[word[k]] = byLetter[word[k]] || []).push(idx);
        }
        if (dir === ACROSS) usedAcross[idx] = true;
        else usedDown[idx] = true;
      }
      var endR = r + dr * (word.length - 1);
      var endC = c + dc * (word.length - 1);
      if (!box) box = { minR: r, maxR: endR, minC: c, maxC: endC };
      else {
        box.minR = Math.min(box.minR, r);
        box.maxR = Math.max(box.maxR, endR);
        box.minC = Math.min(box.minC, c);
        box.maxC = Math.max(box.maxC, endC);
      }
      placed.push({ item: item, r: r, c: c, dir: dir });
      totalCrossings += crossings;
    }

    function findBest(word) {
      var best = null;
      var tried = {};
      for (var k = 0; k < word.length; k++) {
        var cellsWithLetter = byLetter[word[k]];
        if (!cellsWithLetter) continue;
        for (var j = 0; j < cellsWithLetter.length; j++) {
          var idx = cellsWithLetter[j];
          if (usedAcross[idx] && usedDown[idx]) continue;
          var dir = usedAcross[idx] ? DOWN : ACROSS;
          var r = Math.floor(idx / CW) - (dir === DOWN ? k : 0);
          var c = (idx % CW) - (dir === ACROSS ? k : 0);
          var key = r + ',' + c + ',' + dir;
          if (tried[key]) continue;
          tried[key] = true;
          var cand = evaluate(word, r, c, dir);
          if (!cand) continue;
          cand.tie = rng();
          if (!best || betterPlacement(cand, best)) best = cand;
        }
      }
      return best;
    }

    var first = items[order[0]];
    put(first, maxH + 1, maxW + 1, first.answer.length <= maxW ? ACROSS : DOWN, 0);

    var pending = order.slice(1);
    var progress = true;
    while (pending.length && progress) {
      progress = false;
      var rest = [];
      for (var p = 0; p < pending.length; p++) {
        var item = items[pending[p]];
        var best = findBest(item.answer);
        if (best) {
          put(item, best.r, best.c, best.dir, best.crossings);
          progress = true;
        } else {
          rest.push(pending[p]);
        }
      }
      pending = rest;
    }

    var width = box.maxC - box.minC + 1;
    var height = box.maxR - box.minR + 1;
    return {
      placed: placed,
      unplaced: pending,
      box: box,
      area: width * height,
      square: Math.abs(width - height),
      crossings: totalCrossings
    };
  }

  function attemptOrder(items, attempt, rng) {
    var idx = [];
    for (var i = 0; i < items.length; i++) idx.push(i);
    var byLength = function (rank) {
      return function (a, b) {
        var d = items[b].answer.length - items[a].answer.length;
        return d !== 0 ? d : rank[a] - rank[b];
      };
    };
    if (attempt === 0) return idx.sort(byLength(idx.slice()));
    var shuffled = permutation(items.length, rng);
    if (attempt % 2 === 1) return shuffled;
    var rank = [];
    shuffled.forEach(function (item, pos) {
      rank[item] = pos;
    });
    return shuffled.slice().sort(byLength(rank)); // longest first, ties in random order
  }

  function sharesLetter(word, others) {
    for (var i = 0; i < others.length; i++) {
      for (var k = 0; k < word.length; k++) if (others[i].indexOf(word[k]) >= 0) return true;
    }
    return false;
  }

  /**
   * Crossword layout. entries: [{ answer, clue }] (2–30). opts: { maxWidth = 17, maxHeight = 17, seed }.
   * Returns { ok, width, height, cells, numbers, words, across, down, unplaced, errors, warnings }.
   */
  function crossword(entries, opts) {
    var o = opts || {};
    var result = emptyCrossword();
    var errors = result.errors;
    var maxW = o.maxWidth === undefined ? 17 : o.maxWidth;
    var maxH = o.maxHeight === undefined ? 17 : o.maxHeight;
    var seed = seedOf(o.seed);
    var range = CROSSWORD_MIN_SIZE + ' and ' + CROSSWORD_MAX_SIZE;
    if (!isIntIn(maxW, CROSSWORD_MIN_SIZE, CROSSWORD_MAX_SIZE)) {
      errors.push('maxWidth must be a whole number between ' + range + ', got ' + describe(maxW) + '.');
    }
    if (!isIntIn(maxH, CROSSWORD_MIN_SIZE, CROSSWORD_MAX_SIZE)) {
      errors.push('maxHeight must be a whole number between ' + range + ', got ' + describe(maxH) + '.');
    }
    if (!Array.isArray(entries)) {
      errors.push('entries must be an array of { answer, clue } objects.');
      return result;
    }
    if (entries.length < CROSSWORD_MIN_ENTRIES || entries.length > CROSSWORD_MAX_ENTRIES) {
      errors.push('A crossword needs ' + CROSSWORD_MIN_ENTRIES + '–' + CROSSWORD_MAX_ENTRIES +
        ' entries, got ' + entries.length + '.');
    }
    var longest = errors.length ? Infinity : Math.max(maxW, maxH);
    var items = [];
    var seen = Object.create(null);
    entries.forEach(function (entry, i) {
      var label = 'Entry ' + (i + 1);
      if (!entry || typeof entry !== 'object' || typeof entry.answer !== 'string') {
        errors.push(label + ': answer is missing – give { answer, clue }.');
        return;
      }
      var norm = normalizeGridWord(entry.answer);
      if (!norm.ok) {
        errors.push(label + ': ' + norm.error);
        return;
      }
      var answer = norm.word;
      if (answer.length < CROSSWORD_MIN_LETTERS || answer.length > CROSSWORD_MAX_LETTERS) {
        errors.push(label + ': answer "' + answer + '" has ' + answer.length + ' letters – crossword answers need ' +
          CROSSWORD_MIN_LETTERS + '–' + CROSSWORD_MAX_LETTERS + ' letters.');
        return;
      }
      if (answer.length > longest) {
        errors.push(label + ': answer "' + answer + '" has ' + answer.length + ' letters but the grid allows at most ' +
          longest + ' – shorten it or raise maxWidth/maxHeight.');
        return;
      }
      if (typeof entry.clue !== 'string' || !entry.clue.trim()) {
        errors.push(label + ' ("' + answer + '"): clue is missing – every answer needs a clue.');
        return;
      }
      if (seen[answer] !== undefined) {
        errors.push('Entries ' + (seen[answer] + 1) + ' and ' + (i + 1) + ' have the same answer "' + answer +
          '" – each answer may appear only once.');
        return;
      }
      seen[answer] = i;
      items.push({ answer: answer, given: entry.answer, clue: entry.clue.trim(), index: i });
    });
    if (errors.length) return result;

    var best = null;
    for (var attempt = 0; attempt < CROSSWORD_ATTEMPTS; attempt++) {
      var rng = seededRandom(String(seed) + '/crossword/' + attempt);
      var layout = layoutCrossword(items, attemptOrder(items, attempt, rng), maxW, maxH, rng);
      if (!best || betterLayout(layout, best)) best = layout;
    }

    var box = best.box;
    var width = box.maxC - box.minC + 1;
    var height = box.maxR - box.minR + 1;
    var cells = [];
    var numbers = [];
    for (var r = 0; r < height; r++) {
      var row = [];
      var nums = [];
      for (var c = 0; c < width; c++) {
        row.push('');
        nums.push(0);
      }
      cells.push(row);
      numbers.push(nums);
    }
    var starts = {};
    var words = best.placed.map(function (p) {
      var w = {
        answer: p.item.answer,
        clue: p.item.clue,
        row: p.r - box.minR,
        col: p.c - box.minC,
        direction: p.dir === ACROSS ? 'across' : 'down',
        number: 0
      };
      for (var k = 0; k < w.answer.length; k++) {
        cells[w.row + (p.dir === DOWN ? k : 0)][w.col + (p.dir === ACROSS ? k : 0)] = w.answer[k];
      }
      starts[w.row + ',' + w.col] = true;
      return w;
    });
    var next = 1;
    for (var nr = 0; nr < height; nr++) {
      for (var nc = 0; nc < width; nc++) {
        if (starts[nr + ',' + nc]) numbers[nr][nc] = next++;
      }
    }
    words.forEach(function (w) {
      w.number = numbers[w.row][w.col];
    });
    words.sort(function (a, b) {
      if (a.number !== b.number) return a.number - b.number;
      return a.direction === 'across' ? -1 : 1;
    });
    var clueList = function (direction) {
      return words
        .filter(function (w) {
          return w.direction === direction;
        })
        .map(function (w) {
          return { number: w.number, clue: w.clue, answer: w.answer };
        });
    };

    var placedAnswers = best.placed.map(function (p) {
      return p.item.answer;
    });
    var unplacedItems = best.unplaced
      .slice()
      .sort(function (a, b) {
        return a - b;
      })
      .map(function (i) {
        return items[i];
      });
    unplacedItems.forEach(function (item) {
      var others = items
        .filter(function (other) {
          return other !== item;
        })
        .map(function (other) {
          return other.answer;
        });
      if (!sharesLetter(item.answer, others)) {
        result.warnings.push('Word "' + item.answer + '" could not be placed – it shares no letter with the other ' +
          'answers; replace it or add words that cross it.');
      } else {
        result.warnings.push('Word "' + item.answer + '" could not be placed – use fewer or shorter words, or raise ' +
          'maxWidth/maxHeight (now ' + maxW + '×' + maxH + ').');
      }
    });
    if (placedAnswers.length === 1 && items.length > 1) {
      result.warnings.push('Only one word could be placed – the answers need common letters to cross.');
    }

    result.ok = unplacedItems.length === 0;
    result.width = width;
    result.height = height;
    result.cells = cells;
    result.numbers = numbers;
    result.words = words;
    result.across = clueList('across');
    result.down = clueList('down');
    result.unplaced = unplacedItems.map(function (item) {
      return { answer: item.given, clue: item.clue };
    });
    return result;
  }

  // ---------------------------------------------------------------------------
  // Word search
  // ---------------------------------------------------------------------------

  /** Relative letter frequencies of German texts (per 10 000 letters, umlauts separate). */
  var GERMAN_LETTER_WEIGHTS = Object.freeze({
    A: 651, B: 189, C: 306, D: 508, E: 1740, F: 166, G: 301, H: 476, I: 755, J: 27, K: 121, L: 344, M: 253,
    N: 978, O: 251, P: 79, Q: 2, R: 700, S: 727, T: 615, U: 435, V: 67, W: 189, X: 3, Y: 4, Z: 113,
    'Ä': 54, 'Ö': 30, 'Ü': 65
  });

  var WORD_SEARCH_DIRECTIONS = {
    easy: [[0, 1], [1, 0]],
    medium: [[0, 1], [1, 0], [1, 1]],
    hard: [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]]
  };
  var ALL_DIRECTIONS = WORD_SEARCH_DIRECTIONS.hard;
  var WORD_SEARCH_MIN_WORDS = 2;
  var WORD_SEARCH_MAX_WORDS = 25;
  var WORD_SEARCH_MIN_LETTERS = 3;
  var WORD_SEARCH_MAX_LETTERS = 15;
  var WORD_SEARCH_MIN_SIZE = 5;
  var WORD_SEARCH_MAX_SIZE = 20;
  var WORD_SEARCH_ATTEMPTS = 30;
  var WORD_SEARCH_FILLS = 10;

  // Bit for the line a direction runs on (a word and its reverse share the line).
  function axisBit(dr, dc) {
    if (dr === 0) return 1;
    if (dc === 0) return 2;
    return dr === dc ? 4 : 8;
  }

  function placeWordSearch(items, order, size, dirs, rng) {
    var grid = [];
    var axes = [];
    for (var i = 0; i < size * size; i++) {
      grid.push('');
      axes.push(0);
    }
    var placements = [];
    var count = 0;

    function fits(word, r, c, dr, dc, bit) {
      for (var k = 0; k < word.length; k++) {
        var idx = (r + dr * k) * size + (c + dc * k);
        var ch = grid[idx];
        if (ch !== '' && (ch !== word[k] || (axes[idx] & bit))) return false;
      }
      return true;
    }

    order.forEach(function (itemIndex) {
      var word = items[itemIndex].normalized;
      var len = word.length;
      var options = [];
      dirs.forEach(function (d) {
        var dr = d[0];
        var dc = d[1];
        var bit = axisBit(dr, dc);
        var starts = [];
        for (var r = 0; r < size; r++) {
          var endR = r + dr * (len - 1);
          if (endR < 0 || endR >= size) continue;
          for (var c = 0; c < size; c++) {
            var endC = c + dc * (len - 1);
            if (endC < 0 || endC >= size) continue;
            if (fits(word, r, c, dr, dc, bit)) starts.push(r * size + c);
          }
        }
        if (starts.length) options.push({ dr: dr, dc: dc, bit: bit, starts: starts });
      });
      if (!options.length) return;
      var opt = options[randomInt(rng, options.length)];
      var start = opt.starts[randomInt(rng, opt.starts.length)];
      var row = Math.floor(start / size);
      var col = start % size;
      for (var k = 0; k < len; k++) {
        var idx = (row + opt.dr * k) * size + (col + opt.dc * k);
        grid[idx] = word[k];
        axes[idx] |= opt.bit;
      }
      placements[itemIndex] = { row: row, col: col, dr: opt.dr, dc: opt.dc };
      count++;
    });
    return { grid: grid, placements: placements, count: count };
  }

  function countOccurrences(grid, size, word) {
    var n = 0;
    var len = word.length;
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if (grid[r * size + c] !== word[0]) continue;
        for (var d = 0; d < ALL_DIRECTIONS.length; d++) {
          var dr = ALL_DIRECTIONS[d][0];
          var dc = ALL_DIRECTIONS[d][1];
          var endR = r + dr * (len - 1);
          var endC = c + dc * (len - 1);
          if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;
          var k = 1;
          while (k < len && grid[(r + dr * k) * size + (c + dc * k)] === word[k]) k++;
          if (k === len) n++;
        }
      }
    }
    return n;
  }

  /**
   * Word search. words: 2–25 strings (3–15 letters after normalizeGridWord).
   * opts: { size, difficulty = 'medium', seed }.
   * Returns { ok, size, grid, placements, unplaced, errors, warnings }.
   */
  function wordSearch(words, opts) {
    var o = opts || {};
    var result = { ok: false, size: 0, grid: [], placements: [], unplaced: [], errors: [], warnings: [] };
    var errors = result.errors;
    var difficulty = o.difficulty === undefined ? 'medium' : o.difficulty;
    var dirs = Object.prototype.hasOwnProperty.call(WORD_SEARCH_DIRECTIONS, difficulty)
      ? WORD_SEARCH_DIRECTIONS[difficulty] : null;
    if (!dirs) errors.push('Unknown difficulty ' + describe(difficulty) + ' – use "easy", "medium" or "hard".');
    if (o.size !== undefined && !isIntIn(o.size, WORD_SEARCH_MIN_SIZE, WORD_SEARCH_MAX_SIZE)) {
      errors.push('size must be a whole number between ' + WORD_SEARCH_MIN_SIZE + ' and ' + WORD_SEARCH_MAX_SIZE +
        ', got ' + describe(o.size) + '.');
    }
    if (!Array.isArray(words)) {
      errors.push('words must be an array of strings.');
      return result;
    }
    if (words.length < WORD_SEARCH_MIN_WORDS || words.length > WORD_SEARCH_MAX_WORDS) {
      errors.push('A word search needs ' + WORD_SEARCH_MIN_WORDS + '–' + WORD_SEARCH_MAX_WORDS + ' words, got ' +
        words.length + '.');
    }
    var items = [];
    var seen = Object.create(null);
    words.forEach(function (word, i) {
      var norm = normalizeGridWord(word);
      if (!norm.ok) {
        errors.push('Word ' + (i + 1) + ': ' + norm.error);
        return;
      }
      var w = norm.word;
      if (w.length < WORD_SEARCH_MIN_LETTERS || w.length > WORD_SEARCH_MAX_LETTERS) {
        errors.push('Word "' + w + '" has ' + w.length + ' letters – word search words need ' +
          WORD_SEARCH_MIN_LETTERS + '–' + WORD_SEARCH_MAX_LETTERS + ' letters.');
        return;
      }
      if (seen[w]) {
        errors.push('Word "' + w + '" appears twice – each word may appear only once.');
        return;
      }
      seen[w] = true;
      items.push({ word: word, normalized: w });
    });
    if (errors.length) return result;

    var longest = 0;
    var total = 0;
    items.forEach(function (item) {
      longest = Math.max(longest, item.normalized.length);
      total += item.normalized.length;
    });
    var size = o.size !== undefined ? o.size
      : Math.min(WORD_SEARCH_MAX_SIZE, Math.max(longest, Math.ceil(Math.sqrt(total * 2.5)), 8));
    items.forEach(function (item) {
      if (item.normalized.length > size) {
        errors.push('Word "' + item.normalized + '" has ' + item.normalized.length + ' letters but the grid is only ' +
          size + ' wide – use size ' + item.normalized.length + ' or more, or a shorter word.');
      }
    });
    if (errors.length) return result;

    var reverse = function (s) {
      return s.split('').reverse().join('');
    };
    items.forEach(function (a) {
      items.forEach(function (b) {
        if (a === b) return;
        var inside = b.normalized.indexOf(a.normalized) >= 0 ||
          (difficulty === 'hard' && reverse(b.normalized).indexOf(a.normalized) >= 0);
        if (inside) {
          result.warnings.push('Word "' + a.normalized + '" is also part of "' + b.normalized +
            '" – students may find it twice.');
        }
      });
    });

    var order = items
      .map(function (item, i) {
        return i;
      })
      .sort(function (a, b) {
        var d = items[b].normalized.length - items[a].normalized.length;
        return d !== 0 ? d : a - b;
      });
    var rng = seededRandom(String(seedOf(o.seed)) + '/wordsearch');
    var best = null;
    for (var attempt = 0; attempt < WORD_SEARCH_ATTEMPTS; attempt++) {
      var layout = placeWordSearch(items, order, size, dirs, rng);
      if (!best || layout.count > best.count) best = layout;
      if (best.count === items.length) break;
    }

    // Fill the empty cells with weighted random letters; avoid accidental extra copies of a word.
    var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    var useUmlauts = items.some(function (item) {
      return /[ÄÖÜ]/.test(item.normalized);
    });
    if (useUmlauts) alphabet = alphabet.concat(['Ä', 'Ö', 'Ü']);
    var cumulative = [];
    var sum = 0;
    alphabet.forEach(function (letter) {
      sum += GERMAN_LETTER_WEIGHTS[letter];
      cumulative.push(sum);
    });
    var pickLetter = function () {
      var x = rng() * sum;
      for (var i = 0; i < cumulative.length; i++) if (x < cumulative[i]) return alphabet[i];
      return alphabet[alphabet.length - 1];
    };
    var baseline = items.map(function (item) {
      return countOccurrences(best.grid, size, item.normalized);
    });
    var filled = null;
    var fewestExtra = Infinity;
    for (var f = 0; f < WORD_SEARCH_FILLS && fewestExtra > 0; f++) {
      var candidate = best.grid.map(function (ch) {
        return ch === '' ? pickLetter() : ch;
      });
      var extra = 0;
      items.forEach(function (item, i) {
        extra += countOccurrences(candidate, size, item.normalized) - baseline[i];
      });
      if (extra < fewestExtra) {
        fewestExtra = extra;
        filled = candidate;
      }
    }

    for (var r = 0; r < size; r++) result.grid.push(filled.slice(r * size, (r + 1) * size));
    items.forEach(function (item, i) {
      var p = best.placements[i];
      if (p) {
        result.placements.push({ word: item.word, normalized: item.normalized, row: p.row, col: p.col, dr: p.dr, dc: p.dc });
      } else {
        result.unplaced.push(item.word);
        result.warnings.push('Word "' + item.normalized + '" could not be placed in the ' + size + '×' + size +
          ' grid – use fewer or shorter words, a larger size' + (difficulty === 'hard' ? '' : ' or a harder difficulty') + '.');
      }
    });
    result.size = size;
    result.ok = result.unplaced.length === 0;
    return result;
  }

  // ---------------------------------------------------------------------------
  // Cloze texts and word bank
  // ---------------------------------------------------------------------------

  /**
   * Parse a gap text: "[[answer]]" marks a gap (answer may contain spaces).
   * Unclosed "[[", empty gaps and gaps spanning lines stay plain text.
   */
  function cloze(text) {
    var s = typeof text === 'string' ? text : text === undefined || text === null ? '' : String(text);
    var parts = [];
    var answers = [];
    var buf = '';
    var pos = 0;
    while (pos < s.length) {
      var close = s.indexOf(']]', pos);
      if (close < 0) break;
      var open = close >= 2 ? s.lastIndexOf('[[', close - 2) : -1;
      var inner = open >= pos ? s.slice(open + 2, close) : '';
      var answer = inner.trim();
      if (open < pos || !answer || /[\r\n]/.test(inner)) {
        buf += s.slice(pos, close + 2);
        pos = close + 2;
        continue;
      }
      buf += s.slice(pos, open);
      if (buf) parts.push({ type: 'text', text: buf });
      buf = '';
      parts.push({ type: 'gap', answer: answer, index: answers.length });
      answers.push(answer);
      pos = close + 2;
    }
    buf += s.slice(pos);
    if (buf) parts.push({ type: 'text', text: buf });
    return { parts: parts, answers: answers, gapCount: answers.length };
  }

  var GAP_MAX = 30;

  /** Underscores for a printed gap: max(opts.min || 8, round(length × 1.6)), at most 30. */
  function gapString(answer, opts) {
    var o = opts || {};
    var len = answer === undefined || answer === null ? 0 : String(answer).length;
    var min = typeof o.min === 'number' && o.min > 0 ? Math.floor(o.min) : 8;
    var n = Math.min(GAP_MAX, Math.max(min, Math.round(len * 1.6)));
    return repeatChar('_', n);
  }

  /** Sort key in German dictionary order (DIN 5007-1): ä≈a, ö≈o, ü≈u, ß≈ss, case-insensitive. */
  function germanSortKey(s) {
    return s
      .toLowerCase()
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/ü/g, 'u')
      .replace(/ß/g, 'ss');
  }

  function compareGerman(a, b) {
    var ka = germanSortKey(a);
    var kb = germanSortKey(b);
    if (ka !== kb) return ka < kb ? -1 : 1;
    if (a !== b) return a < b ? -1 : 1;
    return 0;
  }

  /**
   * Word bank for cloze texts. opts: { order: 'alpha' | 'shuffle' = 'alpha', seed, unique = true }.
   * Entries are trimmed; empty entries are dropped.
   */
  function wordBank(answers, opts) {
    var o = opts || {};
    if (!Array.isArray(answers)) throw new TypeError('wordBank() expects an array of strings, got ' + describe(answers) + '.');
    var order = o.order === undefined ? 'alpha' : o.order;
    if (order !== 'alpha' && order !== 'shuffle') {
      throw new Error('wordBank: order must be "alpha" or "shuffle", got ' + describe(order) + '.');
    }
    var list = [];
    answers.forEach(function (a) {
      if (a === undefined || a === null) return;
      var s = String(a).trim();
      if (!s) return;
      if (o.unique !== false && list.indexOf(s) >= 0) return;
      list.push(s);
    });
    if (order === 'shuffle') return shuffle(list, o.seed);
    return list
      .map(function (s, i) {
        return { s: s, i: i };
      })
      .sort(function (a, b) {
        return compareGerman(a.s, b.s) || a.i - b.i;
      })
      .map(function (x) {
        return x.s;
      });
  }

  // ---------------------------------------------------------------------------
  // Matching exercise
  // ---------------------------------------------------------------------------

  var MATCHING_MIN_PAIRS = 2;
  var MATCHING_MAX_PAIRS = 12;
  var MATCHING_LETTERS = 'ABCDEFGHIJKL';

  /**
   * Matching exercise: pairs [{ left, right }] (2–12). The right column is shuffled so that no
   * partner stays on its row. key[i] = index in `right` of the partner of left[i].
   */
  function matching(pairs, opts) {
    var o = opts || {};
    if (!Array.isArray(pairs)) throw new TypeError('matching() expects an array of { left, right } pairs.');
    if (pairs.length < MATCHING_MIN_PAIRS || pairs.length > MATCHING_MAX_PAIRS) {
      throw new Error('A matching exercise needs ' + MATCHING_MIN_PAIRS + '–' + MATCHING_MAX_PAIRS + ' pairs, got ' +
        pairs.length + '.');
    }
    pairs.forEach(function (p, i) {
      var ok = p && typeof p.left === 'string' && p.left.trim() && typeof p.right === 'string' && p.right.trim();
      if (!ok) throw new Error('Pair ' + (i + 1) + ': left and right must be non-empty strings.');
    });
    var perm = shuffledIndices(pairs.length, o.seed, true);
    var key = [];
    var right = perm.map(function (src, pos) {
      key[src] = pos;
      return pairs[src].right;
    });
    return {
      left: pairs.map(function (p) {
        return p.left;
      }),
      right: right,
      key: key,
      letters: right.map(function (r, i) {
        return MATCHING_LETTERS.charAt(i);
      })
    };
  }

  // ---------------------------------------------------------------------------
  // Reading texts
  // ---------------------------------------------------------------------------

  /** Greedy word wrap; '\n' forces a break, empty lines stay '', over-long words are split. */
  function wrapLines(text, maxChars) {
    if (!isIntIn(maxChars, 1, Infinity)) {
      throw new Error('wrapLines: maxChars must be a whole number of at least 1, got ' + describe(maxChars) + '.');
    }
    var s = text === undefined || text === null ? '' : String(text);
    var out = [];
    s.replace(/\r\n?/g, '\n').split('\n').forEach(function (paragraph) {
      var words = paragraph.split(/[ \t\f\v]+/).filter(Boolean);
      if (!words.length) {
        out.push('');
        return;
      }
      var line = '';
      words.forEach(function (word) {
        var w = word;
        while (w.length > maxChars) {
          if (line) {
            out.push(line);
            line = '';
          }
          out.push(w.slice(0, maxChars));
          w = w.slice(maxChars);
        }
        if (!line) line = w;
        else if (line.length + 1 + w.length <= maxChars) line += ' ' + w;
        else {
          out.push(line);
          line = w;
        }
      });
      out.push(line);
    });
    return out;
  }

  // ---------------------------------------------------------------------------
  // Grade key
  // ---------------------------------------------------------------------------

  var GRADE_LABELS = Object.freeze(['sehr gut', 'gut', 'befriedigend', 'ausreichend', 'mangelhaft', 'ungenügend']);
  var DEFAULT_THRESHOLDS = [87.5, 75, 62.5, 50, 25];

  /**
   * German grade key (grades 1–6). opts: { thresholds = [87.5, 75, 62.5, 50, 25], step = 0.5 | 1 }.
   * thresholds are the minimum percentages for grades 1..5. Throws on invalid input.
   */
  function gradeKey(totalPoints, opts) {
    var o = opts || {};
    var total = totalPoints;
    if (typeof total !== 'number' || !isFinite(total) || total < 1 || total > 1000) {
      throw new Error('gradeKey: totalPoints must be a number between 1 and 1000, got ' + describe(total) + '.');
    }
    var step = o.step === undefined ? 0.5 : o.step;
    if (step !== 0.5 && step !== 1) throw new Error('gradeKey: step must be 0.5 or 1, got ' + describe(step) + '.');
    var th = o.thresholds === undefined ? DEFAULT_THRESHOLDS : o.thresholds;
    if (!Array.isArray(th) || th.length !== 5) {
      throw new Error('gradeKey: thresholds must be an array of 5 percentages (minimum for grades 1–5), got ' +
        describe(th) + '.');
    }
    th.forEach(function (t, i) {
      if (typeof t !== 'number' || !isFinite(t) || t <= 0 || t > 100) {
        throw new Error('gradeKey: threshold for grade ' + (i + 1) + ' must be a percentage above 0 and at most 100, got ' +
          describe(t) + '.');
      }
      if (i > 0 && t >= th[i - 1]) {
        throw new Error('gradeKey: thresholds must be strictly decreasing (grade ' + (i + 1) + ': ' + t + ' >= grade ' +
          i + ': ' + th[i - 1] + ').');
      }
    });
    // Minimum points in units of `step`, rounded up (tiny epsilon against floating point noise).
    var units = th.map(function (t) {
      var v = Math.round((t * total) / 100 / step * 1e6) / 1e6;
      return Math.ceil(v);
    });
    var key = [];
    for (var g = 0; g < 6; g++) {
      var min = g < 5 ? units[g] * step : 0;
      var max = g === 0 ? total : (units[g - 1] - 1) * step;
      if (min > max) {
        throw new Error('gradeKey: with ' + total + ' points grade ' + (g + 1) + ' would get no points (step ' + step +
          ') – use more total points' + (step === 1 ? ', step 0.5' : '') + ' or other thresholds.');
      }
      key.push({ grade: g + 1, label: GRADE_LABELS[g], min: min, max: max });
    }
    return key;
  }

  return {
    DEFAULT_SEED: DEFAULT_SEED,
    GERMAN_LETTER_WEIGHTS: GERMAN_LETTER_WEIGHTS,
    GRADE_LABELS: GRADE_LABELS,
    hashSeed: hashSeed,
    seededRandom: seededRandom,
    shuffle: shuffle,
    normalizeGridWord: normalizeGridWord,
    crossword: crossword,
    wordSearch: wordSearch,
    cloze: cloze,
    gapString: gapString,
    wordBank: wordBank,
    matching: matching,
    wrapLines: wrapLines,
    gradeKey: gradeKey
  };
});
