#!/usr/bin/env node
/*
 * End-to-end smoke test of the plugin panel in the local test harness.
 *
 * Env: PROXY_URL – proxy with LLM_PROVIDER=mock (default: what the harness has stored, http://localhost:8787)
 *
 * Prerequisites:
 *   1. pnpm install (root, installs playwright-core – no browser download)
 *   2. a Chromium/Chrome binary (CHROMIUM_PATH, default /usr/bin/chromium)
 *   3. bash scripts/build.sh && node scripts/serve.mjs 8080
 *   4. proxy with the mock provider, e.g. in apps/server/: .env with
 *        LLM_PROVIDER=mock, PROXY_TOKEN=dev-token-change-me-0123, CORS_ORIGINS=http://localhost:8080
 *      and `docker compose up -d` (or `pnpm dev:server` in the root)
 *
 *   pnpm e2e [<screenshot-prefix>]
 */
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const BASE = process.env.HARNESS_URL || 'http://localhost:8080/apps/plugin/harness/';
const shot = process.argv[2];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  // A proxy before 0.3 has no /v1/meta (the plugin then assumes token mode without MCP) – not an error.
  if (m.type() === 'error' && !/\/v1\/meta$/.test(m.location().url || '')) errors.push(m.text());
});

let d0;
const doc = () => page.evaluate(() => window.HarnessMock.state.elements.map((e) => ({ text: e.text, alts: e.drawings.map((d) => d.descr) })));

