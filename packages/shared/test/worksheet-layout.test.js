'use strict';
// Unit tests for packages/shared/worksheet-layout.js (blocks -> layout elements) and packages/shared/worksheet-themes.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const layout = require('../worksheet-layout.js');
const themes = require('../worksheet-themes.js');

const ABC = 'X:1\nM:4/4\nL:1/4\nK:C clef=treble\nC D E F |]';

/** One block of every type – a realistic worksheet. */
const ALL_BLOCKS = [
  { type: 'title', text: 'Der Wasserkreislauf', subtitle: 'Wie Regen entsteht', subject: 'Sachunterricht', grade: 'Klasse 3' },
  { type: 'name_line' },
  { type: 'heading', text: 'Einstieg', level: 2 },
  { type: 'paragraph', text: 'Lies **genau** und *langsam*. Rechne \\(\\frac{1}{2}+\\frac{1}{4}\\).', align: 'justify' },
  { type: 'paragraph', text: 'Die Sonne scheint.', syllables: true, size: 'large' },
  { type: 'task', number: '1', title: 'Lückentext', instruction: 'Ergänze die Lücken.', icons: ['single', 'write', 'nonsense'], points: 4, level: 2, time_min: 10 },
  { type: 'cloze', text: 'Die [[Sonne]] erwärmt das [[Wasser]].' },
  { type: 'task', number: '2', instruction: 'Kreuze an.', icons: ['partner'], points: 3 },
  { type: 'list', items: ['eins', 'zwei'], style: 'checkbox' },
  { type: 'list', items: ['a', 'b'], style: 'letters' },
  { type: 'table', rows: [['Begriff', 'Erklärung'], ['Wolke', '']], widths: [1, 2], answer_rows: 2, header_column: true },
  { type: 'lines', count: 3, label: 'Antwort:' },
  { type: 'lines', count: 2, style: 'school2' },
  { type: 'lines', count: 4, style: 'grid5' },
  { type: 'box', variant: 'rule', title: 'Merke', text: 'Wasser verdunstet.\n\nZweiter Absatz', items: ['Punkt'] },
  { type: 'box', title: 'Tipp', text: 'Lies zweimal.' },
  { type: 'word_bank', words: ['Zebra', 'Affe', 'Ölbaum'] },
  { type: 'multiple_choice', questions: [{ question: 'Was ist H2O?', options: ['Wasser', 'Luft'], correct: [0] }, { question: 'Lang?', options: ['eine ziemlich lange Antwortmöglichkeit Nummer eins', 'eine zweite, ebenso lange Antwortmöglichkeit'] }] },
  { type: 'true_false', statements: [{ text: 'Wasser ist nass.', correct: true }, 'Feuer ist kalt.'] },
  { type: 'matching', pairs: [{ left: 'Hund', right: 'bellt' }, { left: 'Katze', right: 'miaut' }, { left: 'Kuh', right: 'muht' }] },
  { type: 'matching', mode: 'letters', show_answers: true, pairs: [{ left: 'rot', right: 'red' }, { left: 'blau', right: 'blue' }] },
  { type: 'crossword', entries: [{ answer: 'Wolke', clue: 'am Himmel' }, { answer: 'Regen', clue: 'fällt' }, { answer: 'Sonne', clue: 'wärmt' }, { answer: 'Meer', clue: 'salzig' }] },
  { type: 'word_search', words: ['HUND', 'KATZE', 'MAUS'], difficulty: 'easy' },
  { type: 'reading_text', title: 'Der Regen', text: Array(40).fill('Es regnet heute sehr viel in der Stadt.').join(' ') },
  { type: 'formula', latex: 'a^2+b^2=c^2' },
  { type: 'number_line', from: 0, to: 20, step: 1, label_every: 5, blanks: [7, 13] },
  { type: 'coordinate_system', x_min: -4, x_max: 4, y_min: -3, y_max: 3, points: [{ x: 1, y: 2, label: 'A' }] },
  { type: 'chart', chart_type: 'column', title: 'Regentage', labels: ['Jan', 'Feb', 'Mär'], series: [{ name: '2024', values: [10, 8, 12] }], caption: 'Quelle: eigene Messung' },
  { type: 'mindmap', center: 'Wasser', branches: [{ text: 'Regen', children: ['Tropfen'] }, { text: 'Meer' }] },
  { type: 'qr_code', url: 'https://example.org/video', caption: 'Video' },
  { type: 'picture', image_id: 'arasaac:2623', width_cm: 3, picture_meta: { title: 'Fuchs', credit: 'Piktogramm: Sergio Palao, ARASAAC (arasaac.org), CC BY-NC-SA 4.0', width: 500, height: 500 } },
  { type: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" width="100" height="50"><rect x="5" y="5" width="90" height="40" fill="none" stroke="#000"/><script>alert(1)</script></svg>', caption: 'Rechteck' },
  { type: 'cut_line' },
  { type: 'self_assessment', statements: ['Ich kann den Wasserkreislauf erklären.'] },
  { type: 'hint_cards', cards: [{ title: 'Tipp 1', text: 'Schau in den Text.' }, { text: 'Frag deinen Partner.' }, { text: 'Drei' }] },
  { type: 'grade_key', total_points: 30 },
  { type: 'columns', columns: [[{ type: 'paragraph', text: 'Links' }, { type: 'table', rows: [['a', 'b']] }], [{ type: 'chart', chart_type: 'pie', labels: ['A', 'B'], series: [{ values: [1, 3] }] }]] },
  { type: 'staff', abc: ABC },
  { type: 'empty_staves', clef: 'bass', count: 2 },
  { type: 'spacer', lines: 2 },
  { type: 'page_break' },
];

function walk(elements, fn) {
  elements.forEach((e) => {
    fn(e);
    if (e.t === 'table') e.rows.forEach((r) => r.cells.forEach((c) => walk(c.content, fn)));
  });
}

test('every block type is laid out in every theme', () => {
  for (const id of themes.THEME_IDS) {
    const r = layout.compose(ALL_BLOCKS, { theme: id, lang: 'de', textWidthMm: 170 });
    assert.ok(r.elements.length > ALL_BLOCKS.length, id);
    assert.equal(r.theme, id);
    // The elements go through callCommand as JSON: only finite numbers, strings, booleans, arrays, objects.
    (function check(v, where) {
      if (typeof v === 'number') assert.ok(Number.isFinite(v), `${id}: ${where} is ${v}`);
      else if (Array.isArray(v)) v.forEach((x, i) => check(x, `${where}[${i}]`));
      else if (v && typeof v === 'object') Object.keys(v).forEach((k) => check(v[k], `${where}.${k}`));
      else assert.ok(v === undefined || v === null || ['string', 'boolean'].includes(typeof v), `${id}: ${where} is ${typeof v}`);
    })(r.elements, 'elements');
    const images = layout.collectImages(r.elements);
    assert.ok(images.length > 20, `${id}: ${images.length} images`);
    for (const im of images) {
      if (im.kind === 'staff' || im.kind === 'empty_staves') assert.ok(im.widthCm > 0);
      else if (im.kind === 'picture') assert.ok(im.widthMm === 30 && im.heightMm === 30, `${id}: picture ${im.widthMm}x${im.heightMm} mm`);
      else {
        assert.match(im.svg, /^<svg[\s>]/);
        assert.ok(im.widthMm > 0 && im.heightMm > 0 && im.widthMm <= 171, `${id}: image ${im.widthMm} mm`);
      }
    }
  }
  assert.ok(themes.THEME_IDS.length === 4);
});

test('the BLOCK_TYPES list covers every builder', () => {
  const used = new Set(ALL_BLOCKS.map((b) => b.type));
  for (const t of layout.BLOCK_TYPES) assert.ok(used.has(t), `test covers ${t}`);
});

test('inline markup: bold, italic, underline, gaps, formulas, check boxes', () => {
  const base = { font: 'X', size: 11 };
  const runs = layout.textRuns('a **b** *c* __d__ ________ \\(x^2\\) [ ] [x]\nneu', base);
  const texts = runs.map((r) => (r.br ? '<br>' : r.math ? `<m:${r.math}>` : (r.b ? 'B:' : r.i ? 'I:' : r.u ? 'U:' : '') + r.text));
  assert.deepEqual(texts, ['a ', 'B:b', ' ', 'I:c', ' ', 'U:d', ' ________ ', '<m:x^2>', ' ', '☐', ' ', '☒', '<br>', 'neu']);
  assert.equal(runs[0].font, 'X');
  assert.equal(runs[9].font, 'DejaVu Sans');
  assert.equal(layout.plainText('**a** \\(b\\) [x]'), 'a b ☒');
});

test('task header: badge with task info, heading, kept with the next element, points at the right', () => {
  const r = layout.compose([
    { type: 'task', number: '3', title: 'Rechnen', instruction: 'Rechne aus.', icons: ['calculate'], points: 2.5 },
    { type: 'lines', count: 2 },
  ], { theme: 'modern', textWidthMm: 160 });
  const head = r.elements[0];
  assert.equal(head.style, 'Heading 2');
  assert.equal(head.keepNext, true);
  assert.deepEqual(head.tabs, [{ pos: layout.tw(9.5), type: 'left' }, { pos: layout.tw(160), type: 'right' }]);
  assert.equal(head.indFirst, -head.indLeft, 'wrapped header lines align with the text after the badge');
  const badge = head.runs[0].image;
  assert.deepEqual(layout.parseMarker(badge.alt, layout.TASK_MARKER), { number: '3', title: 'Rechnen', points: 2.5, level: null });
  assert.ok(head.runs.some((r) => r.text && /___ \/ 2,5 P\./.test(r.text)));
  const instr = r.elements[1];
  assert.equal(instr.runs.map((x) => x.text).join(''), 'Rechne aus.');
  assert.equal(instr.keepNext, true);
  // last element is never kept with "next"
  assert.equal(r.elements[r.elements.length - 1].keepNext, undefined);
});

test('tasks without number are numbered on', () => {
  const r = layout.compose([{ type: 'task', number: '4', instruction: 'a' }, { type: 'task', instruction: 'b' }], { theme: 'modern' });
  const nums = r.elements.filter((e) => e.style === 'Heading 2').map((e) => layout.parseMarker(e.runs[0].image.alt, layout.TASK_MARKER).number);
  assert.deepEqual(nums, ['4', '5']);
});

test('cloze: gaps, alphabetic word bank, solution version', () => {
  const r = layout.compose([{ type: 'cloze', text: 'Die [[Sonne]] und das [[Ärgernis]] und [[Affe]].' }], { theme: 'modern' });
  const p = r.elements[0];
  assert.match(p.runs.map((x) => x.text).join(''), /^Die _{8,} und das _{8,} und _{8,}\.$/);
  const bank = r.elements[1];
  assert.equal(bank.t, 'table');
  assert.equal(bank.description, 'WSBLOCK {"type":"word_bank","count":3}');
  const words = bank.rows[0].cells[0].content[1].runs.map((x) => x.text).join('');
  assert.equal(words, 'Affe     Ärgernis     Sonne');
  const sol = layout.compose([{ type: 'cloze', text: 'Die [[Sonne]].', show_answers: true }], { theme: 'modern' });
  assert.equal(sol.elements.length, 1);
  assert.ok(sol.elements[0].runs.some((x) => x.text === 'Sonne' && x.u && x.b));
});

test('syllable colouring alternates two colours per word', () => {
  const t = themes.getTheme('primary');
  const r = layout.compose([{ type: 'paragraph', text: 'Die Sonne', syllables: true }], { theme: 'primary' });
  const coloured = r.elements[0].runs.filter((x) => x.text && x.text.trim()).map((x) => [x.text, x.color]);
  assert.deepEqual(coloured, [['Die', t.colors.syllable1], ['Son', t.colors.syllable1], ['ne', t.colors.syllable2]]);
});

test('document theme keeps the document fonts', () => {
  const r = layout.compose([{ type: 'paragraph', text: 'Hallo' }, { type: 'heading', text: 'H', level: 1 }], { theme: 'document' });
  assert.equal(r.elements[0].runs[0].font, undefined);
  assert.equal(r.elements[0].runs[0].size, undefined);
  assert.equal(r.elements[0].after, undefined);
  assert.equal(r.elements[1].runs[0].b, true);
  const m = layout.compose([{ type: 'paragraph', text: 'Hallo' }], { theme: 'modern' });
  assert.equal(m.elements[0].runs[0].font, 'Open Sans');
});

test('reading text: line numbers every 5 lines, lines short enough not to wrap', () => {
  const text = Array(30).fill('Es war einmal ein kleiner Igel im Wald.').join(' ');
  const r = layout.compose([{ type: 'reading_text', text }], { theme: 'modern', textWidthMm: 170 });
  const lines = r.elements.filter((e) => e.t === 'p');
  const numbers = lines.map((l) => l.runs[0].text);
  assert.equal(numbers[4], '5');
  assert.equal(numbers[3], '');
  assert.equal(numbers[9], '10');
  for (const l of lines) assert.ok(l.runs.slice(2).map((x) => x.text).join('').length <= 90);
});

test('graphics carry their source in the alt text', () => {
  const r = layout.compose([{ type: 'number_line', from: 0, to: 10, step: 1, blanks: [3] }], { theme: 'classic' });
  const img = layout.collectImages(r.elements)[0];
  const src = layout.parseMarker(img.alt, layout.GRAPHIC_MARKER);
  assert.equal(src.type, 'number_line');
  assert.deepEqual(src.blanks, [3]);
});

test('invalid blocks name the block and the problem', () => {
  assert.throws(() => layout.compose([{ type: 'paragraph', text: 'x' }, { type: 'cloze', text: 'keine Lücke' }]), /blocks\[1\] \(cloze\): .*\[\[answer\]\]/);
  assert.throws(() => layout.compose([{ type: 'nope' }]), /blocks\[0\] \(nope\): unknown type/);
  assert.throws(() => layout.compose([{ type: 'crossword', entries: [{ answer: 'ABC', clue: 'x' }, { answer: 'XYZ', clue: 'y' }] }]), /blocks\[0\] \(crossword\): .*could not be placed/);
  assert.throws(() => layout.compose([{ type: 'columns', columns: [[{ type: 'page_break' }], []] }]), /not allowed inside columns/);
  assert.throws(() => layout.compose([{ type: 'matching', pairs: [{ left: 'a', right: 'b' }] }]), /2–12/);
});

test('adjacent tables are separated and tables are tagged with their block type', () => {
  const r = layout.compose([{ type: 'table', rows: [['a']] }, { type: 'table', rows: [['b']] }], { theme: 'modern' });
  assert.deepEqual(r.elements.map((e) => e.t), ['table', 'p', 'table']);
  assert.equal(r.elements[0].description, 'WSBLOCK {"type":"table"}');
});

test('labels follow the document language', () => {
  const de = layout.compose([{ type: 'name_line' }], { theme: 'modern', lang: 'de' });
  const en = layout.compose([{ type: 'name_line' }], { theme: 'modern', lang: 'en' });
  const label = (r) => r.elements[0].rows[0].cells[2].content[0].runs[0].text;
  assert.equal(label(de), 'Klasse:');
  assert.equal(label(en), 'Class:');
  for (const l of themes.LANGUAGES) assert.deepEqual(Object.keys(themes.LABELS[l]).sort(), Object.keys(themes.LABELS.de).sort(), l);
});

// ---------------------------------------------------------------------------
// picture
// ---------------------------------------------------------------------------

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

test('picture: loaded image with size from the aspect ratio, credit below, source in the alt text', () => {
  const r = layout.compose([
    { type: 'picture', image_id: 'commons:Red fox.jpg', width_cm: 6, caption: 'Ein **Fuchs**', align: 'left',
      picture_data: { dataUrl: PNG, width: 800, height: 600, title: 'Rotfuchs', credit: 'Bild: A__B, CC BY-SA 4.0, Wikimedia Commons' } },
  ], { theme: 'primary', textWidthMm: 170 });
  const [pic, caption, credit] = r.elements;
  const im = pic.runs[0].image;
  assert.equal(im.kind, 'picture');
  assert.equal(im.dataUrl, PNG);
  assert.equal(im.widthMm, 60);
  assert.equal(im.heightMm, 45);
  assert.equal(im.wEmu, 60 * 36000);
  assert.equal(im.hEmu, 45 * 36000);
  assert.equal(pic.jc, 'left');
  assert.equal(pic.keepNext, true, 'picture stays with its caption/credit');
  assert.match(im.alt, /^Bild: Rotfuchs/);
  const src = layout.parseMarker(im.alt, layout.GRAPHIC_MARKER);
  assert.deepEqual(src, { type: 'picture', image_id: 'commons:Red fox.jpg', width_cm: 6, align: 'left', caption: 'Ein **Fuchs**' });
  assert.ok(!JSON.stringify(src).includes('base64'), 'no image data in the alt text');
  assert.equal(layout.plainText(caption.runs.map((x) => x.text || '').join('')), 'Ein Fuchs');
  assert.equal(credit.runs.length, 1, 'credit is one plain run (no markup parsing)');
  assert.equal(credit.runs[0].text, 'Bild: A__B, CC BY-SA 4.0, Wikimedia Commons');
  assert.equal(credit.after, 160);
  assert.deepEqual(layout.collectImages(r.elements), [im]);
});

test('picture: without data (layout check in the proxy) a placeholder of the right size; own pictures without credit', () => {
  const r = layout.compose([
    { type: 'picture', image_id: 'own:Asterix/obelix.png', picture_meta: { title: 'obelix', credit: '' } },
    { type: 'picture', image_id: 'arasaac:1', width_cm: 40, picture_meta: { width: 100, height: 1000, credit: 'x' } },
  ], { theme: 'modern', textWidthMm: 160 });
  const first = r.elements[0].runs[0].image;
  assert.equal(first.dataUrl, undefined);
  assert.equal(first.widthMm, 50, 'default width 5 cm');
  assert.equal(first.heightMm, 37.5, 'unknown aspect ratio: 4:3');
  assert.equal(r.elements[0].after, 160, 'no credit line for own pictures');
  const tall = r.elements[1].runs[0].image;
  assert.equal(tall.heightMm, 160, 'very tall pictures are limited to 16 cm');
  assert.equal(tall.widthMm, 16);
});

test('picture: needs an image id from search_images; works inside columns', () => {
  assert.throws(() => layout.compose([{ type: 'picture', image_id: 'https://example.org/a.png' }], {}), /image_id/);
  const r = layout.compose([
    { type: 'columns', widths: [1, 3], columns: [[{ type: 'picture', image_id: 'arasaac:2', width_cm: 3 }], [{ type: 'paragraph', text: 'Text' }]] },
  ], { theme: 'primary', textWidthMm: 170 });
  const imgs = layout.collectImages(r.elements);
  assert.equal(imgs.length, 1);
  assert.ok(imgs[0].widthMm <= 170 / 4 + 0.01, 'picture fits its column');
});
