#!/usr/bin/env node
/*
 * End-to-end test of AUTH_MODE=nextcloud against a REAL Nextcloud and a REAL Euro-Office editor:
 *   - the plugin signs in with "Mit Nextcloud anmelden" (Login Flow v2, popup)
 *   - the panel connects the MCP bridge
 *   - an MCP client signs in with a Nextcloud app password and edits the document; another user does not see it
 *   - an MCP client signs in with OAuth (dynamic registration, PKCE, Nextcloud login, consent page), refreshes,
 *     and loses access after the token is deleted in Nextcloud
 *   - signing out in the plugin deletes its app password in Nextcloud
 *
 * Prerequisites:
 *   bash scripts/build.sh && npm run build:server
 *   (cd dev/eurooffice && docker compose up -d)
 *   (cd dev/nextcloud && docker compose up -d && ./setup.sh)
 *   node dev/nextcloud/e2e-nextcloud.mjs [screenshot-dir]
 *
 * The script starts its own proxy on port 8797 and registers the OAuth client "Arbeitsblatt-Assistent E2E" in
 * Nextcloud once (stored in dev/nextcloud/oauth-client-e2e.env).
 */
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { grantLoginFlow, grantOAuth } from './nc-browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../..');
const NC = process.env.NEXTCLOUD_URL || 'http://localhost:8091';
const EDITOR_URL = process.env.EDITOR_URL || 'http://localhost:8099/';
const PORT = 8797;
const PROXY = `http://localhost:${PORT}`;
const USER = 'lehrer';
const PASSWORD = 'lehrer-dev-password-123';
const shots = process.argv[2];
const step = (msg) => console.log('ok - ' + msg);
const shot = async (page, name) => { if (shots) await page.screenshot({ path: path.join(shots, `nc-${name}.png`) }); };

const occ = (...args) => execFileSync('docker', ['compose', '-p', 'nextcloud-dev', 'exec', '-T', '-u', 'www-data', 'nextcloud', 'php', 'occ', ...args], { cwd: here, encoding: 'utf8' });

// --- OAuth client in Nextcloud for this proxy ----------------------------------------------------------
const clientFile = path.join(here, 'oauth-client-e2e.env');
if (!fs.existsSync(clientFile)) {
  const out = JSON.parse(occ('oauth2:add-client', '--output=json', 'Arbeitsblatt-Assistent E2E', `${PROXY}/oauth/callback`));
  fs.writeFileSync(clientFile, `NEXTCLOUD_OAUTH_CLIENT_ID=${out.clientId}\nNEXTCLOUD_OAUTH_CLIENT_SECRET=${out.clientSecret}\n`, { mode: 0o600 });
}
const clientEnv = Object.fromEntries(fs.readFileSync(clientFile, 'utf8').trim().split('\n').map((l) => l.split('=')));

// --- proxy ------------------------------------------------------------------------------------------------
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-e2e-'));
const proxy = spawn(process.execPath, [path.join(root, 'apps/server/build/src/server.js')], {
  env: {
    ...process.env,
    AUTH_MODE: 'nextcloud',
    NEXTCLOUD_URL: NC,
    ...clientEnv,
    PUBLIC_URL: PROXY,
    PORT: String(PORT),
    CORS_ORIGINS: 'http://localhost:8090',
    LLM_PROVIDER: 'mock',
    DATA_DIR: dataDir,
    RATE_LIMIT_MAX: '1000',
    LOG_LEVEL: 'warn',
  },
  stdio: ['ignore', 'inherit', 'inherit'],
});
for (let i = 0; i < 50; i++) {
  try { if ((await fetch(`${PROXY}/healthz`)).ok) break; } catch { /* starting */ }
  await new Promise((r) => setTimeout(r, 200));
}

