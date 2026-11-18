/**
 * Companion app: registering the MCP server in Claude Desktop (config file) and Claude Code (CLI, faked here),
 * launch commands inside the desktop app and repairing old entries. Everything runs in temporary folders.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { autostartTarget, launchCommand, repairAutostart, stdioCommand } from '../src/companion/autostart.js';
import {
  claudeAction,
  claudeDesktopConfigPath,
  ClaudeError,
  claudeStatus,
  cmdQuote,
  desktopStatus,
  findClaudeCode,
  realProbe,
  repairDesktopEntry,
  setCodeEntry,
  setDesktopEntry,
  type Probe,
  type RunResult,
  type Runner,
} from '../src/companion/claude.js';
import type { Env } from '../src/companion/paths.js';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wa-claude-'));
}

function env(platform: NodeJS.Platform, home: string, vars: Record<string, string> = {}): Env {
  return { platform, home, env: vars };
}

const APP = '/opt/Worksheet Assistant/worksheet-assistant-app';
const STDIO = [APP, 'mcp-stdio'];

test('launch command: the desktop app replaces this program when WORKSHEET_ASSISTANT_APP is set', () => {
  const bare = launchCommand(env('linux', '/home/u'));
  assert.equal(bare[0], process.execPath);
  assert.equal(bare.at(-1), '--background');
  assert.deepEqual(stdioCommand(env('linux', '/home/u')), [...bare.slice(0, -1), 'mcp-stdio']);

  const e = env('linux', '/home/u', { WORKSHEET_ASSISTANT_APP: APP });
  assert.deepEqual(launchCommand(e), [APP, '--background']);
  assert.deepEqual(stdioCommand(e), [APP, 'mcp-stdio']);
  assert.deepEqual(stdioCommand(env('win32', 'C:\\Users\\u', { WORKSHEET_ASSISTANT_APP: 'C:\\Program Files\\WA\\wa.exe' })), [
    'C:\\Program Files\\WA\\wa.exe',
    'mcp-stdio',
  ]);
});

test('autostart repair: an enabled entry of the old program now starts the app', () => {
  const home = tmp();
  const e = env('linux', home, { XDG_CONFIG_HOME: path.join(home, '.config'), WORKSHEET_ASSISTANT_APP: APP });
  const cfg = path.join(home, 'cfg');
  const { file, content } = autostartTarget(launchCommand(e), cfg, e);
  assert.ok(file.startsWith(home));
  assert.equal(repairAutostart(cfg, e), false, 'autostart off: nothing is written');
  assert.equal(fs.existsSync(file), false);

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '[Desktop Entry]\nExec=/home/u/Downloads/worksheet-assistant --background\n');
  assert.equal(repairAutostart(cfg, e), true);
  assert.equal(fs.readFileSync(file, 'utf8'), content);
  assert.match(content, /^Exec="\/opt\/Worksheet Assistant\/worksheet-assistant-app" --background$/m);
  assert.equal(repairAutostart(cfg, e), false, 'up to date');
});

test('claude desktop: configuration file per OS, the Microsoft Store version is preferred', () => {
  const none: Probe = { isDir: () => false, isExecutable: () => false, list: () => [] };
  assert.equal(claudeDesktopConfigPath(env('linux', '/home/u'), none), '/home/u/.config/Claude/claude_desktop_config.json');
  assert.equal(claudeDesktopConfigPath(env('linux', '/home/u', { XDG_CONFIG_HOME: '/cfg' }), none), '/cfg/Claude/claude_desktop_config.json');
  assert.equal(claudeDesktopConfigPath(env('darwin', '/Users/u'), none), '/Users/u/Library/Application Support/Claude/claude_desktop_config.json');
  assert.equal(claudeDesktopConfigPath(env('win32', 'C:\\Users\\u'), none), 'C:\\Users\\u\\AppData\\Roaming\\Claude\\claude_desktop_config.json');

  const win = env('win32', 'C:\\Users\\u', { APPDATA: 'D:\\Roaming', LOCALAPPDATA: 'D:\\Local' });
  assert.equal(claudeDesktopConfigPath(win, none), 'D:\\Roaming\\Claude\\claude_desktop_config.json');
  const msix = 'D:\\Local\\Packages\\Claude_pzs8sxrjxfjjc\\LocalCache\\Roaming\\Claude';
  const store = (dirs: string[]): Probe => ({
    isDir: (p) => dirs.includes(p),
    isExecutable: () => false,
    list: (d) => (d === 'D:\\Local\\Packages' ? ['Microsoft.WindowsTerminal_8wekyb3d8bbwe', 'Claude_pzs8sxrjxfjjc'] : []),
  });
  assert.equal(claudeDesktopConfigPath(win, store([msix])), `${msix}\\claude_desktop_config.json`);
  assert.equal(desktopStatus(STDIO, win, store([msix])).installed, true);
  // a package folder Claude never started from does not count
  assert.equal(claudeDesktopConfigPath(win, store([])), 'D:\\Roaming\\Claude\\claude_desktop_config.json');
  assert.equal(desktopStatus(STDIO, win, store([])).installed, false);
});

test('claude desktop: add and remove only touch our entry, with a backup and an atomic write', () => {
  const home = tmp();
  const e = env('linux', home);
  const dir = path.join(home, '.config', 'Claude');
  const file = path.join(dir, 'claude_desktop_config.json');

  // not installed: adding is refused, removing is fine
  assert.throws(() => setDesktopEntry(true, STDIO, e), (err: unknown) => err instanceof ClaudeError && err.message === 'Claude Desktop wurde nicht gefunden.');
  assert.deepEqual(setDesktopEntry(false, STDIO, e), { installed: false, config_path: file, registered: false, current: false });
  assert.equal(fs.existsSync(dir), false);

  // installed, no file yet: it is created
  fs.mkdirSync(dir, { recursive: true });
  assert.deepEqual(setDesktopEntry(true, STDIO, e), { installed: true, config_path: file, registered: true, current: true });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { mcpServers: { 'worksheet-assistant': { command: APP, args: ['mcp-stdio'] } } });
  assert.equal(fs.existsSync(`${file}.bak`), false);

  // existing settings and other servers are kept; the previous file is backed up
  const before = JSON.stringify({ globalShortcut: 'Ctrl+Space', mcpServers: { other: { command: 'npx', args: ['x'], env: { A: '1' } } }, preferences: { x: true } }, null, 2);
  fs.writeFileSync(file, before);
  const added = setDesktopEntry(true, STDIO, e);
  assert.equal(added.current, true);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(data, {
    globalShortcut: 'Ctrl+Space',
    mcpServers: { other: { command: 'npx', args: ['x'], env: { A: '1' } }, 'worksheet-assistant': { command: APP, args: ['mcp-stdio'] } },
    preferences: { x: true },
  });
  assert.equal(fs.readFileSync(`${file}.bak`, 'utf8'), before);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['claude_desktop_config.json', 'claude_desktop_config.json.bak'], 'no temporary files left');

  // another command (e.g. the old standalone program) is registered but not current
  assert.equal(desktopStatus(['/old/worksheet-assistant', 'mcp-stdio'], e).current, false);

  const removed = setDesktopEntry(false, STDIO, e);
  assert.deepEqual(removed, { installed: true, config_path: file, registered: false, current: false });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).mcpServers, { other: { command: 'npx', args: ['x'], env: { A: '1' } } });

  // only our entry: an empty mcpServers object stays
  setDesktopEntry(true, STDIO, e);
  fs.writeFileSync(file, JSON.stringify({ mcpServers: { 'worksheet-assistant': { command: APP, args: ['mcp-stdio'] } } }));
  setDesktopEntry(false, STDIO, e);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { mcpServers: {} });
  const unchanged = fs.statSync(file).mtimeMs;
  setDesktopEntry(false, STDIO, e);
  assert.equal(fs.statSync(file).mtimeMs, unchanged, 'removing an absent entry writes nothing');
});

test('claude desktop: a file that is not a JSON object is never overwritten', () => {
  const home = tmp();
  const e = env('linux', home);
  const file = path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (const content of ['{ "mcpServers": { ', '[1, 2]', '{"mcpServers": []}']) {
    fs.writeFileSync(file, content);
    assert.throws(() => setDesktopEntry(true, STDIO, e), (err: unknown) => err instanceof ClaudeError && err.statusCode === 400 && err.message.includes(file));
    assert.throws(() => setDesktopEntry(false, STDIO, e), ClaudeError);
    assert.equal(fs.readFileSync(file, 'utf8'), content);
    assert.equal(fs.existsSync(`${file}.bak`), false);
    const status = desktopStatus(STDIO, e);
    assert.equal(status.registered, false);
    assert.match(status.error ?? '', /Claude Desktop/);
    assert.equal(repairDesktopEntry(STDIO, e), false);
  }
  // an empty file or one with a byte order mark (Windows editors) is fine
  fs.writeFileSync(file, '\uFEFF{"theme":"dark"}');
  setDesktopEntry(true, STDIO, e);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { theme: 'dark', mcpServers: { 'worksheet-assistant': { command: APP, args: ['mcp-stdio'] } } });
  fs.writeFileSync(file, '');
  assert.equal(setDesktopEntry(true, STDIO, e).current, true);
});

test('claude desktop: repair points an outdated entry to the current command, adds nothing', () => {
  const home = tmp();
  const e = env('linux', home);
  const file = path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ mcpServers: { other: { command: 'x' } } }));
  assert.equal(repairDesktopEntry(STDIO, e), false, 'not registered: stays so');
  assert.equal(desktopStatus(STDIO, e).registered, false);

  fs.writeFileSync(file, JSON.stringify({ mcpServers: { 'worksheet-assistant': { command: '/home/u/Downloads/worksheet-assistant', args: ['mcp-stdio'] } } }));
  assert.equal(repairDesktopEntry(STDIO, e), true);
  assert.deepEqual(desktopStatus(STDIO, e), { installed: true, config_path: file, registered: true, current: true });
  assert.equal(repairDesktopEntry(STDIO, e), false);
});

test('claude code: the command is found on PATH or where its installers put it', () => {
  const only = (files: string[]): Probe => ({ isDir: () => false, isExecutable: (p) => files.includes(p), list: () => [] });
  const linux = env('linux', '/home/u', { PATH: 'relative/bin:/usr/bin:/opt/claude/bin' });
  assert.equal(findClaudeCode(linux, only([])), null);
  assert.equal(findClaudeCode(linux, only(['/opt/claude/bin/claude', '/home/u/.local/bin/claude'])), '/opt/claude/bin/claude', 'PATH first');
  assert.equal(findClaudeCode(linux, only(['relative/bin/claude'])), null, 'relative PATH entries are ignored');
  // apps started from the desktop often lack the shell's PATH
  for (const p of ['/home/u/.local/bin/claude', '/home/u/.claude/local/claude', '/opt/homebrew/bin/claude', '/usr/local/bin/claude']) {
    assert.equal(findClaudeCode(env('darwin', '/home/u', { PATH: '/usr/bin:/bin' }), only([p])), p);
  }

  const win = env('win32', 'C:\\Users\\u', { PATH: 'C:\\Windows;"C:\\Program Files\\nodejs";', APPDATA: 'C:\\Users\\u\\AppData\\Roaming', USERPROFILE: 'C:\\Users\\u' });
  assert.equal(findClaudeCode(win, only(['C:\\Program Files\\nodejs\\claude.cmd'])), 'C:\\Program Files\\nodejs\\claude.cmd');
  assert.equal(findClaudeCode(win, only(['C:\\Program Files\\nodejs\\claude.cmd', 'C:\\Program Files\\nodejs\\claude.exe'])), 'C:\\Program Files\\nodejs\\claude.exe');
  assert.equal(findClaudeCode(win, only(['C:\\Users\\u\\.local\\bin\\claude.exe'])), 'C:\\Users\\u\\.local\\bin\\claude.exe');
  assert.equal(findClaudeCode(win, only(['C:\\Users\\u\\AppData\\Roaming\\npm\\claude.cmd'])), 'C:\\Users\\u\\AppData\\Roaming\\npm\\claude.cmd');

  // .cmd files run through cmd.exe: arguments with spaces are quoted
  assert.equal(cmdQuote('C:\\Users\\Max Muster\\AppData\\Roaming\\npm\\claude.cmd'), '"C:\\Users\\Max Muster\\AppData\\Roaming\\npm\\claude.cmd"');
  assert.equal(cmdQuote('http://127.0.0.1:8787/mcp'), 'http://127.0.0.1:8787/mcp');
  assert.equal(cmdQuote('--scope'), '--scope');
  assert.equal(cmdQuote('a"b&c'), '"a""b&c"');
});

/** A fake `claude` CLI: remembers the user-scope entry like the real one. */
function fakeClaude(opts: { projectEntry?: boolean; failAdd?: boolean; hang?: boolean } = {}) {
  const calls: string[][] = [];
  let user: string | null = null;
  const ok = (code: number, stdout = '', stderr = ''): RunResult => ({ code, stdout, stderr });
  const run: Runner = async (file, args) => {
    calls.push([file, ...args]);
    if (opts.hang) return { code: null, stdout: '', stderr: '', error: 'keine Antwort nach 15 s' };
    const [, sub] = args;
    if (sub === 'get') return user || opts.projectEntry ? ok(0, 'worksheet-assistant:\n  Type: http') : ok(1, '', 'No MCP server named "worksheet-assistant".');
    if (sub === 'remove') {
      if (!user) return ok(1, '', 'No user-scoped MCP server found');
      user = null;
      return ok(0);
    }
    if (sub === 'add') {
      if (opts.failAdd) return ok(1, '', 'Invalid URL');
      if (user) return ok(1, '', 'MCP server worksheet-assistant already exists in user config');
      user = args.at(-1)!;
      return ok(0);
    }
    return ok(2);
  };
  return { run, calls, url: () => user };
}

