/**
 * Companion app: paths per OS, settings, plugin installation, autostart entries and the settings API.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { autostartTarget } from '../src/companion/autostart.js';
import { Companion } from '../src/companion/companion.js';
import { installedInfo, installPlugin, localConfigScript, pluginDir, uninstallPlugin } from '../src/companion/install.js';
import { configDir, desktopApps, detectedApps, PLUGIN_GUID } from '../src/companion/paths.js';
import { loadSettings, serverConfig } from '../src/companion/settings-store.js';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wa-companion-'));
}

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(port));
    });
  });
}

const FILES = new Map([
  ['config.json', Buffer.from(JSON.stringify({ name: 'Arbeitsblatt-Assistent', version: '9.9.9', guid: 'asc.' + PLUGIN_GUID }))],
  ['index.html', Buffer.from('<html></html>')],
  ['js/app.js', Buffer.from('// app')],
  ['local-config.js', Buffer.from('window.WORKSHEET_LOCAL = null;')],
]);

test('companion paths: desktop app plugin folders per OS', () => {
  const linux = desktopApps({ platform: 'linux', home: '/home/u', env: {} });
  assert.deepEqual(linux.map((a) => a.pluginsDir), [
    '/home/u/.local/share/euro-office/desktopeditors/sdkjs-plugins',
    '/home/u/.local/share/nextcloud-office/desktopeditors/sdkjs-plugins',
  ]);
  const win = desktopApps({ platform: 'win32', home: 'C:\\Users\\u', env: { LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' } });
  assert.equal(win[0].pluginsDir, 'C:\\Users\\u\\AppData\\Local\\Euro-Office\\DesktopEditors\\data\\sdkjs-plugins');
  const mac = desktopApps({ platform: 'darwin', home: '/Users/u', env: {} });
  assert.equal(mac[1].pluginsDir, '/Users/u/Library/Application Support/asc.nextcloud-office.Nextcloud-Office/data/sdkjs-plugins');
  assert.equal(configDir({ platform: 'win32', home: 'C:\\Users\\u', env: { APPDATA: 'C:\\Users\\u\\AppData\\Roaming' } }), 'C:\\Users\\u\\AppData\\Roaming\\Arbeitsblatt-Assistent');
  assert.equal(configDir({ platform: 'linux', home: '/home/u', env: {} }), '/home/u/.config/arbeitsblatt-assistent');
});

test('companion settings: created with a token (mode 0600), mapped to the local server configuration', () => {
  const dir = tmp();
  const { settings, created } = loadSettings(dir);
  assert.equal(created, true);
  assert.ok(settings.token.length >= 24);
  if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(dir, 'config.json')).mode & 0o777, 0o600);
  assert.equal(loadSettings(dir).settings.token, settings.token, 'token is kept');

  const none = serverConfig(settings);
  assert.equal(none.authMode, 'local');
  assert.equal(none.host, '127.0.0.1');
  assert.equal(none.provider, 'none');
  assert.ok(none.corsOrigins.includes('null'));
  const ollama = serverConfig({ ...settings, provider: 'ollama' });
  assert.equal(ollama.provider, 'openai');
  assert.equal(ollama.baseUrl, 'http://127.0.0.1:11434/v1');
  assert.throws(() => serverConfig({ ...settings, provider: 'mistral', apiKey: '' }), /API key/);
  assert.equal(serverConfig({ ...settings, provider: 'mistral', apiKey: 'k' }).model, 'mistral-large-latest');
});

test('companion install: copies the plugin and writes local-config.js', () => {
  const home = tmp();
  const env = { platform: 'linux' as const, home, env: {} };
  assert.equal(detectedApps(env).length, 0);
  fs.mkdirSync(path.join(home, '.local/share/euro-office/desktopeditors'), { recursive: true });
  const [app] = detectedApps(env);
  assert.equal(app.id, 'euro-office');
  const local = { proxyUrl: 'http://127.0.0.1:8787', token: 'tok-0123456789abcdef' };
  assert.equal(installedInfo(app, local).installed, false);
  const dir = installPlugin(app, FILES, local);
  assert.equal(dir, pluginDir(app));
  assert.ok(dir.endsWith(PLUGIN_GUID));
  assert.equal(fs.readFileSync(path.join(dir, 'js/app.js'), 'utf8'), '// app');
  assert.equal(fs.readFileSync(path.join(dir, 'local-config.js'), 'utf8'), localConfigScript(local));
  assert.deepEqual(installedInfo(app, local), { installed: true, version: '9.9.9', configured: true });
  assert.equal(installedInfo(app, { ...local, token: 'other' }).configured, false);
  fs.writeFileSync(path.join(dir, 'stale.js'), 'old');
  installPlugin(app, FILES, local);
  assert.equal(fs.existsSync(path.join(dir, 'stale.js')), false, 'old files are removed on update');
  assert.equal(uninstallPlugin(app), true);
  assert.equal(fs.existsSync(dir), false);
});

test('companion autostart entries', () => {
  const cmd = ['/opt/A B/arbeitsblatt-assistent', '--background'];
  const linux = autostartTarget(cmd, '/cfg', { platform: 'linux', home: '/home/u', env: {} });
  assert.equal(linux.file, '/home/u/.config/autostart/arbeitsblatt-assistent.desktop');
  assert.match(linux.content, /^Exec="\/opt\/A B\/arbeitsblatt-assistent" --background$/m);
  const mac = autostartTarget(cmd, '/cfg', { platform: 'darwin', home: '/Users/u', env: {} });
  assert.match(mac.file, /LaunchAgents\/de\.arbeitsblatt-assistent\.companion\.plist$/);
  assert.match(mac.content, /<string>\/opt\/A B\/arbeitsblatt-assistent<\/string><string>--background<\/string>/);
  const win = autostartTarget(['C:\\Program Files\\aa.exe', '--background'], 'C:\\cfg', { platform: 'win32', home: 'C:\\Users\\u', env: {} });
  assert.equal(win.file, 'C:\\cfg\\autostart.vbs');
  assert.match(win.content, /Run """C:\\Program Files\\aa\.exe"" ""--background""", 0, False/);
});

test('companion: settings page and API, plugin token, applying AI settings', async () => {
  const home = tmp();
  fs.mkdirSync(path.join(home, '.local/share/euro-office/desktopeditors'), { recursive: true });
  const port = await freePort();
  const companion = new Companion({
    configDir: path.join(home, 'cfg'),
    env: { platform: 'linux', home, env: {} },
    port,
    logLevel: 'silent',
  });
  (companion as unknown as { files: Map<string, Buffer> }).files = FILES;
  assert.equal(companion.ensureInstalled().length, 1);
  assert.equal(companion.ensureInstalled().length, 0, 'nothing to do when up to date');
  await companion.start();
  const base = `http://127.0.0.1:${port}`;
  try {
    const page = await (await fetch(base + '/')).text();
    const secret = /const SECRET = "([^"]+)"/.exec(page)![1];
    const api = (p: string, body?: unknown, headers: Record<string, string> = {}) =>
      fetch(`${base}/companion/api/${p}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'x-companion-secret': secret, ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
    assert.equal((await fetch(`${base}/companion/api/state`)).status, 403, 'no secret');
    assert.equal((await api('settings', {}, { origin: 'https://evil.example' })).status, 403, 'foreign origin');
    const state = await (await api('state')).json();
    assert.equal(state.apps[0].installed, true);
    assert.equal(state.settings.has_key, false);

    // the plugin authenticates with the companion's token
    const info = await fetch(`${base}/v1/info`, { headers: { authorization: `Bearer ${companion.settings.token}` } });
    assert.equal(info.status, 200);
    assert.equal((await (await fetch(`${base}/v1/meta`)).json()).settings_url, `${base}/`);

    // a provider without key is refused; with a key the server restarts with chat enabled
    const bad = await api('settings', { provider: 'mistral' });
    assert.equal(bad.status, 400);
    assert.equal((await api('settings', { provider: 'mistral', api_key: 'test-key' })).status, 200);
    let chat = false;
    for (let i = 0; i < 40 && !chat; i++) {
      await new Promise((r) => setTimeout(r, 100));
      chat = await fetch(`${base}/v1/meta`).then((r) => r.json()).then((m) => m.chat, () => false);
    }
    assert.equal(chat, true);
    const saved = JSON.parse(fs.readFileSync(path.join(home, 'cfg', 'config.json'), 'utf8'));
    assert.equal(saved.apiKey, 'test-key');
    const state2 = await (await fetch(`${base}/`).then((r) => r.text()).then((p2) => {
      const s2 = /const SECRET = "([^"]+)"/.exec(p2)![1];
      return fetch(`${base}/companion/api/state`, { headers: { 'x-companion-secret': s2 } });
    })).json();
    assert.equal(state2.settings.has_key, true);
    assert.equal(JSON.stringify(state2).includes('test-key'), false, 'the key is never sent back');
  } finally {
    await companion.stop();
  }
});
