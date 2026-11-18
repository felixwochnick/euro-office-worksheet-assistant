'use strict';
// Unit tests for the German note name conversion (node:test, no dependencies).
const test = require('node:test');
const assert = require('node:assert/strict');
const abc = require('../shared/abc-tools.js');

function note(token, opts) {
  const r = abc.parseGermanNote(token, opts);
  assert.ok(r.ok, `expected "${token}" to parse, got: ${r.error}`);
  return r.abc;
}

test('natural notes in Helmholtz octaves', () => {
  assert.equal(note("c'"), 'C');     // middle C = C4
  assert.equal(note("d'"), 'D');
  assert.equal(note("c''"), 'c');    // C5
  assert.equal(note("c'''"), "c'");  // C6
  assert.equal(note('c'), 'C,');     // small octave C3 (strict default)
  assert.equal(note('C'), 'C,,');    // great octave C2
  assert.equal(note('C,'), 'C,,,');  // contra octave C1
});

test('numeric and superscript octave marks', () => {
  assert.equal(note('c1'), 'C');
  assert.equal(note('c2'), 'c');
  assert.equal(note('g¹'), 'G');
  assert.equal(note('a²'), 'a');
  assert.equal(note('C1'), 'C,,,');
  assert.equal(note('C₁'), 'C,,,');
});

test('German h and b', () => {
  assert.equal(note("h'"), 'B');      // H = B
  assert.equal(note("b'"), '_B');     // B = B flat
  assert.equal(note("heses'"), '__B');
  assert.equal(note("his'"), '^B');
  assert.equal(note('H'), 'B,,');
  assert.equal(note('B'), '_B,,');
});

test('is / es suffixes including contracted forms', () => {
  assert.equal(note("fis'"), '^F');
  assert.equal(note("cis''"), '^c');
  assert.equal(note("gisis'"), '^^G');
  assert.equal(note("des'"), '_D');
  assert.equal(note("es'"), '_E');    // e + es = es
  assert.equal(note("as'"), '_A');    // a + es = as
  assert.equal(note("eses'"), '__E');
  assert.equal(note("ases'"), '__A');
  assert.equal(note("ces''"), '_c');
  assert.equal(note('Es'), '_E,,');
});

test('symbol accidentals and typographic apostrophes', () => {
  assert.equal(note("f#'"), '^F');
  assert.equal(note('f♯’'), '^F');
  assert.equal(note("eb'"), '_E');
});

test('rests and lengths', () => {
  assert.equal(note('p'), 'z');
  assert.equal(note('pause:2'), 'z2');
  assert.equal(note("c':2"), 'C2');
  assert.equal(note("g':/2"), 'G/2');
});

test('invalid names are rejected', () => {
  for (const bad of ['x', 'i', "c'x", 'bb', 'his,', 'fis,,', '']) {
    assert.equal(abc.parseGermanNote(bad).ok, false, `"${bad}" should be rejected`);
  }
});

test('germanToAbc: bare names use clef-dependent octave', () => {
  assert.equal(abc.germanToAbc('c – f – g', { clef: 'treble' }).abc, 'C F G');
  assert.equal(abc.germanToAbc('c – f – g', { clef: 'bass' }).abc, 'C, F, G,');
  assert.equal(abc.germanToAbc('c, f, g').abc, 'C F G');           // list commas
  assert.equal(abc.germanToAbc('c-f-g').abc, 'C F G');
  assert.equal(abc.germanToAbc('c und h').abc, 'C B');
});

test('germanToAbc: explicit octaves and bar lines', () => {
  const r = abc.germanToAbc("c' d' e' f' | g'' h | c'' |]");
  assert.equal(r.ok, true);
  assert.equal(r.abc, 'C D E F | g B | c |]');
  assert.equal(r.notes.length, 7);
});

test('germanToAbc: reports unknown tokens', () => {
  const r = abc.germanToAbc('c x g');
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].token, 'x');
  assert.equal(r.abc, 'C G');
});

test('explicit naturals on request', () => {
  assert.equal(abc.germanToAbc("f' fis'", { explicitNatural: true }).abc, '=F ^F');
});

test('germanToAbc: commas after upper-case notes are octave marks', () => {
  assert.equal(abc.germanToAbc('G, A, H, | C D').abc, 'G,,, A,,, B,,, | C,, D,,');
  assert.equal(abc.germanToAbc('C,, D,,').abc, 'C,,,, D,,,,');
  assert.equal(abc.germanToAbc("c, f, g'").abc, 'C F G');
});

