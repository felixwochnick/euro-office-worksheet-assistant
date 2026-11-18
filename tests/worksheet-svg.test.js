'use strict';
// Unit tests for the worksheet SVG generators (shared/worksheet-svg.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const ws = require('../shared/worksheet-svg.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Small strict XML well-formedness check: one root, balanced tags, quoted attributes, valid entities. */
function assertWellFormed(xml) {
  const stack = [];
  let roots = 0;
  let i = 0;
  const ENTITY = /^&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/;
  const checkText = (t, where) => {
    for (let k = 0; k < t.length; k++) {
      if (t[k] === '<') assert.fail(`raw "<" in ${where}`);
      if (t[k] === '&' && !ENTITY.test(t.slice(k))) assert.fail(`bad entity in ${where}: ${t.slice(k, k + 12)}`);
    }
  };
  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    if (lt < 0) {
      if (xml.slice(i).trim()) assert.fail('text after the root element');
      break;
    }
    const txt = xml.slice(i, lt);
    if (txt) {
      if (!stack.length && txt.trim()) assert.fail('text outside the root element');
      checkText(txt, 'text');
    }
    if (xml[lt + 1] === '/') {
      const m = /^<\/([A-Za-z_][\w:.-]*)>/.exec(xml.slice(lt));
      assert.ok(m, 'malformed closing tag at ' + lt);
      assert.equal(stack.pop(), m[1], 'unbalanced </' + m[1] + '>');
      i = lt + m[0].length;
      continue;
    }
    const m = /^<([A-Za-z_][\w:.-]*)((?:\s+[A-Za-z_][\w:.-]*="[^"]*")*)\s*(\/?)>/.exec(xml.slice(lt));
    assert.ok(m, 'malformed start tag at ' + lt + ': ' + xml.slice(lt, lt + 80));
    const names = [];
    m[2].replace(/([A-Za-z_][\w:.-]*)="([^"]*)"/g, (all, name, value) => {
      assert.ok(!names.includes(name), 'duplicate attribute ' + name);
      names.push(name);
      checkText(value, 'attribute ' + name);
    });
    if (!stack.length) roots++;
    if (!m[3]) stack.push(m[1]);
    i = lt + m[0].length;
  }
  assert.equal(stack.length, 0, 'unclosed elements: ' + stack.join(', '));
  assert.equal(roots, 1, 'exactly one root element');
}

const px = (mm) => String(Math.round(mm / 25.4 * 96 * 100) / 100);

/** Checks the common contract of every graphic function. */
function check(g, widthMm, heightMm) {
  assert.equal(typeof g.svg, 'string');
  assertWellFormed(g.svg);
  if (widthMm !== undefined) assert.equal(g.widthMm, widthMm);
  if (heightMm !== undefined) assert.equal(g.heightMm, heightMm);
  const root = /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="([\d.]+)" height="([\d.]+)" viewBox="0 0 ([\d.]+) ([\d.]+)">/.exec(g.svg);
  assert.ok(root, 'root element: ' + g.svg.slice(0, 120));
  assert.equal(root[1], px(g.widthMm));
  assert.equal(root[2], px(g.heightMm));
  assert.equal(Number(root[3]), g.widthMm);
  assert.equal(Number(root[4]), g.heightMm);
  assert.doesNotMatch(g.svg, /NaN|undefined|Infinity|null/);
  assert.doesNotMatch(g.svg.replace(/^<svg[^>]*>/, ''), /\d\.\d{4,}/, 'numbers are rounded to 3 decimals');
  assert.doesNotMatch(g.svg, /<rect[^>]*width="100%"/, 'no background rect');
  return g;
}

function throwsLike(fn, re) {
  assert.throws(fn, (e) => e instanceof Error && re.test(e.message));
}

const XSS = '<script>alert("x")</script>';
const assertEscaped = (svg) => {
  assert.doesNotMatch(svg, /<script/);
  assert.match(svg, /&lt;script&gt;/);
};

// ---------------------------------------------------------------------------
// Basics
// ---------------------------------------------------------------------------

