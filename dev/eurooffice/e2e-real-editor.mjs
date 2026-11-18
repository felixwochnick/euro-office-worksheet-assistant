#!/usr/bin/env node
/*
 * End-to-end test of the plugin in a REAL Euro-Office editor.
 *
 * Prerequisites:
 *   bash scripts/build.sh
 *   (cd dev/eurooffice && docker compose up -d)      # Document Server + test storage
 *   (cd proxy && docker compose up -d)               # .env: LLM_PROVIDER=mock,
 *                                                    #   PROXY_TOKEN=dev-token-change-me-0123,
 *                                                    #   CORS_ORIGINS=http://localhost:8090
 *   npm install                                      # playwright-core (root)
 *
 *   node dev/eurooffice/e2e-real-editor.mjs [screenshot-dir]
 *
 * Env: EDITOR_URL (http://localhost:8099/), PROXY_URL (http://localhost:8787),
 *      PROXY_TOKEN (dev-token-change-me-0123), CHROMIUM_PATH (/usr/bin/chromium)
 */
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const EDITOR_URL = process.env.EDITOR_URL || 'http://localhost:8099/';
const PROXY_URL = process.env.PROXY_URL || 'http://localhost:8787';
const PROXY_TOKEN = process.env.PROXY_TOKEN || 'dev-token-change-me-0123';
const shots = process.argv[2];
const shot = async (page, name) => { if (shots) await page.screenshot({ path: path.join(shots, `real-${name}.png`) }); };
const step = (msg) => console.log('ok - ' + msg);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

