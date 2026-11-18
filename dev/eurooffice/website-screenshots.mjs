#!/usr/bin/env node
/*
 * Screenshots for the website (website/public/img/), taken in the real Euro-Office editor.
 *
 *   (cd dev/eurooffice && docker compose up -d)   # editor + storage
 *   a proxy with a real model, e.g. Mistral:      # PROXY_URL / PROXY_TOKEN, CORS_ORIGINS=http://localhost:8090
 *   node dev/eurooffice/website-screenshots.mjs <out-dir>
 *
 * 1. worksheet-chat.png – a complete worksheet created by the AI chat
 * 2. mcp.png            – an MCP client adds a task with a staff; the panel logs the calls
 * 3. companion.png      – window of the desktop app (desktop/, its built UI with the simulated backend)
 * 4. music.png          – the music tab with a template, on the test worksheet
 *
 * ONLY=music takes only the music tab screenshot (no model needed).
 * ONLY=companion takes only the desktop app screenshot (no editor needed; build it first with
 * `npm --prefix desktop run generate`).
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
const PROMPT = process.env.PROMPT || 'Erstelle ein Arbeitsblatt zum Wasserkreislauf für Klasse 5 mit drei abwechslungsreichen Aufgaben, einer Tabelle und einem Merkkasten.';
const out = process.argv[2] || '.';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });

/** The desktop app's window: its built UI (desktop/.output/public) with the simulated backend, everything set up. */
async function desktopAppShot() {
  const dist = path.join(root, 'desktop/.output/public');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
  const page2 = await browser.newPage({ viewport: { width: 980, height: 700 }, deviceScaleFactor: 2, colorScheme: 'light' });
  await page2.route('http://app.local/**', (route) => {
    const file = path.join(dist, decodeURIComponent(new URL(route.request().url()).pathname));
    const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(dist, 'index.html');
    return route.fulfill({ contentType: types[path.extname(target)] || 'application/octet-stream', body: fs.readFileSync(target) });
  });
  await page2.goto('http://app.local/?scenario=ready#/');
  await page2.getByText('Claude kann das geöffnete Dokument bearbeiten.').waitFor();
  await page2.waitForTimeout(500);
  await page2.screenshot({ path: path.join(out, 'companion.png') });
  console.log('companion.png');
}

if (process.env.ONLY === 'companion') {
  await desktopAppShot();
  await browser.close();
  process.exit(0);
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await fetch(new URL('/reset', EDITOR_URL));
  await page.goto(EDITOR_URL);
  await page.waitForFunction(() => window.documentReady === true, null, { timeout: 120000 });
  const editor = page.frame({ name: 'frameEditor' });
  await editor.locator('.ribtab a[data-tab=plugins]').click();
  await editor.getByText('Arbeitsblatt-Assistent', { exact: true }).first().click();
  let plugin = null;
  for (let i = 0; i < 50 && !plugin; i++) {
    plugin = page.frames().find((f) => /worksheet-assistant\/index\.html/.test(f.url())) || null;
    if (!plugin) await page.waitForTimeout(200);
  }
  await plugin.locator('#chat-text').waitFor();
  await plugin.locator('.tab[data-tab=settings]').click();
  await plugin.locator('#s-url').fill(PROXY_URL);
  await plugin.locator('#s-token').fill(PROXY_TOKEN);
  await plugin.locator('#s-save').click();
  await page.waitForTimeout(500);

  if (process.env.ONLY === 'music') {
    await plugin.locator('.tab[data-tab=manual]').click();
    await plugin.locator('#m-template').selectOption('melody');
    await plugin.locator('#m-outline').click();
    await page.waitForTimeout(500);
    await plugin.locator('#m-position').selectOption('after:3');
    await plugin.locator('#m-insert').click();
    await plugin.locator('#m-status.ok, #m-status.error').waitFor({ timeout: 20000 });
    await plugin.evaluate(() => window.MusicEditor.callCommand(function () {
      Api.GetDocument().GetElement(0).GetRange(0, 0).Select();
    }, {}, false));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(out, 'music.png') });
    console.log('music.png');
    process.exit(0);
  }

  // empty document
  await plugin.evaluate(() => window.MusicEditor.callCommand(function () {
    var d = Api.GetDocument();
    d.RemoveAllElements();
    d.Push(Api.CreateParagraph());
  }, {}, false));

  // 1. worksheet via chat
  await plugin.locator('.tab[data-tab=chat]').click();
  await plugin.locator('#chat-auto').check();
  await plugin.locator('#chat-text').fill(PROMPT);
  await plugin.locator('#chat-send').click();
  await plugin.locator('#chat-send:disabled').waitFor({ timeout: 10000 });
  await plugin.locator('#chat-send:not(:disabled)').waitFor({ timeout: 300000 });
  console.log('chat:', (await plugin.locator('.msg').allTextContents()).slice(-3).join(' | ').slice(0, 300));
  await page.waitForTimeout(2000);
  // remove the empty paragraph left at the top, put the cursor at the start
  await plugin.evaluate(() => window.MusicEditor.callCommand(function () {
    var d = Api.GetDocument();
    var first = d.GetElement(0);
    if (d.GetElementsCount() > 1 && first.GetClassType && first.GetClassType() === 'paragraph' && !first.GetText().trim()) d.RemoveElement(0);
    d.GetElement(0).GetRange(0, 0).Select();
  }, {}, false));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, 'worksheet-chat.png') });
  console.log('worksheet-chat.png');

  // 2. MCP
  await plugin.locator('.tab[data-tab=settings]').click();
  await plugin.locator('#s-mcp').check();
  await plugin.locator('#s-mcp-status.ok').waitFor({ timeout: 15000 });
  const sdk = await import(pathToFileURL(path.join(root, 'proxy/node_modules/@modelcontextprotocol/client/dist/index.mjs')).href);
  const mcp = new sdk.Client({ name: 'screenshots', version: '1' });
  await mcp.connect(new sdk.StreamableHTTPClientTransport(new URL(PROXY_URL + '/mcp'), { requestInit: { headers: { authorization: `Bearer ${PROXY_TOKEN}` } } }));
  await mcp.callTool({ name: 'get_document_outline', arguments: {} });
  const r = await mcp.callTool({
    name: 'insert_blocks',
    arguments: {
      position: 'end',
      blocks: [
        { type: 'heading', level: 2, text: 'Zusatzaufgabe: Das Regenlied' },
        { type: 'paragraph', text: 'Singt das Lied und klatscht dazu den Rhythmus.' },
        { type: 'staff', abc: 'X:1\nT:Es regnet\nM:2/4\nL:1/8\nK:F clef=treble\nc c A A | c c A2 | B B G G | B2 G2 |]\nw: Es reg-net, es reg-net, die Er-de wird nass, wird nass' },
      ],
    },
  });
  console.log('mcp insert:', r.content[0].text.slice(0, 120));
  await mcp.close();
  await plugin.locator('.tab[data-tab=chat]').click();
  await page.waitForTimeout(1500);
  await plugin.evaluate(() => window.MusicEditor.callCommand(function () {
    var d = Api.GetDocument();
    var last = d.GetElement(d.GetElementsCount() - 1);
    last.GetRange(0, 0).Select();
  }, {}, false));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, 'mcp.png') });
  console.log('mcp.png');

  // 3. the desktop app's window
  await desktopAppShot();
} finally {
  await browser.close();
}
