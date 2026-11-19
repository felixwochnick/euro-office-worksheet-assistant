#!/usr/bin/env node
/*
 * Screenshots for the website (apps/website/public/img/), taken in the real Euro-Office editor.
 *
 * The content is inserted over MCP with fixed worksheet blocks (no language model involved), so every run gives the
 * same pictures. The server only needs MCP and the picture sources:
 *
 *   bash scripts/build.sh && (cd dev/eurooffice && docker compose up -d)          # editor + storage
 *   (cd apps/server && pnpm build && AUTH_MODE=token PROXY_TOKEN=dev-token-change-me-0123 \
 *     CORS_ORIGINS=http://localhost:8090 LLM_PROVIDER=mock PORT=8789 node build/src/server.js)
 *   pnpm --filter @worksheet-assistant/desktop generate                          # for "companion"
 *   node dev/eurooffice/website-screenshots.mjs <out-dir>
 *
 * Shots (ONLY=hero,themes,… takes some of them):
 *   hero        hero.png                     designed worksheet in the editor, panel with the AI chat
 *   themes      theme-<classic|modern|primary>.png   the same worksheet in the three designs (page excerpts)
 *   tasks       tasks.png                    crossword, word search, multiple choice (page excerpt)
 *   graphics    graphics.png                 number line, coordinate system, chart, formula (page excerpt)
 *   pictures    pictures.png                 ARASAAC pictograms and Silbenfärbung (page excerpt)
 *   diagrams    diagram-<kind>.png           computer science diagrams (page excerpts)
 *   music       music.png                    the "Noten" tab inserting a melody with lyrics
 *   mcp         mcp.png                      an MCP client adds a task with a staff; the panel logs the calls
 *   companion   companion.png                the desktop app's window, page "Übersicht" (built UI, simulated backend)
 *
 * Page excerpts are cropped to the content of the first page. Convert for the website (window shots scaled to
 * 1800 px, excerpts and the desktop app at their size):
 *   for f in hero mcp music; do cwebp -quiet -q 84 -resize 1800 0 <out-dir>/$f.png -o apps/website/public/img/$f.webp; done
 *   for f in <out-dir>/{theme-*,tasks,graphics,pictures,diagram-*,companion}.png; do
 *     cwebp -quiet -q 86 "$f" -o "apps/website/public/img/$(basename "${f%.png}").webp"; done
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../..');
const EDITOR_URL = process.env.EDITOR_URL || 'http://localhost:8099/';
const PROXY_URL = process.env.PROXY_URL || 'http://localhost:8789';
const PROXY_TOKEN = process.env.PROXY_TOKEN || 'dev-token-change-me-0123';
const DSF = 2;
const out = process.argv[2] || '.';
const only = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const wanted = (name) => !only.length || only.includes(name);
fs.mkdirSync(out, { recursive: true });

const sdk = await import(pathToFileURL(path.join(root, 'apps/server/node_modules/@modelcontextprotocol/client/dist/index.mjs')).href);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });

// ---------------------------------------------------------------------------------------------------------------
// Content

/** The worksheet of the hero and the MCP shot (modern design). */
const WATER_CYCLE = [
  { type: 'title', text: 'Der Wasserkreislauf', subject: 'Erdkunde', grade: 'Klasse 5' },
  { type: 'name_line' },
  { type: 'task', number: '1', title: 'Lies und ergänze', instruction: 'Lies den Text und setze die Wörter aus dem Wortspeicher ein.', icons: ['single', 'read', 'write'], points: 5, level: 1 },
  { type: 'cloze', text: 'Die Sonne erwärmt das Wasser im Meer. Es [[verdunstet]] und steigt als Wasserdampf auf. In der Höhe kühlt der Dampf ab und es bilden sich [[Wolken]]. Werden die Tropfen zu schwer, fällt [[Niederschlag]] als Regen oder Schnee. Das Wasser fließt in Bächen und [[Flüssen]] zurück ins Meer oder versickert als [[Grundwasser]].' },
  { type: 'task', number: '2', title: 'Ordne zu', instruction: 'Verbinde jeden Begriff mit der passenden Erklärung.', icons: ['partner', 'draw'], points: 4, level: 2 },
  {
    type: 'matching',
    pairs: [
      { left: 'Verdunstung', right: 'Wasser wird zu Wasserdampf.' },
      { left: 'Kondensation', right: 'Wasserdampf kühlt ab und bildet Tropfen.' },
      { left: 'Niederschlag', right: 'Regen, Schnee oder Hagel fällt zur Erde.' },
      { left: 'Versickerung', right: 'Wasser dringt in den Boden ein.' },
    ],
  },
  { type: 'box', variant: 'rule', title: 'Merke', text: 'Das Wasser auf der Erde ist ständig unterwegs: Es verdunstet, bildet Wolken, fällt als Niederschlag und fließt zurück ins Meer. Diesen Weg nennt man Wasserkreislauf.' },
];

