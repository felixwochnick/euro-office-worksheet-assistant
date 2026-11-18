'use strict';
// Unit tests for ABC normalisation, validation and builders.
const test = require('node:test');
const assert = require('node:assert/strict');
const abc = require('../shared/abc-tools.js');

const GOOD = 'X:1\nT:Test\nM:4/4\nL:1/4\nK:C clef=treble\nC F G2 |]';

function codes(result) {
  return result.errors.map((e) => e.code);
}

test('accepts a complete, valid tune', () => {
  const r = abc.validateAbc(GOOD);
  assert.equal(r.valid, true, abc.formatValidationErrors(r));
  assert.equal(r.clef, 'treble');
  assert.equal(r.headers.M, '4/4');
  assert.deepEqual(r.warnings, []);
});

test('accepts bass clef, key with mode, decorations, chords and lyrics', () => {
  const r = abc.validateAbc('X:1\nM:3/4\nL:1/8\nK:Am clef=bass\n"Am"A,2 !fermata!c2 [CEG]2 | (3cde .f2 z2 |]\nw: la la la');
  assert.equal(r.valid, true, abc.formatValidationErrors(r));
  assert.equal(r.clef, 'bass');
});

test('normalizes code fences, CRLF, curly quotes and missing X:', () => {
  const n = abc.normalizeAbc('Hier ist die Melodie:\r\n```abc\r\nM:4/4\r\nL:1/4\r\nK:C clef=treble\r\nc’ d e f|]\r\n```');
  assert.equal(n, "X:1\nM:4/4\nL:1/4\nK:C clef=treble\nc' d e f|]");
  assert.equal(abc.validateAbc(n).valid, true);
});

test('normalizes literal \\n sequences', () => {
  const r = abc.validateAbc('X:1\\nM:4/4\\nL:1/4\\nK:C clef=treble\\nCDEF|]');
  assert.equal(r.valid, true, abc.formatValidationErrors(r));
});

test('reports missing header fields', () => {
  const r = abc.validateAbc('X:1\nK:C clef=treble\nCDE');
  assert.deepEqual(codes(r).sort(), ['missing_l', 'missing_m']);
});

test('requires K: to be the last header line', () => {
  const r = abc.validateAbc('X:1\nM:4/4\nL:1/4\nCDE\nK:C');
  assert.ok(codes(r).includes('k_not_last'));
});

test('rejects German note names in the body', () => {
  assert.ok(codes(abc.validateAbc('X:1\nM:4/4\nL:1/4\nK:C clef=treble\nc d e h')).includes('german_h'));
  assert.ok(codes(abc.validateAbc('X:1\nM:4/4\nL:1/4\nK:C clef=treble\nc fis g')).includes('german_accidental'));
  assert.ok(codes(abc.validateAbc('X:1\nM:4/4\nL:1/4\nK:C clef=treble\nc f# g')).includes('german_accidental'));
});

test('rejects a German key "H"', () => {
  assert.ok(codes(abc.validateAbc('X:1\nM:4/4\nL:1/4\nK:H clef=treble\nB')).includes('bad_key'));
});

test('clef handling', () => {
  const noClef = abc.validateAbc('X:1\nM:4/4\nL:1/4\nK:C\nCDE');
  assert.equal(noClef.valid, true);
  assert.equal(noClef.warnings[0].code, 'missing_clef');
  assert.ok(codes(abc.validateAbc('X:1\nM:4/4\nL:1/4\nK:C\nCDE', { requireClef: true })).includes('missing_clef'));
  assert.ok(codes(abc.validateAbc('X:1\nM:4/4\nL:1/4\nK:C clef=alto\nCDE')).includes('bad_clef'));
});

test('rejects invalid meter and unit length', () => {
  assert.ok(codes(abc.validateAbc('X:1\nM:4\nL:1/4\nK:C\nC')).includes('bad_meter'));
  assert.ok(codes(abc.validateAbc('X:1\nM:4/4\nL:1/3\nK:C\nC')).includes('bad_length'));
});

test('rejects multiple tunes, empty bodies and unbalanced brackets', () => {
  assert.ok(codes(abc.validateAbc(GOOD + '\n\nX:2\nM:4/4\nL:1/4\nK:C\nC')).includes('multiple_tunes'));
  assert.ok(codes(abc.validateAbc('X:1\nM:4/4\nL:1/4\nK:C')).includes('no_music'));
  assert.ok(codes(abc.validateAbc('X:1\nM:4/4\nL:1/4\nK:C\n[CEG')).includes('unbalanced_brackets'));
  assert.ok(codes(abc.validateAbc('X:1\nM:4/4\nL:1/4\nK:C\n"Am C')).includes('unbalanced_quotes'));
  assert.equal(abc.validateAbc('').valid, false);
  assert.equal(abc.validateAbc(null).valid, false);
  assert.equal(abc.validateAbc('X:1\nM:4/4\nL:1/4\nK:C\n' + 'C'.repeat(abc.MAX_ABC_LENGTH)).valid, false);
});

test('buildAbc produces a valid tune', () => {
  const tune = abc.buildAbc({ notes: abc.germanToAbc('c f g').abc, clef: 'treble', meter: '3/4', title: 'Aufgabe 2' });
  assert.equal(tune, 'X:1\nT:Aufgabe 2\nM:3/4\nL:1/4\nK:C clef=treble\nC F G');
  assert.equal(abc.validateAbc(tune, { requireClef: true }).valid, true);
});

test('emptyStavesAbc produces valid invisible staves', () => {
  const t = abc.emptyStavesAbc({ clef: 'bass', count: 2 });
  assert.equal(t, 'X:1\nM:none\nL:1/4\nK:C clef=bass\nx4 | x4 | x4 | x4 |\nx4 | x4 | x4 | x4 |]');
  const r = abc.validateAbc(t, { requireClef: true });
  assert.equal(r.valid, true, abc.formatValidationErrors(r));
  assert.equal(r.clef, 'bass');
  const noBars = abc.emptyStavesAbc({ count: 1, measures: 0 });
  assert.equal(abc.validateAbc(noBars).valid, true);
  assert.ok(!/[A-Ga-g]/.test(noBars.split('\n').slice(4).join('')), 'no visible notes');
  // count is clamped to 1..12
  assert.equal(abc.emptyStavesAbc({ count: 99 }).split('\n').length, 4 + 12);
});

test('looksLikeAbc detects alt texts created by the plugin', () => {
  assert.equal(abc.looksLikeAbc(GOOD), true);
  assert.equal(abc.looksLikeAbc('Ein Bild'), false);
  assert.equal(abc.looksLikeAbc(null), false);
});
