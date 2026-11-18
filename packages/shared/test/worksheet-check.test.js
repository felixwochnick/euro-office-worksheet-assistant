'use strict';
// Unit tests for the deterministic worksheet quality check.
const test = require('node:test');
const assert = require('node:assert/strict');
const wc = require('../worksheet-check.js');

// --- builders --------------------------------------------------------------
function build(list) {
  return { elements: list.map((e, i) => Object.assign({ index: i }, e)) };
}
const P = (text, extra) => Object.assign({ type: 'paragraph', text }, extra);
const H = (text, level, extra) => Object.assign({ type: 'paragraph', text, is_heading: true, heading_level: level || 2 }, extra);
const LINE = () => ({ type: 'paragraph', text: '', empty: true, line: true });
const SPACER = () => ({ type: 'paragraph', text: '', empty: true });
const TABLE = (rows, extra) => Object.assign({ type: 'table', rows, text: rows.map((r) => r.join(' | ')).join(' | ') }, extra);
const TASK = (number, text, task) => H(text, 2, { task: Object.assign({ number: String(number), title: null, points: null, level: null }, task) });
const codes = (r) => r.issues.map((x) => x.code);

// A clean German worksheet as the editor plugin describes it.
function cleanWorksheet() {
  return build([
    H('Die Jahreszeiten', 1, { block: 'title' }),
    TABLE([['Name:', ''], ['Datum:', '']], { block: 'name_line' }),
    P('Im Jahr gibt es vier Jahreszeiten. Jede Jahreszeit hat drei Monate.'),
    TASK(1, 'Lückentext ___ / 4 P.', { title: 'Lückentext', points: 4 }),
    P('Ergänze die Lücken mit den Wörtern aus dem Wortspeicher.'),
    TABLE([['Frühling', 'Sommer', 'Herbst', 'Winter']], { block: 'word_bank' }),
    P('Im ________ blühen die Blumen. Im ________ ist es heiß.', { block: 'cloze' }),
    P('Im ________ fallen die Blätter. Im ________ schneit es.', { block: 'cloze' }),
    TASK(2, 'Kreuze an: Was passt zum Winter? ___ / 3 P.', { points: 3 }),
    P('☐ Schnee   ☐ Sonnenbrand   ☐ Schlitten'),
    TASK(3, 'Mein Lieblingsmonat ___ / 3 P.', { title: 'Mein Lieblingsmonat', points: 3 }),
    P('Schreibe zwei Sätze über deinen Lieblingsmonat.'),
    LINE(),
    LINE(),
    P('Gesamtpunktzahl: ___ / 10 Punkte'),
    H('Lösungen', 1),
    P('Aufgabe 1: Frühling, Sommer, Herbst, Winter'),
    P('Aufgabe 2: Schnee, Schlitten'),
    P('Aufgabe 3: individuelle Lösung')
  ]);
}

test('clean worksheet: no issues, tasks and stats', () => {
  const r = wc.check(cleanWorksheet(), { grade: 3 });
  assert.deepEqual(r.issues, []);
  assert.equal(r.ok, true);
  assert.equal(r.summary, 'No issues found (3 tasks, 10 points).');
  assert.deepEqual(r.tasks.map((t) => [t.number, t.element_index, t.points, t.has_instruction, t.has_workspace]),
    [['1', 3, 4, true, true], ['2', 8, 3, true, true], ['3', 10, 3, true, true]]);
  assert.equal(r.tasks[0].title, 'Lückentext');
  assert.equal(r.tasks[1].title, 'Kreuze an: Was passt zum Winter?');
  assert.equal(r.stats.tasks, 3);
  assert.equal(r.stats.points_total, 10);
  assert.equal(r.stats.points_declared, 10);
  assert.equal(r.stats.pages, null);
  assert.ok(r.stats.words > 20 && r.stats.sentences >= 5);
  assert.ok(r.stats.lix > 0 && r.stats.lix < 40, String(r.stats.lix));
  assert.equal(r.tasks[0].page_start, null);
});