/** The same short worksheet in every design. */
const HEDGEHOG = [
  { type: 'title', text: 'Der Igel im Herbst', subject: 'Sachunterricht', grade: 'Klasse 3' },
  { type: 'name_line' },
  { type: 'task', number: '1', title: 'Lies und ergänze', instruction: 'Setze die Wörter aus dem Wortspeicher ein.', icons: ['single', 'read', 'write'], points: 4, level: 1 },
  { type: 'cloze', text: 'Der Igel ist ein [[Säugetier]]. Er frisst Käfer, Würmer und [[Schnecken]]. Im Herbst frisst er sich ein dickes [[Fettpolster]] an. Den Winter verschläft er in einem Nest aus [[Laub]].' },
  { type: 'task', number: '2', title: 'Richtig oder falsch?', instruction: 'Kreuze an.', icons: ['partner', 'speak'], points: 3, level: 2 },
  {
    type: 'true_false',
    statements: [
      { text: 'Igel halten Winterschlaf.', correct: true },
      { text: 'Igel trinken am liebsten Milch.', correct: false },
      { text: 'Igel sind vor allem nachts unterwegs.', correct: true },
    ],
  },
  { type: 'box', variant: 'rule', title: 'Merke', text: 'Der Igel ist ein Winterschläfer. Im Winterschlaf schlägt sein Herz nur etwa fünfmal in der Minute.' },
];

const TASKS = [
  { type: 'task', number: '1', title: 'Kreuzworträtsel', instruction: 'Löse das Rätsel. Die Lösungen sind Tiere des Waldes.', icons: ['single', 'write'], points: 6, level: 2 },
  {
    type: 'crossword',
    entries: [
      { answer: 'FUCHS', clue: 'Er hat einen buschigen Schwanz und gilt als schlau.' },
      { answer: 'IGEL', clue: 'Er rollt sich bei Gefahr zu einer Stachelkugel.' },
      { answer: 'EULE', clue: 'Sie jagt nachts und kann ihren Kopf weit drehen.' },
      { answer: 'SPECHT', clue: 'Er klopft Löcher in Baumstämme.' },
      { answer: 'DACHS', clue: 'Er gräbt einen Bau und hat einen schwarz-weißen Kopf.' },
      { answer: 'HIRSCH', clue: 'Das Männchen trägt ein Geweih.' },
    ],
  },
  { type: 'task', number: '2', title: 'Suchsel', instruction: 'Finde die sechs Tiere im Buchstabengitter und kreise sie ein.', icons: ['single', 'read'], points: 6, level: 1 },
  { type: 'word_search', words: ['FUCHS', 'IGEL', 'EULE', 'SPECHT', 'DACHS', 'HIRSCH'], difficulty: 'easy' },
  { type: 'task', number: '3', title: 'Wähle aus', instruction: 'Kreuze die richtige Antwort an.', icons: ['single'], points: 2, level: 1 },
  {
    type: 'multiple_choice',
    questions: [
      { question: 'Welches Tier hält Winterschlaf?', options: ['Igel', 'Fuchs', 'Reh'], correct: [0] },
      { question: 'Wovon ernährt sich der Specht vor allem?', options: ['Insekten', 'Gras', 'Fische'], correct: [0] },
    ],
  },
];

