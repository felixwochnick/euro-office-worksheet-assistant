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
  { type: 'class_diagram', classes: [{ name: 'Tier', kind: 'abstract', attributes: ['# name: String'], methods: ['+ abstract gibLaut(): String'] }, { name: 'Hund', methods: ['[[+ gibLaut(): String]]'] }], relations: [{ from: 'Hund', to: 'Tier', kind: 'inheritance' }], caption: 'Vererbung' },
  { type: 'object_diagram', objects: [{ name: 'bello', class: 'Hund', values: ['name = "Bello"'] }, { name: 'mia', class: 'Person', values: 1 }], links: [{ from: 'mia', to: 'bello', label: 'haustier', blank: true }] },
  { type: 'sequence_diagram', participants: [{ name: 'Nutzer', kind: 'actor' }, ':App'], messages: [{ from: 'Nutzer', to: ':App', text: 'start()' }, { fragment: 'opt', label: 'angemeldet', messages: [{ from: ':App', to: 'Nutzer', text: '[[zeigeStart()]]', kind: 'return' }] }] },
  { type: 'state_diagram', notation: 'automaton', states: ['q0', 'q1'], initial: 'q0', accepting: ['q1'], transitions: [{ from: 'q0', to: 'q1', label: '1' }, { from: 'q1', to: 'q1', label: '0, 1' }, { from: 'q0', to: 'q0', label: '0', blank: true }] },
  { type: 'structogram', title: 'Summe', steps: ['summe ← 0', { for: 'für i von 1 bis n', do: ['[[summe ← summe + i]]'] }, { if: 'summe > 100', then: ['Ausgabe: groß'], else: [] }] },
  { type: 'er_diagram', entities: [{ name: 'Klasse', attributes: ['__Bezeichnung__'] }, { name: 'Schüler', attributes: ['__ID__', 'Name'] }], relationships: [{ name: 'gehört zu', from: 'Schüler', to: 'Klasse', from_card: 'n', to_card: '[[1]]' }] },
  { type: 'activity_diagram', nodes: [{ kind: 'start' }, { id: 'a', text: 'Teig rühren' }, { id: 'd', kind: 'decision' }, { id: 'b', text: '[[Backen]]' }, { kind: 'end' }], edges: [{ from: 'start', to: 'a' }, { from: 'a', to: 'd' }, { from: 'd', to: 'b', label: '[fertig]' }, { from: 'd', to: 'a', label: '[sonst]' }, { from: 'b', to: 'end' }] },
  { type: 'use_case_diagram', system: 'Bibliothek', actors: ['Leser', { name: 'Bibliothekar', side: 'right' }], use_cases: ['Buch ausleihen', 'Ausweis prüfen'], links: [{ from: 'Leser', to: 'Buch ausleihen' }, { from: 'Buch ausleihen', to: 'Ausweis prüfen', kind: 'include' }, { from: 'Bibliothekar', to: 'Ausweis prüfen', blank: true }] },
  { type: 'flowchart', nodes: [{ kind: 'start' }, { kind: 'io', text: 'Eingabe: x' }, { id: 'q', kind: 'decision', text: 'x > 0?' }, { id: 'p', kind: 'io', text: 'Ausgabe: positiv' }, { id: 'n', kind: 'io', text: '' }, { id: 'm', kind: 'merge' }, { kind: 'end' }], edges: [{ from: 'start', to: 'Eingabe: x' }, { from: 'Eingabe: x', to: 'q' }, { from: 'q', to: 'p', label: 'ja' }, { from: 'q', to: 'n', label: 'nein' }, { from: 'p', to: 'm' }, { from: 'n', to: 'm' }, { from: 'm', to: 'end' }] },
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