const sdk = await import(pathToFileURL(path.join(root, 'node_modules/@modelcontextprotocol/client/dist/index.mjs')).href);
async function mcp(authorization) {
  const client = new sdk.Client({ name: 'e2e-nextcloud', version: '1.0.0' });
  await client.connect(new sdk.StreamableHTTPClientTransport(new URL(PROXY + '/mcp'), { requestInit: { headers: { authorization } } }));
  return client;
}
const text = (r) => r.content.map((c) => c.text || '').join('\n');
const appPassword = (user, name) => {
  const out = occ('user:auth-tokens:add', '--no-interaction', `--name=${name}`, user);
  const m = /app password:\s*\n?\s*(\S{40,})/i.exec(out);
  assert.ok(m, 'app password from occ: ' + out);
  return m[1];
};
const tokens = (user) => JSON.parse(occ('user:auth-tokens:list', '--output=json', user));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const errors = [];
try {
  // --- 1. plugin sign-in with Login Flow v2 ---------------------------------------------------------------
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await fetch(new URL('/reset', EDITOR_URL));
  await page.goto(EDITOR_URL);
  await page.waitForFunction(() => window.documentReady === true || window.editorError, null, { timeout: 120000 });
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
  await plugin.locator('#s-url').fill(PROXY);
  await plugin.locator('#s-save').click();
  await plugin.locator('#s-nc:not(.hidden)').waitFor({ timeout: 10000 });
  assert.equal(await plugin.locator('#s-token-field').isHidden(), true);
  const [popup] = await Promise.all([context.waitForEvent('page'), plugin.locator('#s-nc-login').click()]);
  await popup.waitForURL(/\/login\/v2\/flow/, { timeout: 15000 });
  await grantLoginFlow(popup, popup.url(), USER, PASSWORD);
  await plugin.locator('#s-nc-status.ok').waitFor({ timeout: 20000 });
  const signedIn = await plugin.locator('#s-nc-user').textContent();
  assert.match(signedIn, /Angemeldet als/);
  const pluginTokens = () => tokens(USER).filter((t) => t.name === 'Arbeitsblatt-Assistent (Euro-Office plugin)').length;
  const pluginTokensAfterLogin = pluginTokens();
  assert.ok(pluginTokensAfterLogin >= 1, 'app password visible in Nextcloud');
  step(`plugin signed in with Nextcloud Login Flow v2 (${signedIn})`);

  // chat works with the sign-in token
  await plugin.locator('#s-test').click();
  await plugin.locator('#s-status.ok').waitFor({ timeout: 10000 });
  step('connection test with the sign-in token: ' + (await plugin.locator('#s-status').textContent()));

  await plugin.locator('#s-mcp').check();
  await plugin.locator('#s-mcp-status.ok').waitFor({ timeout: 15000 });
  await shot(page, '1-settings');
  step('MCP bridge connected as the Nextcloud user');

  // --- 2. MCP with app passwords --------------------------------------------------------------------------
  const pw = appPassword(USER, 'MCP-Test');
  const basicAuth = 'Basic ' + Buffer.from(`${USER}:${pw}`).toString('base64');
  const c1 = await mcp(basicAuth);
  assert.match(text(await c1.callTool({ name: 'list_open_documents', arguments: {} })), /Worksheet\.docx/);
  const ins = await c1.callTool({
    name: 'insert_blocks',
    arguments: { position: 'end', blocks: [{ type: 'heading', level: 2, text: 'Per App-Passwort' }, { type: 'lines', count: 2 }] },
  });
  assert.equal(ins.isError, false, text(ins));
  const outline = await plugin.evaluate(() => window.MusicEditor.getOutline());
  assert.ok(outline.elements.some((e) => e.text === 'Per App-Passwort' && e.is_heading));
  const r = JSON.parse(text(ins));
  assert.equal((await c1.callTool({ name: 'delete_elements', arguments: { from: r.first_index, to: r.last_index } })).isError, false);
  await c1.close();
  step('MCP client with a Nextcloud app password edited the open document');

  const adminPw = appPassword('admin', 'MCP-Test');
  const c2 = await mcp('Basic ' + Buffer.from(`admin:${adminPw}`).toString('base64'));
  const other = await c2.callTool({ name: 'list_open_documents', arguments: {} });
  assert.equal(other.isError, true);
  await c2.close();
  step('another Nextcloud user does not see the document');

  const wrong = await fetch(PROXY + '/mcp', {
    method: 'POST',
    headers: { authorization: 'Basic ' + Buffer.from(`${USER}:wrong-password`).toString('base64'), 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });
  assert.equal(wrong.status, 401);
  assert.match(wrong.headers.get('www-authenticate') || '', /resource_metadata=/);
  step('wrong app password: 401 with OAuth discovery hint');

  // --- 3. MCP with OAuth ----------------------------------------------------------------------------------
  const asm = await (await fetch(`${PROXY}/.well-known/oauth-authorization-server`)).json();
  const redirectUri = 'http://127.0.0.1:47123/callback';
  const reg = await (await fetch(asm.registration_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_name: 'E2E-Assistent', redirect_uris: [redirectUri], token_endpoint_auth_method: 'none' }),
  })).json();
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const authorizeUrl = `${asm.authorization_endpoint}?` + new URLSearchParams({
    response_type: 'code', client_id: reg.client_id, redirect_uri: redirectUri, code_challenge: challenge,
    code_challenge_method: 'S256', state: 'e2e-state', resource: `${PROXY}/mcp`,
  });
  // The proxy's authorize endpoint sets a cookie (binds the sign-in to this browser) and redirects to Nextcloud.
  const start = await fetch(authorizeUrl, { redirect: 'manual' });
  assert.equal(start.status, 302);
  const [cookieName, cookieValue] = (start.headers.get('set-cookie') || '').split(';')[0].split('=');
  const oauthContext = await browser.newContext();
  await oauthContext.addCookies([{ name: cookieName, value: cookieValue, url: `${PROXY}/oauth/` }]);
  const oauthPage = await oauthContext.newPage();
  const callback = await grantOAuth(oauthPage, start.headers.get('location'), USER, PASSWORD, `${PROXY}/oauth/callback`);
  let finalUrl = null;
  await oauthPage.route('http://127.0.0.1:47123/**', (route) => { finalUrl = route.request().url(); return route.fulfill({ status: 200, body: 'ok' }); });
  await oauthPage.goto(callback);
  const consent = await oauthPage.locator('main').innerText();
  assert.match(consent, /Test Lehrer \(lehrer\)/);
  assert.match(consent, /E2E-Assistent/);
  await shot(oauthPage, '2-consent');
  await oauthPage.locator('button[value=allow]').click();
  for (let i = 0; i < 50 && !finalUrl; i++) await oauthPage.waitForTimeout(100);
  const back = new URL(finalUrl);
  assert.equal(back.searchParams.get('state'), 'e2e-state');
  const tokenReq = (params) => fetch(asm.token_endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) }).then((x) => x.json());
  const tok = await tokenReq({ grant_type: 'authorization_code', code: back.searchParams.get('code'), client_id: reg.client_id, redirect_uri: redirectUri, code_verifier: verifier });
  assert.ok(tok.access_token, JSON.stringify(tok));
  const c3 = await mcp(`Bearer ${tok.access_token}`);
  assert.match(text(await c3.callTool({ name: 'get_document_outline', arguments: {} })), /Aufgabe 2/);
  await c3.close();
  step('MCP client signed in with OAuth via Nextcloud (registration, PKCE, Nextcloud login, consent) and read the document');

  const ref = await tokenReq({ grant_type: 'refresh_token', refresh_token: tok.refresh_token, client_id: reg.client_id });
  assert.ok(ref.access_token, JSON.stringify(ref));
  step('refresh token rotated (Nextcloud token refreshed)');

  // revoke in Nextcloud: delete the OAuth token of the E2E client in "Devices & sessions"
  const oauthTokens = tokens(USER).filter((t) => t.name === 'Arbeitsblatt-Assistent E2E');
  assert.ok(oauthTokens.length >= 1, 'OAuth token listed in Nextcloud');
  for (const t of oauthTokens) occ('user:auth-tokens:delete', USER, String(t.id));
  const ref2 = await tokenReq({ grant_type: 'refresh_token', refresh_token: ref.refresh_token, client_id: reg.client_id });
  assert.equal(ref2.error, 'invalid_grant', JSON.stringify(ref2));
  const after = await fetch(PROXY + '/mcp', {
    method: 'POST',
    headers: { authorization: `Bearer ${ref.access_token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });
  assert.equal(after.status, 401);
  step('access revoked in Nextcloud: refresh fails, tokens stop working');

  // --- 4. sign-out ------------------------------------------------------------------------------------------
  await plugin.locator('#s-nc-logout').click();
  await plugin.locator('#s-nc-login:not(.hidden)').waitFor();
  await page.waitForTimeout(1500);
  assert.equal(pluginTokens(), pluginTokensAfterLogin - 1, 'app password deleted in Nextcloud');
  await plugin.locator('#s-mcp-status.bad, #s-mcp-status:not(.ok)').first().waitFor({ timeout: 10000 });
  step('sign-out deleted the app password in Nextcloud');

  assert.deepEqual(errors, []);
  step('no page errors');
} catch (err) {
  console.error('FAILED:', err.message);
  process.exitCode = 1;
} finally {
  // clean up the app passwords created for the test
  for (const user of [USER, 'admin']) {
    try { for (const t of tokens(user).filter((x) => x.name === 'MCP-Test')) occ('user:auth-tokens:delete', user, String(t.id)); } catch { /* ignore */ }
  }
  await browser.close();
  proxy.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