const GRAPHICS = [
  { type: 'task', number: '1', title: 'Zahlenstrahl', instruction: 'Trage die fehlenden Zahlen ein.', icons: ['single', 'write'], points: 3, level: 1 },
  { type: 'number_line', from: -5, to: 5, step: 1, blanks: [-3, 1, 4] },
  { type: 'task', number: '2', title: 'Daten und Figuren', instruction: 'Lies das Diagramm ab und zeichne das Dreieck ABC ein.', icons: ['partner', 'calculate'], points: 6, level: 2 },
  {
    type: 'columns',
    columns: [
      [{ type: 'chart', chart_type: 'column', title: 'Lieblingsfächer der 7b', labels: ['Mathe', 'Deutsch', 'Sport', 'Kunst'], series: [{ name: 'Stimmen', values: [8, 5, 9, 4] }], y_label: 'Stimmen' }],
      [{ type: 'coordinate_system', x_min: -1, x_max: 6, y_min: -1, y_max: 5, grid: true, points: [{ x: 1, y: 1, label: 'A' }, { x: 5, y: 1, label: 'B' }, { x: 3, y: 4, label: 'C' }], polygons: [{ points: [[1, 1], [5, 1], [3, 4]] }] }],
    ],
  },
  { type: 'task', number: '3', title: 'Flächeninhalt', instruction: 'Berechne den Flächeninhalt des Dreiecks ABC (\\( g = 4 \\) cm, \\( h = 3 \\) cm).', icons: ['single', 'calculate'], points: 2, level: 2 },
  { type: 'formula', latex: 'A = \\frac{g \\cdot h}{2}' },
  { type: 'lines', count: 2 },
];

const ANIMALS = [
  ['Igel', 'I|gel'], ['Eule', 'Eu|le'], ['Hase', 'Ha|se'],
  ['Eichhörnchen', 'Eich|hörn|chen'], ['Fuchs', 'Fuchs'], ['Rabe', 'Ra|be'],
];