try {
  await page.goto(BASE);
  if (process.env.PROXY_URL) {
    // Point the plugin at another proxy (e.g. a mock instance next to a real one).
    await page.locator('#h-url').fill(process.env.PROXY_URL);
    await page.locator('#h-apply').click();
  }
  const frame = page.frameLocator('#panel');
  await frame.locator('#chat-text').waitFor();

  // 0) "Neuer Chat" while a preview is waiting must not block the chat (regression)
  await frame.locator('#chat-text').fill('Füge eine Notenzeile mit c – d – e ein');
  await frame.locator('#chat-send').click();
  await frame.locator('.card button.primary').first().waitFor({ timeout: 15000 });
  await frame.locator('#chat-new').click();
  await page.waitForTimeout(300);
  assert.equal(await frame.locator('.card').count(), 0);
  d0 = await doc();
  assert.ok(!d0.some((e) => e.alts.some((a) => /C D E/.test(a || ''))), 'discarded preview must not be inserted');
  console.log('ok - new chat during an open preview');

  // 1) AI chat (mock model) with preview confirmation
  await frame.locator('#chat-text').fill('Füge unter Aufgabe 2 eine Notenzeile mit c – f – g im Violinschlüssel ein und darunter eine leere Zeile zum Nachschreiben');
  await frame.locator('#chat-send').click();
  await frame.locator('.card button.primary').first().waitFor({ timeout: 15000 });
  if (shot) await page.screenshot({ path: `${shot}-preview.png` });
  await frame.locator('.card button.primary').first().click();
  await frame.locator('.card').nth(1).locator('button.primary').click({ timeout: 15000 });
  await frame.locator('.msg.assistant', { hasText: 'Fertig' }).waitFor({ timeout: 15000 });
  let d = await doc();
  const heading = d.findIndex((e) => e.text === 'Aufgabe 2');
  assert.equal(d[heading + 1].alts[0], 'X:1\nM:none\nL:1/4\nK:C clef=treble\nC F G |]');
  assert.match(d[heading + 2].alts[0], /x4 \| x4/);
  if (shot) await page.screenshot({ path: `${shot}-chat.png` });
  console.log('ok - chat inserts staff and empty staff below "Aufgabe 2"');

  // 1b) change an existing staff via chat (replace_staff, with preview)
  await frame.locator('#chat-text').fill('Bitte ändere Zeile 1: statt f #f');
  await frame.locator('#chat-send').click();
  await frame.locator('.card', { hasText: 'ersetzen' }).locator('button.primary').click({ timeout: 15000 });
  await frame.locator('.msg.assistant', { hasText: 'Notenzeile 1 steht jetzt' }).waitFor({ timeout: 15000 });
  d = await doc();
  assert.equal(d[heading + 1].alts[0], 'X:1\nM:none\nL:1/4\nK:C clef=treble\nC ^F G |]');
  assert.equal(d[heading + 1].alts.length, 1, 'replaced, not added');
  console.log('ok - chat changes an existing staff (replace_staff)');

  // 1c) add lyrics to an existing staff via chat (add_lyrics + replace_staff)
  await frame.locator('#chat-text').fill('Füge zu Zeile 1 den Text hinzu: Hal-lo du');
  await frame.locator('#chat-send').click();
  await frame.locator('.card button.primary:not([disabled])').first().click({ timeout: 15000 });
  await frame.locator('.msg.assistant', { hasText: 'hat jetzt Text' }).waitFor({ timeout: 15000 });
  d = await doc();
  assert.equal(d[heading + 1].alts[0], 'X:1\nM:none\nL:1/4\nK:C clef=treble\nC ^F G |]\nw: Hal-lo du');
  console.log('ok - chat adds lyrics to an existing staff');

  // 1d) whole worksheet via insert_blocks (preview with blocks), then replace and delete elements
  await frame.locator('#chat-text').fill('Erstelle ein Arbeitsblatt zum Wasserkreislauf für Klasse 5');
  await frame.locator('#chat-send').click();
  const card = frame.locator('.card').filter({ has: frame.locator('.preview-doc') }).last();
  await card.locator('button.primary').waitFor({ timeout: 15000 });
  assert.match(await card.locator('.preview-doc').innerText(), /Arbeitsblatt: Wasserkreislauf[\s\S]*Aufgabe 1[\s\S]*Begriff[\s\S]*Merke/);
  await card.locator('button.primary').click();
  await frame.locator('.msg.assistant', { hasText: 'Arbeitsblatt mit' }).waitFor({ timeout: 15000 });
  let els = await page.evaluate(() => window.HarnessMock.state.elements.map((e) => ({ type: e.type, text: e.text, style: e.style, list: e.list, line: e.line, rows: e.rows && e.rows.length })));
  const ws = els.findIndex((e) => e.text === 'Arbeitsblatt: Wasserkreislauf');
  assert.ok(ws > 0, 'worksheet inserted at the end');
  assert.equal(els[ws].style, 'Heading 1');
  assert.equal(els.filter((e) => e.list === 'numbered').length, 2);
  assert.equal(els.filter((e) => e.line).length, 3);
  assert.equal(els.filter((e) => e.type === 'table').length, 2);
  // bold run followed by plain text must not stay bold
  const bold = await page.evaluate((i) => window.HarnessMock.state.elements[i].runs.map((r) => (r.b ? '*' : '') + r.text).join('|'), ws + 3);
  assert.equal(bold, 'Lies den Text über |*Wasserkreislauf| und beantworte die Fragen.');
  // cloze gaps "________" stay plain; only __Wichtig__ is underlined
  const cloze = await page.evaluate(() => {
    const el = window.HarnessMock.state.elements.find((e) => (e.text || '').startsWith('Ergänze'));
    return el.runs.map((r) => (r.u ? '_' : '') + r.text).join('|');
  });
  assert.equal(cloze, 'Ergänze: Es ________ und dann ________. |_Wichtig|: genau lesen.');
  console.log('ok - worksheet via insert_blocks (headings, list, lines, table, box)');

  await frame.locator('#chat-text').fill(`Ersetze Element ${ws + 3} durch: Lies den Text **genau**.`);
  await frame.locator('#chat-send').click();
  await frame.locator('.card button.primary:not([disabled])').first().click({ timeout: 15000 });
  await frame.locator('.msg.assistant', { hasText: 'ersetzt' }).waitFor({ timeout: 15000 });
  els = await page.evaluate(() => window.HarnessMock.state.elements.map((e) => e.text));
  assert.equal(els[ws + 3], 'Lies den Text genau.');
  await frame.locator('#chat-text').fill(`Lösche Element ${ws + 1}`);
  await frame.locator('#chat-send').click();
  await frame.locator('.card button.danger:not([disabled])').first().click({ timeout: 15000 });
  await frame.locator('.msg.assistant', { hasText: 'gelöscht' }).waitFor({ timeout: 15000 });
  const after = await page.evaluate(() => window.HarnessMock.state.elements.map((e) => e.text));
  assert.equal(after.length, els.length - 1);
  assert.ok(!after.some((t) => /^Name: _+  Klasse/.test(t || '')), 'name line deleted');
  console.log('ok - replace_elements and delete_elements (with confirmation)');

  // 1e) designed worksheet: theme, title, tasks with badges/icons/points, cloze + word bank, true/false, matching,
  //     crossword, lineature, box, self-assessment – then check_worksheet
  await frame.locator('#chat-text').fill('Gestalte ein schönes Arbeitsblatt zum Wasserkreislauf für Klasse 3');
  await frame.locator('#chat-send').click();
  const card2 = frame.locator('.card').filter({ has: frame.locator('.preview-doc') }).last();
  await card2.locator('button.primary:not([disabled])').waitFor({ timeout: 20000 });
  assert.match(await card2.locator('.preview-doc').innerText(), /DER WASSERKREISLAUF|Der Wasserkreislauf[\s\S]*Wortspeicher[\s\S]*richtig[\s\S]*Waagerecht/);
  assert.ok(await card2.locator('.preview-doc img').count() >= 10, 'preview shows badges, icons, puzzle and lineature');
  if (shot) await page.screenshot({ path: `${shot}-design-preview.png` });
  await card2.locator('button.primary').click();
  const designMsg = frame.locator('.msg.assistant', { hasText: 'gestaltetes Arbeitsblatt' });
  await designMsg.waitFor({ timeout: 20000 });
  const st = await page.evaluate(() => ({
    props: window.HarnessMock.state.props,
    els: window.HarnessMock.state.elements.map((e) => ({ type: e.type, text: e.text, style: e.style, keepNext: e.keepNext, alts: (e.drawings || []).map((d) => d.descr), desc: e.description })),
  }));
  assert.equal(st.props.WorksheetTheme, 'primary');
  const tasks = st.els.filter((e) => e.alts.some((a) => /WSTASK/.test(a || '')));
  assert.equal(tasks.length, 5, 'five task headers');
  assert.ok(tasks.every((t) => t.keepNext && t.style === 'Heading 2'), 'task headers are headings kept with the next element');
  assert.ok(st.els.some((e) => e.alts.some((a) => /WSGRAPHIC \{"type":"crossword"/.test(a || ''))), 'crossword image with its source');
  assert.ok(st.els.some((e) => e.alts.some((a) => /WSGRAPHIC \{"type":"lineature"/.test(a || ''))), 'lineature image');
  assert.ok(st.els.some((e) => /"type":"true_false"/.test(e.desc || '')), 'true/false table tagged');
  assert.ok(st.els.some((e) => e.type === 'paragraph' && /Die _+ erwärmt das Wasser/.test(e.text || '')), 'cloze with gaps');
  assert.match(await designMsg.innerText(), /Design primary/);
  if (shot) await page.screenshot({ path: `${shot}-design.png` });
  console.log('ok - designed worksheet (theme, tasks, puzzles, graphics) + check_worksheet');

  // 1f) page setup with the school name and logo from the settings
  await frame.locator('.tab[data-tab=settings]').click();
  await frame.locator('#s-school').fill('Grundschule Musterstadt');
  const logo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR42mNk+M9Qz8DAwMAAAA4NAgFZB5EeAAAAAElFTkSuQmCC', 'base64');
  await frame.locator('#s-logo-file').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: logo });
  await frame.locator('#s-logo-preview:not(.hidden)').waitFor({ timeout: 5000 });
  await frame.locator('#s-save').click();
  await frame.locator('.tab[data-tab=chat]').click();
  await frame.locator('#chat-text').fill('Richte die Seite ein: Kopfzeile mit Logo und Seitenzahlen');
  await frame.locator('#chat-send').click();
  await frame.locator('.card button.primary:not([disabled])').last().click({ timeout: 15000 });
  await frame.locator('.msg.assistant', { hasText: 'Seite eingerichtet' }).waitFor({ timeout: 15000 });
  const hf = await page.evaluate(() => ({
    header: window.HarnessMock.state.header.map((p) => ({ text: p.text, images: (p.drawings || []).length })),
    footer: window.HarnessMock.state.footer.map((p) => p.text),
  }));
  assert.match(hf.header.map((h) => h.text).join(' '), /Grundschule Musterstadt\tSachunterricht\tKlasse 3/);
  assert.equal(hf.header[0].images, 1, 'logo in the header');
  assert.match(hf.footer.join(' '), /Seite 1 von 1/);
  console.log('ok - setup_page (header with school and logo, page numbers)');

  // 1g) picture: search_images (ARASAAC, needs internet) -> picture block beside text (columns) with the licence credit.
  //     E2E_OFFLINE=1 skips it.
  if (!process.env.E2E_OFFLINE) {
    await frame.locator('#chat-text').fill('Füge ein Bild vom Fuchs ein');
    await frame.locator('#chat-send').click();
    const picCard = frame.locator('.card').filter({ has: frame.locator('.preview-doc img') }).filter({ hasText: 'Sergio Palao, ARASAAC' }).last();
    await picCard.locator('button.primary').waitFor({ timeout: 30000 });
    if (shot) await picCard.screenshot({ path: `${shot}-picture.png` });
    await picCard.locator('button.primary').click();
    await frame.locator('.msg.assistant', { hasText: 'Bild „Fuchs“' }).waitFor({ timeout: 15000 });
    const pics = await page.evaluate(() => {
      const out = [];
      const scan = (paras) => paras.forEach((p) => (p.drawings || []).forEach((dr) => out.push({ descr: dr.descr || '', src: String(dr.src || '').slice(0, 22), wMm: dr.wMm })));
      window.HarnessMock.state.elements.forEach((e) => (e.type === 'table' ? e.rows.forEach((r) => r.forEach((c) => scan(c.paras))) : scan([e])));
      const texts = [];
      window.HarnessMock.state.elements.forEach((e) => { if (e.type === 'table') e.rows.forEach((r) => r.forEach((c) => c.paras.forEach((p) => texts.push(p.text)))); });
      return { pics: out.filter((x) => /^Bild: /.test(x.descr)), texts };
    });
    assert.equal(pics.pics.length, 1, 'one picture in the document');
    assert.match(pics.pics[0].descr, /^Bild: Fuchs\n\nWSGRAPHIC \{"type":"picture","image_id":"arasaac:\d+"/);
    assert.equal(pics.pics[0].src, 'data:image/png;base64,');
    assert.ok(Math.abs(pics.pics[0].wMm - 30) < 0.5, `picture is 3 cm wide (${pics.pics[0].wMm} mm)`);
    assert.ok(pics.texts.some((t) => /Sergio Palao, ARASAAC/.test(t)), 'licence credit under the picture');
    console.log('ok - picture via search_images (pictogram beside text, credit)');
  }

  // 2) manual mode: template after element 0, load + replace selected image
  await frame.locator('.tab[data-tab=manual]').click();
  await frame.locator('#m-template').selectOption('melody');
  await frame.locator('#m-position').selectOption('after:0');
  await frame.locator('#m-insert').click();
  await frame.locator('#m-status.ok').waitFor({ timeout: 10000 });
  d = await doc();
  assert.match(d[1].alts[0], /Alle meine Entchen/);
  console.log('ok - manual insert after element 0');

  // 2a) manual lyrics: scale + "Do re mi …", then a second verse
  await frame.locator('#m-template').selectOption('scale');
  await frame.locator('#m-lyrics').fill('Do re mi fa sol la ti do');
  await frame.locator('#m-add-lyrics').click();
  assert.match(await frame.locator('#m-status').textContent(), /8 Silben auf 8 Noten verteilt/);
  await frame.locator('#m-lyrics').fill('c d e f');
  await frame.locator('#m-verse').check();
  await frame.locator('#m-add-lyrics').click();
  assert.match(await frame.locator('#m-status').textContent(), /4 Silben auf 8 Noten[\s\S]*übrigen Noten bleiben ohne Text/);
  assert.equal(await frame.locator('#m-abc').inputValue(), 'X:1\nM:none\nL:1/4\nK:C clef=treble\nC D E F G A B c |]\nw: Do re mi fa sol la ti do\nw: c d e f * * * *');
  await frame.locator('#m-verse').uncheck();
  await frame.locator('#m-lyrics').fill('eins zwei drei vier fünf sechs sie-ben acht neun');
  await frame.locator('#m-add-lyrics').click();
  assert.match(await frame.locator('#m-status').textContent(), /Zu viele Silben: 10 Silben für 8 Noten/);
  console.log('ok - manual lyrics (distribute, verse, too many syllables)');

  await page.locator('#mock-doc .el').nth(1).locator('img').click();
  await frame.locator('#m-abc').fill('');
  await frame.locator('#m-load').click();
  await frame.locator('#m-status', { hasText: 'geladen' }).waitFor({ timeout: 5000 });
  assert.match(await frame.locator('#m-abc').inputValue(), /Alle meine Entchen/);
  await frame.locator('#m-german').fill("fis' g' a' h'");
  await frame.locator('#m-convert').click();
  await frame.locator('#m-replace').click();
  await frame.locator('#m-status', { hasText: 'ersetzt' }).waitFor({ timeout: 5000 });
  d = await doc();
  assert.equal(d[1].alts[0], 'X:1\nM:none\nL:1/4\nK:C clef=treble\n^F G A B |]');
  if (shot) await page.screenshot({ path: `${shot}-manual.png` });
  console.log('ok - load selected staff, edit, replace');

  // 2b) German note list with time signature, accidentals in front and digits as note values
  await frame.locator('#m-german').fill('4/4 bc1, f1, g2, be2, c1, C');
  await frame.locator('#m-digits').selectOption('auto');
  await frame.locator('#m-convert').click();
  assert.match(await frame.locator('#m-status').textContent(), /6 Töne umgerechnet.*Notenwerte.*4\/4-Takt, 5 Takte[\s\S]*großen Oktave/);
  assert.equal(await frame.locator('#m-abc').inputValue(), 'X:1\nM:4/4\nL:1/4\nK:C clef=treble\n_C4 | F4 | G2 _E2 | C4 | C,,4 |]');
  await frame.locator('#m-digits').selectOption('octave');
  await frame.locator('#m-convert').click();
  assert.match(await frame.locator('#m-status').textContent(), /Oktaven gelesen.*1,5 Takte/);
  await frame.locator('#m-german').fill('4/4 bc1, xy, g2');
  await frame.locator('#m-abc').fill('X:1\nM:none\nL:1/4\nK:C\nC|]');
  await frame.locator('#m-convert').click();
  assert.match(await frame.locator('#m-status').textContent(), /Nicht umgerechnet[\s\S]*„xy“ ist kein bekannter Tonname/);
  assert.equal(await frame.locator('#m-abc').inputValue(), 'X:1\nM:none\nL:1/4\nK:C\nC|]', 'ABC untouched on errors');
  console.log('ok - German note list "4/4 bc1, f1, g2, be2, c1, C" (auto/octave/error)');

  // 3) fallback path: CreateImage fails, older API
  await page.locator('#h-fail').check();
  await page.locator('#h-legacy').check();
  await frame.locator('#m-template').selectOption('emptyBass');
  await frame.locator('#m-position').selectOption('cursor');
  await frame.locator('#m-insert').click();
  await frame.locator('#m-status', { hasText: 'PutImageDataToSelection' }).waitFor({ timeout: 5000 });
  console.log('ok - fallback PutImageDataToSelection');

  assert.deepEqual(errors, []);
  console.log('ok - no console errors');
} catch (err) {
  try {
    const msgs = await page.frameLocator('#panel').locator('.msg').allTextContents();
    console.error('last chat messages:\n  ' + msgs.slice(-6).join('\n  '));
  } catch (e) { /* ignore */ }
  throw err;
} finally {
  await browser.close();
}
