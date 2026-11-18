/**
 * MCP endpoint, plugin bridge and authentication (token, local, nextcloud with a fake Nextcloud).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import WebSocket from 'ws';
import { loadConfig, type Config } from '../src/config.js';
import { buildServer } from '../src/server.js';
import { NextcloudClient } from '../src/nextcloud.js';
import { OAuthServer, redirectUriMatches, validRedirectUri } from '../src/oauth.js';
import { fetchSmallDocument, isBlockedAddress } from '../src/safe-fetch.js';
import { AuthStore } from '../src/store.js';

const TOKEN = 'test-token-0123456789';
const ORIGIN = 'https://cloud.example.org';

function cfg(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    LLM_PROVIDER: 'mock',
    PROXY_TOKEN: TOKEN,
    CORS_ORIGINS: ORIGIN,
    LOG_LEVEL: 'silent',
    RATE_LIMIT_MAX: '1000',
    ...overrides,
  });
}

async function listen(app: Awaited<ReturnType<typeof buildServer>>): Promise<string> {
  await app.listen({ host: '127.0.0.1', port: 0 });
  return `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
}

const OUTLINE = {
  elements: [
    { index: 0, type: 'paragraph', text: 'Arbeitsblatt Wasser', is_heading: true, heading_level: 1 },
    { index: 1, type: 'paragraph', text: '' },
  ],
  cursor_index: 1,
  total_elements: 2,
};

/** A fake editor: connects to the bridge and answers tool calls. */
async function fakeEditor(base: string, token: string | undefined, opts: { origin?: string; title?: string } = {}) {
  const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
  const ws = new WebSocket(base.replace(/^http/, 'ws') + '/v1/bridge', { origin: opts.origin ?? ORIGIN });
  const welcome = await new Promise<Record<string, unknown>>((resolve, reject) => {
    ws.on('open', () => ws.send(JSON.stringify({ type: 'hello', token, document: { title: opts.title ?? 'Wasser.docx' }, client: { version: 'test' } })));
    ws.on('message', (data) => {
      const msg = JSON.parse(String(data));
      if (msg.type === 'welcome' || msg.type === 'error') return resolve(msg);
      if (msg.type === 'call') {
        calls.push({ name: msg.name, arguments: msg.arguments });
        let result: unknown = { ok: true, inserted: true, count: 3, first_index: 2, last_index: 4 };
        if (msg.name === 'get_document_outline') result = { ok: true, outline: OUTLINE };
        if (msg.name === 'delete_elements') return ws.send(JSON.stringify({ type: 'result', id: msg.id, ok: false, error: 'boom' }));
        ws.send(JSON.stringify({ type: 'result', id: msg.id, ok: true, result }));
      }
    });
    ws.on('close', (code, reason) => resolve({ type: 'closed', code, reason: String(reason) }));
    ws.on('error', reject);
  });
  return { ws, welcome, calls, close: () => ws.close() };
}

async function mcpClient(base: string, headers: Record<string, string> = {}) {
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp'), { requestInit: { headers } }));
  return client;
}

function textOf(result: unknown): string {
  const r = result as { content: Array<{ type: string; text?: string }> };
  return r.content.map((c) => c.text ?? '').join('\n');
}

// ---------------------------------------------------------------------------