const DIAGRAMS = {
  class: {
    type: 'class_diagram',
    classes: [
      { name: 'Kunde', attributes: ['- name: String', '- kundennummer: int'], methods: ['+ getName(): String'] },
      { name: 'Konto', kind: 'abstract', attributes: ['- kontonummer: String', '[[- kontostand: double]]'], methods: ['+ einzahlen(betrag: double)', '+ abheben(betrag: double): boolean'] },
      { name: 'Girokonto', attributes: ['- dispo: double'], methods: ['+ ueberweisen(ziel: Konto, betrag: double)'] },
      { name: 'Sparkonto', attributes: ['- zinssatz: double'], methods: 1 },
    ],
    relations: [
      { from: 'Kunde', to: 'Konto', kind: 'association', label: 'besitzt', from_mult: '1', to_mult: '1..*', directed: true },
      { from: 'Girokonto', to: 'Konto', kind: 'inheritance' },
      { from: 'Sparkonto', to: 'Konto', kind: 'inheritance', blank: true },
    ],
  },
  sequence: {
    type: 'sequence_diagram',
    participants: [{ name: 'Kunde', kind: 'actor' }, ':Automat', ':Kasse'],
    messages: [
      { from: 'Kunde', to: ':Automat', text: 'waehleGetraenk(nr)' },
      { from: ':Automat', to: ':Kasse', text: 'pruefeGuthaben(preis)' },
      { from: ':Kasse', to: ':Automat', text: 'ok', kind: 'return' },
      {
        fragment: 'alt', label: 'ok',
        messages: [{ from: ':Automat', to: 'Kunde', text: 'gibGetraenkAus()', kind: 'async' }],
        else: { label: 'sonst', messages: [{ from: ':Automat', to: 'Kunde', text: 'zeigeFehler()', kind: 'async' }] },
      },
    ],
  },
  automaton: {
    type: 'state_diagram',
    notation: 'automaton',
    direction: 'horizontal',
    states: ['q0', 'q1', 'q2'],
    initial: 'q0',
    accepting: ['q2'],
    transitions: [
      { from: 'q0', to: 'q1', label: 'a' },
      { from: 'q0', to: 'q0', label: 'b' },
      { from: 'q1', to: 'q1', label: 'a' },
      { from: 'q1', to: 'q2', label: 'b' },
      { from: 'q2', to: 'q1', label: 'a' },
      { from: 'q2', to: 'q0', label: 'b' },
    ],
  },
  structogram: {
    type: 'structogram',
    title: 'ggT(a, b)',
    steps: [
      'Eingabe: a, b',
      { if: 'a < b', then: ['tausche a und b'], else: [] },
      { while: 'b ≠ 0', do: ['r := a mod b', 'a := b', 'b := r'] },
      'Ausgabe: a',
    ],
  },
  flowchart: {
    type: 'flowchart',
    nodes: [
      { id: 's', kind: 'start' },
      { id: 'in', kind: 'io', text: 'Punkte eingeben' },
      { id: 'd', kind: 'decision', text: 'Punkte ≥ 50?' },
      { id: 'y', kind: 'io', text: 'Ausgabe: bestanden' },
      { id: 'n', kind: 'io', text: 'Ausgabe: nicht bestanden' },
      { id: 'e', kind: 'end' },
    ],
    edges: [
      { from: 's', to: 'in' }, { from: 'in', to: 'd' },
      { from: 'd', to: 'y', label: 'ja' }, { from: 'd', to: 'n', label: 'nein' },
      { from: 'y', to: 'e' }, { from: 'n', to: 'e' },
    ],
  },
  er: {
    type: 'er_diagram',
    notation: 'chen',
    entities: [
      { name: 'Schüler', attributes: ['__schuelerNr__', 'name', 'klasse'] },
      { name: 'Kurs', attributes: ['__kursNr__', 'thema'] },
      { name: 'Lehrer', attributes: ['__kuerzel__', 'name'] },
    ],
    relationships: [
      { name: 'belegt', from: 'Schüler', to: 'Kurs', from_card: 'n', to_card: 'm' },
      { name: 'leitet', from: 'Lehrer', to: 'Kurs', from_card: '1', to_card: 'n' },
    ],
  },
};

const RAIN_SONG = 'X:1\nT:Es regnet\nM:2/4\nL:1/8\nK:F clef=treble\nc c A A | c c A2 | B B G G | B2 G2 |]\nw: Es reg-net, es reg-net, die Er-de wird nass, wird nass';

// ---------------------------------------------------------------------------------------------------------------
// Editor session: the test document, the plugin connected to the server and an MCP client

