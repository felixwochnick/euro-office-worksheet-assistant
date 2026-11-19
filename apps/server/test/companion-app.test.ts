/**
 * Companion inside the desktop app (`--app`): secret chosen by the app, JSON lines on stdout, quitting with stdin,
 * start errors with exit codes, taking over an older companion, and the Claude endpoints.
 *
 * The spawned programs get temporary HOME/APPDATA/XDG folders: nothing on this computer is touched.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../src/version.js';
import { realProbe, type Runner } from '../src/companion/claude.js';
import { Companion } from '../src/companion/companion.js';
import { PLUGIN_GUID } from '../src/companion/paths.js';

const CLI = fileURLToPath(new URL('../src/companion/cli.js', import.meta.url));
const APP = '/opt/Worksheet Assistant/worksheet-assistant-app';
const SECRET = 'app-secret-0123456789abcdef';

const FILES = new Map([
  ['config.json', Buffer.from(JSON.stringify({ name: 'Arbeitsblatt-Assistent', version: '9.9.9', guid: 'asc.' + PLUGIN_GUID }))],
  ['index.html', Buffer.from('<html></html>')],
]);

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wa-app-'));
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

/** Environment of a spawned companion: every per-user folder points into a new temporary home. */
function sandbox(extra: Record<string, string> = {}): { home: string; env: NodeJS.ProcessEnv } {
  const home = tmp();
  fs.mkdirSync(path.join(home, 'plugin'));
  fs.writeFileSync(path.join(home, 'plugin', 'config.json'), JSON.stringify({ version: '9.9.9' }));
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const k of Object.keys(env)) if (/^(WORKSHEET_|LOG_LEVEL$)/.test(k)) delete env[k];
  Object.assign(env, {
    HOME: home,
    USERPROFILE: home,
    APPDATA: path.join(home, 'AppData', 'Roaming'),
    LOCALAPPDATA: path.join(home, 'AppData', 'Local'),
    XDG_CONFIG_HOME: path.join(home, '.config'),
    XDG_DATA_HOME: path.join(home, '.local', 'share'),
    WORKSHEET_ASSISTANT_HOME: path.join(home, 'wa'),
    WORKSHEET_PLUGIN_DIR: path.join(home, 'plugin'),
    ...extra,
  });
  return { home, env };
}

interface Running {
  child: ChildProcessWithoutNullStreams;
  /** The next line on stdout, parsed (every line must be JSON). */
  next(timeoutMs?: number): Promise<Record<string, unknown>>;
  exit: Promise<number | null>;
  /** Lines nobody asked for. */
  pending: string[];
  stderr(): string;
}

function startCli(args: string[], env: NodeJS.ProcessEnv): Running {
  const child = spawn(process.execPath, [CLI, ...args], { env, stdio: ['pipe', 'pipe', 'pipe'] });
  const pending: string[] = [];
  const waiting: Array<(line: string) => void> = [];
  let buf = '';
  let err = '';
  child.stdout.setEncoding('utf8').on('data', (d: string) => {
    buf += d;
    for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      const w = waiting.shift();
      if (w) w(line);
      else pending.push(line);
    }
  });
  child.stderr.setEncoding('utf8').on('data', (d: string) => (err += d));
  const exit = new Promise<number | null>((resolve) => child.on('exit', (code) => resolve(code)));
  return {
    child,
    exit,
    pending,
    stderr: () => err,
    next: (timeoutMs = 20000) =>
      new Promise((resolve, reject) => {
        const parse = (line: string) => {
          try {
            resolve(JSON.parse(line));
          } catch {
            reject(new Error(`not JSON on stdout: ${line}`));
          }
        };
        const line = pending.shift();
        if (line !== undefined) return parse(line);
        const timer = setTimeout(() => reject(new Error(`no line on stdout; stderr: ${err}`)), timeoutMs);
        waiting.push((l) => {
          clearTimeout(timer);
          parse(l);
        });
      }),
  };
}