test('worksheet with typical mistakes', () => {
  const doc = build([
    H('Bruchrechnung', 1),                                                   // 0
    P('**Achtung:** Lies jede Aufgabe genau.'),                               // 1
    TASK(1, 'Berechne die Ergebnisse. ___ / 4 P.', { points: 4 }),             // 2
    P('a) 1/2 + 1/4 = ________'),                                            // 3
    P('b) 3/4 − 1/8 = ________'),                                            // 4
    TASK(2, 'Textaufgaben ___ / 5 P.', { title: 'Textaufgaben', points: 5 }), // 5
    P('Beantworte die Fragen in ganzen Sätzen.'),                            // 6
    P('Wie viel Pizza bleibt übrig, wenn Tom ein Viertel isst?'),            // 7
    P('Wer hat mehr Kuchen, Anna oder Ben?'),                                // 8
    TASK(4, 'Zeichne die Brüche in die Kreise. ___ / 3 P.', { points: 3 }),   // 9
    P('', { graphic: { type: 'svg' }, page_start: 2, page_end: 2 }),         // 10
    SPACER(),                                                                 // 11
    P('Gesamt: ____ / 15 P')                                                  // 12
  ]);
  // page information: task 4's heading is the last line of page 1
  doc.elements.forEach((el) => { el.page_start = el.page_end = el.index <= 9 ? 1 : 2; });
  doc.layout = { pages: 2, last_page_fill: 0.5 };
  const r = wc.check(doc, { grade: 6 });
  assert.equal(r.ok, false);
  assert.deepEqual(codes(r), ['leftover_markup', 'points_mismatch', 'task_numbering', 'no_workspace',
    'task_split', 'missing_name_line']);
  const byCode = (c) => r.issues.find((x) => x.code === c);
  assert.equal(byCode('leftover_markup').element_index, 1);
  assert.match(byCode('leftover_markup').message, /Element 1 .*"\*\*"/);
  assert.equal(byCode('points_mismatch').severity, 'error');
  assert.match(byCode('points_mismatch').message, /total of 15 points \(element 12\).*\(12\)/);
  assert.match(byCode('task_numbering').message, /Task 4 \(element 9\) should be task 3/);
  assert.equal(byCode('no_workspace').element_index, 5);
  assert.match(byCode('no_workspace').message, /^Task 2 \(element 5\) has no space for answers/);
  assert.match(byCode('task_split').message, /task 4 \(element 9\) is alone at the bottom of page 1/);
  assert.equal(r.stats.points_total, 12);
  assert.equal(r.stats.points_declared, 15);
  assert.equal(r.stats.pages, 2);
  assert.equal(r.summary, '2 errors, 3 warnings, 1 hint: leftover markup, points mismatch, task numbering, ' +
    'no workspace, task split, missing name line.');
  assert.deepEqual(r.tasks.map((t) => [t.number, t.page_start, t.page_end]), [['1', 1, 1], ['2', 1, 1], ['4', 1, 2]]);
});

test('solutions section: tasks without a solution, solutions are not tasks', () => {
  const doc = build([
    H('Tiere im Wald', 1),
    P('Name: ______________'),
    H('Aufgabe 1 (2 P)', 2), P('Schreibe drei Waldtiere auf.'), LINE(),
    H('Aufgabe 2 (2 P)', 2), P('Beantworte: Was frisst ein Igel?'), LINE(),
    H('Aufgabe 3 (2 P)', 2), P('Male einen Fuchs.'), SPACER(), SPACER(),
    H('Lösungen', 2),
    P('1) Reh, Fuchs, Igel'),
    P('Aufgabe 3: individuell'),
    H('Aufgabe 2', 3)            // a task header inside the solutions does not start a new task
  ]);
  const r = wc.check(doc);
  assert.deepEqual(r.tasks.map((t) => t.number), ['1', '2', '3']);
  assert.deepEqual(r.tasks.map((t) => t.points), [2, 2, 2]);
  assert.deepEqual(codes(r), []);   // task 2 is covered by the task header in the solutions

  doc.elements.pop();
  const r2 = wc.check(doc);
  assert.deepEqual(codes(r2), ['solutions_incomplete']);
  assert.equal(r2.issues[0].severity, 'hint');
  assert.equal(r2.issues[0].element_index, 12);
  assert.match(r2.issues[0].message, /do not cover task 2 – add its solution/);
  assert.equal(r2.ok, true);
});

