'use strict';
// Unit tests for the worksheet generators (crossword, word search, cloze, matching, grade key …).
const test = require('node:test');
const assert = require('node:assert/strict');
const gen = require('../shared/worksheet-generators.js');

const ANIMALS = [
  ['Elefant', 'Großes graues Tier mit Rüssel'],
  ['Giraffe', 'Tier mit dem längsten Hals'],
  ['Löwe', 'König der Tiere'],
  ['Zebra', 'Pferdeähnliches Tier mit schwarzen und weißen Streifen'],
  ['Affe', 'Klettert gern auf Bäume und isst Bananen'],
  ['Tiger', 'Große gestreifte Raubkatze'],
  ['Krokodil', 'Reptil mit langem Maul, lebt im Fluss'],
  ['Nashorn', 'Hat ein oder zwei Hörner auf der Nase'],
  ['Pinguin', 'Vogel, der nicht fliegen, aber gut schwimmen kann'],
  ['Kamel', 'Hat Höcker und lebt in der Wüste']
].map(([answer, clue]) => ({ answer, clue }));

// ---------------------------------------------------------------------------
// Crossword checker: re-reads the grid independently of the generator.
// ---------------------------------------------------------------------------
function checkCrossword(r, opts = {}) {
  const { width: W, height: H, cells, numbers } = r;
  assert.equal(cells.length, H);
  assert.equal(numbers.length, H);
  cells.forEach((row) => assert.equal(row.length, W));
  numbers.forEach((row) => assert.equal(row.length, W));
  assert.ok(W <= (opts.maxWidth || 17) && H <= (opts.maxHeight || 17), `grid ${W}×${H} exceeds the limits`);
  const has = (row, col) => row >= 0 && col >= 0 && row < H && col < W && cells[row][col] !== '';
  cells.forEach((row) => row.forEach((ch) => assert.ok(ch === '' || /^[A-ZÄÖÜ]$/.test(ch), `bad cell ${ch}`)));

  // Trimmed to the bounding box.
  assert.ok(cells[0].some((ch) => ch), 'first row empty');
  assert.ok(cells[H - 1].some((ch) => ch), 'last row empty');
  assert.ok(cells.some((row) => row[0]), 'first column empty');
  assert.ok(cells.some((row) => row[W - 1]), 'last column empty');

  // Every maximal run of >= 2 letters is exactly one placed word, and vice versa.
  const runs = [];
  for (let row = 0; row < H; row++) {
    for (let col = 0; col < W; col++) {
      if (has(row, col) && !has(row, col - 1) && has(row, col + 1)) {
        let text = '';
        for (let c = col; has(row, c); c++) text += cells[row][c];
        runs.push(`across:${row}:${col}:${text}`);
      }
      if (has(row, col) && !has(row - 1, col) && has(row + 1, col)) {
        let text = '';
        for (let rr = row; has(rr, col); rr++) text += cells[rr][col];
        runs.push(`down:${row}:${col}:${text}`);
      }
    }
  }
  const placed = r.words.map((w) => `${w.direction}:${w.row}:${w.col}:${w.answer}`);
  assert.deepEqual([...runs].sort(), [...placed].sort(), 'grid words differ from placed words');

  // Every letter belongs to a word; all letters are connected.
  const covered = new Set();
  r.words.forEach((w) => {
    for (let k = 0; k < w.answer.length; k++) {
      covered.add(w.direction === 'across' ? `${w.row},${w.col + k}` : `${w.row + k},${w.col}`);
    }
  });
  const letters = [];
  for (let row = 0; row < H; row++) for (let col = 0; col < W; col++) if (has(row, col)) letters.push(`${row},${col}`);
  assert.equal(covered.size, letters.length, 'letter outside of any word');
  const seen = new Set([letters[0]]);
  const queue = [letters[0]];
  while (queue.length) {
    const [row, col] = queue.shift().split(',').map(Number);
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${row + dr},${col + dc}`;
      if (has(row + dr, col + dc) && !seen.has(key)) {
        seen.add(key);
        queue.push(key);
      }
    }
  }
  assert.equal(seen.size, letters.length, 'grid is not connected');

  // Every word crosses at least one other word.
  if (r.words.length > 1) {
    r.words.forEach((w) => {
      let crossings = 0;
      for (let k = 0; k < w.answer.length; k++) {
        const [row, col] = w.direction === 'across' ? [w.row, w.col + k] : [w.row + k, w.col];
        const perpendicular = w.direction === 'across' ? has(row - 1, col) || has(row + 1, col) : has(row, col - 1) || has(row, col + 1);
        if (perpendicular) crossings++;
      }
      assert.ok(crossings > 0, `${w.answer} crosses nothing`);
    });
  }

  // Numbering in reading order; one number per starting cell.
  let n = 0;
  for (let row = 0; row < H; row++) {
    for (let col = 0; col < W; col++) {
      const startsAcross = has(row, col) && !has(row, col - 1) && has(row, col + 1);
      const startsDown = has(row, col) && !has(row - 1, col) && has(row + 1, col);
      assert.equal(numbers[row][col], startsAcross || startsDown ? ++n : 0, `number at ${row},${col}`);
    }
  }
  r.words.forEach((w) => assert.equal(w.number, numbers[w.row][w.col]));
  const list = (dir) => r.words.filter((w) => w.direction === dir).map((w) => ({ number: w.number, clue: w.clue, answer: w.answer }));
  assert.deepEqual(r.across, list('across').sort((a, b) => a.number - b.number));
  assert.deepEqual(r.down, list('down').sort((a, b) => a.number - b.number));
}

// ---------------------------------------------------------------------------
// Seeded randomness and shuffle
// ---------------------------------------------------------------------------

test('hashSeed is FNV-1a over the string form', () => {
  assert.equal(gen.hashSeed(''), 2166136261);
  assert.equal(gen.hashSeed('a'), 0xe40c292c);
  assert.equal(gen.hashSeed(42), gen.hashSeed('42'));
  assert.equal(gen.hashSeed(undefined), gen.hashSeed('worksheet'));
  assert.notEqual(gen.hashSeed('klasse5a'), gen.hashSeed('klasse5b'));
  const h = gen.hashSeed('Grüße ẞ 🎵');
  assert.ok(Number.isInteger(h) && h >= 0 && h < 2 ** 32);
});

test('seededRandom is deterministic, in [0,1) and defaults to "worksheet"', () => {
  const take = (rng, n) => Array.from({ length: n }, () => rng());
  const a = take(gen.seededRandom('x'), 1000);
  assert.deepEqual(a, take(gen.seededRandom('x'), 1000));
  assert.notDeepEqual(a, take(gen.seededRandom('y'), 1000));
  assert.ok(a.every((v) => v >= 0 && v < 1));
  assert.deepEqual(take(gen.seededRandom(), 5), take(gen.seededRandom('worksheet'), 5));
  const mean = a.reduce((s, v) => s + v, 0) / a.length;
  assert.ok(mean > 0.45 && mean < 0.55, `mean ${mean}`);
});

test('shuffle returns a new permutation, deterministic per seed', () => {
  const input = Object.freeze(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  const out = gen.shuffle(input, 1);
  assert.notEqual(out, input);
  assert.deepEqual([...out].sort(), [...input]);
  assert.deepEqual(gen.shuffle(input, 1), out);
  const variants = new Set(Array.from({ length: 10 }, (_, i) => gen.shuffle(input, i).join('')));
  assert.ok(variants.size >= 8, 'different seeds give different orders');
  assert.deepEqual(gen.shuffle([], 1), []);
  assert.deepEqual(gen.shuffle(['x'], 1, { derange: true }), ['x']);
  assert.throws(() => gen.shuffle('abc'), /expects an array/);
});

test('shuffle with derange never keeps an element at its index', () => {
  for (let n = 2; n <= 12; n++) {
    const input = Array.from({ length: n }, (_, i) => i);
    for (let seed = 0; seed < 60; seed++) {
      const out = gen.shuffle(input, seed, { derange: true });
      assert.deepEqual([...out].sort((a, b) => a - b), input);
      out.forEach((v, i) => assert.notEqual(v, i, `n=${n} seed=${seed}`));
    }
  }
  assert.deepEqual(gen.shuffle(['a', 'b'], 'x', { derange: true }), ['b', 'a']);
});

// ---------------------------------------------------------------------------
// Grid words
// ---------------------------------------------------------------------------

test('normalizeGridWord', () => {
  const w = (s) => gen.normalizeGridWord(s);
  assert.deepEqual(w('  Löwe '), { ok: true, word: 'LÖWE', error: null });
  assert.equal(w('Fußball').word, 'FUSSBALL');
  assert.equal(w('T-Rex').word, 'TREX');
  assert.equal(w("Rock 'n' Roll").word, 'ROCKNROLL');
  assert.equal(w('z.B.').word, 'ZB');
  assert.equal(w('Übung ärgern ölig').word, 'ÜBUNGÄRGERNÖLIG');
  assert.equal(w('Mu\u0308ller').word, 'MÜLLER'); // decomposed umlaut
  assert.equal(w('Haus').ok, true);
  for (const bad of ['R2D2', 'Café', 'Haus!', 'ελέφαντας']) {
    const r = w(bad);
    assert.equal(r.ok, false, bad);
    assert.match(r.error, /invalid characters.*A–Z, Ä, Ö, Ü/);
  }
  assert.match(w('   ').error, /empty/);
  assert.match(w('- . -').error, /empty/);
  assert.match(w(12).error, /must be a string/);
});

// ---------------------------------------------------------------------------
// Crossword
// ---------------------------------------------------------------------------

test('crossword: German animals – every word placed in a valid, connected grid', () => {
  for (const seed of [undefined, 1, 2, 'klasse5a', 'Tiere im Zoo']) {
    const r = gen.crossword(ANIMALS, { seed });
    assert.equal(r.ok, true, `seed ${seed}: ${r.warnings.join(' ')}`);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
    assert.deepEqual(r.unplaced, []);
    assert.equal(r.words.length, 10);
    assert.equal(r.across.length + r.down.length, 10);
    assert.deepEqual(r.words.map((w) => w.answer).sort(),
      ['AFFE', 'ELEFANT', 'GIRAFFE', 'KAMEL', 'KROKODIL', 'LÖWE', 'NASHORN', 'PINGUIN', 'TIGER', 'ZEBRA']);
    assert.equal(r.words.find((w) => w.answer === 'LÖWE').clue, 'König der Tiere');
    checkCrossword(r);
  }
});

test('crossword is deterministic and the seed changes the layout', () => {
  const a = gen.crossword(ANIMALS, { seed: 7 });
  assert.deepEqual(gen.crossword(ANIMALS, { seed: 7 }), a);
  const layouts = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => JSON.stringify(gen.crossword(ANIMALS, { seed }).cells)));
  assert.ok(layouts.size >= 2, 'different seeds usually give different layouts');
});

test('crossword respects maxWidth/maxHeight and stays valid for many words', () => {
  const school = ('HAUS MAUS BAUM TISCH STUHL FENSTER SCHULE KREIDE TAFEL HEFT BLEISTIFT LINEAL SCHERE ' +
    'KLEBER PAUSE KLASSE ZEUGNIS MATHEMATIK SPORT KUNST').split(' ').map((answer) => ({ answer, clue: `Hinweis ${answer}` }));
  for (const [maxWidth, maxHeight] of [[17, 17], [12, 20], [20, 10]]) {
    const r = gen.crossword(school, { maxWidth, maxHeight, seed: 3 });
    checkCrossword(r, { maxWidth, maxHeight });
    assert.equal(r.words.length + r.unplaced.length, school.length);
    assert.equal(r.ok, r.unplaced.length === 0);
    assert.equal(r.warnings.length, r.unplaced.length);
  }
});

test('crossword: words without common letters end up unplaced with warnings', () => {
  const r = gen.crossword([
    { answer: 'Abc', clue: 'eins' },
    { answer: 'DEF', clue: 'zwei' },
    { answer: 'GHI', clue: 'drei' }
  ]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, []);
  assert.equal(r.words.length, 1);
  assert.equal(r.unplaced.length, 2);
  r.unplaced.forEach((u) => assert.ok(typeof u.answer === 'string' && typeof u.clue === 'string'));
  assert.ok(r.warnings.some((w) => /could not be placed – it shares no letter/.test(w)));
  assert.ok(r.warnings.some((w) => /Only one word could be placed/.test(w)));
  checkCrossword(r);

  // Too small a grid: some words do not fit.
  const tight = gen.crossword(ANIMALS, { maxWidth: 8, maxHeight: 8 });
  assert.equal(tight.ok, false);
  assert.ok(tight.unplaced.length > 0);
  assert.match(tight.warnings[0], /could not be placed – use fewer or shorter words, or raise maxWidth\/maxHeight \(now 8×8\)/);
  checkCrossword(tight, { maxWidth: 8, maxHeight: 8 });
});

test('crossword: two words cross, one-letter overlap rules', () => {
  const r = gen.crossword([{ answer: 'Hund', clue: 'bellt' }, { answer: 'Katze', clue: 'miaut' }]);
  assert.equal(r.ok, false, 'HUND and KATZE share no letter');
  const ok = gen.crossword([{ answer: 'Hund', clue: 'bellt' }, { answer: 'Maus', clue: 'piept' }]);
  assert.equal(ok.ok, true);
  assert.equal(ok.words.length, 2);
  assert.deepEqual(new Set(ok.words.map((w) => w.direction)), new Set(['across', 'down']));
  checkCrossword(ok);
});

test('crossword input validation', () => {
  const err = (entries, opts) => gen.crossword(entries, opts).errors;
  assert.match(err('x')[0], /entries must be an array/);
  assert.match(err([{ answer: 'Haus', clue: 'x' }])[0], /needs 2–30 entries, got 1/);
  assert.match(err(Array.from({ length: 31 }, (_, i) => ({ answer: 'A'.repeat(2) + i, clue: 'x' })))[0], /needs 2–30 entries/);
  assert.match(err([{ answer: 'R2D2', clue: 'x' }, { answer: 'Haus', clue: 'y' }])[0], /^Entry 1: Word "R2D2" contains invalid characters/);
  assert.match(err([{ answer: 'A', clue: 'x' }, { answer: 'Haus', clue: 'y' }])[0], /answer "A" has 1 letters – crossword answers need 2–20/);
  assert.match(err([{ answer: 'Donaudampfschifffahrt', clue: 'x' }, { answer: 'Haus', clue: 'y' }])[0], /has 21 letters/);
  assert.match(err([{ answer: 'Haus' }, { answer: 'Maus', clue: 'y' }])[0], /Entry 1 \("HAUS"\): clue is missing/);
  assert.match(err([{ clue: 'x' }, { answer: 'Maus', clue: 'y' }])[0], /Entry 1: answer is missing/);
  assert.match(err([{ answer: 'Löwe', clue: 'x' }, { answer: 'LÖWE', clue: 'y' }])[0],
    /Entries 1 and 2 have the same answer "LÖWE"/);
  assert.match(err([{ answer: 'Schmetterling', clue: 'x' }, { answer: 'Haus', clue: 'y' }], { maxWidth: 10, maxHeight: 12 })[0],
    /has 13 letters but the grid allows at most 12/);
  assert.match(err(ANIMALS, { maxWidth: 2 })[0], /maxWidth must be a whole number between 3 and 40/);
  const r = gen.crossword([]);
  assert.equal(r.ok, false);
  assert.deepEqual([r.width, r.height, r.cells, r.words, r.unplaced], [0, 0, [], [], []]);
});

// ---------------------------------------------------------------------------
// Word search
// ---------------------------------------------------------------------------

function checkWordSearch(r, words, difficulty) {
  const allowed = {
    easy: ['0,1', '1,0'],
    medium: ['0,1', '1,0', '1,1'],
    hard: ['0,1', '1,0', '1,1', '-1,1', '0,-1', '-1,0', '-1,-1', '1,-1']
  }[difficulty];
  assert.equal(r.grid.length, r.size);
  r.grid.forEach((row) => assert.equal(row.length, r.size));
  const umlauts = words.some((w) => /[äöüÄÖÜ]/.test(w));
  r.grid.forEach((row) => row.forEach((ch) => assert.match(ch, umlauts ? /^[A-ZÄÖÜ]$/ : /^[A-Z]$/)));
  assert.equal(r.placements.length + r.unplaced.length, words.length);
  const axes = new Map();
  r.placements.forEach((p) => {
    assert.ok(words.includes(p.word));
    assert.equal(p.normalized, gen.normalizeGridWord(p.word).word);
    assert.ok(allowed.includes(`${p.dr},${p.dc}`), `${p.word}: direction ${p.dr},${p.dc} not allowed in ${difficulty}`);
    let read = '';
    for (let k = 0; k < p.normalized.length; k++) {
      const row = p.row + p.dr * k;
      const col = p.col + p.dc * k;
      read += r.grid[row][col];
      const key = `${row},${col}`;
      const axis = p.dr === 0 ? 'h' : p.dc === 0 ? 'v' : p.dr === p.dc ? 'd' : 'a';
      assert.ok(!(axes.get(key) || []).includes(axis), `${p.word} overlaps a word on the same line`);
      axes.set(key, (axes.get(key) || []).concat(axis));
    }
    assert.equal(read, p.normalized);
  });
}

test('wordSearch places every word readable from the grid, for every difficulty', () => {
  const words = ['Elefant', 'Giraffe', 'Löwe', 'Zebra', 'Tiger', 'Krokodil', 'Nashorn', 'Pinguin', 'Kamel', 'Igel'];
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const seed of [1, 2, 3]) {
      const r = gen.wordSearch(words, { difficulty, seed });
      assert.equal(r.ok, true, `${difficulty}/${seed}: ${r.warnings.join(' ')}`);
      assert.deepEqual(r.errors, []);
      assert.deepEqual(r.unplaced, []);
      checkWordSearch(r, words, difficulty);
    }
  }
  // Hard puzzles actually use more than the easy directions.
  const dirs = new Set();
  for (let seed = 0; seed < 5; seed++) {
    gen.wordSearch(words, { difficulty: 'hard', seed }).placements.forEach((p) => dirs.add(`${p.dr},${p.dc}`));
  }
  assert.ok(dirs.size >= 6, `hard uses ${dirs.size} directions`);
});

test('wordSearch: size default, fill letters, determinism', () => {
  const words = ['Haus', 'Maus', 'Baum', 'Tisch'];
  const r = gen.wordSearch(words, { seed: 'a' });
  assert.equal(r.size, 8); // max(5, ceil(sqrt(17 × 2.5)) = 7, 8)
  assert.deepEqual(gen.wordSearch(words, { seed: 'a' }), r);
  assert.notDeepEqual(gen.wordSearch(words, { seed: 'b' }).grid, r.grid);
  checkWordSearch(r, words, 'medium');
  assert.equal(gen.wordSearch(['Schmetterling', 'Raupe'], {}).size, 13);
  const many = 'HAUS MAUS BAUM TISCH STUHL FENSTER SCHULE KREIDE TAFEL HEFT BLEISTIFT LINEAL SCHERE KLEBER PAUSE KLASSE ZEUGNIS'.split(' ');
  const big = gen.wordSearch(many, { difficulty: 'hard', seed: 4 });
  assert.equal(big.size, 16); // max(9, ceil(sqrt(95 × 2.5)) = 16, 8)
  checkWordSearch(big, many, 'hard');
  // Umlauts only appear when a word contains one.
  const withUmlaut = gen.wordSearch(['Bär', 'Fuchs', 'Dachs'], { size: 12, seed: 1 });
  checkWordSearch(withUmlaut, ['Bär', 'Fuchs', 'Dachs'], 'medium');
  assert.equal(withUmlaut.placements[0].normalized, 'BÄR');
  assert.equal(withUmlaut.placements[0].word, 'Bär');
  // German letter frequency: E is the most common filler letter.
  const counts = {};
  gen.wordSearch(['Ohr', 'Arm'], { size: 20, seed: 9 }).grid.flat().forEach((ch) => (counts[ch] = (counts[ch] || 0) + 1));
  const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  assert.equal(top, 'E');
  assert.equal(gen.GERMAN_LETTER_WEIGHTS.E > gen.GERMAN_LETTER_WEIGHTS.Q, true);
});

test('wordSearch: too many words for the grid end up unplaced', () => {
  const words = ['Abend', 'Birne', 'Clown', 'Dachs', 'Eimer', 'Fisch', 'Gabel', 'Hafen', 'Insel', 'Junge', 'Kerze', 'Lampe'];
  const r = gen.wordSearch(words, { size: 5, difficulty: 'easy', seed: 1 });
  assert.equal(r.ok, false);
  assert.ok(r.unplaced.length > 0);
  assert.ok(r.unplaced.every((w) => words.includes(w)));
  assert.match(r.warnings[r.warnings.length - 1], /could not be placed in the 5×5 grid – use fewer or shorter words, a larger size or a harder difficulty/);
  checkWordSearch(r, words, 'easy');
});

test('wordSearch input validation and warnings', () => {
  const err = (words, opts) => gen.wordSearch(words, opts).errors;
  assert.match(err('Haus')[0], /words must be an array/);
  assert.match(err(['Haus'])[0], /needs 2–25 words, got 1/);
  assert.match(err(['Haus', 'Ei'])[0], /"EI" has 2 letters – word search words need 3–15/);
  assert.match(err(['Haus', 'haus'])[0], /"HAUS" appears twice/);
  assert.match(err(['Haus', 'R2D2'])[0], /Word 2: Word "R2D2" contains invalid characters/);
  assert.match(err(['Haus', 'Maus'], { difficulty: 'expert' })[0], /Unknown difficulty "expert" – use "easy", "medium" or "hard"/);
  assert.match(err(['Haus', 'Maus'], { size: 30 })[0], /size must be a whole number between 5 and 20/);
  assert.match(err(['Schmetterling', 'Maus'], { size: 10 })[0], /"SCHMETTERLING" has 13 letters but the grid is only 10 wide/);
  const w = gen.wordSearch(['Affe', 'Giraffe'], { seed: 1 }).warnings;
  assert.match(w[0], /"AFFE" is also part of "GIRAFFE"/);
});

// ---------------------------------------------------------------------------
// Cloze, gaps and word bank
// ---------------------------------------------------------------------------

test('cloze parses [[answer]] gaps', () => {
  const r = gen.cloze('Der [[Hund]] bellt, die [[ Katze ]] miaut im [[grünen Garten]].');
  assert.deepEqual(r.answers, ['Hund', 'Katze', 'grünen Garten']);
  assert.equal(r.gapCount, 3);
  assert.deepEqual(r.parts, [
    { type: 'text', text: 'Der ' },
    { type: 'gap', answer: 'Hund', index: 0 },
    { type: 'text', text: ' bellt, die ' },
    { type: 'gap', answer: 'Katze', index: 1 },
    { type: 'text', text: ' miaut im ' },
    { type: 'gap', answer: 'grünen Garten', index: 2 },
    { type: 'text', text: '.' }
  ]);
});

test('cloze edge cases', () => {
  const texts = (s) => gen.cloze(s).parts.map((p) => (p.type === 'gap' ? `<${p.answer}>` : p.text)).join('|');
  assert.deepEqual(gen.cloze(''), { parts: [], answers: [], gapCount: 0 });
  assert.deepEqual(gen.cloze(undefined), { parts: [], answers: [], gapCount: 0 });
  assert.equal(texts('Kein Lückentext.'), 'Kein Lückentext.');
  assert.equal(texts('[[A]][[B]]'), '<A>|<B>');
  assert.equal(texts('offen [[Hund und so'), 'offen [[Hund und so');
  assert.equal(texts('[[a [[b]] c'), '[[a |<b>| c');
  assert.equal(texts('leer [[]] und [[  ]] hier'), 'leer [[]] und [[  ]] hier');
  assert.equal(texts('a]] b [[c]]'), 'a]] b |<c>');
  assert.equal(texts('[[[x]]]'), '[|<x>|]');
  assert.equal(texts('[[zwei\nZeilen]] und [[ok]]'), '[[zwei\nZeilen]] und |<ok>');
  assert.equal(texts('Ende [[x]]'), 'Ende |<x>');
  assert.equal(gen.cloze('[[1]] [[2]] [[3]]').parts.filter((p) => p.type === 'gap').map((p) => p.index).join(), '0,1,2');
});

test('gapString', () => {
  assert.equal(gen.gapString('Hund'), '________'); // min 8
  assert.equal(gen.gapString('Hund', { min: 3 }), '______'); // round(4 × 1.6) = 6
  assert.equal(gen.gapString('Schmetterling').length, 21); // round(13 × 1.6) = 20.8 → 21
  assert.equal(gen.gapString('x'.repeat(40)).length, 30); // capped
  assert.equal(gen.gapString('a', { min: 50 }).length, 30);
  assert.equal(gen.gapString('').length, 8);
  assert.match(gen.gapString('grünen Garten'), /^_+$/);
});

test('wordBank sorts in German dictionary order', () => {
  assert.deepEqual(gen.wordBank(['Zebra', 'Äpfel', 'apfel', 'Ofen', 'Öl', 'Uhr', 'über', 'Bär', 'Bar', 'Straße', 'Strasse', 'Stroh']),
    ['apfel', 'Äpfel', 'Bar', 'Bär', 'Ofen', 'Öl', 'Strasse', 'Straße', 'Stroh', 'über', 'Uhr', 'Zebra']);
  assert.deepEqual(gen.wordBank(['b', 'B', 'a', 'A']), ['A', 'a', 'B', 'b']);
  assert.deepEqual(gen.wordBank(['Hund', 'Katze', 'Hund', 'hund']), ['Hund', 'hund', 'Katze']);
  assert.deepEqual(gen.wordBank(['Hund', 'Katze', 'Hund'], { unique: false }), ['Hund', 'Hund', 'Katze']);
  assert.deepEqual(gen.wordBank([' Hund ', '', null, 'Maus']), ['Hund', 'Maus']);
  const shuffled = gen.wordBank(['eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs'], { order: 'shuffle', seed: 5 });
  assert.deepEqual([...shuffled].sort(), ['drei', 'eins', 'fünf', 'sechs', 'vier', 'zwei']);
  assert.deepEqual(gen.wordBank(['eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs'], { order: 'shuffle', seed: 5 }), shuffled);
  assert.throws(() => gen.wordBank(['a'], { order: 'random' }), /order must be "alpha" or "shuffle"/);
  assert.throws(() => gen.wordBank('a'), /expects an array/);
});

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

test('matching shuffles the right column with a correct key', () => {
  const pairs = [
    { left: 'Hund', right: 'dog' },
    { left: 'Katze', right: 'cat' },
    { left: 'Maus', right: 'mouse' },
    { left: 'Pferd', right: 'horse' },
    { left: 'Vogel', right: 'bird' }
  ];
  for (let seed = 0; seed < 30; seed++) {
    const m = gen.matching(pairs, { seed });
    assert.deepEqual(m.left, pairs.map((p) => p.left));
    assert.deepEqual([...m.right].sort(), pairs.map((p) => p.right).sort());
    assert.deepEqual(m.letters, ['A', 'B', 'C', 'D', 'E']);
    m.key.forEach((j, i) => {
      assert.equal(m.right[j], pairs[i].right);
      assert.notEqual(j, i, 'no partner stays on its row');
    });
  }
  assert.deepEqual(gen.matching(pairs, { seed: 1 }), gen.matching(pairs, { seed: 1 }));
  const two = gen.matching(pairs.slice(0, 2));
  assert.deepEqual([two.right, two.key], [['cat', 'dog'], [1, 0]]);
  assert.throws(() => gen.matching(pairs.slice(0, 1)), /needs 2–12 pairs, got 1/);
  assert.throws(() => gen.matching(Array.from({ length: 13 }, () => pairs[0])), /got 13/);
  assert.throws(() => gen.matching([{ left: 'a', right: '' }, { left: 'b', right: 'c' }]), /Pair 1: left and right must be non-empty/);
  assert.throws(() => gen.matching(null), /expects an array/);
});

// ---------------------------------------------------------------------------
// wrapLines
// ---------------------------------------------------------------------------

test('wrapLines wraps greedily, keeps empty lines and splits long words', () => {
  assert.deepEqual(gen.wrapLines('Es war einmal ein kleines Mädchen.', 12), ['Es war', 'einmal ein', 'kleines', 'Mädchen.']);
  assert.deepEqual(gen.wrapLines('eins zwei\n\ndrei', 20), ['eins zwei', '', 'drei']);
  assert.deepEqual(gen.wrapLines('a\r\nb\rc', 5), ['a', 'b', 'c']);
  assert.deepEqual(gen.wrapLines('Donaudampfschiff fährt', 6), ['Donaud', 'ampfsc', 'hiff', 'fährt']);
  assert.deepEqual(gen.wrapLines('ab abcdefgh', 4), ['ab', 'abcd', 'efgh']);
  assert.deepEqual(gen.wrapLines('  viel   Platz  ', 20), ['viel Platz']);
  assert.deepEqual(gen.wrapLines('genau zehn', 10), ['genau zehn']);
  assert.deepEqual(gen.wrapLines('', 10), ['']);
  assert.deepEqual(gen.wrapLines('x\n', 10), ['x', '']);
  assert.deepEqual(gen.wrapLines('10\u00a0km weit', 5), ['10\u00a0km', 'weit']);
  assert.throws(() => gen.wrapLines('x', 0), /maxChars must be a whole number/);
});

// ---------------------------------------------------------------------------
// gradeKey
// ---------------------------------------------------------------------------

const ranges = (key) => key.map((g) => [g.grade, g.min, g.max]);

test('gradeKey for 30 and 47 points', () => {
  assert.deepEqual(ranges(gen.gradeKey(30)), [[1, 26.5, 30], [2, 22.5, 26], [3, 19, 22], [4, 15, 18.5], [5, 7.5, 14.5], [6, 0, 7]]);
  assert.deepEqual(ranges(gen.gradeKey(30, { step: 1 })), [[1, 27, 30], [2, 23, 26], [3, 19, 22], [4, 15, 18], [5, 8, 14], [6, 0, 7]]);
  assert.deepEqual(ranges(gen.gradeKey(47, { step: 0.5 })),
    [[1, 41.5, 47], [2, 35.5, 41], [3, 29.5, 35], [4, 23.5, 29], [5, 12, 23], [6, 0, 11.5]]);
  assert.deepEqual(ranges(gen.gradeKey(47, { step: 1 })), [[1, 42, 47], [2, 36, 41], [3, 30, 35], [4, 24, 29], [5, 12, 23], [6, 0, 11]]);
  assert.deepEqual(gen.gradeKey(30).map((g) => g.label), ['sehr gut', 'gut', 'befriedigend', 'ausreichend', 'mangelhaft', 'ungenügend']);
  assert.deepEqual(ranges(gen.gradeKey(20, { thresholds: [85, 70, 55, 40, 20], step: 1 })),
    [[1, 17, 20], [2, 14, 16], [3, 11, 13], [4, 8, 10], [5, 4, 7], [6, 0, 3]]);
});

test('gradeKey ranges are contiguous and never negative', () => {
  for (const step of [0.5, 1]) {
    for (let total = 6; total <= 120; total++) {
      const key = gen.gradeKey(total, { step });
      assert.equal(key[0].max, total);
      assert.equal(key[5].min, 0);
      key.forEach((g, i) => {
        assert.ok(g.min >= 0 && g.min <= g.max, `${total}/${step}: grade ${g.grade}`);
        if (i > 0) assert.equal(g.max, key[i - 1].min - step);
        assert.equal(Math.round(g.min / step) * step, g.min);
      });
    }
  }
});

test('gradeKey rejects invalid input', () => {
  assert.throws(() => gen.gradeKey(0), /totalPoints must be a number between 1 and 1000, got 0/);
  assert.throws(() => gen.gradeKey(1001), /between 1 and 1000/);
  assert.throws(() => gen.gradeKey('30'), /between 1 and 1000, got "30"/);
  assert.throws(() => gen.gradeKey(30, { step: 0.25 }), /step must be 0.5 or 1/);
  assert.throws(() => gen.gradeKey(30, { thresholds: [90, 80, 70, 60] }), /array of 5 percentages/);
  assert.throws(() => gen.gradeKey(30, { thresholds: [90, 80, 80, 60, 30] }), /strictly decreasing/);
  assert.throws(() => gen.gradeKey(30, { thresholds: [120, 80, 70, 60, 30] }), /grade 1 must be a percentage/);
  assert.throws(() => gen.gradeKey(30, { thresholds: [90, 80, 70, 60, 0] }), /grade 5 must be a percentage above 0/);
  assert.throws(() => gen.gradeKey(4, { step: 1 }), /with 4 points grade 3 would get no points \(step 1\) – use more total points, step 0.5/);
});