async function exitWithin(p: Running, ms = 10000): Promise<number | null> {
  const timer = setTimeout(() => p.child.kill('SIGKILL'), ms);
  try {
    return await p.exit;
  } finally {
    clearTimeout(timer);
  }
}

function api(base: string, secret: string, p: string, body?: unknown): Promise<Response> {
  return fetch(`${base}/companion/api/${p}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-companion-secret': secret, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test('companion: the API secret can be chosen (desktop app), too short ones are ignored', async () => {
  const home = tmp();
  for (const [secret, works] of [
    [SECRET, true],
    ['short', false],
  ] as const) {
    const port = await freePort();
    const companion = new Companion({ configDir: path.join(home, `cfg-${port}`), env: { platform: 'linux', home, env: {} }, port, logLevel: 'silent', secret });
    (companion as unknown as { files: Map<string, Buffer> }).files = FILES;
    await companion.start();
    try {
      const base = `http://127.0.0.1:${port}`;
      assert.equal((await api(base, secret, 'state')).status, works ? 200 : 403);
      assert.equal((await fetch(`${base}/`).then((r) => r.text())).includes(JSON.stringify(secret)), works);
    } finally {
      await companion.stop();
    }
  }
});

test('companion in the desktop app: no API secret on its page; entries refused while it runs from a disk image', async () => {
  const home = tmp();
  fs.mkdirSync(path.join(home, '.config', 'Claude'), { recursive: true });
  for (const temporary of [false, true]) {
    const port = await freePort();
    const companion = new Companion({
      configDir: path.join(home, `cfg-${port}`),
      env: { platform: 'linux', home, env: { WORKSHEET_ASSISTANT_APP: APP } },
      port,
      logLevel: 'silent',
      secret: SECRET,
      app: true,
      temporary,
      claude: { run: async () => ({ code: 1, stdout: '', stderr: '' }), probe: realProbe },
    });
    (companion as unknown as { files: Map<string, Buffer> }).files = FILES;
    await companion.start();
    try {
      const base = `http://127.0.0.1:${port}`;
      const page = await (await fetch(`${base}/`)).text();
      assert.ok(!page.includes(SECRET) && page.includes('Arbeitsblatt-Assistent'), 'the page points to the app, without the secret');
      const add = await api(base, SECRET, 'claude', { client: 'desktop', action: 'add' });
      assert.equal(add.status, temporary ? 400 : 200);
      if (temporary) assert.match((await add.json()).error, /Programme/);
      assert.equal((await api(base, SECRET, 'claude', { client: 'desktop', action: 'remove' })).status, 200, 'removing is always allowed');
      if (temporary) assert.equal((await api(base, SECRET, 'autostart', { enabled: true })).status, 400);
    } finally {
      await companion.stop();
    }
  }
});