test('cloze: gaps and word bank do not match', () => {
  const doc = build([
    H('Haustiere', 1, { block: 'title' }),
    P('Name: ______  Klasse: ____'),
    TASK(1, 'Setze die Wörter aus dem Wortspeicher ein.'),
    P('Wortspeicher: Hund · Katze · Maus · Pferd · Kuh', { block: 'box' }),
    P('Der ________ bellt. Die ________ miaut.'),
    P('Die ________ piepst. Das ________ wiehert.')
  ]);
  const r = wc.check(doc);
  assert.deepEqual(codes(r), ['cloze_bank_mismatch']);
  assert.match(r.issues[0].message, /^Task 1 \(element 2\) has 4 gaps but the word bank \(element 3\) has 5 words/);
  // with a matching bank there is no hint; a bank table with rows works too
  doc.elements[3] = Object.assign(TABLE([['Hund', 'Katze'], ['Maus', 'Pferd']], { block: 'word_bank' }), { index: 3 });
  assert.deepEqual(codes(wc.check(doc)), []);
});

test('English worksheet with headings "Task N" and points in the header', () => {
  const doc = build([
    H('My Hobbies', 1),
    P('Name: ____________   Class: ____'),
    H('Task 1 (5 points)', 2),
    P('Write three sentences about your favourite hobby.'),
    LINE(), LINE(), LINE(),
    H('Task 2 (5 points)', 2),
    P('Answer the questions about the text.'),
    P('What does Tom do on Sundays?'),
    P('Where does he meet his friends?'),
    P('Total: ___ / 12 points')
  ]);
  const r = wc.check(doc, { grade: 6 });
  assert.deepEqual(codes(r), ['points_mismatch', 'no_workspace']);
  assert.match(r.issues[1].message, /^Task 2 \(element 7\) has no space for answers/);
  assert.deepEqual(r.tasks.map((t) => [t.number, t.points, t.title]), [['1', 5, null], ['2', 5, null]]);
  assert.equal(r.stats.points_declared, 12);
});

test('workspace rules avoid false positives', () => {
  const doc = build([
    H('Gemischte Aufgaben', 1), P('Name: ________'),
    TASK(1, 'Male das Bild bunt an.'), P('', { has_image: true }),
    TASK(2, 'Ordne die Tiere ihren Lebensräumen zu.'), TABLE([['Fisch', 'Wald'], ['Reh', 'Meer']], { block: 'matching' }),
    TASK(3, 'Kreuze an: richtig oder falsch?'), TABLE([['Satz', 'r', 'f'], ['Igel fressen Schnecken.', '', '']], { block: 'true_false' }),
    TASK(4, 'Schreibe die Töne in das Notensystem.'), P('', { abc: 'X:1\nL:1/4\nK:C\nx4 | x4 |]' }),
    TASK(5, 'Schreibe das Wort fünfmal schön ab.'), P('', { graphic: { type: 'lineature' } }),
    TASK(6, 'Lies den Text und markiere alle Nomen.'), P('Es war einmal ein kleiner Igel, der im Wald lebte.'),
    TASK(7, 'Trage die fehlenden Zahlen ein.'), P('', { graphic: { type: 'number_line', blanks: [3, 7] } }),
    TASK(8, 'Ergänze die Tabelle.'), TABLE([['3 · 4', ''], ['5 · 6', '']]),
    TASK(9, 'Löse das Kreuzworträtsel.'), TABLE([['', ''], ['', '']], { block: 'crossword' })
  ]);
  const r = wc.check(doc);
  assert.deepEqual(r.issues, []);
  assert.ok(r.tasks.every((t) => t.has_instruction));
  assert.deepEqual(r.tasks.map((t) => t.has_workspace), [true, true, true, true, true, false, true, true, true]);
});