try {
  await fetch(new URL('/reset', EDITOR_URL)); // fresh copy of the worksheet, new document key
  await page.goto(EDITOR_URL);
  await page.waitForFunction(() => window.documentReady === true || window.editorError, null, { timeout: 120000 });
  assert.equal(await page.evaluate(() => window.editorError), undefined);
  const editor = page.frame({ name: 'frameEditor' });
  step('document loaded in Euro-Office');

  // Open the plugin from the Plugins tab.
  await editor.locator('.ribtab a[data-tab=plugins]').click();
  await editor.getByText('Arbeitsblatt-Assistent', { exact: true }).first().click();
  let plugin = null;
  for (let i = 0; i < 100 && !plugin; i++) {
    plugin = page.frames().find((f) => f.url().includes('/sdkjs-plugins/worksheet-assistant/index.html'));
    if (!plugin) await page.waitForTimeout(200);
  }
  assert.ok(plugin, 'plugin iframe found');
  await plugin.locator('#chat-text').waitFor();
  await plugin.waitForFunction(() => window.Asc && window.Asc.plugin && typeof window.Asc.plugin.callCommand === 'function');
  step('plugin panel opened (plugins.js handshake with the editor works)');
  await shot(page, '1-panel');

  // Settings
  await plugin.locator('.tab[data-tab=settings]').click();
  await plugin.locator('#s-url').fill(PROXY_URL);
  await plugin.locator('#s-token').fill(PROXY_TOKEN);
  await plugin.locator('#s-save').click();
  await plugin.locator('#s-test').click();
  await plugin.locator('#s-status.ok').waitFor({ timeout: 10000 });
  step('settings saved, proxy reachable from the plugin origin: ' + (await plugin.locator('#s-status').textContent()));

  // Outline: headings, cursor
  const outline = await plugin.evaluate(() => window.MusicEditor.getOutline());
  console.log('   outline:', outline.elements.map((e) => `${e.index}${e.is_heading ? 'H' + e.heading_level : ''}:${(e.text || '').slice(0, 25)}`).join(' | '));
  console.log('   cursor_index:', outline.cursor_index, 'via', outline.cursor_source);
  assert.ok(outline.elements.some((e) => e.text === 'Aufgabe 2' && e.is_heading), 'headings detected');
  step('get_document_outline reads paragraphs, headings and cursor');

  // Manual insert (after element 1 = name line)
  await plugin.locator('.tab[data-tab=manual]').click();
  await plugin.locator('#m-template').selectOption('melody');
  await plugin.locator('#m-outline').click();
  await page.waitForTimeout(500);
  await plugin.locator('#m-position').selectOption('after:1');
  await plugin.locator('#m-insert').click();
  await plugin.locator('#m-status.ok, #m-status.error').waitFor({ timeout: 20000 });
  const manualStatus = await plugin.locator('#m-status').textContent();
  console.log('   manual status:', manualStatus.replace(/\n/g, ' '));
  await page.waitForTimeout(1500);
  await shot(page, '2-manual');
  let o2 = await plugin.evaluate(() => window.MusicEditor.getOutline());
  const melody = o2.elements[2];
  console.log('   element 2:', JSON.stringify({ has_image: melody.has_image, abc: (melody.abc || '').slice(0, 40) }));
  assert.ok(melody.has_image, 'image inserted after element 1');
  assert.match(melody.abc || '', /Alle meine Entchen/, 'ABC alt text readable');
  step('manual insert after a paragraph, alt text set: ' + manualStatus.split('\n')[0]);

  // Insert "at the cursor" while a sentence is selected: the sentence must survive
  // (regression: InsertContent replaced the selection).
  await plugin.evaluate(() => window.MusicEditor.callCommand(function () {
    Api.GetDocument().GetElement(4).GetRange().Select(); // "Schreibe die Tonnamen unter die Noten."
    return true;
  }, {}, false));
  await plugin.locator('#m-template').selectOption('emptyBass');
  await plugin.locator('#m-position').selectOption('cursor');
  await plugin.evaluate(() => { document.getElementById('m-status').className = 'message hidden'; });
  await plugin.locator('#m-insert').click();
  await plugin.locator('#m-status.ok, #m-status.error').waitFor({ timeout: 20000 });
  o2 = await plugin.evaluate(() => window.MusicEditor.getOutline());
  assert.equal(o2.elements[4].text, 'Schreibe die Tonnamen unter die Noten.', 'selected text is kept');
  assert.match(o2.elements[5].abc || '', /clef=bass/, 'staff inserted after the paragraph with the cursor');
  step('insert at the cursor keeps selected text (new paragraph after it)');

  // Chat (mock model): "unter Aufgabe 2 … c – f – g … leere Zeile", auto insert
  await plugin.locator('.tab[data-tab=chat]').click();
  await plugin.locator('#chat-auto').check();
  await plugin.locator('#chat-text').fill('Füge unter Aufgabe 2 eine Notenzeile mit c – f – g im Violinschlüssel ein und darunter eine leere Zeile zum Nachschreiben');
  await plugin.locator('#chat-send').click();
  await plugin.locator('.msg.assistant', { hasText: /Fertig|Problem/ }).waitFor({ timeout: 60000 });
  console.log('   chat:', (await plugin.locator('.msg').allTextContents()).slice(1).join(' | '));
  await page.waitForTimeout(1500);
  await shot(page, '3-chat');
  o2 = await plugin.evaluate(() => window.MusicEditor.getOutline());
  const h2 = o2.elements.findIndex((e) => e.text === 'Aufgabe 2');
  assert.match(o2.elements[h2 + 1].abc || '', /C F G/);
  assert.match(o2.elements[h2 + 2].abc || '', /x4/);
  step('chat inserted staff + empty staff directly below "Aufgabe 2"');

  // Change an existing staff via chat: "ändere Zeile N: statt f #f"
  const staffNo = o2.elements[h2 + 1].staff_number;
  const countBefore = o2.elements.length;
  await plugin.locator('#chat-text').fill(`Bitte ändere Zeile ${staffNo}: statt f #f`);
  await plugin.locator('#chat-send').click();
  await plugin.locator('.msg.assistant', { hasText: /steht jetzt|Problem|nicht/ }).waitFor({ timeout: 60000 });
  await page.waitForTimeout(1000);
  o2 = await plugin.evaluate(() => window.MusicEditor.getOutline());
  assert.equal(o2.elements.length, countBefore, 'no element added');
  assert.match(o2.elements[h2 + 1].abc || '', /C \^F G/);
  step(`chat changed Notenzeile ${staffNo} in place (replace_staff): ` + o2.elements[h2 + 1].abc.split('\n').pop());

  // Lyrics via chat: add_lyrics (server) + replace_staff
  await plugin.locator('#chat-text').fill(`Füge zu Zeile ${staffNo} den Text hinzu: Hal-lo du`);
  await plugin.locator('#chat-send').click();
  await plugin.locator('.msg.assistant', { hasText: /hat jetzt Text|passt nicht|nicht/ }).waitFor({ timeout: 60000 });
  await page.waitForTimeout(1000);
  o2 = await plugin.evaluate(() => window.MusicEditor.getOutline());
  assert.match(o2.elements[h2 + 1].abc || '', /C \^F G \|\]\nw: Hal-lo du$/);
  step(`chat added lyrics to Notenzeile ${staffNo}`);

  // Whole worksheet via insert_blocks (mock model), real builder API: headings, list, lines, table, box
  const countBeforeWs = (await plugin.evaluate(() => window.MusicEditor.getOutline())).total_elements;
  await plugin.locator('#chat-text').fill('Erstelle ein Arbeitsblatt zum Wasserkreislauf für Klasse 5');
  await plugin.locator('#chat-send').click();
  await plugin.locator('.msg.assistant', { hasText: /Arbeitsblatt mit|fehlgeschlagen/ }).waitFor({ timeout: 60000 });
  o2 = await plugin.evaluate(() => window.MusicEditor.getOutline());
  const wsIdx = o2.elements.findIndex((e) => e.text === 'Arbeitsblatt: Wasserkreislauf');
  assert.ok(wsIdx >= 0, 'worksheet title inserted');
  assert.equal(o2.elements[wsIdx].heading_level, 1);
  assert.equal(o2.elements.filter((e) => e.list_item).length >= 2, true, 'numbered list');
  assert.equal(o2.elements.filter((e) => e.type === 'table').length >= 2, true, 'table + box');
  assert.ok(o2.total_elements >= countBeforeWs + 13);
  const full = await plugin.evaluate((i) => window.WorksheetDoc.getElements(i, i + 12), wsIdx);
  const tableEl = full.elements.find((e) => e.type === 'table' && e.rows.length === 3);
  assert.deepEqual(tableEl.rows[0], ['Begriff', 'Erklärung']);
  step(`worksheet inserted with insert_blocks (${o2.total_elements - countBeforeWs} elements: headings, list, lines, table, box)`);
  // delete the worksheet again (keeps later assertions on the rest of the document stable)
  await plugin.evaluate(({ from, to }) => window.WorksheetDoc.editBlocks({ op: 'delete', from, to }), { from: wsIdx, to: wsIdx + (o2.total_elements - countBeforeWs) - 1 });
  o2 = await plugin.evaluate(() => window.MusicEditor.getOutline());
  assert.equal(o2.total_elements, countBeforeWs);
  step('delete_elements removed the worksheet again');
  await shot(page, '3b-worksheet');

  // MCP: the panel connects to the proxy's plugin bridge; an MCP client edits the document through it.
  if (process.env.SKIP_MCP !== '1') {
    await plugin.locator('.tab[data-tab=settings]').click();
    await plugin.locator('#s-mcp').check();
    await plugin.locator('#s-mcp-status.ok').waitFor({ timeout: 15000 });
    step('MCP bridge connected: ' + (await plugin.locator('#s-mcp-status').textContent()));
    const sdk = await import(pathToFileURL(path.join(here, '../../proxy/node_modules/@modelcontextprotocol/client/dist/index.mjs')).href);
    const mcp = new sdk.Client({ name: 'e2e', version: '1.0.0' });
    await mcp.connect(new sdk.StreamableHTTPClientTransport(new URL(PROXY_URL + '/mcp'), { requestInit: { headers: { authorization: `Bearer ${PROXY_TOKEN}` } } }));
    const docs = await mcp.callTool({ name: 'list_open_documents', arguments: {} });
    assert.match(docs.content[0].text, /arbeitsblatt\.docx/i);
    const outlineText = (await mcp.callTool({ name: 'get_document_outline', arguments: {} })).content[0].text;
    assert.match(outlineText, /Aufgabe 2/);
    const totalBefore = (await plugin.evaluate(() => window.MusicEditor.getOutline())).total_elements;
    const ins = await mcp.callTool({
      name: 'insert_blocks',
      arguments: {
        position: 'end',
        blocks: [
          { type: 'heading', level: 2, text: 'MCP-Test: Aufgabe 9' },
          { type: 'paragraph', text: 'Ergänze die **Tabelle**.' },
          { type: 'table', rows: [['Wort', 'Silben'], ['Wasser', '']] },
          { type: 'staff', abc: 'X:1\nM:none\nL:1/4\nK:C clef=treble\nC E G c |]' },
        ],
      },
    });
    assert.equal(ins.isError, false, ins.content[0].text);
    const insResult = JSON.parse(ins.content[0].text);
    let o3 = await plugin.evaluate(() => window.MusicEditor.getOutline());
    const mcpIdx = o3.elements.findIndex((e) => e.text === 'MCP-Test: Aufgabe 9');
    assert.ok(mcpIdx >= 0 && o3.elements[mcpIdx].is_heading, 'heading inserted via MCP');
    assert.ok(o3.elements.slice(mcpIdx).some((e) => e.type === 'table'), 'table inserted via MCP');
    assert.ok(o3.elements.slice(mcpIdx).some((e) => /C E G c/.test(e.abc || '')), 'staff with alt text inserted via MCP');
    await plugin.locator('.tab[data-tab=chat]').click();
    assert.ok((await plugin.locator('.msg.mcp').count()) >= 2, 'MCP calls are logged in the chat');
    await shot(page, '3c-mcp');
    const bad = await mcp.callTool({ name: 'insert_staff', arguments: { abc: 'not abc' } });
    assert.equal(bad.isError, true);
    const del = await mcp.callTool({ name: 'delete_elements', arguments: { from: insResult.first_index, to: insResult.last_index } });
    assert.equal(del.isError, false, del.content[0].text);
    o3 = await plugin.evaluate(() => window.MusicEditor.getOutline());
    assert.equal(o3.total_elements, totalBefore);
    await mcp.close();
    await plugin.locator('.tab[data-tab=settings]').click();
    await plugin.locator('#s-mcp').uncheck();
    step(`MCP client inserted (heading, text, table, staff) and deleted content through the plugin bridge`);
  }

  // Load + replace a selected image: select the melody via the builder API
  const selected = await plugin.evaluate(() => window.MusicEditor.callCommand(function () {
    var d = Api.GetDocument().GetElement(2).GetAllDrawingObjects()[0];
    return d && d.Select ? d.Select() : 'no Select()';
  }, {}, false));
  console.log('   select result:', selected);
  await plugin.locator('.tab[data-tab=manual]').click();
  await plugin.locator('#m-abc').fill('');
  await plugin.evaluate(() => { document.getElementById('m-status').className = 'message hidden'; });
  await plugin.locator('#m-load').click();
  await plugin.locator('#m-status.ok, #m-status.error').waitFor({ timeout: 10000 });
  console.log('   load status:', await plugin.locator('#m-status').textContent());
  assert.match(await plugin.locator('#m-abc').inputValue(), /Alle meine Entchen/);
  await plugin.locator('#m-abc').fill("X:1\nT:Geändert\nM:3/4\nL:1/4\nK:G clef=treble\nG A B | d2 B | G3 |]");
  await plugin.evaluate(() => { document.getElementById('m-status').className = 'message hidden'; });
  await plugin.locator('#m-replace').click();
  await plugin.locator('#m-status.ok, #m-status.error').waitFor({ timeout: 10000 });
  await page.waitForTimeout(1000);
  console.log('   replace status:', await plugin.locator('#m-status').textContent());
  o2 = await plugin.evaluate(() => window.MusicEditor.getOutline());
  console.log('   element 2 after replace:', (o2.elements[2].abc || '').replace(/\n/g, '\\n'));
  assert.match(o2.elements[2].abc || '', /Geändert/);
  step('load selected staff into the panel and replace it');
  await shot(page, '4-replace');

  // Fallback insert methods (used when Api.CreateImage fails): two inserts in a
  // row must not replace each other (the new image stays selected).
  const fb = await plugin.evaluate(async () => {
    const out = [];
    for (const method of ['imageData', 'html', 'imageData']) {
      const abc = 'X:1\nT:Fallback ' + method + '\nM:none\nL:1/4\nK:C clef=bass\nC, E, G, |]';
      const png = await MusicRenderer.renderPng(abc, { widthCm: 12 });
      const r = await MusicEditor.insertImage({ dataUrl: png.dataUrl, widthMm: png.widthMm, heightMm: png.heightMm, abc, position: { after_paragraph_index: 3 }, method });
      out.push(r.method + (r.ok ? '' : ' FAILED ' + r.error));
    }
    const o = await MusicEditor.getOutline();
    return { methods: out, staves: o.elements.filter((e) => /Fallback/.test(e.abc || '')).length };
  });
  console.log('   fallbacks:', JSON.stringify(fb));
  assert.deepEqual(fb.methods, ['PutImageDataToSelection', 'PasteHtml', 'PutImageDataToSelection']);
  assert.equal(fb.staves, 3, 'three separate fallback images with alt text');
  step('fallbacks PutImageDataToSelection / PasteHtml insert separate images with alt text');
  await shot(page, '5-fallbacks');

  // Save and inspect the .docx. Give the editor time to send the last changes
  // to the server first (co-editing changes are transmitted asynchronously).
  await page.waitForTimeout(Number(process.env.SAVE_DELAY_MS || 5000));
  const savedBefore = await (await fetch(new URL('/saved', EDITOR_URL))).json();
  console.log('   forcesave:', await (await fetch(new URL('/forcesave', EDITOR_URL))).text());
  let saved = savedBefore;
  for (let i = 0; i < 60 && saved.length === savedBefore.length; i++) {
    await page.waitForTimeout(1000);
    saved = await (await fetch(new URL('/saved', EDITOR_URL))).json();
  }
  assert.ok(saved.length > savedBefore.length, 'document was saved via callback');
  const file = path.join(here, 'out', path.basename(saved.at(-1).file));
  const listing = execFileSync('unzip', ['-l', file]).toString();
  const xml = execFileSync('unzip', ['-p', file, 'word/document.xml']).toString();
  const media = listing.split('\n').filter((l) => /word\/media\//.test(l)).map((l) => l.trim().split(/\s+/).slice(-1)[0] + ' ' + l.trim().split(/\s+/)[0] + 'B');
  const descrs = [...xml.matchAll(/<wp:docPr [^>]*descr="([^"]*)"/g)].map((m) => m[1].replace(/&#xA;|&#10;/g, '\\n').slice(0, 200));
  console.log('   saved:', file);
  console.log('   media:', media.join(', '));
  console.log('   docPr descr:', descrs);
  assert.ok(media.length >= 6, 'images are embedded in the saved .docx');
  assert.ok(descrs.some((d) => /Geändert/.test(d)) && descrs.some((d) => /C \^F G/.test(d)) && descrs.some((d) => /Hal-lo du/.test(d)), 'ABC alt text survives saving');
  step('saved .docx contains the PNG images and the ABC alt texts');

  assert.deepEqual(errors, []);
  step('no page errors');
} catch (err) {
  await shot(page, 'failure');
  try {
    const pf = page.frames().find((f) => f.url().includes('/sdkjs-plugins/worksheet-assistant/index.html'));
    if (pf) console.error('last chat messages:\n  ' + (await pf.locator('.msg').allTextContents()).slice(-6).join('\n  '));
  } catch (e) { /* ignore */ }
  console.error('FAILED:', err.message);
  console.error('page errors:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
