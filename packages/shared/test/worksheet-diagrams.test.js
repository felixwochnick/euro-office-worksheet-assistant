'use strict';
// Unit tests for the computer science diagrams (packages/shared/worksheet-diagrams.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const wd = require('../worksheet-diagrams.js');
const { assertWellFormed } = require('./xml-helper.js');

const ACCENT = '#2563eb';
const BASE = { accentColor: ACCENT, maxWidthMm: 170 };

/** Common contract: well-formed SVG, sizes in mm match the root, deterministic. */
function render(fn, opts) {
  const o = Object.assign({}, BASE, opts);
  const g = wd[fn](o);
  assertWellFormed(g.svg);
  assert.ok(g.widthMm > 0 && g.heightMm > 0, `${fn}: ${g.widthMm} × ${g.heightMm}`);
  assert.ok(g.widthMm <= 170.001, `${fn}: ${g.widthMm} mm wide`);
  const m = /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="([\d.]+)" height="([\d.]+)" viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)">/.exec(g.svg);
  assert.ok(m, 'svg root: ' + g.svg.slice(0, 160));
  assert.ok(Math.abs(Number(m[1]) - g.widthMm / 25.4 * 96) < 0.02);
  assert.equal(wd[fn](o).svg, g.svg, `${fn} is deterministic`);
  assert.doesNotMatch(g.svg, /NaN|undefined|Infinity/);
  return g;
}

/** Student and solution version: same size; the solution shows the answers, the student version does not. */
function pair(fn, opts, answers) {
  const student = render(fn, Object.assign({}, opts, { showAnswers: false }));
  const solution = render(fn, Object.assign({}, opts, { showAnswers: true }));
  assert.equal(student.widthMm, solution.widthMm, `${fn}: same width`);
  assert.equal(student.heightMm, solution.heightMm, `${fn}: same height`);
  const vb = (svg) => /viewBox="([^"]+)"/.exec(svg)[1];
  assert.equal(vb(student.svg), vb(solution.svg), `${fn}: same viewBox`);
  for (const a of answers) {
    assert.ok(solution.svg.includes(a), `${fn}: solution shows ${a}`);
    assert.ok(!student.svg.includes(a), `${fn}: student version hides ${a}`);
  }
  assert.match(student.svg, /stroke-dasharray="0\.9 0\.7"/, `${fn}: writing lines in the student version`);
  return { student, solution };
}

const CLASSES = {
  classes: [
    { name: 'Konto', kind: 'abstract', attributes: ['- kontonummer: String', '# kontostand: double', '- static anzahl: int'], methods: ['+ einzahlen(betrag: double)', '+ abstract abheben(betrag: double): boolean'] },
    { name: 'Girokonto', attributes: ['- dispo: double'], methods: ['+ abheben(betrag: double): boolean'] },
    { name: 'Sparkonto', attributes: ['[[- zinssatz: double]]'], methods: ['+ [[verzinsen()]]'] },
    { name: 'Kunde', attributes: ['- name: String'], methods: 2 },
    { name: 'Verzinsbar', kind: 'interface', methods: ['+ verzinsen()'] },
    { name: 'Kontoart', kind: 'enum', values: ['GIRO', 'SPAR'] },
  ],
  relations: [
    { from: 'Girokonto', to: 'Konto', kind: 'inheritance' },
    { from: 'Sparkonto', to: 'Konto', kind: 'inheritance', blank: true },
    { from: 'Sparkonto', to: 'Verzinsbar', kind: 'implementation' },
    { from: 'Kunde', to: 'Konto', label: 'besitzt', from_mult: '1', to_mult: '[[0..*]]', directed: true },
    { from: 'Konto', to: 'Kontoart', kind: 'dependency' },
  ],
};