test('no_workspace: kind-specific advice for ticking, matching and drawing', () => {
  const doc = build([
    H('Test', 1), P('Name: ____'),
    TASK(1, 'Kreuze die richtige Antwort an.'), P('Der Igel ist ein Säugetier.'),
    TASK(2, 'Verbinde die Wörter.'), P('Hund, Katze, Maus'),
    TASK(3, 'Zeichne einen Baum.'),
    // a self-assessment after the last task is not its workspace
    TABLE([['Ich kann Bäume zeichnen.', '', '']], { block: 'self_assessment' })
  ]);
  const r = wc.check(doc);
  assert.deepEqual(codes(r), ['no_workspace', 'no_workspace', 'no_workspace']);
  assert.match(r.issues[0].message, /Task 1 \(element 2\) asks to tick answers but has no boxes/);
  assert.match(r.issues[1].message, /Task 2 \(element 4\) asks to match items/);
  assert.match(r.issues[2].message, /Task 3 \(element 6\) asks to draw but has no free space/);
});

test('task without instruction, points incomplete, duplicated number', () => {
  const doc = build([
    H('Zahlen', 1), P('Name: ____'),
    TASK(1, 'Rechenpäckchen ___ / 4 P.', { title: 'Rechenpäckchen', points: 4 }),
    TABLE([['2 + 3 =', ''], ['4 + 5 =', '']]),
    TASK(2, 'Rechne aus.'), P('7 + 8 = ____'),
    TASK(2, 'Schreibe die Zahlen in Worten.'), LINE()
  ]);
  const r = wc.check(doc);
  assert.deepEqual(codes(r), ['task_numbering', 'task_numbering', 'task_without_instruction', 'points_incomplete']);
  assert.match(r.issues[0].message, /Task 2 appears twice \(elements 4 and 6\)/);
  assert.match(r.issues[1].message, /Task 2 \(element 6\) should be task 3/);
  assert.match(r.issues[2].message, /Task 1 \(element 2\) has no instruction/);
  assert.match(r.issues[3].message, /^Tasks 2, 2 \(element 4\) have no points/);
  assert.equal(r.stats.points_total, 4);
});

test('leftover markup variants are errors, normal text is not', () => {
  const bad = ['# Überschrift', 'Das ist __fett__ gedruckt.', 'Code `x`', 'Zeile 1\\nZeile 2', '[[Bild]]',
    'Formel \\(x^2\\)', '$$a+b$$', '<b>fett</b>', '| a | b |\n|---|---|'];
  bad.forEach((text) => {
    const r = wc.check(build([H('Titel', 1), P('Name: ___'), P(text)]));
    assert.deepEqual(codes(r), ['leftover_markup'], text);
    assert.equal(r.ok, false);
  });
  const good = ['Der Hund ________ im Garten.', 'Preis: 3 € < 5 €', 'Nr. 5 und #3', 'Ein Satz – mit Gedankenstrich.'];
  good.forEach((text) => {
    assert.deepEqual(codes(wc.check(build([H('Titel', 1), P('Name: ___'), P(text)]))), [], text);
  });
});

test('title, name line and empty heading', () => {
  const r = wc.check(build([SPACER(), P('Lies den Text.'), H('', 2), P('Ein Text ohne Überschrift.')]));
  assert.deepEqual(codes(r), ['empty_heading', 'missing_title', 'missing_name_line']);
  assert.equal(r.issues[0].element_index, 2);
  assert.equal(r.issues[1].element_index, 1);
  assert.equal(r.issues[2].element_index, null);
  // a name_line block anywhere satisfies the name check
  assert.deepEqual(codes(wc.check(build([H('Titel', 1), P('Text.'), TABLE([['Name', '']], { block: 'name_line' })]))), []);
});

