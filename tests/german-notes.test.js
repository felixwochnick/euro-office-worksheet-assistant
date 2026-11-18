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