test('mcp (token mode): tools are forwarded to the connected editor and validated first', async () => {
  const app = await buildServer(cfg());
  const base = await listen(app);
  try {
    // without a token: 401 with a challenge
    const unauth = await fetch(base + '/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
    assert.equal(unauth.status, 401);
    assert.match(unauth.headers.get('www-authenticate') || '', /^Bearer/);

    const client = await mcpClient(base, { authorization: `Bearer ${TOKEN}` });
    const tools = (await client.listTools()).tools.map((t) => t.name);
    for (const name of ['list_open_documents', 'get_document_outline', 'insert_blocks', 'replace_elements', 'delete_elements', 'insert_staff', 'convert_german_notes', 'add_lyrics']) {
      assert.ok(tools.includes(name), `tool ${name} is listed`);
    }

    // no editor connected yet: explanatory error
    const none = await client.callTool({ name: 'get_document_outline', arguments: {} });
    assert.equal(none.isError, true);
    assert.match(textOf(none), /MCP-Zugriff erlauben/);

    // server-side tools work without an editor
    const conv = await client.callTool({ name: 'convert_german_notes', arguments: { notes: 'c d e f g' } });
    assert.equal(conv.isError, false);
    assert.match(textOf(conv), /"tune"/);

    const editor = await fakeEditor(base, TOKEN);
    assert.equal(editor.welcome.type, 'welcome');

    const docs = await client.callTool({ name: 'list_open_documents', arguments: {} });
    assert.match(textOf(docs), /Wasser\.docx/);

    const outline = await client.callTool({ name: 'get_document_outline', arguments: {} });
    assert.equal(outline.isError, false);
    assert.match(textOf(outline), /HEADING 1: "Arbeitsblatt Wasser"/);

    // invalid blocks never reach the editor
    const before = editor.calls.length;
    const bad = await client.callTool({ name: 'insert_blocks', arguments: { position: 'end', blocks: [{ type: 'nonsense' }] } });
    assert.equal(bad.isError, true);
    assert.equal(editor.calls.length, before);

    const ok = await client.callTool({
      name: 'insert_blocks',
      arguments: { position: 'end', blocks: [{ type: 'heading', level: 2, text: 'Aufgabe 1' }, { type: 'lines', count: 2 }] },
    });
    assert.equal(ok.isError, false, textOf(ok));
    const last = editor.calls[editor.calls.length - 1];
    assert.equal(last.name, 'insert_blocks');
    assert.equal(last.arguments.position, 'end');
    assert.equal((last.arguments.blocks as unknown[]).length, 2);

    // errors reported by the editor are tool errors
    const del = await client.callTool({ name: 'delete_elements', arguments: { from: 0, to: 0 } });
    assert.equal(del.isError, true);
    assert.match(textOf(del), /boom/);

    // unknown document id
    const wrongDoc = await client.callTool({ name: 'get_document_outline', arguments: { document_id: 'nope' } });
    assert.equal(wrongDoc.isError, true);

    editor.close();
    await client.close();
  } finally {
    await app.close();
  }
});

test('bridge: wrong token and foreign origins are refused', async () => {
  const app = await buildServer(cfg());
  const base = await listen(app);
  try {
    const wrong = await fakeEditor(base, 'wrong-token-000000000');
    assert.equal(wrong.welcome.type, 'error');
    const foreign = await fakeEditor(base, TOKEN, { origin: 'https://evil.example' });
    assert.equal(foreign.welcome.type, 'closed');
    assert.equal(foreign.welcome.code, 4403);
  } finally {
    await app.close();
  }
});

test('mcp (local mode): no authentication, loopback only, Host header checked', async () => {
  assert.throws(() => cfg({ AUTH_MODE: 'local', HOST: '0.0.0.0' }), /loopback|127\.0\.0\.1/);
  const app = await buildServer(cfg({ AUTH_MODE: 'local' }));
  const base = await listen(app);
  try {
    const client = await mcpClient(base);
    assert.ok((await client.listTools()).tools.length > 5);
    await client.close();
    const rebinding = await app.inject({ method: 'GET', url: '/healthz', headers: { host: 'evil.example:8787' } });
    assert.equal(rebinding.statusCode, 403);
    const foreign = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: { host: '127.0.0.1:8787', origin: 'https://evil.example', 'content-type': 'application/json' },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
    });
    assert.equal(foreign.statusCode, 403);
  } finally {
    await app.close();
  }
});

// --- fake Nextcloud -----------------------------------------------------------------

interface FakeNextcloud {
  url: string;
  close: () => Promise<void>;
  /** app passwords (login -> password) */
  appPasswords: Map<string, { user: string; password: string }>;
  /** grant the pending login flow */
  grantLoginFlow: () => void;
  /** pending OAuth codes -> user */
  oauthAccess: Map<string, string>;
  refreshTokens: Map<string, string>;
  revokeAll: () => void;
  refreshCalls: number;
}

