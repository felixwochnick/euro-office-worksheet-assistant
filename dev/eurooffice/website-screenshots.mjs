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
 * 3. companion.png      – settings page of the companion app (rendered with example data)
 * 4. music.png          – the music tab with a template, on the test worksheet
 *
 * ONLY=music takes only the music tab screenshot (no model needed).
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

  // 3. companion settings page with example data (the real page, API answers mocked)
  const { settingsPage } = await import(pathToFileURL(path.join(root, 'proxy/build/src/companion/ui.js')).href);
  const page2 = await browser.newPage({ viewport: { width: 860, height: 1200 }, deviceScaleFactor: 2, colorScheme: 'light' });
  const home = '/home/lehrer';
  await page2.route('http://127.0.0.1:8787/**', (route) => {
    const url = route.request().url();
    if (url.endsWith('/companion/api/state')) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          version: '0.4.2', url: 'http://127.0.0.1:8787', mcp_url: 'http://127.0.0.1:8787/mcp', config_dir: `${home}/.config/worksheet-assistant`,
          plugin_version: '0.4.2',
          apps: [{ id: 'desktop-editors', name: 'Euro-Office / Nextcloud Office', detected: true, installed: true, configured: true, version: '0.4.2', plugin_dir: `${home}/.local/share/euro-office/desktopeditors/sdkjs-plugins/{DA7D8078-28E2-4FFC-A41B-02BD1B9CE490}` }],
          settings: { provider: 'mistral', model: '', base_url: '', has_key: true, extra_origins: [] },
          providers: [
            { id: 'none', label: 'Kein KI-Chat (nur MCP)', model: '', needs_key: false, base_url: '' },
            { id: 'mistral', label: 'Mistral', model: 'mistral-large-latest', needs_key: true, base_url: '' },
            { id: 'openai', label: 'OpenAI', model: 'gpt-4o-mini', needs_key: true, base_url: '' },
            { id: 'anthropic', label: 'Anthropic (Claude)', model: 'claude-sonnet-5-5', needs_key: true, base_url: '' },
            { id: 'ollama', label: 'Ollama (lokales Modell)', model: 'qwen2.5:7b', needs_key: false, base_url: 'http://127.0.0.1:11434/v1' },
          ],
          chat_error: '', autostart: true, stdio_command: ['/opt/worksheet-assistant/worksheet-assistant', 'mcp-stdio'], platform: 'linux',
        }),
      });
    }
    return route.fulfill({ contentType: 'text/html', body: settingsPage('demo') });
  });
  await page2.goto('http://127.0.0.1:8787/');
  await page2.locator('#apps .app').first().waitFor();
  await page2.screenshot({ path: path.join(out, 'companion.png'), fullPage: true });
  console.log('companion.png');
} finally {
  await browser.close();
}
