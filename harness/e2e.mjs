#!/usr/bin/env node
/*
 * End-to-end smoke test of the plugin panel in the local test harness.
 *
 * Env: PROXY_URL – proxy with LLM_PROVIDER=mock (default: what the harness has stored, http://localhost:8787)
 *
 * Prerequisites:
 *   1. npm install (root, installs playwright-core – no browser download)
 *   2. a Chromium/Chrome binary (CHROMIUM_PATH, default /usr/bin/chromium)
 *   3. bash scripts/build.sh && node scripts/serve.mjs 8080
 *   4. proxy with the mock provider, e.g. in proxy/: .env with
 *        LLM_PROVIDER=mock, PROXY_TOKEN=dev-token-change-me-0123, CORS_ORIGINS=http://localhost:8080
 *      and `docker compose up -d` (or `npm run dev`)
 *
 *   npm run e2e [-- <screenshot-prefix>]
 */
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const BASE = process.env.HARNESS_URL || 'http://localhost:8080/harness/';
const shot = process.argv[2];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

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

  // 2) manual mode: template after element 0, load + replace selected image
  await frame.locator('.tab[data-tab=manual]').click();
  await frame.locator('#m-template').selectOption('melody');
  await frame.locator('#m-position').selectOption('after:0');
  await frame.locator('#m-insert').click();
  await frame.locator('#m-status.ok').waitFor({ timeout: 10000 });
  d = await doc();
  assert.match(d[1].alts[0], /Alle meine Entchen/);
  console.log('ok - manual insert after element 0');

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
} finally {
  await browser.close();
}