async function fakeNextcloud(): Promise<FakeNextcloud> {
  const appPasswords = new Map<string, { user: string; password: string }>();
  const oauthCodes = new Map<string, string>();
  const oauthAccess = new Map<string, string>();
  const refreshTokens = new Map<string, string>();
  let flow: { pollToken: string; granted: boolean } | null = null;
  const state = { refreshCalls: 0 };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://x');
    let body = '';
    for await (const chunk of req) body += chunk;
    const json = (status: number, obj: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    if (url.pathname === '/ocs/v2.php/cloud/user') {
      const auth = req.headers.authorization || '';
      let user: string | undefined;
      if (auth.startsWith('Basic ')) {
        const [login, pw] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
        const entry = appPasswords.get(login);
        if (entry && entry.password === pw) user = entry.user;
      } else if (auth.startsWith('Bearer ')) user = oauthAccess.get(auth.slice(7));
      if (!user) return json(401, { ocs: { meta: { statuscode: 997 } } });
      return json(200, { ocs: { data: { id: user, 'display-name': user === 'lehrer' ? 'Frau Lehrer' : user } } });
    }
    if (url.pathname === '/index.php/login/v2' && req.method === 'POST') {
      flow = { pollToken: crypto.randomBytes(16).toString('hex'), granted: false };
      return json(200, { poll: { token: flow.pollToken, endpoint: `${base}/index.php/login/v2/poll` }, login: `${base}/index.php/login/v2/flow/abc` });
    }
    if (url.pathname === '/index.php/login/v2/poll') {
      const token = new URLSearchParams(body).get('token');
      if (!flow || token !== flow.pollToken || !flow.granted) return json(404, []);
      flow = null;
      const pw = 'app-' + crypto.randomBytes(8).toString('hex');
      appPasswords.set('lehrer', { user: 'lehrer', password: pw });
      return json(200, { server: base, loginName: 'lehrer', appPassword: pw });
    }
    if (url.pathname === '/ocs/v2.php/core/apppassword' && req.method === 'DELETE') {
      appPasswords.delete('lehrer');
      return json(200, {});
    }
    if (url.pathname === '/index.php/apps/oauth2/authorize') {
      // The user logs in and grants: redirect back with a code.
      const code = crypto.randomBytes(16).toString('hex');
      oauthCodes.set(code, 'lehrer');
      const back = new URL(url.searchParams.get('redirect_uri')!);
      back.searchParams.set('code', code);
      back.searchParams.set('state', url.searchParams.get('state')!);
      res.writeHead(303, { location: back.toString() });
      return res.end();
    }
    if (url.pathname === '/index.php/apps/oauth2/api/v1/token') {
      const p = new URLSearchParams(body);
      if (p.get('client_id') !== 'nc-client' || p.get('client_secret') !== 'nc-secret') return json(400, { error: 'invalid_client' });
      let user: string | undefined;
      if (p.get('grant_type') === 'authorization_code') {
        user = oauthCodes.get(p.get('code') || '');
        oauthCodes.delete(p.get('code') || '');
      } else {
        state.refreshCalls++;
        user = refreshTokens.get(p.get('refresh_token') || '');
        refreshTokens.delete(p.get('refresh_token') || '');
      }
      if (!user) return json(400, { error: 'invalid_request' });
      const access = 'nca-' + crypto.randomBytes(8).toString('hex');
      const refresh = 'ncr-' + crypto.randomBytes(8).toString('hex');
      oauthAccess.set(access, user);
      refreshTokens.set(refresh, user);
      return json(200, { access_token: access, token_type: 'Bearer', expires_in: 3600, refresh_token: refresh, user_id: user });
    }
    json(404, {});
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url: base,
    close: () => new Promise((r) => server.close(() => r())),
    appPasswords,
    grantLoginFlow: () => {
      if (flow) flow.granted = true;
    },
    oauthAccess,
    refreshTokens,
    revokeAll: () => refreshTokens.clear(),
    get refreshCalls() {
      return state.refreshCalls;
    },
  };
}