test('readability: LIX warning and long sentences for young pupils', () => {
  const long = 'Nachdem die außergewöhnlich neugierigen Eichhörnchen stundenlang zwischen den hohen ' +
    'Bäumen herumgesprungen waren, versteckten sie ihre gesammelten Haselnüsse sorgfältig unter dem ' +
    'feuchten Laub, damit sie im kalten Winter genug Nahrung finden und überleben konnten.';
  const doc = build([
    H('Eichhörnchen', 1), P('Name: ____'),
    P(long),
    P('Eichhörnchen klettern geschickt. Sie haben buschige Schwänze, die beim Springen helfen und im ' +
      'Winter wärmen, wenn es draußen sehr kalt und ungemütlich wird.'),
    P('Kurzer Satz. Noch ein Satz.')
  ]);
  const r = wc.check(doc, { grade: 2 });
  assert.deepEqual(codes(r), ['readability', 'long_sentence', 'long_sentence']);
  assert.match(r.issues[0].message, /LIX \d+(\.\d)?, grade 2: target at most 40/);
  assert.match(r.issues[1].message, /element 2 has 33 words \(grade 2: at most 15\) – split it: "Nachdem die/);
  assert.match(r.issues[2].message, /element 3 has 20 words/);
  // grade 8: no LIX warning (LIX < 60), only the 33-word sentence exceeds 30 words
  const r8 = wc.check(doc, { grade: 8 });
  assert.deepEqual(codes(r8), ['long_sentence']);
  // without a grade: LIX only in the stats, threshold 30
  const r0 = wc.check(doc);
  assert.deepEqual(codes(r0), ['long_sentence']);
  assert.ok(r0.stats.lix > 40);
  assert.equal(r0.stats.sentences, 5);
});

test('readability: at most 5 long-sentence hints, worst first; solutions and tables excluded', () => {
  const sentence = (n) => Array.from({ length: n }, (_, i) => 'Wort' + i).join(' ') + '.';
  const doc = build([H('Text', 1), P('Name: ___')]
    .concat([16, 20, 17, 25, 18, 19, 30].map((n) => P(sentence(n))))
    .concat([TABLE([[sentence(40)]]), H('Lösungen', 1), P(sentence(50))]));
  const r = wc.check(doc, { grade: 3 });
  const hints = r.issues.filter((x) => x.code === 'long_sentence');
  assert.equal(hints.length, 5);
  assert.deepEqual(hints.map((x) => Number(x.message.match(/has (\d+) words/)[1])), [30, 25, 20, 19, 18]);
  assert.equal(r.stats.sentences, 7);
  assert.equal(r.stats.words, 145);
});

test('layout: too many pages, split table, nearly empty last page, split task', () => {
  const doc = build([
    H('Wetter', 1, { page_start: 1, page_end: 1 }),
    P('Name: ___', { page_start: 1, page_end: 1 }),
    TASK(1, 'Trage die Temperaturen in die Tabelle ein.', { points: 4 }),
    TABLE([['Mo', ''], ['Di', ''], ['Mi', ''], ['Do', '']]),
    TASK(2, 'Schreibe einen Wetterbericht.', { points: 6 }),
    LINE(), LINE()
  ]);
  const pages = [1, 1, 1, 1, 2, 2, 3];
  doc.elements.forEach((el, i) => { el.page_start = el.page_end = pages[i]; });
  doc.elements[3].page_end = 2;          // the table runs over to page 2
  doc.elements[4].page_start = 2; doc.elements[4].page_end = 2;
  doc.layout = { pages: 3, last_page_fill: 0.12 };
  const r = wc.check(doc, { max_pages: 2 });
  assert.deepEqual(codes(r), ['too_many_pages', 'task_split', 'task_split', 'table_split', 'last_page_nearly_empty']);
  assert.match(r.issues[0].message, /has 3 pages but should have at most 2/);
  assert.match(r.issues[1].message, /Task 1 \(element 2\) is split across pages 1–2/);
  assert.match(r.issues[2].message, /Task 2 \(element 4\) is split across pages 2–3/);
  assert.match(r.issues[3].message, /table in element 3 \(4 rows\) is split across pages 1–2/);
  assert.equal(r.issues[4].message, 'Only 12 % of page 3 is used – shorten or move content, or add a task.');
  assert.equal(r.stats.pages, 3);
  // long tables (15+ rows) may be split
  doc.elements[3].rows = Array.from({ length: 16 }, () => ['x', '']);
  assert.ok(!codes(wc.check(doc)).includes('table_split'));
  // without page information there are no layout checks
  doc.elements.forEach((el) => { delete el.page_start; delete el.page_end; });
  delete doc.layout;
  assert.deepEqual(codes(wc.check(doc, { max_pages: 1 })), []);
});

test('lix()', () => {
  assert.equal(wc.lix(''), 0);
  assert.equal(wc.lix(null), 0);
  assert.equal(wc.lix('Der Hund läuft schnell. Die Katze schläft im Garten.'), 26.7);   // 9/2 + 100*2/9
  assert.equal(wc.lix('Ich bin da'), 3);                                               // one sentence, no long words
  assert.equal(wc.lix('Wir lesen z. B. ein Buch.'), 6);                                // abbreviation is no sentence end
  assert.ok(wc.lix('Die Bundesregierung verabschiedete umfangreiche Gesetzesänderungen.') > 60);
});

test('detectTasks()', () => {
  const doc = build([
    H('Titel', 1),                                    // 0
    H('Aufgabe 1: Lies den Text.', 2),                // 1
    P('Text …'),                                      // 2
    P('Aufgabe 2: Schreibe eine Antwort.'),           // 3 paragraph header with colon
    LINE(),                                           // 4
    H('Teil B', 1),                                   // 5 ends task 2 (a paragraph header ends at any heading)
    H('Übung 3a', 2),                                 // 6
    H('Hinweis', 3),                                  // 7 lower level: stays in task 3a
    P('Aufgabe 4 ist freiwillig.'),                   // 8 no colon: not a task header
    H('A4', 2, { task: { number: '4', title: 'Zusatz', points: 2 } }),   // 9
    P('Rechne.'),                                     // 10
    H('Exercise 5 (3 points)', 2),                    // 11
    H('Nr. 6', 2),                                    // 12
    H('Erwartungshorizont', 2),                       // 13 solutions
    H('Aufgabe 7', 2)                                 // 14 inside the solutions
  ]);
  assert.deepEqual(wc.detectTasks(doc), [
    { number: '1', title: 'Lies den Text.', element_index: 1, end_index: 2, points: null },
    { number: '2', title: 'Schreibe eine Antwort.', element_index: 3, end_index: 4, points: null },
    { number: '3a', title: null, element_index: 6, end_index: 8, points: null },
    { number: '4', title: 'Zusatz', element_index: 9, end_index: 10, points: 2 },
    { number: '5', title: null, element_index: 11, end_index: 11, points: 3 },
    { number: '6', title: null, element_index: 12, end_index: 12, points: null }
  ]);
  assert.deepEqual(wc.detectTasks({}), []);
  assert.deepEqual(wc.detectTasks(null), []);
});

test('robust against missing fields', () => {
  const r = wc.check({ elements: [{ index: 0, type: 'paragraph' }, { index: 1, type: 'table' }, null] }, null);
  assert.equal(r.ok, true);
  assert.equal(typeof r.summary, 'string');
  assert.deepEqual(wc.check(undefined).issues, []);
});

test('output of the worksheet layout: title after a subject line, one-cell word bank', () => {
  // As the editor reports a designed worksheet: "SACHUNTERRICHT · KLASSE 3", title (Heading 1), word bank box.
  const doc = build([
    P('SACHUNTERRICHT  ·  KLASSE 3'),
    H('Der Wasserkreislauf', 1),
    TABLE([['Name:', '', 'Klasse:', '']], { block: 'name_line' }),
    TASK(1, '\tLies den Text und ergänze die Lücken.\t___ / 4 P.', { points: 4 }),
    P('Die ________ erwärmt das Wasser. Es ________ und steigt auf. Oben bilden sich ________. Dann fällt ________.'),
    TABLE([['Wortspeicher\nRegen     Sonne     verdunstet     Wolken']], { block: 'word_bank' }),
  ]);
  const r = wc.check(doc, { grade: 3 });
  assert.ok(!codes(r).includes('missing_title'), JSON.stringify(r.issues));
  assert.ok(!codes(r).includes('cloze_bank_mismatch'), JSON.stringify(r.issues));
  const off = wc.check(build([doc.elements[0], doc.elements[2], doc.elements[3], doc.elements[4],
    TABLE([['Wortspeicher\nRegen     Sonne']], { block: 'word_bank' })]), { grade: 3 });
  assert.ok(codes(off).includes('missing_title'));
  assert.ok(codes(off).includes('cloze_bank_mismatch'));
});