async function openSession({ title, width = 1440, height = 900 }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: DSF });
  await fetch(new URL('/reset', EDITOR_URL));
  await page.goto(`${EDITOR_URL}?spellcheck=0&title=${encodeURIComponent(title)}`);
  await page.waitForFunction(() => window.documentReady === true, null, { timeout: 120000 });
  const editor = page.frame({ name: 'frameEditor' });
  await editor.locator('.ribtab a[data-tab=plugins]').click();
  await editor.getByText('Arbeitsblatt-Assistent', { exact: true }).first().click();
  let plugin = null;
  for (let i = 0; i < 50 && !plugin; i++) {
    plugin = page.frames().find((f) => /worksheet-assistant\/index\.html/.test(f.url())) || null;
    if (!plugin) await page.waitForTimeout(200);
  }
  if (!plugin) throw new Error('plugin panel did not open');
  await plugin.locator('#chat-text').waitFor();
  await plugin.locator('.tab[data-tab=settings]').click();
  await plugin.locator('#s-url').fill(PROXY_URL);
  await plugin.locator('#s-token').fill(PROXY_TOKEN);
  await plugin.locator('#s-save').click();
  await page.waitForTimeout(500);
  await plugin.locator('#s-mcp').check();
  await plugin.locator('#s-mcp-status.ok').waitFor({ timeout: 15000 });
  // no blinking text cursor in the pictures
  await editor.addStyleTag({ content: '#id_target_cursor { visibility: hidden !important; }' });
  const mcp = new sdk.Client({ name: 'website-screenshots', version: '1' });
  await mcp.connect(new sdk.StreamableHTTPClientTransport(new URL(PROXY_URL + '/mcp'), { requestInit: { headers: { authorization: `Bearer ${PROXY_TOKEN}` } } }));
  const session = {
    page, editor, plugin, mcp,
    async close() {
      await mcp.close();
      await page.close();
    },
  };
  await clearDocument(session);
  return session;
}

/** An empty document. */
async function clearDocument(s) {
  await s.plugin.evaluate(() => window.MusicEditor.callCommand(function () {
    var d = Api.GetDocument();
    d.RemoveAllElements();
    d.Push(Api.CreateParagraph());
  }, {}, false));
}

/** Call an MCP tool; throws on errors. Returns the parsed JSON result. */
async function call(s, name, args) {
  const r = await s.mcp.callTool({ name, arguments: args });
  const text = r.content?.[0]?.text ?? '';
  let data = null;
  try { data = JSON.parse(text); } catch { /* plain text */ }
  if (r.isError || data?.ok === false) throw new Error(`${name}: ${text.slice(0, 600)}`);
  return data ?? text;
}

/** Append worksheet blocks at the end of the document. */
async function insert(s, blocks, theme) {
  const r = await call(s, 'insert_blocks', { position: 'end', theme, blocks });
  console.log(`  insert_blocks: ${r.count} elements`);
  return r;
}

/** image_id of the first picture found. */
async function findPicture(s, query, source = 'pictograms') {
  const r = await call(s, 'search_images', { query, source, limit: 3 });
  const hit = r.results?.[0];
  if (!hit) throw new Error(`no picture for "${query}"`);
  return hit.image_id;
}

/** Drop the empty paragraph left at the top and put the cursor into element `index` ('end' = last). */
async function placeCursor(s, index = 0) {
  await s.plugin.evaluate((idx) => window.MusicEditor.callCommand(function () {
    var d = Api.GetDocument();
    var first = d.GetElement(0);
    if (d.GetElementsCount() > 1 && first.GetClassType && first.GetClassType() === 'paragraph' && !first.GetText().trim()) d.RemoveElement(0);
    var n = d.GetElementsCount();
    var i = Asc.scope.idx === 'end' ? n - 1 : Math.min(Asc.scope.idx, n - 1);
    d.GetElement(i).GetRange(0, 0).Select();
  }, { idx }, false), index);
  await s.page.waitForTimeout(1200);
}

/**
 * Screenshot of the content on the visible part of the first page: finds the page (white, 1 px border on the grey
 * background) and the bounding box of everything on it that is not white, plus `pad` CSS pixels.
 */