function ncCfg(nc: FakeNextcloud, publicUrl = 'http://127.0.0.1:1') {
  return cfg({
    AUTH_MODE: 'nextcloud',
    PROXY_TOKEN: '',
    NEXTCLOUD_URL: nc.url,
    NEXTCLOUD_OAUTH_CLIENT_ID: 'nc-client',
    NEXTCLOUD_OAUTH_CLIENT_SECRET: 'nc-secret',
    PUBLIC_URL: publicUrl,
  });
}

test('nextcloud mode: plugin sign-in with Login Flow v2, app passwords for MCP', async () => {
  const nc = await fakeNextcloud();
  const app = await buildServer(ncCfg(nc), { store: new AuthStore(null) });
  const base = await listen(app);
  try {
    const meta = (await app.inject({ method: 'GET', url: '/v1/meta' })).json();
    assert.equal(meta.auth_mode, 'nextcloud');
    assert.equal(meta.mcp.auth, 'oauth+app_password');

    const start = (await app.inject({ method: 'POST', url: '/v1/auth/login' })).json();
    assert.match(start.login_url, /login\/v2\/flow/);
    const waiting = (await app.inject({ method: 'POST', url: '/v1/auth/login/poll', payload: { flow_id: start.flow_id } })).json();
    assert.equal(waiting.done, false);
    nc.grantLoginFlow();
    const done = (await app.inject({ method: 'POST', url: '/v1/auth/login/poll', payload: { flow_id: start.flow_id } })).json();
    assert.equal(done.done, true);
    assert.equal(done.user.id, 'lehrer');
    const pluginToken = done.token as string;

    const info = await app.inject({ method: 'GET', url: '/v1/info', headers: { authorization: `Bearer ${pluginToken}` } });
    assert.equal(info.json().user.display_name, 'Frau Lehrer');

    // the editor of "lehrer" connects; an MCP client with lehrer's app password reaches it
    const editor = await fakeEditor(base, pluginToken);
    assert.equal(editor.welcome.type, 'welcome');
    nc.appPasswords.set('lehrer-mcp', { user: 'lehrer', password: 'mcp-app-password' });
    const basicAuth = 'Basic ' + Buffer.from('lehrer-mcp:mcp-app-password').toString('base64');
    const client = await mcpClient(base, { authorization: basicAuth });
    const outline = await client.callTool({ name: 'get_document_outline', arguments: {} });
    assert.equal(outline.isError, false, textOf(outline));
    await client.close();

    // another user does not see lehrer's editor
    nc.appPasswords.set('kollege', { user: 'kollege', password: 'other-password' });
    const other = await mcpClient(base, { authorization: 'Basic ' + Buffer.from('kollege:other-password').toString('base64') });
    const none = await other.callTool({ name: 'list_open_documents', arguments: {} });
    assert.equal(none.isError, true);
    await other.close();

    // wrong app password -> 401 with an OAuth challenge
    const wrong = await fetch(base + '/mcp', {
      method: 'POST',
      headers: { authorization: 'Basic ' + Buffer.from('lehrer:nope').toString('base64'), 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
    assert.equal(wrong.status, 401);
    assert.match(wrong.headers.get('www-authenticate') || '', /resource_metadata="http:\/\/127\.0\.0\.1:1\/\.well-known\/oauth-protected-resource\/mcp"/);

    // sign-out deletes the app password; the plugin token stops working
    await app.inject({ method: 'POST', url: '/v1/auth/logout', headers: { authorization: `Bearer ${pluginToken}` } });
    const after = await app.inject({ method: 'GET', url: '/v1/info', headers: { authorization: `Bearer ${pluginToken}` } });
    assert.equal(after.statusCode, 401);
    editor.close();
  } finally {
    await app.close();
    await nc.close();
  }
});

/** Follow the browser part of the OAuth flow: authorize -> Nextcloud -> callback -> consent. */
async function browserFlow(base: string, authorizeUrl: string, decision: 'allow' | 'deny' = 'allow'): Promise<URL> {
  const r1 = await fetch(authorizeUrl, { redirect: 'manual' });
  assert.equal(r1.status, 302, await r1.text());
  const cookie = (r1.headers.get('set-cookie') || '').split(';')[0];
  const r2 = await fetch(r1.headers.get('location')!, { redirect: 'manual' }); // fake Nextcloud grants immediately
  const callback = r2.headers.get('location')!.replace('http://127.0.0.1:1', base);
  const r3 = await fetch(callback, { headers: { cookie } });
  const html = await r3.text();
  assert.equal(r3.status, 200, html);
  assert.match(html, /Test-Client/);
  const id = /name="id" value="([^"]+)"/.exec(html)![1];
  const csrf = /name="csrf" value="([^"]+)"/.exec(html)![1];
  const r4 = await fetch(base + '/oauth/consent', {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id, csrf, decision }).toString(),
  });
  assert.equal(r4.status, 303);
  return new URL(r4.headers.get('location')!);
}