test('escapeXml escapes markup and drops invalid control characters', () => {
  assert.equal(ws.escapeXml('<a href="x">Tom & Jerry\'s</a>'), '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;');
  assert.equal(ws.escapeXml('a\u0001b\u000bc'), 'abc');
  assert.equal(ws.escapeXml(null), '');
  assert.equal(ws.escapeXml(12), '12');
  assert.match(ws.DEFAULT_FONT, /Open Sans/);
});

test('icons: all required names exist and render as square line icons', () => {
  const required = ['single', 'partner', 'group', 'class', 'read', 'write', 'listen', 'speak', 'draw', 'calculate',
    'research', 'cut', 'glue', 'experiment', 'computer', 'music', 'info', 'rule', 'tip', 'warning', 'example',
    'solution', 'definition', 'question', 'star', 'star_outline', 'clock', 'check', 'smiley_good', 'smiley_neutral',
    'smiley_bad'];
  for (const name of required) assert.ok(ws.ICON_NAMES.includes(name), 'missing icon ' + name);
  for (const name of ws.ICON_NAMES) {
    const g = check(ws.icon(name), 8, 8);
    assert.match(g.svg, /stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/);
    assert.match(g.svg, /#1f2937/);
  }
  const big = check(ws.icon('tip', { sizeMm: 10, color: '#2563EB' }), 10, 10);
  assert.match(big.svg, /scale\(0\.417\)/);
  assert.match(big.svg, /#2563eb/);
  assert.match(ws.icon('tip', { color: 'red' }).svg, /#1f2937/, 'invalid colour falls back to the default');
  throwsLike(() => ws.icon('unicorn'), /^icon: unknown icon "unicorn"\. Available: single, /);
  throwsLike(() => ws.icon('info', { sizeMm: 500 }), /^icon: "sizeMm" must be between 3 and 100/);
});

test('taskBadge: circle for 1–2 characters, pill for 3, bold centred label', () => {
  const one = check(ws.taskBadge('1'), 8, 8);
  assert.match(one.svg, /<circle cx="4" cy="4" r="4" fill="#2563eb"\/>/);
  assert.match(one.svg, /font-weight="700" text-anchor="middle" fill="#ffffff">1<\/text>/);
  check(ws.taskBadge(12), 8, 8);
  const three = check(ws.taskBadge('12b'));
  assert.ok(three.widthMm > 8, 'three characters make the badge wider');
  assert.match(three.svg, /<rect [^>]*rx="4"/);
  const sq = check(ws.taskBadge('4', { shape: 'square', fill: '#111111', color: '#ffff00', sizeMm: 10 }), 10, 10);
  assert.match(sq.svg, /<rect x="0" y="0" width="10" height="10" fill="#111111"\/>/);
  assert.match(sq.svg, /fill="#ffff00">4</);
  assert.match(check(ws.taskBadge('3', { shape: 'rounded' })).svg, /rx="1\.92"/);
  assert.match(ws.taskBadge('<a').svg, />&lt;a<\/text>/);
  throwsLike(() => ws.taskBadge(''), /^taskBadge: label must be/);
  throwsLike(() => ws.taskBadge('1234'), /1–3 characters/);
  throwsLike(() => ws.taskBadge('1', { shape: 'star' }), /"shape" must be circle, rounded or square/);
});

test('stars: filled and outlined stars', () => {
  const g = check(ws.stars(2));
  assert.equal(g.heightMm, 4);
  assert.equal(g.widthMm, 13.76);
  assert.equal((g.svg.match(/<path /g) || []).length, 3);
  assert.equal((g.svg.match(/fill="none"/g) || []).length, 1);
  assert.equal((check(ws.stars(0, { max: 5 })).svg.match(/fill="none"/g) || []).length, 5);
  throwsLike(() => ws.stars(4), /^stars: level must be a whole number from 0 to 3/);
  throwsLike(() => ws.stars(1.5), /whole number/);
});

test('lineature: Lineatur 1–4, lines and grids', () => {
  const s1 = check(ws.lineature({ kind: 'school1', rows: 2, widthMm: 120 }), 120, 35.6);
  assert.equal((s1.svg.match(/<rect /g) || []).length, 2, 'tinted x-height band per system');
  assert.equal((s1.svg.match(/<line /g) || []).length, 8, 'four lines per system');
  check(ws.lineature({ kind: 'school2', rows: 3 }), 160, 3 * 12 + 2 * 4 + 0.6);
  check(ws.lineature({ kind: 'school3' }));
  assert.match(check(ws.lineature({ kind: 'school4', rows: 2 }), 160, 20).svg, /stroke-dasharray/);
  check(ws.lineature({ kind: 'lines', rows: 4, spacingMm: 8 }), 160, 32);
  const g5 = check(ws.lineature({ kind: 'grid5', rows: 4, widthMm: 101 }), 101, 20.6);
  assert.match(g5.svg, /M0\.5 0\.3V20\.3/, 'whole squares, centred');
  check(ws.lineature({ kind: 'grid10', rows: 2 }));
  assert.match(ws.lineature().svg, /<line /, 'defaults to plain lines');
  throwsLike(() => ws.lineature({ kind: 'school5' }), /^lineature: "kind" must be one of school1, school2/);
  throwsLike(() => ws.lineature({ rows: 0 }), /"rows" must be between 1 and 40/);
});

// ---------------------------------------------------------------------------
// Maths
// ---------------------------------------------------------------------------

test('numberLine: ticks, labels with decimal comma, minus sign, marks and blanks', () => {
  const dec = check(ws.numberLine({ from: 0, to: 1, step: 0.1, widthMm: 140 }));
  assert.equal(dec.widthMm, 140);
  for (const l of ['0,0', '0,1', '0,3', '0,7', '1,0']) assert.match(dec.svg, new RegExp('>' + l + '</text>'));
  assert.doesNotMatch(dec.svg, /0,30000/);
  const neg = check(ws.numberLine({ from: -4, to: 4, marks: [{ value: -2, label: 'A' }, 3], blanks: [1] }));
  assert.match(neg.svg, />−4<\/text>/);
  assert.match(neg.svg, />A<\/text>/);
  assert.equal((neg.svg.match(/<circle /g) || []).length, 2);
  assert.equal((neg.svg.match(/<rect /g) || []).length, 1, 'one box to fill in');
  assert.doesNotMatch(neg.svg, />1<\/text>/, 'the blank value has no label');
  const hidden = check(ws.numberLine({ from: 0, to: 100, step: 10, minorTicks: 4, hideLabels: true }));
  assert.doesNotMatch(hidden.svg, /<text/);
  assert.match(check(ws.numberLine({ from: 0, to: 20, labelEvery: 5 })).svg, />15<\/text>/);
  assert.match(ws.numberLine({ from: 0, to: 1, step: 0.5, decimalSeparator: '.' }).svg, />0\.5</);
  throwsLike(() => ws.numberLine({ from: 0, to: 1000 }), /^numberLine: too many ticks \(1000, max 200\)/);
  throwsLike(() => ws.numberLine({ from: 0, to: 10, step: 3 }), /multiple of step/);
  throwsLike(() => ws.numberLine({ from: 5, to: 1 }), /"to" must be greater than "from"/);
  throwsLike(() => ws.numberLine({ to: 1 }), /"from" is required/);
  throwsLike(() => ws.numberLine({ from: 0, to: 10, marks: [11] }), /mark 11 lies outside 0 … 10/);
  throwsLike(() => ws.numberLine({ from: 0, to: 200, widthMm: 60 }), /would overlap .* labelEvery/);
});

test('coordinateSystem: axes, grid, labelled points, segments and polygons', () => {
  const g = check(ws.coordinateSystem({
    points: [{ x: 2, y: 3, label: 'A(2|3)' }, { x: -4, y: 1, label: XSS }],
    segments: [{ from: [2, 3], to: [-4, 1] }],
    polygons: [{ points: [[1, -1], [4, -1], [4, -4]], label: 'D' }]
  }));
  assert.match(g.svg, />A\(2\|3\)<\/text>/);
  assert.match(g.svg, /font-style="italic"[^>]*>x<\/text>/);
  assert.match(g.svg, />−5<\/text>/);
  assertEscaped(g.svg);
  assert.ok(g.widthMm > 80 && g.widthMm < 100, 'width ≈ 10 units × 8 mm + margins');
  const q1 = check(ws.coordinateSystem({ xMin: 0, xMax: 10, yMin: 0, yMax: 6, unitMm: 10, grid: false, showLabels: false }));
  assert.doesNotMatch(q1.svg, /stroke="#cbd5e1"/);
  throwsLike(() => ws.coordinateSystem({ points: [{ x: 6, y: 0 }] }), /^coordinateSystem: point \(6\|0\) lies outside the axes/);
  throwsLike(() => ws.coordinateSystem({ xMin: -20, xMax: 20, unitMm: 8 }), /too wide \(320 mm, max 175\)/);
  throwsLike(() => ws.coordinateSystem({ xMin: 2, xMax: 1 }), /"xMax" must be greater than "xMin"/);
  throwsLike(() => ws.coordinateSystem({ segments: [{ from: [0, 0] }] }), /segments\[0\]\.to must be \[x, y\]/);
});

// ---------------------------------------------------------------------------
// Charts and mind maps
// ---------------------------------------------------------------------------

test('chart: column, bar, line and pie with legend, patterns and nice ticks', () => {
  const col = check(ws.chart({
    type: 'column', title: 'Lieblingstiere', labels: ['Hund', 'Katze', 'Maus'],
    series: [{ name: 'Mädchen', values: [4, 7, 2] }, { name: 'Jungen', values: [5, 3, 6] }],
    xLabel: 'Tier', yLabel: 'Anzahl'
  }), 150, 85);
  for (const t of ['Lieblingstiere', 'Mädchen', 'Jungen', 'Hund', 'Tier', 'Anzahl']) assert.match(col.svg, new RegExp('>' + t + '</text>'));
  for (const t of ['0', '2', '4', '6', '8']) assert.match(col.svg, new RegExp('>' + t + '</text>'), 'tick ' + t);
  assert.match(col.svg, /<pattern id="ws[0-9a-z]+-p1"/, 'second series has a pattern for grayscale print');
  assert.match(col.svg, /transform="rotate\(-90 /, 'rotated y label');
  const bar = check(ws.chart({ type: 'bar', labels: ['Rhein', 'Elbe'], series: [{ values: [865, 727] }], widthMm: 120, heightMm: 50 }), 120, 50);
  assert.match(bar.svg, />1000<\/text>/);
  assert.doesNotMatch(bar.svg, /<pattern/);
  const line = check(ws.chart({ type: 'line', labels: ['6 Uhr', '12 Uhr', '18 Uhr'], series: [{ name: 'Mo', values: [-2, 8, 3] }, { name: 'Di', values: [1, 10, 4] }] }));
  assert.match(line.svg, />−2<\/text>/);
  assert.match(line.svg, /stroke-dasharray="2\.4 1\.2"/, 'second line is dashed');
  const pie = check(ws.chart({ type: 'pie', labels: ['A', 'B', 'C'], series: [{ values: [1, 1, 2] }] }));
  assert.match(pie.svg, />50 %<\/text>/);
  assert.match(pie.svg, />25 %<\/text>/);
  const pct = ws.chart({ type: 'pie', labels: ['a', 'b', 'c'], series: [{ values: [1, 1, 1] }] }).svg.match(/>(\d+) %</g);
  assert.deepEqual(pct.map((s) => parseInt(s.slice(1), 10)).reduce((a, b) => a + b, 0), 100, 'percentages add up to 100');
});

test('chart: blank charts and validation messages', () => {
  const blank = check(ws.chart({ type: 'column', labels: ['Mo', 'Di', 'Mi'], blank: true, max: 20 }));
  assert.match(blank.svg, />20<\/text>/);
  assert.doesNotMatch(blank.svg, /<path d="M[\d.]+ [\d.]+V[\d.]+Q/, 'no bars');
  const blankPie = check(ws.chart({ type: 'pie', labels: ['A', 'B'], blank: true }));
  assert.match(blankPie.svg, /<circle [^>]*fill="none"/);
  assert.doesNotMatch(blankPie.svg, / %</);
  assertEscaped(ws.chart({ title: XSS, labels: ['a'], series: [{ values: [1] }] }).svg);
  throwsLike(() => ws.chart({ type: 'column', labels: ['a', 'b', 'c', 'd', 'e'], series: [{ name: 'x', values: [1, 2, 3, 4] }] }),
    /^chart: "labels" and every series need the same length \(5 vs 4 in "x"\)\.$/);
  throwsLike(() => ws.chart({ type: 'area', labels: ['a'], series: [{ values: [1] }] }), /"type" must be bar, column, line or pie/);
  throwsLike(() => ws.chart({ labels: ['a'], series: [{ values: [-1] }] }), /negative values are only possible in line charts/);
  throwsLike(() => ws.chart({ type: 'pie', labels: ['a'], series: [{ values: [1] }, { values: [2] }] }), /exactly one series/);
  throwsLike(() => ws.chart({ type: 'pie', labels: ['a', 'b'], series: [{ values: [0, 0] }] }), /positive sum/);
  throwsLike(() => ws.chart({ labels: [], series: [] }), /"labels" must be a non-empty array/);
  throwsLike(() => ws.chart({ labels: ['a'], series: [{ values: ['x'] }] }), /values\[0\] is not a number/);
  throwsLike(() => ws.chart({ labels: ['a'] }), /"series" needs at least one entry/);
});

test('chart: long category labels wrap, then rotate', () => {
  const many = check(ws.chart({
    type: 'column',
    labels: ['Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hessen', 'Niedersachsen'],
    series: [{ values: [11.1, 13.1, 3.7, 2.5, 0.7, 1.9, 6.3, 8.0] }]
  }));
  assert.match(many.svg, /rotate\(-45 /);
  const few = check(ws.chart({ type: 'column', labels: ['Hund', 'Meerschweinchen'], series: [{ values: [1, 2] }] }));
  assert.doesNotMatch(few.svg, /rotate\(-45 /);
});

test('mindmap: centre, branches, children and blank version', () => {
  const opts = {
    center: 'Wasser',
    branches: [
      { text: 'Aggregatzustände', children: ['fest', 'flüssig', 'gasförmig'] },
      { text: 'Kreislauf', children: ['Verdunstung', 'Niederschlag'] },
      { text: 'Nutzung', children: ['Trinken'] },
      { text: XSS }
    ]
  };
  const g = check(ws.mindmap(opts));
  assert.equal(g.widthMm, 160);
  assert.ok(g.heightMm >= 100);
  for (const t of ['Wasser', 'Aggregatzustände', 'Verdunstung', 'Trinken']) assert.match(g.svg, new RegExp('>' + t + '</text>'));
  assertEscaped(g.svg);
  assert.match(g.svg, /<ellipse /);
  const blank = check(ws.mindmap(Object.assign({}, opts, { blank: true })));
  assert.match(blank.svg, />Wasser<\/text>/, 'the centre keeps its text');
  assert.doesNotMatch(blank.svg, /Kreislauf|Trinken/);
  assert.equal((blank.svg.match(/<rect /g) || []).length, 4 + 6, 'empty boxes for branches and children');
  check(ws.mindmap({ center: 'Hobby', blank: true, branches: [{ children: 2 }, { children: 3 }] }));
  throwsLike(() => ws.mindmap({ center: 'X', branches: ['a'] }), /^mindmap: "branches" needs 2–8 entries/);
  throwsLike(() => ws.mindmap({ branches: ['a', 'b'] }), /"center" is required/);
  throwsLike(() => ws.mindmap({ center: 'X', branches: [{ text: 'a', children: ['1', '2', '3', '4', '5', '6', '7'] }, 'b'] }), /7 children \(max 6\)/);
});

// ---------------------------------------------------------------------------
// Puzzles, cut line, QR code
// ---------------------------------------------------------------------------

const CROSSWORD = {
  width: 4, height: 3,
  cells: [['H', 'U', 'N', 'D'], ['', '', '', 'A'], ['', '', '', 'S']],
  numbers: [[1, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0]]
};

test('crosswordGrid: boxes only for letter cells, clue numbers, optional answers', () => {
  const g = check(ws.crosswordGrid(CROSSWORD), 28.55, 21.55);
  assert.equal((g.svg.match(/h7v7h-7Z/g) || []).length, 6);
  assert.match(g.svg, />1<\/text>/);
  assert.match(g.svg, />2<\/text>/);
  assert.doesNotMatch(g.svg, />H<\/text>/);
  const a = check(ws.crosswordGrid(CROSSWORD, { showAnswers: true, cellMm: 8 }));
  assert.match(a.svg, />H<\/text>/);
  assert.match(a.svg, /fill="#2563eb">S<\/text>/);
  throwsLike(() => ws.crosswordGrid({ width: 2, height: 1, cells: [['A']] }), /layout\.cells\[0\] must have 2 columns/);
  throwsLike(() => ws.crosswordGrid(null), /^crosswordGrid: layout must be/);
});

test('wordSearchGrid: letter grid with optional answer capsules', () => {
  const grid = [['K', 'A', 'T', 'Z'], ['X', 'H', 'Y', 'E'], ['Q', 'W', 'U', 'E'], ['R', 'T', 'Z', 'N']];
  const result = { size: 4, grid, placements: [{ normalized: 'KATZ', row: 0, col: 0, dr: 0, dc: 1 }, { normalized: 'KHUN', row: 0, col: 0, dr: 1, dc: 1 }] };
  const g = check(ws.wordSearchGrid(result), 28.8, 28.8);
  assert.equal((g.svg.match(/<text /g) || []).length, 16);
  assert.doesNotMatch(g.svg, /rx="2\.59"/);
  const a = check(ws.wordSearchGrid(result, { showAnswers: true }));
  assert.equal((a.svg.match(/rx="2\.59"/g) || []).length, 2);
  assert.match(a.svg, /rotate\(45 /);
  const nb = ws.wordSearchGrid(result, { borders: false }).svg;
  assert.doesNotMatch(nb, /stroke="#d1d5db"/);
  throwsLike(() => ws.wordSearchGrid({ size: 4, grid, placements: [{ normalized: 'KATZE', row: 0, col: 0, dr: 0, dc: 1 }] }, { showAnswers: true }),
    /runs outside the grid/);
  throwsLike(() => ws.wordSearchGrid({ size: 3, grid }), /result\.grid must have 3 rows/);
});

test('cutLine: scissors drawn as paths, dashed line, optional label', () => {
  const g = check(ws.cutLine({ label: 'hier abschneiden' }), 160, 6);
  assert.match(g.svg, />hier abschneiden<\/text>/);
  assert.match(g.svg, /<circle cx="6" cy="6\.5" r="3"\/>/);
  assert.doesNotMatch(g.svg, /✂/);
  assertEscaped(ws.cutLine({ label: XSS }).svg);
  check(ws.cutLine({ widthMm: 50 }), 50, 6);
});

test('qrCode: works in Node with the vendored library, one merged path, right module count', () => {
  const g = check(ws.qrCode('https://example.org'), 25, 25);
  assert.equal((g.svg.match(/<path /g) || []).length, 1, 'all dark modules in one path');
  // 19 bytes at error correction M -> version 2 = 25 modules, plus 2 × 4 quiet zone = 33
  assert.match(g.svg, /scale\(0\.758\)/);
  const runs = [...g.svg.matchAll(/M(\d+) (\d+)h(\d+)/g)].map((m) => m.slice(1).map(Number));
  assert.equal(Math.min(...runs.map((r) => r[0])), 4);
  assert.equal(Math.max(...runs.map((r) => r[0] + r[2])), 29);
  assert.equal(Math.max(...runs.map((r) => r[1])), 28);
  // finder pattern: first row of the top-left finder is 7 dark modules
  assert.deepEqual(runs[0], [4, 4, 7]);

  const lib = require('../vendor/qrcode-generator/qrcode.js');
  const before = lib.stringToBytes;
  const withLabel = check(ws.qrCode('Grüße – äöü €', { label: 'Lösung', sizeMm: 30, qrcode: lib }));
  assert.equal(lib.stringToBytes, before, 'library setting restored');
  assert.ok(withLabel.heightMm > 30);
  assert.match(withLabel.svg, />Lösung<\/text>/);
  throwsLike(() => ws.qrCode(''), /^qrCode: text must not be empty/);
  throwsLike(() => ws.qrCode('x'.repeat(500), { sizeMm: 20 }), /hard to scan\); use sizeMm ≥ \d+/);
  throwsLike(() => ws.qrCode('x'.repeat(900)), /too long/);
});

// ---------------------------------------------------------------------------
// Sanitizer
// ---------------------------------------------------------------------------

test('sanitizeSvg removes scripts, handlers, foreignObject, images and external references', () => {
  const dirty = '<?xml version="1.0"?>\n<!DOCTYPE svg>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
    'width="100mm" height="50mm" viewBox="0 0 200 100" onload="alert(1)">' +
    '<script>alert(2)</script><!-- note -->' +
    '<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs>' +
    '<rect x="0" y="0" width="10" height="10" fill="url(#g)" onclick="x()"/>' +
    '<circle cx="5" cy="5" r="2" fill="url(http://evil/x.svg#a)" stroke="#000"/>' +
    '<foreignObject><div>hi</div></foreignObject>' +
    '<image href="http://evil/x.png" width="10" height="10"/>' +
    '<use xlink:href="http://evil/s.svg#a"/><use xlink:href="#g"/>' +
    '<a href="javascript:alert(3)"><path d="M0 0L10 10" stroke="#000"/></a>' +
    '<text x="1" y="9" font-size="4">Grüße &amp; &lt;Tschüss&gt;&nbsp;!</text>' +
    '<style>@import url(http://evil/x.css); .c { fill: #2563eb; stroke: url(http://evil) }</style>' +
    '<rect class="c" x="20" y="20" width="5" height="5" style="opacity:.5;behavior:url(x.htc)"/>' +
    '</svg>';
  const r = ws.sanitizeSvg(dirty);
  assert.equal(r.ok, true);
  assertWellFormed(r.svg);
  assert.equal(r.widthMm, 100);
  assert.equal(r.heightMm, 50);
  assert.match(r.svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="377\.95" height="188\.98" viewBox="0 0 200 100">/);
  for (const bad of [/script/i, /onload/, /onclick/, /foreignObject/, /<image/, /evil/, /javascript/, /behavior/, /<style/, /@import/]) {
    assert.doesNotMatch(r.svg, bad);
  }
  assert.match(r.svg, /<rect x="0" y="0" width="10" height="10" fill="url\(#g\)"\/>/);
  assert.match(r.svg, /<circle cx="5" cy="5" r="2" stroke="#000"\/>/);
  assert.match(r.svg, /<use href="#g"\/>/);
  assert.match(r.svg, /<g><path d="M0 0L10 10" stroke="#000"\/><\/g>/);
  assert.match(r.svg, />Grüße &amp; &lt;Tschüss&gt; !<\/text>/);
  assert.match(r.svg, /<rect x="20" y="20" width="5" height="5" style="fill:#2563eb;opacity:\.5"\/>/, 'simple CSS rules are inlined');
  const removed = r.removed.join(' | ');
  for (const w of ['<script>', 'onload', 'onclick', '<foreignObject>', '<image>', 'external', 'unsafe value in fill', '<style>']) {
    assert.ok(removed.includes(w), 'removed lists ' + w + ': ' + removed);
  }
});

test('sanitizeSvg: physical size from units or viewBox, scaled to the maximum width', () => {
  let r = ws.sanitizeSvg('<svg viewBox="0 0 960 480"><rect width="10" height="10"/></svg>');
  assert.equal(r.ok, true);
  assert.equal(r.widthMm, 180, 'viewBox px 254 mm wide -> scaled to 180 mm');
  assert.equal(r.heightMm, 90);
  assert.match(r.svg, /width="680\.31" height="340\.16" viewBox="0 0 960 480"/);
  r = ws.sanitizeSvg('<svg width="5cm" height="2cm"><rect width="10" height="10"/></svg>');
  assert.equal(r.widthMm, 50);
  assert.equal(r.heightMm, 20);
  assert.match(r.svg, /viewBox="0 0 188\.976 75\.591"/);
  r = ws.sanitizeSvg('<svg width="72pt" viewBox="0 0 10 5"><rect width="10" height="5"/></svg>');
  assert.equal(r.widthMm, 25.4);
  assert.equal(r.heightMm, 12.7);
  r = ws.sanitizeSvg('<svg width="300" height="150"><rect width="10" height="5"/></svg>', { maxWidthMm: 50 });
  assert.equal(r.widthMm, 50);
  r = ws.sanitizeSvg('```svg\n<svg viewBox="0 0 10 10"><path d="M0 0H10"/></svg>\n```');
  assert.equal(r.ok, true, 'Markdown code fences are tolerated');
  r = ws.sanitizeSvg('<svg><path d="M0 0H10"/></svg>');
  assert.equal(r.ok, true);
  assert.match(r.errors.join(' '), /no width\/height\/viewBox/);
});

test('sanitizeSvg rejects unusable input', () => {
  assert.equal(ws.sanitizeSvg('').ok, false);
  assert.equal(ws.sanitizeSvg(42).ok, false);
  assert.equal(ws.sanitizeSvg('<svg><rect></svg>').ok, false);
  assert.match(ws.sanitizeSvg('<svg><rect></svg>').errors[0], /not well-formed XML/);
  assert.equal(ws.sanitizeSvg('<svg><rect x=1/></svg>').ok, false);
  assert.match(ws.sanitizeSvg('<html><body/></html>').errors[0], /root element must be <svg>/);
  assert.equal(ws.sanitizeSvg('<svg/><svg/>').ok, false);
  const big = ws.sanitizeSvg('<svg>' + '<rect/>'.repeat(100) + '</svg>', { maxBytes: 100 });
  assert.equal(big.ok, false);
  assert.match(big.errors[0], /too big/);
});

// ---------------------------------------------------------------------------
// General
// ---------------------------------------------------------------------------

test('all generators are deterministic', () => {
  const opts = { type: 'column', labels: ['a', 'b'], series: [{ name: 'x', values: [1, 2] }, { name: 'y', values: [2, 1] }] };
  assert.equal(ws.chart(opts).svg, ws.chart(opts).svg);
  const mm = { center: 'Z', branches: [{ text: 'a', children: ['b'] }, 'c'] };
  assert.equal(ws.mindmap(mm).svg, ws.mindmap(mm).svg);
  assert.equal(ws.qrCode('abc').svg, ws.qrCode('abc').svg);
  assert.equal(ws.coordinateSystem({ points: [{ x: 1, y: 1, label: 'P' }] }).svg, ws.coordinateSystem({ points: [{ x: 1, y: 1, label: 'P' }] }).svg);
});

test('font option: valid families are used, unsafe ones fall back to the default', () => {
  assert.match(ws.taskBadge('1', { font: 'Comic Neue, sans-serif' }).svg, /font-family="Comic Neue, sans-serif"/);
  assert.match(ws.taskBadge('1', { font: 'x"><script>' }).svg, /font-family="&#39;Open Sans&#39;/);
});

test('options must be objects', () => {
  throwsLike(() => ws.icon('info', 'big'), /^icon: options must be an object\./);
  throwsLike(() => ws.chart([]), /^chart: options must be an object\./);
});