test('companion: Claude endpoints (fake claude command, temporary home)', async () => {
  const home = tmp();
  fs.mkdirSync(path.join(home, '.config', 'Claude'), { recursive: true });
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const calls: string[][] = [];
  let registered = false;
  const run: Runner = async (file, args) => {
    calls.push([file, ...args]);
    if (args[1] === 'get') return { code: registered ? 0 : 1, stdout: '', stderr: '' };
    registered = args[1] === 'add';
    return { code: 0, stdout: '', stderr: '' };
  };
  let listening = 0;
  const companion = new Companion({
    configDir: path.join(home, 'cfg'),
    env: { platform: 'linux', home, env: { WORKSHEET_ASSISTANT_APP: APP } },
    port,
    logLevel: 'silent',
    secret: SECRET,
    app: true,
    onListening: () => listening++,
    claude: { run, probe: { ...realProbe, isExecutable: (p) => p === '/usr/local/bin/claude' } },
  });
  (companion as unknown as { files: Map<string, Buffer> }).files = FILES;
  await companion.start();
  try {
    assert.equal(listening, 1);
    const state = await (await api(base, SECRET, 'state')).json();
    assert.equal(state.app, true);
    assert.deepEqual(state.stdio_command, [APP, 'mcp-stdio']);
    // the plugin points to the app's window, not to a settings page, when the chat is not set up
    assert.equal((await (await fetch(`${base}/v1/meta`)).json()).settings_in_app, true);

    assert.equal((await fetch(`${base}/companion/api/claude`)).status, 403, 'no secret');
    const configPath = path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
    assert.deepEqual(await (await api(base, SECRET, 'claude')).json(), {
      desktop: { installed: true, config_path: configPath, registered: false, current: false },
      code: { installed: true, command_path: '/usr/local/bin/claude', registered: false },
      stdio_command: [APP, 'mcp-stdio'],
      mcp_url: `${base}/mcp`,
    });

    let res = await api(base, SECRET, 'claude', { client: 'desktop', action: 'add' });
    assert.equal(res.status, 200);
    let body = await res.json();
    assert.equal(body.ok, true);
    assert.deepEqual([body.status.desktop.registered, body.status.desktop.current], [true, true]);
    assert.deepEqual(JSON.parse(fs.readFileSync(configPath, 'utf8')).mcpServers['worksheet-assistant'], { command: APP, args: ['mcp-stdio'] });

    body = await (await api(base, SECRET, 'claude', { client: 'code', action: 'add' })).json();
    assert.equal(body.status.code.registered, true);
    assert.ok(calls.some((c) => c.join(' ') === `/usr/local/bin/claude mcp add --scope user --transport http worksheet-assistant ${base}/mcp`));
    body = await (await api(base, SECRET, 'claude', { client: 'code', action: 'remove' })).json();
    assert.equal(body.status.code.registered, false);

    res = await api(base, SECRET, 'claude', { client: 'chatgpt', action: 'add' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).ok, false);

    // a broken configuration is reported, not overwritten
    fs.writeFileSync(configPath, '{ broken');
    res = await api(base, SECRET, 'claude', { client: 'desktop', action: 'remove' });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /kein gültiges JSON/);
    assert.equal(fs.readFileSync(configPath, 'utf8'), '{ broken');
  } finally {
    await companion.stop();
  }
});

test('app mode: ready line, API with the app secret, restart, repaired entries, quits when stdin closes', async () => {
  const { home, env } = sandbox({ WORKSHEET_ASSISTANT_APP: APP, WORKSHEET_ASSISTANT_UI_SECRET: SECRET });
  // left behind by the standalone program from before the desktop app
  const autostart = path.join(home, '.config', 'autostart', 'worksheet-assistant.desktop');
  fs.mkdirSync(path.dirname(autostart), { recursive: true });
  fs.writeFileSync(autostart, '[Desktop Entry]\nExec=/home/u/Downloads/worksheet-assistant --background\n');
  const claudeConfig = path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
  fs.mkdirSync(path.dirname(claudeConfig), { recursive: true });
  fs.writeFileSync(claudeConfig, JSON.stringify({ mcpServers: { 'worksheet-assistant': { command: '/home/u/Downloads/worksheet-assistant', args: ['mcp-stdio'] }, other: { command: 'x' } } }));

  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const p = startCli(['--app', '--port', String(port)], env);
  try {
    assert.deepEqual(await p.next(), { event: 'ready', url: base, version: VERSION, chat_error: '' });

    assert.equal((await api(base, 'wrong', 'state')).status, 403);
    const state = await (await api(base, SECRET, 'state')).json();
    assert.equal(state.app, true);
    assert.equal(state.autostart, true);
    assert.deepEqual(state.stdio_command, [APP, 'mcp-stdio']);
    assert.match(fs.readFileSync(autostart, 'utf8'), /^Exec="\/opt\/Worksheet Assistant\/worksheet-assistant-app" --background$/m);
    const claude = JSON.parse(fs.readFileSync(claudeConfig, 'utf8'));
    assert.deepEqual(claude.mcpServers, { 'worksheet-assistant': { command: APP, args: ['mcp-stdio'] }, other: { command: 'x' } });
    assert.ok(fs.existsSync(`${claudeConfig}.bak`));
    assert.ok(fs.existsSync(path.join(home, '.local', 'share', 'euro-office', 'desktopeditors', 'sdkjs-plugins', PLUGIN_GUID, 'local-config.js')));

    // saving settings restarts the server: a new ready line
    assert.equal((await api(base, SECRET, 'settings', { provider: 'none' })).status, 200);
    assert.deepEqual(await p.next(), { event: 'ready', url: base, version: VERSION, chat_error: '' });
    assert.equal((await api(base, SECRET, 'state')).status, 200);

    p.child.stdin.end(); // the desktop app quits (or dies)
    assert.equal(await exitWithin(p), 0);
    assert.deepEqual(p.pending, [], 'nothing else on stdout');
    await assert.rejects(fetch(`${base}/v1/meta`));
  } finally {
    p.child.kill('SIGKILL');
  }
});