test('nextcloud mode: OAuth for MCP clients (discovery, registration, PKCE, refresh, revocation)', async () => {
  const nc = await fakeNextcloud();
  const app = await buildServer(ncCfg(nc), { store: new AuthStore(null) });
  const base = await listen(app);
  try {
    const prm = (await app.inject({ method: 'GET', url: '/.well-known/oauth-protected-resource/mcp' })).json();
    assert.equal(prm.resource, 'http://127.0.0.1:1/mcp');
    const asm = (await app.inject({ method: 'GET', url: '/.well-known/oauth-authorization-server' })).json();
    assert.deepEqual(asm.code_challenge_methods_supported, ['S256']);
    assert.equal(asm.client_id_metadata_document_supported, true);
    const cors = await app.inject({ method: 'OPTIONS', url: '/oauth/token', headers: { origin: 'https://inspector.example', 'access-control-request-method': 'POST' } });
    assert.equal(cors.headers['access-control-allow-origin'], '*');

    // dynamic client registration
    const badReg = await app.inject({ method: 'POST', url: '/oauth/register', payload: { redirect_uris: ['http://evil.example/cb'] } });
    assert.equal(badReg.statusCode, 400);
    const reg = await app.inject({
      method: 'POST',
      url: '/oauth/register',
      payload: { client_name: 'Test-Client', redirect_uris: ['http://127.0.0.1:33418/callback'], token_endpoint_auth_method: 'none' },
    });
    assert.equal(reg.statusCode, 201);
    const clientId = reg.json().client_id as string;

    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const authorize = (redirect = 'http://127.0.0.1:40000/callback') =>
      `${base}/oauth/authorize?` +
      new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirect, // other loopback port: allowed (RFC 8252)
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: 'st-1',
        resource: 'http://127.0.0.1:1/mcp',
      }).toString();

    // unregistered redirect URI: error page, no redirect
    const evil = await fetch(authorize('https://evil.example/cb'), { redirect: 'manual' });
    assert.equal(evil.status, 400);

    // callback without the browser cookie is refused
    const r1 = await fetch(authorize(), { redirect: 'manual' });
    const r2 = await fetch(r1.headers.get('location')!, { redirect: 'manual' });
    const noCookie = await fetch(r2.headers.get('location')!.replace('http://127.0.0.1:1', base));
    assert.equal(noCookie.status, 400);

    // denied
    const denied = await browserFlow(base, authorize(), 'deny');
    assert.equal(denied.searchParams.get('error'), 'access_denied');
    assert.equal(denied.searchParams.get('state'), 'st-1');

    // allowed
    const back = await browserFlow(base, authorize());
    assert.equal(back.origin + back.pathname, 'http://127.0.0.1:40000/callback');
    assert.equal(back.searchParams.get('state'), 'st-1');
    assert.equal(back.searchParams.get('iss'), 'http://127.0.0.1:1');
    const code = back.searchParams.get('code')!;

    const tokenReq = (params: Record<string, string>) =>
      app.inject({
        method: 'POST',
        url: '/oauth/token',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: new URLSearchParams(params).toString(),
      });
    const wrongVerifier = await tokenReq({ grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: 'http://127.0.0.1:40000/callback', code_verifier: 'x'.repeat(43) });
    assert.equal(wrongVerifier.json().error, 'invalid_grant');
    const tok = await tokenReq({ grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: 'http://127.0.0.1:40000/callback', code_verifier: verifier });
    assert.equal(tok.statusCode, 200, tok.body);
    const tokens = tok.json();
    assert.equal(tokens.token_type, 'Bearer');

    // code replay is refused and revokes the grant
    const replay = await tokenReq({ grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: 'http://127.0.0.1:40000/callback', code_verifier: verifier });
    assert.equal(replay.json().error, 'invalid_grant');
    const revoked = await app.inject({ method: 'POST', url: '/mcp', headers: { authorization: `Bearer ${tokens.access_token}`, 'content-type': 'application/json' }, payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} } });
    assert.equal(revoked.statusCode, 401);

    // second, clean authorization
    const back2 = await browserFlow(base, authorize());
    const tok2 = (await tokenReq({ grant_type: 'authorization_code', code: back2.searchParams.get('code')!, client_id: clientId, redirect_uri: 'http://127.0.0.1:40000/callback', code_verifier: verifier })).json();
    const client = await mcpClient(base, { authorization: `Bearer ${tok2.access_token}` });
    const docs = await client.callTool({ name: 'list_open_documents', arguments: {} });
    assert.match(textOf(docs), /No document is connected/); // authenticated as lehrer, no editor open
    await client.close();

    // refresh rotates our refresh token and refreshes the Nextcloud token
    const calls = nc.refreshCalls;
    const ref = await tokenReq({ grant_type: 'refresh_token', refresh_token: tok2.refresh_token, client_id: clientId });
    assert.equal(ref.statusCode, 200, ref.body);
    assert.equal(nc.refreshCalls, calls + 1);
    assert.notEqual(ref.json().refresh_token, tok2.refresh_token);

    // revoked in Nextcloud -> the next refresh fails and the grant is gone
    nc.revokeAll();
    const ref2 = await tokenReq({ grant_type: 'refresh_token', refresh_token: ref.json().refresh_token, client_id: clientId });
    assert.equal(ref2.json().error, 'invalid_grant');
    const gone = await app.inject({ method: 'POST', url: '/mcp', headers: { authorization: `Bearer ${ref.json().access_token}`, 'content-type': 'application/json' }, payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} } });
    assert.equal(gone.statusCode, 401);
  } finally {
    await app.close();
    await nc.close();
  }
});

