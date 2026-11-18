'use strict';
// Unit tests for lyrics (w: lines) and line breaking.
const test = require('node:test');
const assert = require('node:assert/strict');
const abc = require('../shared/abc-tools.js');

const ENTCHEN = 'X:1\nT:Alle meine Entchen\nM:4/4\nL:1/4\nK:C clef=treble\n' +
  'C D E F | G2 G2 | A A A A | G4 | A A A A | G4 |\nF F F F | E2 E2 | D D D D | C4 |]';
const TEXT = "Al-le mei-ne Ent-chen schwim-men auf dem See, schwim-men auf dem See, Köpf-chen in das Was-ser, Schwänz-chen in die Höh'.";

test('lyric slots follow the ABC 2.1 rules', () => {
  const s = (t) => abc.lyricSlots(t).slots.map((x) => x.text);
  assert.deepEqual(s('Al-le mei-ne'), ['Al', 'le', 'mei', 'ne']);
  assert.deepEqual(s('Ent-chen_ auf'), ['Ent', 'chen', '_', 'auf']);
  assert.deepEqual(s('a * b'), ['a', '*', 'b']);
  assert.deepEqual(s('a~b c'), ['a~b', 'c']);
  assert.deepEqual(s('a - b'), ['a', '-', 'b']);           // "-" after a space is a syllable
  assert.deepEqual(s('Ent\\-chen'), ['Ent\\-chen']);        // literal hyphen on one note
  assert.equal(abc.lyricSlots('a | b').hasBarAdvance, true);
});

test('notes that receive lyrics', () => {
  assert.equal(abc.countLyricNotes('C D z E | [CEG]2 {g}A x B |]'), 6); // rests, spacers, grace notes skipped; chord = 1
  assert.equal(abc.countLyricNotes('"Am"A !fermata!B "^Text"c'), 3);
});

test('addLyrics distributes syllables over the music lines', () => {
  const r = abc.addLyrics(ENTCHEN, TEXT);
  assert.equal(r.ok, true);
  assert.equal(r.syllables, 27);
  assert.equal(r.notes, 27);
  assert.deepEqual(r.lines, [{ notes: 16, syllables: 16 }, { notes: 11, syllables: 11 }]);
  assert.match(r.abc, /G4 \|\nw: Al-le mei-ne Ent-chen schwim-men auf dem See, schwim-men auf dem See,\nF F F F/);
  assert.match(r.abc, /C4 \|\]\nw: Köpf-chen in das Was-ser, Schwänz-chen in die Höh'\.$/);
  assert.deepEqual(abc.validateAbc(r.abc).warnings, []);
});

test('addLyrics: words split across lines keep their hyphen, missing text is padded with *', () => {
  const tune = 'X:1\nM:4/4\nL:1/4\nK:C clef=treble\nC D E |\nF G A |]';
  const r = abc.addLyrics(tune, 'Hän-schen kle-in ging');
  assert.equal(r.abc, 'X:1\nM:4/4\nL:1/4\nK:C clef=treble\nC D E |\nw: Hän-schen kle-\nF G A |]\nw: in ging *');
  assert.equal(r.warnings[0].code, 'too_few_syllables');
  assert.deepEqual(abc.validateAbc(r.abc).warnings, []);
});

test('addLyrics: replace vs. additional verse, errors', () => {
  const first = abc.addLyrics(ENTCHEN, TEXT).abc;
  const replaced = abc.addLyrics(first, 'La la la');
  assert.equal((replaced.abc.match(/^w:/gm) || []).length, 1);
  const verse = abc.addLyrics(first, 'Zwei-te Stro-phe', { mode: 'verse' });
  assert.match(verse.abc, /w: Al-le[^\n]*\nw: Zwei-te Stro-phe \*/);
  assert.equal(abc.addLyrics(ENTCHEN, 'x '.repeat(30)).errors[0].code, 'too_many_syllables');
  assert.equal(abc.addLyrics(ENTCHEN, '  ').errors[0].code, 'no_text');
  assert.equal(abc.addLyrics('X:1\nM:none\nL:1/4\nK:C\nz z |]', 'a').errors[0].code, 'no_notes');
});

test('validateAbc warns about lyrics that do not fit their music line', () => {
  const r = abc.validateAbc('X:1\nM:4/4\nL:1/4\nK:C clef=treble\nC D E F |]\nw: Al-le mei');
  assert.equal(r.valid, true);
  assert.deepEqual(r.warnings.map((w) => [w.code, w.syllables, w.notes]), [['lyrics_mismatch', 3, 4]]);
  // "|" in the lyrics (bar advance) is not counted
  assert.deepEqual(abc.validateAbc('X:1\nM:4/4\nL:1/4\nK:C clef=treble\nC D E F |]\nw: Al | mei').warnings, []);
});

test('splitMeasures and reflowAbc break lines evenly and move the syllables along', () => {
  assert.deepEqual(abc.splitMeasures('C D |: E F :| [1 G A | "Am|x"B c |]').map((m) => m.notes), [2, 2, 2, 2]);
  const withText = abc.addLyrics(ENTCHEN, TEXT).abc;
  assert.equal(abc.maxMeasuresPerLine(withText), 6);
  const r = abc.reflowAbc(withText, 4);
  assert.equal(r.split('\n').slice(5).join('\n'),
    'C D E F | G2 G2 | A A A A |\nw: Al-le mei-ne Ent-chen schwim-men auf dem\n' +
    'G4 | A A A A | G4 |\nw: See, schwim-men auf dem See,\n' +
    'F F F F | E2 E2 | D D D D | C4 |]\nw: Köpf-chen in das Was-ser, Schwänz-chen in die Höh\'.');
  assert.deepEqual(abc.validateAbc(r).warnings, []);
  assert.equal(abc.reflowAbc(ENTCHEN, 10), ENTCHEN, 'nothing to do');
});