async function pageExcerpt(s, file, pad = 26) {
  const shot = await s.page.screenshot();
  const clip = await s.page.evaluate(async ({ b64, dsf, pad }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data, width: W, height: H } = ctx.getImageData(0, 0, c.width, c.height);
    const px = (x, y) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
    const is = (p, v) => p[0] === v && p[1] === v && p[2] === v;
    // page borders on the middle row: a border pixel next to the grey background
    const midY = Math.round(H * 0.6);
    let left = -1, right = -1;
    for (let x = 1; x < W - 1; x++) {
      const p = px(x, midY);
      if (!is(p, 204)) continue;
      if (left < 0 && is(px(x - 1, midY), 243)) left = x;
      if (is(px(x + 1, midY), 243)) right = x;
    }
    if (left < 0 || right <= left) return null;
    const colX = left + 10;
    let top = -1;
    for (let y = 1; y < H; y++) if (is(px(colX, y), 204) && is(px(colX, y - 1), 243)) { top = y; break; }
    let bottom = H - 1;
    for (let y = top + 2; y < H; y++) if (!is(px(colX, y), 255)) { bottom = y - 1; break; }
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let y = top + 3; y < bottom - 2; y++) {
      for (let x = left + 3; x < right - 2; x++) {
        const i = (y * W + x) * 4;
        if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    const p = pad * dsf;
    const cx0 = Math.max(left + 2, x0 - p), cy0 = Math.max(top + 2, y0 - p);
    const cx1 = Math.min(right - 2, x1 + p), cy1 = Math.min(bottom, y1 + p);
    return { x: cx0 / dsf, y: cy0 / dsf, width: (cx1 - cx0) / dsf, height: (cy1 - cy0) / dsf };
  }, { b64: shot.toString('base64'), dsf: DSF, pad });
  if (!clip) throw new Error(`${file}: page not found`);
  await s.page.screenshot({ path: path.join(out, file), clip });
  console.log(file, `${Math.round(clip.width)}×${Math.round(clip.height)}`);
}

/** Screenshot of the whole window. */
async function windowShot(s, file) {
  await s.page.screenshot({ path: path.join(out, file) });
  console.log(file);
}

// ---------------------------------------------------------------------------------------------------------------
// Shots

async function heroAndMcp() {
  const s = await openSession({ title: 'Wasserkreislauf.docx' });
  try {
    await call(s, 'setup_page', { theme: 'modern', header: { left: 'Gesamtschule am See', right: 'Erdkunde · Klasse 5', school: false, line: true }, page_numbers: true });
    await insert(s, WATER_CYCLE, 'modern');
    if (wanted('hero')) {
      await s.plugin.locator('.tab[data-tab=chat]').click();
      await s.plugin.locator('#chat-new').click(); // the chat as a teacher sees it before typing
      await placeCursor(s, 0);
      await windowShot(s, 'hero.png');
    }
    if (wanted('mcp')) {
      await call(s, 'get_document_outline', {});
      await insert(s, [
        { type: 'task', number: '3', title: 'Das Regenlied', instruction: 'Singt das Lied und klatscht dazu den Rhythmus.', icons: ['group', 'music'], level: 1 },
        { type: 'staff', abc: RAIN_SONG },
      ], 'modern');
      await s.plugin.locator('.tab[data-tab=chat]').click();
      await placeCursor(s, 'end');
      await windowShot(s, 'mcp.png');
    }
  } finally {
    await s.close();
  }
}

async function themes() {
  const s = await openSession({ title: 'Igel.docx', height: 1500 });
  try {
    for (const theme of ['classic', 'modern', 'primary']) {
      await clearDocument(s);
      await insert(s, HEDGEHOG, theme);
      await placeCursor(s, 0);
      await pageExcerpt(s, `theme-${theme}.png`);
    }
  } finally {
    await s.close();
  }
}

async function excerpt(title, file, build) {
  const s = await openSession({ title, height: 1500 });
  try {
    await build(s);
    await placeCursor(s, 0);
    await pageExcerpt(s, file);
  } finally {
    await s.close();
  }
}