test('picture: loaded image with size from the aspect ratio, caption below, credit only in the alt text', () => {
  const r = layout.compose([
    { type: 'picture', image_id: 'commons:Red fox.jpg', width_cm: 6, caption: 'Ein **Fuchs**', align: 'left',
      picture_data: { dataUrl: PNG, width: 800, height: 600, title: 'Rotfuchs', credit: 'Bild: A__B, CC BY-SA 4.0, Wikimedia Commons' } },
  ], { theme: 'primary', textWidthMm: 170 });
  assert.equal(r.elements.length, 2, 'picture and caption – no credit line (it goes to the sources page)');
  const [pic, caption] = r.elements;
  const im = pic.runs[0].image;
  assert.equal(im.kind, 'picture');
  assert.equal(im.dataUrl, PNG);
  assert.equal(im.widthMm, 60);
  assert.equal(im.heightMm, 45);
  assert.equal(im.wEmu, 60 * 36000);
  assert.equal(im.hEmu, 45 * 36000);
  assert.equal(pic.jc, 'left');
  assert.equal(pic.keepNext, true, 'picture stays with its caption');
  assert.equal(im.alt.split('\n\n')[0], 'Bild: Rotfuchs\nQuelle: Bild: A__B, CC BY-SA 4.0, Wikimedia Commons');
  const src = layout.parseMarker(im.alt, layout.GRAPHIC_MARKER);
  assert.deepEqual(src, { type: 'picture', image_id: 'commons:Red fox.jpg', width_cm: 6, align: 'left', caption: 'Ein **Fuchs**' });
  assert.ok(!JSON.stringify(src).includes('base64'), 'no image data in the alt text');
  assert.equal(layout.plainText(caption.runs.map((x) => x.text || '').join('')), 'Ein Fuchs');
  assert.equal(caption.after, 160);
  assert.ok(!JSON.stringify(r.elements).includes('Wikimedia Commons\"'), 'credit is not printed');
  assert.ok(!r.elements.some((e) => e.t === 'p' && e.runs.some((x) => /CC BY-SA/.test(x.text || ''))), 'no credit paragraph');
  assert.deepEqual(layout.collectImages(r.elements), [im]);
  // without a caption: one paragraph
  const plain = layout.compose([{ type: 'picture', image_id: 'arasaac:2623', picture_meta: { title: 'Fuchs', credit: 'Piktogramm: X' } }], {});
  assert.equal(plain.elements.length, 1);
  assert.equal(plain.elements[0].after, 160);
  assert.match(plain.elements[0].runs[0].image.alt, /^Bild: Fuchs\nQuelle: Piktogramm: X\n\nWSGRAPHIC \{"type":"picture","image_id":"arasaac:2623"\}$/);
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
  assert.equal(r.elements.length, 2, 'one paragraph per picture, no credit lines');
  assert.equal(first.alt.split('\n\n')[0], 'Bild: obelix', 'own pictures have no credit (no Quelle line)');
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

// ---------------------------------------------------------------------------
// picture items inside tasks
// ---------------------------------------------------------------------------

const ARASAAC = 'Piktogramm: Sergio Palao, ARASAAC (arasaac.org), CC BY-NC-SA 4.0';
/** A picture item as the plugin passes it to the layout (loaded data) – or, with loaded = false, as in the proxy. */
const pic = (n, title, extra = {}, loaded = true) => ({
  image_id: 'arasaac:' + n,
  ...(loaded ? { picture_data: { dataUrl: PNG, width: 500, height: 500, title, credit: ARASAAC } } : { picture_meta: { title, credit: ARASAAC, width: 500, height: 500 } }),
  ...extra,
});
const pictures = (r) => layout.collectImages(r.elements).filter((im) => im.kind === 'picture');
const altSource = (im) => layout.parseMarker(im.alt, layout.PICTURE_MARKER);
const cellTexts = (cl) => cl.content.map((p) => (p.runs || []).map((x) => x.text || '').join('')).join('|');

test('pictureRefs: every object with an image_id, in document order, also inside columns and nested items', () => {
  const blocks = [
    { type: 'picture', image_id: 'arasaac:1' },
    { type: 'matching', pairs: [{ left: { image_id: 'arasaac:2' }, right: 'Sehen' }, { left: 'Ohr', right: { image_id: 'commons:Ear.jpg', text: 'Ohr' } }] },
    { type: 'multiple_choice', questions: [{ question: 'Was ist das?', image_id: 'arasaac:3', options: [{ image_id: 'arasaac:4' }, 'Katze'] }] },
    { type: 'columns', columns: [[{ type: 'table', rows: [[{ image_id: 'own:a.png' }, 'x']] }], [{ type: 'crossword', entries: [{ answer: 'Hund', image_id: 'arasaac:5' }] }]] },
    { type: 'paragraph', text: 'kein Bild' },
  ];
  assert.deepEqual(layout.pictureRefs(blocks).map((r) => r.image_id),
    ['arasaac:1', 'arasaac:2', 'commons:Ear.jpg', 'arasaac:3', 'arasaac:4', 'own:a.png', 'arasaac:5']);
  assert.equal(layout.pictureRefs(blocks)[1], blocks[1].pairs[0].left, 'the objects themselves (to attach data)');
  assert.deepEqual(layout.pictureRefs([{ type: 'picture', image_id: 'arasaac:1', picture_meta: { image_id: 'x' } }]).length, 1, 'meta/data are not searched');
  assert.deepEqual(layout.pictureRefs(null), []);
  assert.equal(layout.PICTURE_MARKER, 'WSPICTURE ');
});

test('matching: picture ↔ word – pictures 2.5 cm high in their boxes, rows grow, dots centred, credit in the alt text', () => {
  const pairs = [{ left: pic(1, 'Auge'), right: 'Sehen' }, { left: pic(2, 'Ohr'), right: 'Hören' }, { left: pic(3, 'Nase', { text: 'Nase' }), right: 'Riechen' }];
  const r = layout.compose([{ type: 'matching', pairs }], { theme: 'primary', textWidthMm: 170 });
  const table = r.elements[0];
  assert.deepEqual(table.widths, [38, 5, 14, 5, 38]);
  const ims = pictures(r);
  assert.equal(ims.length, 3);
  for (const im of ims) {
    assert.equal(im.dataUrl, PNG);
    assert.equal(im.widthMm, 25);
    assert.equal(im.heightMm, 25);
    assert.equal(im.wEmu, 25 * 36000);
    assert.match(im.alt, /^Bild: (Auge|Ohr|Nase)\nQuelle: Piktogramm: Sergio Palao, ARASAAC \(arasaac\.org\), CC BY-NC-SA 4\.0\n\nWSPICTURE \{/);
  }
  assert.deepEqual(altSource(ims[0]), { image_id: 'arasaac:1' });
  assert.deepEqual(altSource(ims[2]), { image_id: 'arasaac:3', text: 'Nase' });
  const row = table.rows[0];
  assert.equal(row.cells[0].content[0].jc, 'center', 'picture centred in its box');
  assert.equal(row.cells[0].valign, 'center');
  assert.equal(row.cells[1].valign, 'center', 'the dot stays in the middle of the (taller) row');
  assert.ok(row.cells[0].borders.top, 'picture boxed like a word');
  assert.equal(row.height, layout.tw(10), 'minimum height – the row grows with the picture');
  assert.equal(cellTexts(table.rows[4].cells[0]), '|Nase', 'text below the picture');
  // the words on the right are shuffled; every word appears once
  assert.deepEqual([0, 2, 4].map((i) => cellTexts(table.rows[i].cells[4])).sort(), ['Hören', 'Riechen', 'Sehen']);
  assert.ok(!JSON.stringify(r.elements).includes('picture_data'));
});

test('matching: same order with and without loaded pictures; letters mode; solution key names the pictures', () => {
  const pairs = (loaded) => [{ left: pic(1, 'Auge', {}, loaded), right: 'Sehen' }, { left: pic(2, 'Ohr', {}, loaded), right: 'Hören' }, { left: 'Mund', right: pic(4, 'Schmecken', { text: 'schmecken' }, loaded) }, { left: 'Haut', right: 'Fühlen' }];
  const order = (r) => r.elements[0].rows.filter((x, i) => i % 2 === 0).map((row) => cellTexts(row.cells[4]) || layout.parseMarker(row.cells[4].content[0].runs[0].image.alt, layout.PICTURE_MARKER).image_id);
  const proxy = layout.compose([{ type: 'matching', pairs: pairs(false) }], {});
  const plugin = layout.compose([{ type: 'matching', pairs: pairs(true) }], {});
  assert.deepEqual(order(proxy), order(plugin), 'the proxy check and the editor show the same order');
  assert.equal(pictures(proxy)[0].dataUrl, undefined, 'placeholder without data');
  assert.equal(pictures(proxy)[0].heightMm, 25);

  const sol = layout.compose([{ type: 'matching', pairs: pairs(true), show_answers: true }], { lang: 'de' });
  const key = sol.elements[sol.elements.length - 1].runs.map((x) => x.text).join('');
  assert.equal(key, 'Lösung: Auge – Sehen;  Ohr – Hören;  Mund – schmecken;  Haut – Fühlen');
  const untitled = layout.compose([{ type: 'matching', show_answers: true, pairs: [{ left: { image_id: 'arasaac:9' }, right: 'a' }, { left: 'b', right: 'c' }] }], { lang: 'de' });
  assert.match(untitled.elements[1].runs.map((x) => x.text).join(''), /Bild – a/);

  const letters = layout.compose([{ type: 'matching', mode: 'letters', pairs: pairs(true) }], { textWidthMm: 170 });
  assert.deepEqual(letters.elements[0].widths, [6, 34, 8, 8, 6, 38]);
  assert.equal(pictures(letters).length, 3);
  for (const im of pictures(letters)) assert.ok(im.widthMm <= 170 * 0.34, 'fits the 34 % column');
  assert.throws(() => layout.compose([{ type: 'matching', pairs: [{ left: {}, right: 'a' }, { left: 'b', right: 'c' }] }], {}), /pair 1: "left"/);
  assert.equal(pictures(layout.compose([{ type: 'matching', pairs: [{ left: { text: 'x' }, right: 'a' }, { left: 'b', right: 'c' }] }], {})).length, 0, '{text} is a text item');
  assert.throws(() => layout.compose([{ type: 'matching', pairs: [{ left: { image_id: 'http://x/y.png' }, right: 'a' }, { left: 'b', right: 'c' }] }], {}), /image_id/);
});

test('matching and crossword: the picture ids do not change the order (the proxy canonicalises them after its check)', () => {
  const m = (id) => layout.compose([{ type: 'matching', pairs: [{ left: { image_id: id }, right: 'Sehen' }, { left: 'Ohr', right: 'Hören' }, { left: 'Nase', right: 'Riechen' }] }], {});
  const rightCol = (r) => r.elements[0].rows.filter((x, i) => i % 2 === 0).map((row) => cellTexts(row.cells[4]));
  assert.deepEqual(rightCol(m('arasaac:02623')), rightCol(m('arasaac:2623')));
  const cw = (id) => layout.compose([{ type: 'crossword', entries: [{ answer: 'HUND', image_id: id }, { answer: 'KATZE', clue: 'miaut' }, { answer: 'KUH', clue: 'muht' }] }], {});
  const grid = (r) => r.elements.find((e) => e.runs && e.runs[0] && e.runs[0].image).runs[0].image;
  assert.equal(layout.parseMarker(grid(cw('arasaac:02623')).alt, layout.GRAPHIC_MARKER).type, 'crossword');
  assert.ok(grid(cw('arasaac:02623')).svg, 'the grid is an SVG');
  assert.equal(grid(cw('arasaac:02623')).svg, grid(cw('arasaac:2623')).svg, 'same grid');
});

test('box and self-assessment: an item object prints its text, never "[object Object]"', () => {
  const r = layout.compose([
    { type: 'box', variant: 'tip', items: [{ image_id: 'arasaac:1', text: 'Auge' }, 'Ohr'] },
    { type: 'self_assessment', statements: [{ text: 'Ich kann lesen.', image_id: 'arasaac:1' }, 'Ich kann zählen.'] },
  ], {});
  const all = JSON.stringify(r.elements);
  assert.doesNotMatch(all, /object Object/);
  assert.match(all, /Auge/);
  assert.match(all, /Ich kann lesen\./);
});

test('multiple choice: picture options side by side with check boxes below, a picture with the question', () => {
  const q = { question: 'Was hörst du?', image_id: 'arasaac:7', picture_meta: { title: 'Ohr', credit: ARASAAC, width: 400, height: 300 },
    options: [pic(1, 'Glocke', { text: 'Glocke' }), pic(2, 'Fisch'), 'nichts'], correct: [0] };
  const r = layout.compose([{ type: 'multiple_choice', questions: [q], show_answers: true }], { textWidthMm: 170 });
  const [question, qPic, table, spacer] = r.elements;
  assert.match(question.runs.map((x) => x.text).join(''), /^1\. {2}Was hörst du\?/);
  assert.equal(qPic.runs[0].image.heightMm, 30, 'question picture 3 cm high');
  assert.equal(qPic.runs[0].image.widthMm, 40);
  assert.equal(qPic.keepNext, true);
  assert.equal(table.t, 'table');
  assert.equal(table.rows.length, 1);
  assert.equal(table.rows[0].cells.length, 4, 'indent column + 3 options');
  const opt = table.rows[0].cells[1];
  assert.equal(opt.content[0].runs[0].image.heightMm, 25);
  assert.equal(opt.content[1].runs[0].text, '☒', 'correct option ticked in the solution');
  assert.equal(opt.content[1].runs[2].text, 'Glocke');
  assert.equal(opt.content[1].runs[2].b, true);
  assert.equal(table.rows[0].cells[2].content[1].runs.length, 1, 'picture without text: just the check box');
  assert.equal(table.rows[0].cells[3].content[0].runs[0].text, '☐', 'a text option in the row');
  assert.equal(spacer.t, 'p');
  // many options wrap into rows of 3 or 4
  const many = layout.compose([{ type: 'multiple_choice', questions: [{ question: 'x', options: [1, 2, 3, 4, 5, 6].map((n) => pic(n, 'p' + n)) }] }], {});
  assert.equal(many.elements[1].rows.length, 2);
  assert.equal(many.elements[1].rows[0].cells.length, 4);
  // text-only questions keep their layout
  const plain = layout.compose([{ type: 'multiple_choice', questions: [{ question: 'x', options: ['a', 'b'] }] }], {});
  assert.ok(plain.elements.every((e) => e.t === 'p'));
});

test('true/false, table, list and crossword with pictures', () => {
  const tf = layout.compose([{ type: 'true_false', statements: [{ text: 'Das ist ein Hund.', correct: true, ...pic(1, 'Hund') }, { text: 'Ohne Bild', correct: false }] }], { textWidthMm: 170 });
  const t = tf.elements[0];
  assert.equal(t.widths.length, 4, 'a picture column in front of the statements');
  assert.equal(t.rows[1].cells[0].content[0].runs[0].image.heightMm, 18);
  assert.deepEqual(altSource(t.rows[1].cells[0].content[0].runs[0].image), { image_id: 'arasaac:1' }, 'the statement text is not the picture text');
  assert.equal(cellTexts(t.rows[1].cells[1]), '1.  Das ist ein Hund.');
  assert.equal(cellTexts(t.rows[2].cells[0]), '', 'no picture: empty cell');
  const tfPlain = layout.compose([{ type: 'true_false', statements: ['a'] }], {});
  assert.equal(tfPlain.elements[0].widths.length, 3);

  const table = layout.compose([{ type: 'table', widths: [1, 1], rows: [['Säugetier', 'Vogel'], [pic(1, 'Hund', { text: 'Hund' }), pic(2, 'Amsel')]] }], { textWidthMm: 170 });
  const row = table.elements[0].rows[1];
  assert.equal(row.cells[0].content[0].runs[0].image.heightMm, 30, 'at most 3 cm high');
  assert.equal(cellTexts(row.cells[0]), '|Hund');
  assert.equal(row.cells[0].content[1].jc, 'center');
  const narrow = layout.compose([{ type: 'table', rows: [[pic(1, 'x'), 'a', 'b', 'c', 'd', 'e', 'f', 'g']] }], { textWidthMm: 170 });
  assert.ok(narrow.elements[0].rows[0].cells[0].content[0].runs[0].image.widthMm < 170 / 8, 'picture fits a narrow cell');
  const wide = layout.compose([{ type: 'table', rows: [[pic(1, 'x', { width_cm: 5 }), 'a']] }], { textWidthMm: 170 });
  assert.equal(wide.elements[0].rows[0].cells[0].content[0].runs[0].image.widthMm, 50, 'width_cm overrides the default');

  const list = layout.compose([{ type: 'list', items: [pic(1, 'Apfel', { text: 'der Apfel' }), 'die Birne'] }], {});
  const li = list.elements[0];
  assert.equal(li.runs[0].image.heightMm, 15, 'pictogram 1.5 cm before the word');
  assert.equal(li.runs.slice(1).map((x) => x.text).join(''), '  der Apfel');
  assert.ok(li.numbering);
  assert.equal(list.elements[1].runs[0].text, 'die Birne');

  const cw = layout.compose([{ type: 'crossword', entries: [{ answer: 'Hund', ...pic(1, 'Hund') }, { answer: 'Haus', clue: 'Wohnung' }, { answer: 'Sonne', clue: 'warm' }, { answer: 'Nase', clue: 'im Gesicht', ...pic(2, 'Nase', {}, false) }] }], { textWidthMm: 170 });
  const grid = cw.elements[0].runs[0].image;
  const src = layout.parseMarker(grid.alt, layout.GRAPHIC_MARKER);
  assert.deepEqual(src.entries[0], { answer: 'Hund', image_id: 'arasaac:1' }, 'picture entry in the source, without data');
  assert.deepEqual(src.entries[3], { answer: 'Nase', clue: 'im Gesicht', image_id: 'arasaac:2' });
  assert.ok(!JSON.stringify(src).includes('base64'));
  const clues = [];
  walk(cw.elements, (e) => { if (e.t === 'p' && e.runs.some((x) => x.image && x.image.kind === 'picture')) clues.push(e); });
  assert.equal(clues.length, 2);
  for (const p of clues) assert.equal(p.runs.find((x) => x.image).image.heightMm, 20, 'picture clue 2 cm');
  const withText = clues.find((p) => p.runs.some((x) => x.text === 'im Gesicht'));
  assert.ok(withText, 'clue text next to the picture');
  assert.ok(!JSON.stringify(cw.elements).includes('⁣'), 'no placeholder printed');
  assert.throws(() => layout.compose([{ type: 'crossword', entries: [{ answer: 'Hund' }, { answer: 'Haus', clue: 'x' }] }], {}), /clue/);
});

test('computer science diagrams: theme colours, solution version, printed labels, source in the alt text', () => {
  const block = { type: 'structogram', title: 'Test', steps: [{ if: 'x > 0', then: ['[[y ← x]]'], else: ['y ← 0'] }] };
  const img = (r) => layout.collectImages(r.elements)[0];
  const de = img(layout.compose([block], { theme: 'modern', lang: 'de' }));
  const en = img(layout.compose([block], { theme: 'classic', lang: 'en' }));
  const sol = img(layout.compose([Object.assign({ show_answers: true }, block)], { theme: 'modern', lang: 'de' }));
  assert.match(de.svg, />wahr</);
  assert.match(de.svg, />falsch</);
  assert.match(en.svg, />true</);
  assert.match(de.svg, /fill="#eff6ff"/, 'modern: light accent header');
  assert.match(en.svg, /fill="#f2f2f2"/, 'classic: grey header');
  assert.ok(!de.svg.includes('y ← x'));
  assert.match(sol.svg, /fill="#2563eb"[^>]*font-weight="700">y ← x</);
  assert.equal(sol.widthMm, de.widthMm);
  assert.equal(sol.heightMm, de.heightMm);
  assert.match(de.alt, /^Struktogramm: Test\n\nWSGRAPHIC /);
  assert.deepEqual(layout.parseMarker(de.alt, layout.GRAPHIC_MARKER).steps, block.steps);
  // width_cm, and a precise error for the model
  const wide = img(layout.compose([Object.assign({ width_cm: 15 }, block)], {}));
  assert.ok(Math.abs(wide.widthMm - 152.4) < 0.01);
  assert.throws(() => layout.compose([{ type: 'class_diagram', classes: [{ name: 'A' }], relations: [{ from: 'A', to: 'X' }] }], {}),
    /^Error: blocks\[0\] \(class_diagram\): classDiagram: "relations\[0\]\.to" is "X"/);
  assert.deepEqual(layout.DIAGRAM_TYPES.filter((t) => !layout.GRAPHIC_TYPES.includes(t)), []);
});

test('flowchart: Start/Ende in the language of the worksheet', () => {
  const block = { type: 'flowchart', nodes: [{ kind: 'start' }, 'x ← 1', { kind: 'end' }] };
  const svg = (lang) => layout.collectImages(layout.compose([block], { lang }).elements)[0].svg;
  assert.match(svg('de'), />Ende</);
  assert.match(svg('en'), />End</);
  assert.match(svg('fr'), />Début</);
});