test('accidentals written in front of the note', () => {
  assert.equal(note('bc1'), '_C');       // ♭c' = ces'
  assert.equal(note('be2'), '_e');       // ♭e'' = es''
  assert.equal(note('#f1'), '^F');
  assert.equal(note('♯g1'), '^G');
  assert.equal(note('♭a1'), '_A');
  assert.equal(note('bbe1'), '__E');
  assert.equal(note('bh1'), '_B');       // ♭h' = b'
  assert.equal(abc.parseGermanNote('bes1').ok, false); // flat twice
  assert.equal(abc.parseGermanNote('bb1').ok, false);  // ambiguous
});

test('digits as note values (duration mode)', () => {
  const d = (t) => note(t, { digits: 'duration', bareOctave: 4 });
  assert.equal(d('c1'), 'C');            // value is applied by germanToAbc
  assert.equal(abc.parseGermanNote('g2', { digits: 'duration', bareOctave: 4 }).duration, 0.5);
  assert.equal(abc.parseGermanNote("c'4.", { digits: 'duration' }).duration, 0.375);
  assert.equal(abc.parseGermanNote('c3', { digits: 'duration' }).ok, false);
  assert.equal(abc.germanToAbc("c'4 d'8 e'8 f'2 g'1", { digits: 'duration' }).abc, 'C D/2 E/2 F2 G4');
  assert.equal(abc.germanToAbc("c'2 d' e'4 f'", { digits: 'duration' }).abc, 'C2 D2 E F'); // value carries over
  assert.equal(abc.germanToAbc('p2 c4 p4', { digits: 'duration' }).abc, 'z2 C z');
});

test('time signature and automatic bar lines', () => {
  const r = abc.germanToAbc('4/4 c d e f g a h c2');
  assert.equal(r.meter, '4/4');
  assert.equal(r.digits, 'octave');
  assert.equal(r.abc, 'C D E F | G A B c |');
  assert.equal(r.tune, 'X:1\nM:4/4\nL:1/4\nK:C clef=treble\nC D E F | G A B c |]');
  assert.equal(abc.validateAbc(r.tune, { requireClef: true }).valid, true);
  assert.equal(abc.germanToAbc('3/4-Takt: c e g | c2').abc, 'C E G | c', 'explicit bars: no auto bars');
  const incomplete = abc.germanToAbc('3/4 c d e f');
  assert.equal(incomplete.warnings[0].code, 'incomplete_bar');
});

test('auto mode decides between octave marks and note values', () => {
  // The user example: 4/4, values 1 and 2 fill exactly 5 bars -> note values.
  const r = abc.germanToAbc('4/4 bc1, f1, g2, be2, c1, C');
  assert.equal(r.digits, 'duration');
  assert.equal(r.abc, '_C4 | F4 | G2 _E2 | C4 | C,,4 |');
  assert.equal(r.errors.length, 0);
  assert.deepEqual(r.warnings.map((w) => [w.code, w.token]), [['far_from_staff', 'C']]);
  assert.equal(abc.validateAbc(r.tune, { requireClef: true }).valid, true);
  // Same input, octave marks forced.
  assert.equal(abc.germanToAbc('4/4 bc1, f1, g2, be2, c1, C', { digits: 'octave' }).abc, '_C F g _e | C C,,');
  // Only "1" digits (c1 = c'), no meter, or values that do not fill bars -> octave marks.
  assert.equal(abc.germanToAbc('4/4 c1 d1 e1 f1').digits, 'octave');
  assert.equal(abc.germanToAbc('c1 e1 g1 c2').digits, 'octave');
  assert.equal(abc.germanToAbc('4/4 c1 e1 g1 c2').digits, 'octave');
  // 4, 8, 16 or apostrophes + digits can only be note values.
  assert.equal(abc.germanToAbc('g4 g4 a2').digits, 'duration');
  assert.equal(abc.germanToAbc("c'2 g'2").digits, 'duration');
});

test('naturals are added when an accidental is still active in the bar', () => {
  assert.equal(abc.germanToAbc('bc1 c1 fis1 f1 | f1').abc, '_C =C ^F =F | F');
  assert.equal(abc.germanToAbc('4/4 bc4 c4 d4 e4 c4').abc, '_C =C D E | C');
});

test('far-from-staff warnings', () => {
  assert.equal(abc.germanToAbc("c' d' e'").warnings.length, 0);
  assert.equal(abc.germanToAbc('C D E', { clef: 'bass' }).warnings.length, 0);
  assert.equal(abc.germanToAbc('C').warnings[0].octave, 'großen Oktave');
});