async function pictures(s) {
  const cell = async ([word, syllables]) => [
    { type: 'picture', image_id: await findPicture(s, word), width_cm: 3.2, align: 'center' },
    { type: 'paragraph', text: syllables, syllables: true, align: 'center', size: 'large' },
  ];
  const rows = [];
  for (let i = 0; i < ANIMALS.length; i += 3) rows.push({ type: 'columns', columns: await Promise.all(ANIMALS.slice(i, i + 3).map(cell)) });
  await insert(s, [
    { type: 'title', text: 'Tiere im Wald', subject: 'Deutsch', grade: 'Klasse 1' },
    { type: 'task', number: '1', title: 'Lies die Wörter', instruction: 'Lies die Wörter. Male das Tier an, das du am liebsten magst.', icons: ['single', 'read', 'draw'], level: 1 },
    ...rows,
    { type: 'task', number: '2', title: 'Schreibe ab', instruction: 'Schreibe zwei Tiernamen in die Lineatur.', icons: ['single', 'write'], level: 1 },
    { type: 'lines', count: 2, style: 'school1' },
  ], 'primary');
}

async function diagrams() {
  const s = await openSession({ title: 'Informatik.docx', height: 1500 });
  try {
    for (const [kind, block] of Object.entries(DIAGRAMS)) {
      await clearDocument(s);
      await insert(s, [block], 'modern');
      await placeCursor(s, 0);
      await pageExcerpt(s, `diagram-${kind}.png`, 18);
    }
  } finally {
    await s.close();
  }
}

async function music() {
  const s = await openSession({ title: 'Alle meine Entchen.docx' });
  try {
    await insert(s, [
      { type: 'title', text: 'Alle meine Entchen', subject: 'Musik', grade: 'Klasse 2' },
      { type: 'task', number: '1', title: 'Singen und lesen', instruction: 'Singt das Lied. Zeigt beim Singen auf die Noten.', icons: ['group', 'music'], level: 1 },
    ], 'modern');
    await placeCursor(s, 'end');
    await s.plugin.locator('.tab[data-tab=manual]').click();
    await s.plugin.locator('#m-template').selectOption('melody');
    await s.plugin.locator('#m-outline').click();
    await s.page.waitForTimeout(800);
    const last = await s.plugin.locator('#m-position option').evaluateAll((o) => o.map((x) => x.value).filter((v) => v.startsWith('after:')).pop());
    if (last) await s.plugin.locator('#m-position').selectOption(last);
    await s.plugin.locator('#m-insert').click();
    await s.plugin.locator('#m-status.ok, #m-status.error').waitFor({ timeout: 20000 });
    await placeCursor(s, 0);
    await windowShot(s, 'music.png');
  } finally {
    await s.close();
  }
}

/** The desktop app's window: its built UI (apps/desktop/.output/public) with the simulated backend. */
async function companion() {
  const dist = path.join(root, 'apps/desktop/.output/public');
  if (!fs.existsSync(dist)) throw new Error('build the desktop UI first: pnpm --filter @worksheet-assistant/desktop generate');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
  const page = await browser.newPage({ viewport: { width: 980, height: 700 }, deviceScaleFactor: DSF, colorScheme: 'light' });
  await page.route('http://app.local/**', (route) => {
    const file = path.join(dist, decodeURIComponent(new URL(route.request().url()).pathname));
    const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(dist, 'index.html');
    return route.fulfill({ contentType: types[path.extname(target)] || 'application/octet-stream', body: fs.readFileSync(target) });
  });
  await page.goto('http://app.local/?scenario=ready#/');
  await page.getByText('Claude kann das geöffnete Dokument bearbeiten.').waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, 'companion.png') });
  console.log('companion.png');
  await page.close();
}

try {
  if (wanted('hero') || wanted('mcp')) await heroAndMcp();
  if (wanted('themes')) await themes();
  if (wanted('tasks')) await excerpt('Waldtiere.docx', 'tasks.png', (s) => insert(s, TASKS, 'modern'));
  if (wanted('graphics')) await excerpt('Mathematik.docx', 'graphics.png', (s) => insert(s, GRAPHICS, 'modern'));
  if (wanted('pictures')) await excerpt('Tiere im Wald.docx', 'pictures.png', pictures);
  if (wanted('diagrams')) await diagrams();
  if (wanted('music')) await music();
  if (wanted('companion')) await companion();
} finally {
  await browser.close();
}