test('oauth: redirect URI rules and client ID metadata documents', async () => {
  assert.ok(validRedirectUri('https://claude.ai/api/mcp/auth_callback'));
  assert.ok(validRedirectUri('http://127.0.0.1:5555/cb'));
  assert.ok(validRedirectUri('http://localhost/cb'));
  assert.ok(validRedirectUri('cursor://anysphere.cursor-retrieval/oauth/callback'));
  assert.ok(!validRedirectUri('http://example.com/cb'));
  assert.ok(!validRedirectUri('javascript:alert(1)'));
  assert.ok(!validRedirectUri('https://a.example/cb#frag'));
  assert.ok(redirectUriMatches('http://127.0.0.1/cb', 'http://127.0.0.1:9999/cb'));
  assert.ok(!redirectUriMatches('https://a.example/cb', 'https://a.example/cb2'));
  assert.ok(!redirectUriMatches('http://127.0.0.1/cb', 'http://localhost:9999/cb'));

  const docs: Record<string, unknown> = {
    'https://client.example/mcp.json': {
      client_id: 'https://client.example/mcp.json',
      client_name: 'CIMD Client',
      redirect_uris: ['https://client.example/callback'],
      token_endpoint_auth_method: 'none',
    },
    'https://client.example/wrong-id.json': { client_id: 'https://other.example/x', redirect_uris: ['https://client.example/cb'] },
  };
  let fetches = 0;
  const fetchDocument = async (url: string) => {
    fetches++;
    return docs[url] ? JSON.stringify(docs[url]) : null;
  };
  const server = new OAuthServer({
    publicUrl: 'https://proxy.example',
    nextcloud: new NextcloudClient({ url: 'https://cloud.example', clientId: 'a', clientSecret: 'b' }),
    store: new AuthStore(null),
    fetchDocument,
  });
  const app = (await import('fastify')).default();
  server.routes(app);
  const q = (clientId: string, redirect: string) =>
    '/oauth/authorize?' +
    new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirect, code_challenge: 'a'.repeat(43), code_challenge_method: 'S256' }).toString();
  const ok = await app.inject({ method: 'GET', url: q('https://client.example/mcp.json', 'https://client.example/callback') });
  assert.equal(ok.statusCode, 302);
  assert.match(ok.headers.location as string, /^https:\/\/cloud\.example\/index\.php\/apps\/oauth2\/authorize\?/);
  assert.match(String(ok.headers['set-cookie']), /HttpOnly; SameSite=Lax; Secure/);
  const wrongId = await app.inject({ method: 'GET', url: q('https://client.example/wrong-id.json', 'https://client.example/cb') });
  assert.equal(wrongId.statusCode, 400);
  const wrongRedirect = await app.inject({ method: 'GET', url: q('https://client.example/mcp.json', 'https://client.example/other') });
  assert.equal(wrongRedirect.statusCode, 400);
  // errors before the sign-in are shown, never redirected (no open redirect)
  const noPkce = await app.inject({
    method: 'GET',
    url: '/oauth/authorize?' + new URLSearchParams({ response_type: 'code', client_id: 'https://client.example/mcp.json', redirect_uri: 'https://client.example/callback' }).toString(),
  });
  assert.equal(noPkce.statusCode, 400);
  assert.equal(noPkce.headers.location, undefined);
  // failed metadata fetches are cached (no repeated fetching)
  const before = fetches;
  await app.inject({ method: 'GET', url: q('https://client.example/missing.json', 'https://client.example/cb') });
  await app.inject({ method: 'GET', url: q('https://client.example/missing.json', 'https://client.example/cb') });
  assert.equal(fetches, before + 1);
  server.close();
  await app.close();
});