test('class diagram: compartments, stereotypes, static/abstract, relations', () => {
  const { student, solution } = pair('classDiagram', CLASSES, ['zinssatz: double', 'verzinsen()</tspan>', '0..*']);
  assert.match(student.svg, /«abstract»/);
  assert.match(student.svg, /«interface»/);
  assert.match(student.svg, /«enumeration»/);
  // static -> underlined, abstract -> italic (the keywords themselves are not printed)
  assert.match(student.svg, /text-decoration="underline"[^>]*>- anzahl: int</);
  assert.match(student.svg, /font-style="italic"[^>]*>\+ abheben\(betrag: double\): boolean</);
  assert.doesNotMatch(student.svg, /static|abstract abheben/);
  // the blank inheritance is drawn only in the solution, in the accent colour
  const tri = (svg) => (svg.match(/fill="#ffffff" stroke="[^"]+" stroke-width="0\.3" stroke-linejoin="round"/g) || []).length;
  assert.equal(tri(solution.svg), tri(student.svg) + 1);
  assert.ok(solution.svg.includes(`stroke="${ACCENT}"`));
  // a horizontal layout without inheritance
  const h = render('classDiagram', { classes: [{ name: 'Auto' }, { name: 'Motor' }], relations: [{ from: 'Auto', to: 'Motor', kind: 'composition', to_mult: '1' }] });
  assert.ok(h.widthMm > h.heightMm);
  const v = render('classDiagram', { classes: [{ name: 'Auto' }, { name: 'Motor' }], relations: [{ from: 'Auto', to: 'Motor', kind: 'composition' }], direction: 'vertical' });
  assert.ok(v.heightMm > v.widthMm);
});

test('self-references are drawn as loops (class, object, state and ER diagrams)', () => {
  const loop = /d="M[\d.]+ [\d.]+L[\d.]+ [\d.]+L[\d.]+ -?[\d.]+L[\d.]+ -?[\d.]+L[\d.]+ -?[\d.]+"/;
  const cls = render('classDiagram', {
    classes: [{ name: 'Liste' }, { name: 'Element', attributes: ['- wert: int'] }],
    relations: [{ from: 'Liste', to: 'Element', label: 'kopf', directed: true }, { from: 'Element', to: 'Element', label: 'naechstes', to_mult: '0..1', directed: true }],
  });
  assert.match(cls.svg, loop, 'orthogonal loop over the corner');
  assert.match(cls.svg, />naechstes</);
  const obj = render('objectDiagram', { objects: [{ name: 'e', class: 'Element' }], links: [{ from: 'e', to: 'e', label: 'selbst' }] });
  assert.match(obj.svg, loop);
  render('erDiagram', { entities: ['Mitarbeiter'], relationships: [{ name: 'leitet', from: 'Mitarbeiter', to: 'Mitarbeiter', from_card: '1', to_card: 'n' }] });
  const st = render('stateDiagram', { states: ['A'], transitions: [{ from: 'A', to: 'A', label: 'tick' }], direction: 'vertical' });
  assert.match(st.svg, /C[\d.]+ /, 'a curved loop');
});

test('class diagram: errors name the problem', () => {
  assert.throws(() => wd.classDiagram({ classes: [] }), /^Error: classDiagram: "classes" needs 1–16 entries/);
  assert.throws(() => wd.classDiagram({ classes: [{ name: 'A' }], relations: [{ from: 'A', to: 'B' }] }),
    /relations\[0\]\.to" is "B", which is not one of the classes: A\./);
  assert.throws(() => wd.classDiagram({ classes: [{ name: 'A' }, { name: 'B' }], relations: [{ from: 'A', to: 'B', kind: 'erbt' }] }), /kind must be inheritance/);
  assert.throws(() => wd.classDiagram({ classes: [{ name: 'A' }, { name: 'a' }] }), /two classes are named "a"/);
  assert.throws(() => wd.classDiagram({ classes: [{ name: 'A', kind: 'struct' }] }), /kind must be class, abstract, interface or enum/);
  assert.throws(() => wd.classDiagram({ classes: [{ name: 'A', attributes: 99 }] }), /as a number must be 0–15/);
  // a gap in a class name still lets relations refer to the class
  render('classDiagram', { classes: [{ name: '[[Hund]]' }, { name: 'Tier' }], relations: [{ from: 'Hund', to: 'Tier', kind: 'inheritance' }] });
});

test('too wide diagrams are scaled down, then refused', () => {
  const chain = {
    direction: 'horizontal',
    classes: Array.from({ length: 4 }, (_, i) => ({ name: 'Klasse' + i, attributes: ['- attribut' + i + ': String'] })),
    relations: [0, 1, 2].map((i) => ({ from: 'Klasse' + i, to: 'Klasse' + (i + 1) })),
  };
  const g = render('classDiagram', chain);
  assert.equal(Math.round(g.widthMm), 170, 'scaled down to the available width');
  assert.throws(() => wd.classDiagram(Object.assign({}, chain, { maxWidthMm: 100 })), /too wide: the diagram needs at least \d+ mm, but only 100 mm are available\. Use fewer/);
  // widthMm sets the width explicitly
  const w = render('classDiagram', { classes: [{ name: 'A' }, { name: 'B' }], relations: [{ from: 'A', to: 'B' }], widthMm: 100 });
  assert.equal(Math.round(w.widthMm), 100);
});

test('object diagram: underlined titles, values, links by name', () => {
  const { student } = pair('objectDiagram', {
    objects: [{ name: 'k1', class: 'Kunde', values: ['name = "Mia"'] }, { name: 'g1', class: 'Girokonto', values: ['dispo = [[500.0]]'] }, { class: 'Sparkonto', values: 2 }],
    links: [{ from: 'k1', to: 'g1', label: 'konto' }, { from: 'k1 : Kunde', to: ': Sparkonto', blank: true }],
  }, ['500.0']);
  assert.match(student.svg, /text-decoration="underline"[^>]*>k1 : Kunde</);
  assert.match(student.svg, /name = &quot;Mia&quot;/);
  assert.throws(() => wd.objectDiagram({ objects: [{ name: 'a', class: 'A' }], links: [{ from: 'a', to: 'b' }] }), /links\[0\]\.to" is "b", which is not one of the objects/);
});

test('sequence diagram: messages, fragments, self calls, create, activations', () => {
  const opts = {
    participants: [{ name: 'Kunde', kind: 'actor' }, ':Automat', 'k: Konto'],
    messages: [
      { from: 'Kunde', to: ':Automat', text: 'karteEinlegen()' },
      { from: ':Automat', to: 'k: Konto', text: 'pruefePin(pin)' },
      { from: 'k: Konto', to: ':Automat', text: '[[true]]', kind: 'return' },
      { fragment: 'alt', label: 'betrag <= kontostand', messages: [
        { from: ':Automat', to: 'k: Konto', text: 'abheben(betrag)' },
        { from: 'k: Konto', to: 'k: Konto', text: 'aktualisiereSaldo()' },
      ], else: { label: 'sonst', messages: [{ from: ':Automat', to: 'Kunde', text: 'zeigeFehler()', kind: 'async', blank: true }] } },
      { fragment: 'loop', label: '[für jeden Schein]', messages: [{ from: ':Automat', to: 'Kunde', text: 'gibSchein()', kind: 'async' }] },
    ],
  };
  const { student, solution } = pair('sequenceDiagram', opts, ['true</tspan>', 'zeigeFehler()']);
  assert.match(student.svg, />alt</);
  assert.match(student.svg, />\[betrag &lt;= kontostand\]</);
  assert.match(student.svg, />\[für jeden Schein\]</, 'guards in brackets are not bracketed twice');
  assert.match(student.svg, />\[sonst\]</);
  assert.match(student.svg, /<circle/, 'actor');
  // activation bars: 2.4 mm wide rectangles
  assert.ok((student.svg.match(/width="2\.4"/g) || []).length >= 3);
  assert.ok(solution.svg.length > student.svg.length);
  const noBars = render('sequenceDiagram', Object.assign({}, opts, { activations: false }));
  assert.equal((noBars.svg.match(/width="2\.4"/g) || []).length, 0);
  // create: the created object's head sits at the message
  render('sequenceDiagram', { participants: [':Liste', 'e: Element'], messages: [{ from: ':Liste', to: 'e: Element', text: 'new Element(5)', kind: 'create' }, { from: ':Liste', to: 'e: Element', text: 'setWert(3)' }] });
  assert.throws(() => wd.sequenceDiagram({ participants: ['a', 'b'], messages: [{ from: 'a', to: 'b', text: 'x' }, { from: 'a', to: 'b', text: 'new', kind: 'create' }] }), /before it is created/);
  assert.throws(() => wd.sequenceDiagram({ participants: ['a', 'b'], messages: [{ from: 'a', to: 'b', text: 'x', kind: 'calls' }] }), /kind must be call, async, return or create/);
  assert.throws(() => wd.sequenceDiagram({ participants: ['a', 'b'], messages: [{ fragment: 'opt', label: 'x', messages: [], else: { messages: [] } }] }), /only alt and par fragments have an else part/);
  assert.throws(() => wd.sequenceDiagram({ participants: ['a'], messages: [] }), /needs at least one message/);
});

test('state diagram: UML states, pseudo-states, self-transitions, blank transitions', () => {
  const { student } = pair('stateDiagram', {
    states: ['Aus', { name: 'Bereit', activities: ['entry / lampeAn()'] }, { name: 'Läuft', activities: ['exit / [[signalton()]]'] }],
    transitions: [
      { from: '[*]', to: 'Aus' },
      { from: 'Aus', to: 'Bereit', label: 'einschalten' },
      { from: 'Bereit', to: 'Läuft', label: 'start [tür zu] / timerStarten()' },
      { from: 'Läuft', to: 'Läuft', label: 'plus / zeit += 30' },
      { from: 'Läuft', to: 'Bereit', label: 'fertig', blank: true },
      { from: 'Aus', to: '[*]' },
    ],
  }, ['signalton()', 'fertig']);
  assert.match(student.svg, /rx="2\.4"/, 'rounded states');
  assert.match(student.svg, /<circle[^>]*r="1\.8"/, 'initial state');
  assert.match(student.svg, /<circle[^>]*r="2\.6"/, 'final state');
  assert.match(student.svg, /plus \/ zeit \+= 30/);
  assert.throws(() => wd.stateDiagram({ states: ['A'], transitions: [{ from: 'A', to: 'B' }] }), /transitions\[0\]\.to" is "B", which is not one of the states: A/);
  assert.throws(() => wd.stateDiagram({ states: ['A'], transitions: [{ from: 'A', to: '[*]' }], notation: 'automaton' }), /accepting/);
  assert.throws(() => wd.stateDiagram({ states: ['A'], notation: 'petri' }), /"notation" must be "uml" or "automaton"/);
});

test('finite automaton: circles, accepting states, start arrow, merged loops', () => {
  const g = render('stateDiagram', {
    notation: 'automaton', states: ['q0', 'q1', 'q2'], initial: 'q0', accepting: ['q2'],
    transitions: [{ from: 'q0', to: 'q1', label: 'a' }, { from: 'q1', to: 'q2', label: 'b' }, { from: 'q2', to: 'q2', label: 'a' }, { from: 'q2', to: 'q2', label: 'b' }],
  });
  // q2 is accepting: two circles
  assert.equal((g.svg.match(/<circle/g) || []).length, 4);
  // two self-loops on q2 become one loop labelled "a, b"
  assert.match(g.svg, />a, b</);
  assert.throws(() => wd.stateDiagram({ notation: 'automaton', states: ['q0'], accepting: ['q9'] }), /"accepting" names "q9", which is not a state/);
});

test('structogram: all control structures, labels, empty boxes and gaps', () => {
  const steps = [
    'Lies a und b ein',
    { while: 'solange a ≠ b', do: [{ if: 'a > b', then: ['a ← a − b'], else: ['[[b ← b − a]]'] }] },
    { switch: 'note', cases: [{ label: '1', do: ['Ausgabe "sehr gut"'] }, { label: '2', do: ['Ausgabe "gut"'] }], default: ['Ausgabe "üben"'] },
    { repeat: ['zahl ← zahl div 10', ''], until: 'bis zahl = 0' },
    { for: 'für i von 1 bis 3', do: [] },
    { loop: ['blinke()'] },
    { call: 'ausgabe(a)' },
    { exit: 'return a' },
  ];
  const { student } = pair('structogram', { title: 'ggT(a, b)', steps, labels: { yes: 'ja', no: 'nein', otherwise: 'andernfalls' } }, ['b ← b − a']);
  assert.match(student.svg, />ja</);
  assert.match(student.svg, />nein</);
  assert.match(student.svg, />andernfalls</);
  assert.match(student.svg, />∅</, 'empty loop body');
  assert.match(student.svg, /stroke-width="0\.6"/, 'thick outer frame');
  // the structogram takes the requested width
  const wide = render('structogram', { steps: ['x ← 1'], widthMm: 150 });
  assert.equal(Math.round(wide.widthMm), 152);
  assert.throws(() => wd.structogram({ steps: [{ when: 'x' }] }), /steps\[0\] is not a statement/);
  assert.throws(() => wd.structogram({ steps: [{ if: '', then: [] }] }), /steps\[0\]\.if" must not be empty/);
  assert.throws(() => wd.structogram({ steps: [] }), /"steps" needs 1–80 entries/);
  // a very narrow column: a plain "too wide" message instead of an option error
  assert.throws(() => wd.structogram({ steps: ['eine ziemlich lange Anweisung mit vielen Wörtern'], maxWidthMm: 30 }), /too wide: .* only 30 mm are available/);
});

test('ER diagram: Chen, (min,max) and crow\'s foot', () => {
  const model = {
    entities: [{ name: 'Schüler', attributes: ['__SchülerID__', 'Name'] }, { name: 'Kurs', attributes: ['__KursID__', 'Thema'] }],
    relationships: [{ name: 'belegt', from: 'Schüler', to: 'Kurs', from_card: 'n', to_card: '[[m]]', attributes: ['Note'] }],
  };
  const { student } = pair('erDiagram', model, ['>m</tspan>']);
  assert.match(student.svg, /<ellipse/);
  assert.match(student.svg, /text-decoration="underline"[^>]*>SchülerID</);
  assert.match(student.svg, />belegt</);
  render('erDiagram', Object.assign({ notation: 'minmax' }, model, { relationships: [{ name: 'belegt', from: 'Schüler', to: 'Kurs', from_card: '(0,*)', to_card: '(1,*)' }] }));
  const crow = render('erDiagram', {
    notation: 'crowsfoot',
    entities: [{ name: 'Klasse', attributes: ['__id__', 'name'] }, { name: 'Schueler', attributes: ['__id__', 'klasse_id (FK)'] }],
    relationships: [{ name: 'hat', from: 'Klasse', to: 'Schueler', from_card: '1', to_card: '0..*' }],
  });
  assert.match(crow.svg, />PK</);
  assert.match(crow.svg, />FK</);
  assert.match(crow.svg, /<circle/, 'optional end (0..*)');
  assert.throws(() => wd.erDiagram({ entities: ['A'], notation: 'uml' }), /"notation" must be "chen", "minmax" or "crowsfoot"/);
  assert.throws(() => wd.erDiagram({ entities: ['A'], relationships: [{ from: 'A', to: 'B' }] }), /which is not one of the entities: A/);
});

test('texts are escaped', () => {
  const g = render('classDiagram', { classes: [{ name: 'List<T>', methods: ['+ add(e: T): boolean & "mehr"'] }] });
  assert.match(g.svg, /List&lt;T&gt;/);
  assert.match(g.svg, /&amp; &quot;mehr&quot;/);
});

test('the vendored dagre (plugin) and the npm package (Node) have the same version', () => {
  const vendored = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'vendor', 'dagre', 'dagre.min.js'), 'utf8');
  const npm = require('@dagrejs/dagre/package.json').version;
  assert.ok(vendored.includes(`"${npm}"`), `vendor/dagre/dagre.min.js is not dagre ${npm} – run scripts/build.sh --update-vendor with DAGRE_VERSION=${npm}`);
  assert.equal(require('../package.json').dependencies['@dagrejs/dagre'], npm, 'exact version in packages/shared/package.json');
});

test('blank elements outside the boxes keep the layout of the solution', () => {
  const same = (fn, opts) => {
    const a = wd[fn](Object.assign({}, BASE, opts, { showAnswers: false }));
    const b = wd[fn](Object.assign({}, BASE, opts, { showAnswers: true }));
    assert.equal(a.widthMm, b.widthMm, fn);
    assert.equal(a.heightMm, b.heightMm, fn);
    assert.equal(/viewBox="([^"]+)"/.exec(a.svg)[1], /viewBox="([^"]+)"/.exec(b.svg)[1], fn);
    assert.ok(a.svg.length < b.svg.length, `${fn}: the solution draws more`);
  };
  same('classDiagram', { classes: ['Element'], relations: [{ from: 'Element', to: 'Element', label: 'next', blank: true }] });
  same('objectDiagram', { objects: [{ name: 'e', class: 'E' }], links: [{ from: 'e', to: 'e', label: 'x', blank: true }] });
  same('stateDiagram', { states: ['A'], transitions: [{ from: 'A', to: 'A', label: 'tick', blank: true }] });
  same('erDiagram', { entities: ['A', 'B'], relationships: [{ name: 'r', from: 'A', to: 'B', from_card: '1', to_card: 'n', attributes: ['seit', 'bis'], blank: true }] });
  same('erDiagram', { notation: 'crowsfoot', entities: ['A', 'B'], relationships: [{ name: 'hat', from: 'A', to: 'B', from_card: '1', to_card: '0..*', blank: true }] });
  same('sequenceDiagram', { participants: ['a', 'b'], messages: [{ from: 'a', to: 'b', text: 'x()' }, { from: 'b', to: 'b', text: 'eineLangeSelbstnachricht()', blank: true }] });
});

test('sequence diagram: a created or asynchronously called object does not end other activations', () => {
  const g = wd.sequenceDiagram(Object.assign({}, BASE, {
    participants: ['A', 'B', 'c: C'],
    messages: [
      { from: 'A', to: 'B', text: 'run()' },
      { from: 'B', to: 'c: C', text: 'new C()', kind: 'create' },
      { from: 'c: C', to: 'B', text: 'register()' },
      { from: 'B', to: 'B', text: 'helper()' },
      { from: 'B', to: 'A', text: 'ok', kind: 'return' },
    ],
  }));
  // bars (2.4 mm wide): B run() – one bar through to "ok", B register() and B helper() nested in it
  const bars = [...g.svg.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="2\.4" height="([\d.-]+)"/g)].map((m) => ({ x: +m[1], y: +m[2], h: +m[3] }))
    .sort((p, q) => p.y - q.y);
  assert.equal(bars.length, 3);
  const [run, reg, help] = bars;
  assert.ok(run.y < reg.y && reg.y < help.y);
  const end = (b) => Math.round((b.y + b.h) * 100) / 100;
  assert.ok(end(run) >= end(reg) && end(reg) >= end(help), 'nested bars end inside the outer one');
  assert.ok(end(run) - end(reg) <= 1.01, 'the return ends all of them');
});

test('names that are also JavaScript object properties work', () => {
  for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    render('classDiagram', { classes: [{ name }, { name: 'Basis' }], relations: [{ from: name, to: 'Basis', kind: 'inheritance' }] });
    render('stateDiagram', { notation: 'automaton', states: [name, 'q1'], initial: name, accepting: ['q1'], transitions: [{ from: name, to: 'q1', label: 'a' }] });
    render('erDiagram', { entities: [name, 'B'], relationships: [{ name: 'r', from: name, to: 'B' }] });
    render('sequenceDiagram', { participants: [name, 'b'], messages: [{ from: name, to: 'b', text: 'm()' }] });
    render('objectDiagram', { objects: [{ name, class: 'K' }, { name: 'b', class: 'K' }], links: [{ from: name, to: 'b' }] });
  }
  assert.throws(() => wd.stateDiagram({ notation: 'automaton', states: ['q0'], accepting: ['constructor'] }), /"accepting" names "constructor", which is not a state/);
});

test("crow's foot: (min,max) cards describe their own entity, the others read across", () => {
  // the same drawing (elements in any order)
  const er = (from_card, to_card) => wd.erDiagram(Object.assign({}, BASE, {
    notation: 'Krähenfuß', entities: ['Schüler', 'Klasse'], relationships: [{ name: 'gehört zu', from: 'Schüler', to: 'Klasse', from_card, to_card }],
  })).svg.match(/<[^/][^>]*>/g).sort().join('');
  // each Schüler belongs to exactly one Klasse, a Klasse has any number of Schüler
  assert.equal(er('(1,1)', '(0,*)'), er('0..*', '1'));
  assert.notEqual(er('(1,1)', '(0,*)'), er('1', '0..*'));
});