test('app mode: "quit" from the settings API is announced, then the program exits', async () => {
  const { env } = sandbox({ WORKSHEET_ASSISTANT_UI_SECRET: SECRET });
  const port = await freePort();
  const p = startCli(['--app', '--port', String(port)], env);
  try {
    assert.equal((await p.next()).event, 'ready');
    assert.equal((await api(`http://127.0.0.1:${port}`, SECRET, 'quit', {})).status, 200);
    assert.deepEqual(await p.next(), { event: 'quit' });
    assert.equal(await exitWithin(p), 0);
  } finally {
    p.child.kill('SIGKILL');
  }
});

test('app mode: a port used by another program → error "port_in_use", exit code 4', async () => {
  const { env } = sandbox();
  const blocker = net.createServer((s) => s.destroy());
  await new Promise<void>((r) => blocker.listen(0, '127.0.0.1', r));
  const port = (blocker.address() as net.AddressInfo).port;
  const p = startCli(['--app', '--port', String(port)], env);
  try {
    const ev = await p.next();
    assert.equal(ev.event, 'error');
    assert.equal(ev.code, 'port_in_use');
    assert.equal(ev.message, `Port ${port} wird von einem anderen Programm benutzt.`);
    assert.equal(await exitWithin(p), 4);
  } finally {
    p.child.kill('SIGKILL');
    blocker.close();
  }
});

test('app mode: a companion that cannot be stopped → error "already_running", exit code 3', async () => {
  const { env } = sandbox();
  // answers like a companion, but has no settings page with a secret (e.g. a very old version)
  const other = http.createServer((req, res) => {
    if (req.url === '/v1/meta') res.setHeader('content-type', 'application/json').end(JSON.stringify({ auth_mode: 'local' }));
    else res.end('<html>no secret here</html>');
  });
  await new Promise<void>((r) => other.listen(0, '127.0.0.1', r));
  const port = (other.address() as net.AddressInfo).port;
  const p = startCli(['--app', '--port', String(port)], env);
  try {
    const ev = await p.next();
    assert.equal(ev.event, 'error');
    assert.equal(ev.code, 'already_running');
    assert.match(String(ev.message), /läuft bereits/);
    assert.equal(await exitWithin(p), 3);
  } finally {
    p.child.kill('SIGKILL');
    other.close();
  }
});

test('app mode: an older companion on the same port is stopped and replaced', async () => {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  // the standalone program as started from a terminal (no --app)
  const old = startCli(['--no-browser', '--port', String(port)], sandbox().env);
  let p: Running | null = null;
  try {
    let up = false;
    for (let i = 0; i < 100 && !up; i++) {
      await new Promise((r) => setTimeout(r, 100));
      up = await fetch(`${base}/v1/meta`).then((r) => r.ok, () => false);
    }
    assert.ok(up, `the old companion did not start: ${old.stderr()}`);
    p = startCli(['--app', '--port', String(port)], sandbox({ WORKSHEET_ASSISTANT_UI_SECRET: SECRET }).env);
    assert.deepEqual(await p.next(), { event: 'ready', url: base, version: VERSION, chat_error: '' });
    assert.equal(await exitWithin(old), 0, 'the old companion quit');
    assert.equal((await api(base, SECRET, 'state')).status, 200, 'the new one answers with the app secret');
    p.child.stdin.end();
    assert.equal(await exitWithin(p), 0);
  } finally {
    old.child.kill('SIGKILL');
    p?.child.kill('SIGKILL');
  }
});