test('claude code: status, add and remove through its CLI', async () => {
  const e = env('linux', '/home/u', { PATH: '/usr/bin' });
  const probe: Probe = { ...realProbe, isExecutable: (p) => p === '/usr/bin/claude' };
  const cli = fakeClaude();
  const url = 'http://127.0.0.1:8787/mcp';

  assert.deepEqual(await setCodeEntry(true, url, cli.run, e, probe), { installed: true, command_path: '/usr/bin/claude', registered: true });
  assert.equal(cli.url(), url);
  assert.deepEqual(cli.calls[1], ['/usr/bin/claude', 'mcp', 'add', '--scope', 'user', '--transport', 'http', 'worksheet-assistant', url]);
  // adding again (e.g. after a port change) replaces the entry
  await setCodeEntry(true, 'http://127.0.0.1:9999/mcp', cli.run, e, probe);
  assert.equal(cli.url(), 'http://127.0.0.1:9999/mcp');
  assert.deepEqual((await setCodeEntry(false, url, cli.run, e, probe)).registered, false);
  assert.ok(cli.calls.some((c) => c.join(' ') === '/usr/bin/claude mcp remove --scope user worksheet-assistant'));
  assert.equal((await setCodeEntry(false, url, cli.run, e, probe)).registered, false, 'removing an absent entry is fine');

  await assert.rejects(setCodeEntry(true, url, fakeClaude({ failAdd: true }).run, e, probe), (err: unknown) => err instanceof ClaudeError && err.statusCode === 500 && /Invalid URL/.test(err.message));
  await assert.rejects(setCodeEntry(false, url, fakeClaude({ projectEntry: true }).run, e, probe), (err: unknown) => err instanceof ClaudeError && /Projekt/.test(err.message));
  await assert.rejects(setCodeEntry(true, url, cli.run, e, { ...probe, isExecutable: () => false }), /Claude Code wurde nicht gefunden\./);

  const status = await claudeStatus({ stdio: STDIO, mcpUrl: url, env: e, probe, run: fakeClaude({ hang: true }).run });
  assert.equal(status.code.registered, null);
  assert.match(status.code.error ?? '', /antwortet nicht/);
  assert.deepEqual((await claudeStatus({ stdio: STDIO, mcpUrl: url, env: e, probe: { ...probe, isExecutable: () => false }, run: cli.run })).code, {
    installed: false,
    registered: null,
  });
});

test('claude: combined status and actions', async () => {
  const home = tmp();
  fs.mkdirSync(path.join(home, '.config', 'Claude'), { recursive: true });
  const cli = fakeClaude();
  const ctx = {
    stdio: STDIO,
    mcpUrl: 'http://127.0.0.1:8787/mcp',
    env: env('linux', home),
    probe: { ...realProbe, isExecutable: (p: string) => p === path.join(home, '.local', 'bin', 'claude') },
    run: cli.run,
  };
  const before = await claudeStatus(ctx);
  assert.deepEqual(before.stdio_command, STDIO);
  assert.equal(before.mcp_url, ctx.mcpUrl);
  assert.deepEqual([before.desktop.registered, before.code.registered], [false, false]);
  const after = await claudeAction(ctx, 'desktop', 'add');
  assert.deepEqual([after.desktop.registered, after.desktop.current, after.code.registered], [true, true, false]);
  assert.equal((await claudeAction(ctx, 'code', 'add')).code.registered, true);
  assert.equal((await claudeAction(ctx, 'desktop', 'remove')).desktop.registered, false);
});