test('safe fetch: private and IPv4-in-IPv6 addresses are refused', async () => {
  for (const ip of ['127.0.0.1', '10.0.0.5', '169.254.169.254', '192.168.1.1', '::1', '::ffff:7f00:1', '::ffff:127.0.0.1', '64:ff9b::a00:5', '2002:7f00:1::', 'fd00::1', 'fe80::1']) {
    assert.equal(isBlockedAddress(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '2606:4700:4700::1111']) assert.equal(isBlockedAddress(ip), false, ip);
  assert.equal(await fetchSmallDocument('https://[::ffff:127.0.0.1]/c'), null);
  assert.equal(await fetchSmallDocument('http://example.com/c'), null);
});

test('dynamic client registration: limits, clients are stored only after the first sign-in', async () => {
  const store = new AuthStore(null);
  const server = new OAuthServer({
    publicUrl: 'https://proxy.example',
    nextcloud: new NextcloudClient({ url: 'https://cloud.example', clientId: 'a', clientSecret: 'b' }),
    store,
  });
  assert.equal(server.register({ redirect_uris: Array(6).fill('https://a.example/cb') }).status, 400);
  assert.equal(server.register({ redirect_uris: ['https://a.example/' + 'x'.repeat(600)] }).status, 400);
  const r = server.register({ client_name: 'X', redirect_uris: ['https://a.example/cb'] });
  assert.equal(r.status, 201);
  assert.equal(store.state.clients.length, 0);
  server.close();
});

test('review fixes: double hello, failed sign-ins, CORS on /mcp, trusted proxies', async () => {
  const app = await buildServer(cfg());
  const base = await listen(app);
  try {
    // two hello frames on one socket: one session, nothing left after close
    const ws = new WebSocket(base.replace(/^http/, 'ws') + '/v1/bridge', { origin: ORIGIN });
    const closed = new Promise<number>((resolve) => ws.on('close', (code) => resolve(code)));
    await new Promise((r) => ws.on('open', r));
    const hello = JSON.stringify({ type: 'hello', token: TOKEN, document: { title: 'Doppelt' } });
    ws.send(hello);
    ws.send(hello);
    assert.equal(await closed, 4400);
    const client = await mcpClient(base, { authorization: `Bearer ${TOKEN}` });
    const docs = await client.callTool({ name: 'list_open_documents', arguments: {} });
    assert.equal(docs.isError, true, 'no ghost session');

    // many wrong tokens do not lock out a valid one
    for (let i = 0; i < 30; i++) {
      await app.inject({ method: 'POST', url: '/mcp', headers: { authorization: 'Bearer wrong', 'content-type': 'application/json' }, payload: {} });
    }
    assert.ok((await client.listTools()).tools.length > 5);
    await client.close();

    // CORS headers survive the SDK writing the response; WWW-Authenticate is readable
    const r = await fetch(base + '/mcp', {
      method: 'POST',
      headers: { origin: ORIGIN, authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
    const r401 = await fetch(base + '/mcp', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{}' });
    assert.equal(r401.status, 401);
    assert.match(r401.headers.get('access-control-expose-headers') || '', /www-authenticate/i);
  } finally {
    await app.close();
  }

  // local mode: only loopback origins may call the unauthenticated MCP endpoint
  const local = await buildServer(cfg({ AUTH_MODE: 'local', CORS_ORIGINS: 'http://localhost:8090,https://office.example.org' }));
  try {
    const call = (origin: string) =>
      local.inject({ method: 'POST', url: '/mcp', headers: { host: '127.0.0.1:8787', origin, 'content-type': 'application/json' }, payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} } });
    assert.equal((await call('https://office.example.org')).statusCode, 403);
    assert.notEqual((await call('http://localhost:6274')).statusCode, 403);
  } finally {
    await local.close();
  }

  // TRUST_PROXY with presets: the client IP behind a reverse proxy in a private network
  const behind = await buildServer(cfg({ TRUST_PROXY: 'loopback,uniquelocal', RATE_LIMIT_MAX: '1' }));
  try {
    const get = (ip: string) => behind.inject({ method: 'GET', url: '/v1/meta', headers: { 'x-forwarded-for': ip } });
    assert.equal((await get('203.0.113.1')).statusCode, 200);
    assert.equal((await get('203.0.113.2')).statusCode, 200, 'different clients are counted separately');
    assert.equal((await get('203.0.113.1')).statusCode, 429);
  } finally {
    await behind.close();
  }
});

test('nextcloud mode: wrong app passwords are throttled before they reach Nextcloud', async () => {
  const nc = await fakeNextcloud();
  let ncCalls = 0;
  const counting = http.createServer((req, res) => {
    ncCalls++;
    const proxyReq = http.request(nc.url + req.url, { method: req.method, headers: req.headers }, (p) => {
      res.writeHead(p.statusCode || 500, p.headers);
      p.pipe(res);
    });
    req.pipe(proxyReq);
  });
  await new Promise<void>((r) => counting.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(counting.address() as AddressInfo).port}`;
  const app = await buildServer(cfg({ AUTH_MODE: 'nextcloud', PROXY_TOKEN: '', NEXTCLOUD_URL: url }), { store: new AuthStore(null) });
  try {
    nc.appPasswords.set('lehrer', { user: 'lehrer', password: 'right' });
    const call = (pw: string) =>
      app.inject({
        method: 'POST',
        url: '/mcp',
        headers: { authorization: 'Basic ' + Buffer.from(`lehrer:${pw}`).toString('base64'), 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
      });
    assert.equal((await call('right')).statusCode, 200);
    for (let i = 0; i < 20; i++) assert.equal((await call('wrong-' + i)).statusCode, 401);
    assert.ok(ncCalls <= 1 + 5, `at most 5 wrong passwords per login reach Nextcloud (got ${ncCalls - 1})`);
    assert.equal((await call('right')).statusCode, 200, 'the valid (cached) app password still works');
  } finally {
    await app.close();
    await new Promise((r) => counting.close(r));
    await nc.close();
  }
});