test('companion: worksheet pictures – internet sources on/off, own picture folder (validated, counted, used by the server)', async () => {
  const home = tmp();
  const pics = path.join(home, 'Bilder');
  fs.mkdirSync(path.join(pics, 'Asterix'), { recursive: true });
  fs.writeFileSync(path.join(pics, 'Asterix', 'obelix.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
  fs.writeFileSync(path.join(pics, 'fuchs.jpg'), 'x');
  fs.writeFileSync(path.join(pics, 'notizen.txt'), 'x');
  const port = await freePort();
  const configDir = path.join(home, 'cfg');
  const companion = new Companion({ configDir, env: { platform: 'linux', home, env: {} }, port, logLevel: 'silent', secret: SECRET, app: true });
  (companion as unknown as { files: Map<string, Buffer> }).files = FILES;
  await companion.start();
  try {
    const base = `http://127.0.0.1:${port}`;
    const state = await (await api(base, SECRET, 'state')).json();
    assert.equal(state.settings.online_pictures, true);
    assert.equal(state.settings.image_folder, '');
    assert.deepEqual(await (await api(base, SECRET, 'pictures')).json(), { online: true, folder: '', folder_ok: false, count: 0, error: '' });

    for (const [folder, msg] of [['Bilder', /vollständigen Ordnerpfad/], [path.join(home, 'fehlt'), /gibt es nicht/], [path.join(pics, 'fuchs.jpg'), /gibt es nicht/]] as const) {
      const r = await api(base, SECRET, 'pictures', { folder });
      assert.equal(r.status, 400);
      assert.match((await r.json()).error, msg);
    }

    const ok = await (await api(base, SECRET, 'pictures', { folder: pics, online: false })).json();
    assert.deepEqual(ok.pictures, { online: false, folder: pics, folder_ok: true, count: 2, error: '' });
    const stored = JSON.parse(fs.readFileSync(path.join(configDir, 'config.json'), 'utf8'));
    assert.equal(stored.imageFolder, pics);
    assert.equal(stored.onlinePictures, false);

    // The server restarted with the new settings: own pictures only.
    await new Promise((r) => setTimeout(r, 400));
    const fetched = await fetch(`${base}/v1/images/fetch`, {
      method: 'POST',
      headers: { authorization: `Bearer ${companion.settings.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ image_id: 'own:Asterix/obelix.png' }),
    });
    assert.equal(fetched.status, 200);
    assert.match((await fetched.json()).data_url, /^data:image\/png;base64,/);
    const free = await fetch(`${base}/v1/images/fetch`, {
      method: 'POST',
      headers: { authorization: `Bearer ${companion.settings.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ image_id: 'arasaac:2623' }),
    });
    assert.equal(free.status, 400, 'internet sources are off');

    // Folder removed outside the app: reported, the setting stays.
    fs.rmSync(pics, { recursive: true, force: true });
    const gone = await (await api(base, SECRET, 'pictures')).json();
    assert.equal(gone.folder_ok, false);
    assert.match(gone.error, /nicht \(mehr\) da/);

    await api(base, SECRET, 'pictures', { folder: '', online: true });
    assert.equal(JSON.parse(fs.readFileSync(path.join(configDir, 'config.json'), 'utf8')).imageFolder, '');
  } finally {
    await new Promise((r) => setTimeout(r, 300));
    await companion.stop();
  }
});
