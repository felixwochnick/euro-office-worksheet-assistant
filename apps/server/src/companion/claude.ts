/**
 * Register this program as MCP server "worksheet-assistant" in Claude Desktop and Claude Code, so nobody has to
 * edit JSON files or type commands:
 *
 *   Claude Desktop  its claude_desktop_config.json (mcpServers): Claude starts `<program> mcp-stdio` itself
 *   Claude Code     its CLI (`claude mcp add|remove|get`, user scope) with the HTTP endpoint. ~/.claude.json is never
 *                   edited directly: its format is internal and a running Claude Code rewrites it.
 *
 * Messages in ClaudeError are shown to the user (German).
 */
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { currentEnv, type Env } from './paths.js';

export const ENTRY = 'worksheet-assistant';
const DESKTOP_FILE = 'claude_desktop_config.json';

/** File system lookups (replaceable in tests, e.g. to check Windows paths on Linux). */
export interface Probe {
  isDir(p: string): boolean;
  /** An existing file that can be run. */
  isExecutable(p: string): boolean;
  /** Entries of a folder (empty if it does not exist). */
  list(dir: string): string[];
}

export const realProbe: Probe = {
  isDir: (p) => {
    try {
      return fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  },
  isExecutable: (p) => {
    try {
      if (!fs.statSync(p).isFile()) return false;
      if (process.platform !== 'win32') fs.accessSync(p, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  },
  list: (dir) => {
    try {
      return fs.readdirSync(dir);
    } catch {
      return [];
    }
  },
};

/** A problem the user can act on; statusCode is the HTTP status of the settings API. */
export class ClaudeError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
  }
}

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ---------------------------------------------------------------------------------------------- Claude Desktop

export interface DesktopStatus {
  /** Claude Desktop's configuration folder exists (Claude creates it on its first start). */
  installed: boolean;
  config_path: string;
  /** Our entry exists. */
  registered: boolean;
  /** Our entry starts the current stdio command. */
  current: boolean;
  error?: string;
}

/** Claude Desktop's configuration folder. */
export function claudeDesktopDir(e: Env = currentEnv(), probe: Probe = realProbe): string {
  if (e.platform === 'win32') {
    const p = path.win32;
    // The Microsoft Store (MSIX) version reads its configuration from its virtualised AppData folder.
    const packages = p.join(e.env.LOCALAPPDATA || p.join(e.home, 'AppData', 'Local'), 'Packages');
    for (const name of probe.list(packages).filter((n) => /^Claude_/i.test(n)).sort()) {
      const dir = p.join(packages, name, 'LocalCache', 'Roaming', 'Claude');
      if (probe.isDir(dir)) return dir;
    }
    return p.join(e.env.APPDATA || p.join(e.home, 'AppData', 'Roaming'), 'Claude');
  }
  if (e.platform === 'darwin') return path.posix.join(e.home, 'Library', 'Application Support', 'Claude');
  return path.posix.join(e.env.XDG_CONFIG_HOME || path.posix.join(e.home, '.config'), 'Claude');
}

export function claudeDesktopConfigPath(e: Env = currentEnv(), probe: Probe = realProbe): string {
  return (e.platform === 'win32' ? path.win32 : path.posix).join(claudeDesktopDir(e, probe), DESKTOP_FILE);
}

/** The parsed configuration, null if there is none. Refuses files we could not write back without losing data. */
function readDesktopConfig(file: string): Json | null {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new ClaudeError(`Die Konfiguration von Claude Desktop kann nicht gelesen werden (${file}): ${(err as Error).message}`, 500);
  }
  text = text.replace(/^﻿/, ''); // saved with a byte order mark by Notepad
  if (!text.trim()) return {};
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ClaudeError(`Die Konfiguration von Claude Desktop ist kein gültiges JSON und wird nicht verändert. Bitte die Datei prüfen: ${file}`);
  }
  if (!isObject(data) || (data.mcpServers !== undefined && !isObject(data.mcpServers))) {
    throw new ClaudeError(`Die Konfiguration von Claude Desktop hat ein unerwartetes Format und wird nicht verändert. Bitte die Datei prüfen: ${file}`);
  }
  return data;
}

/** Backup of the previous version, then an atomic replace (Claude never sees a half-written file). */
function writeDesktopConfig(file: string, data: Json): void {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let mode: number | undefined;
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, `${file}.bak`);
      mode = fs.statSync(file).mode & 0o777;
    }
    const tmp = `${file}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', mode === undefined ? undefined : { mode });
      fs.renameSync(tmp, file);
    } catch (err) {
      fs.rmSync(tmp, { force: true });
      throw err;
    }
  } catch (err) {
    throw new ClaudeError(`Die Konfiguration von Claude Desktop konnte nicht gespeichert werden (${file}): ${(err as Error).message}`, 500);
  }
}

function entryOf(data: Json | null): Json | null {
  const entry = data && isObject(data.mcpServers) ? data.mcpServers[ENTRY] : undefined;
  return isObject(entry) ? entry : null;
}

function startsCommand(entry: Json, stdio: string[]): boolean {
  const args = Array.isArray(entry.args) ? entry.args : [];
  return entry.command === stdio[0] && args.length === stdio.length - 1 && args.every((a, i) => a === stdio[i + 1]);
}

export function desktopStatus(stdio: string[], e: Env = currentEnv(), probe: Probe = realProbe): DesktopStatus {
  const status: DesktopStatus = {
    installed: probe.isDir(claudeDesktopDir(e, probe)),
    config_path: claudeDesktopConfigPath(e, probe),
    registered: false,
    current: false,
  };
  try {
    const entry = entryOf(readDesktopConfig(status.config_path));
    status.registered = !!entry;
    status.current = !!entry && startsCommand(entry, stdio);
  } catch (err) {
    status.error = (err as Error).message;
  }
  return status;
}

/** Add or remove our entry; every other setting in the file is kept. Returns the new status. */
export function setDesktopEntry(add: boolean, stdio: string[], e: Env = currentEnv(), probe: Probe = realProbe): DesktopStatus {
  const file = claudeDesktopConfigPath(e, probe);
  if (add) {
    if (!probe.isDir(claudeDesktopDir(e, probe))) throw new ClaudeError('Claude Desktop wurde nicht gefunden.');
    const data = readDesktopConfig(file) ?? {};
    const entry = entryOf(data);
    if (!entry || !startsCommand(entry, stdio)) {
      const servers = isObject(data.mcpServers) ? data.mcpServers : {};
      servers[ENTRY] = { command: stdio[0], args: stdio.slice(1) };
      data.mcpServers = servers;
      writeDesktopConfig(file, data);
    }
  } else {
    const data = readDesktopConfig(file);
    if (data && entryOf(data)) {
      delete (data.mcpServers as Json)[ENTRY]; // an empty mcpServers object stays
      writeDesktopConfig(file, data);
    }
  }
  return desktopStatus(stdio, e, probe);
}

/**
 * An existing entry that starts another program (e.g. the standalone executable from before the desktop app) is
 * pointed to the current command. Returns whether the file was changed.
 */
export function repairDesktopEntry(stdio: string[], e: Env = currentEnv(), probe: Probe = realProbe): boolean {
  const s = desktopStatus(stdio, e, probe);
  if (s.error || !s.installed || !s.registered || s.current) return false;
  setDesktopEntry(true, stdio, e, probe);
  return true;
}

// ------------------------------------------------------------------------------------------------- Claude Code

export interface CodeStatus {
  /** The `claude` command was found. */
  installed: boolean;
  command_path?: string;
  /** null: unknown (the command did not answer). */
  registered: boolean | null;
  error?: string;
}

export interface RunResult {
  /** Exit code, null if the command could not be started or was stopped. */
  code: number | null;
  stdout: string;
  stderr: string;
  /** Could not start, or timed out. */
  error?: string;
}

export type Runner = (file: string, args: string[]) => Promise<RunResult>;

/**
 * The `claude` command: from PATH, or from where its installers put it (apps started from the desktop often
 * lack the shell's PATH, e.g. ~/.local/bin on macOS).
 */
export function findClaudeCode(e: Env = currentEnv(), probe: Probe = realProbe): string | null {
  const win = e.platform === 'win32';
  const p = win ? path.win32 : path.posix;
  const names = win ? ['claude.exe', 'claude.cmd'] : ['claude'];
  const candidates = (e.env.PATH ?? e.env.Path ?? '')
    .split(win ? ';' : ':')
    .map((d) => d.trim().replace(/^"(.*)"$/, '$1'))
    // relative entries would run whatever lies in the current folder
    .filter((d) => d && p.isAbsolute(d))
    .flatMap((d) => names.map((n) => p.join(d, n)));
  if (win) {
    const profile = e.env.USERPROFILE || e.home;
    candidates.push(
      p.join(profile, '.local', 'bin', 'claude.exe'),
      p.join(e.env.APPDATA || p.join(profile, 'AppData', 'Roaming'), 'npm', 'claude.cmd'),
    );
  } else {
    candidates.push(p.join(e.home, '.local', 'bin', 'claude'), p.join(e.home, '.claude', 'local', 'claude'), '/opt/homebrew/bin/claude', '/usr/local/bin/claude');
  }
  return candidates.find((c) => probe.isExecutable(c)) ?? null;
}

/** Quote an argument for cmd.exe (only needed for .cmd files, which Node can only start through a shell). */
export function cmdQuote(arg: string): string {
  return /^[\w\-.:/\\=@+,]+$/.test(arg) ? arg : `"${arg.replace(/"/g, '""')}"`;
}

/** Runs a command without a console window, stdin and shell (except for .cmd files), with a time limit. */
export function execRunner(e: Env = currentEnv(), timeoutMs = 15000): Runner {
  return (file, args) =>
    new Promise((resolve) => {
      const shell = /\.(cmd|bat)$/i.test(file);
      // npm's `claude` is a Node script: node usually lies next to it, even when it is not on the app's PATH.
      const env = { ...process.env };
      const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
      env[pathKey] = [path.dirname(file), env[pathKey]].filter(Boolean).join(path.delimiter);
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let done = false;
      const finish = (r: RunResult) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(r);
      };
      let child: ChildProcessByStdio<null, Readable, Readable>;
      try {
        // Run in the home folder: `claude mcp` also reads project entries of the current folder.
        child = spawn(shell ? [file, ...args].map(cmdQuote).join(' ') : file, shell ? [] : args, {
          shell,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env,
          cwd: fs.existsSync(e.home) ? e.home : undefined,
        });
      } catch (err) {
        resolve({ code: null, stdout, stderr, error: (err as Error).message });
        return;
      }
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs);
      child.stdout.setEncoding('utf8').on('data', (d: string) => (stdout += d));
      child.stderr.setEncoding('utf8').on('data', (d: string) => (stderr += d));
      child.on('error', (err) => finish({ code: null, stdout, stderr, error: err.message }));
      child.on('close', (code) => finish({ code: timedOut ? null : code, stdout, stderr, error: timedOut ? `keine Antwort nach ${timeoutMs / 1000} s` : undefined }));
    });
}

function detail(r: RunResult): string {
  return (r.error || r.stderr.trim() || r.stdout.trim() || `Exit-Code ${r.code}`).slice(0, 500);
}

export async function codeStatus(run: Runner, e: Env = currentEnv(), probe: Probe = realProbe): Promise<CodeStatus> {
  const cmd = findClaudeCode(e, probe);
  if (!cmd) return { installed: false, registered: null };
  // `claude mcp get` exits with 0 only when the entry exists (in any scope).
  const r = await run(cmd, ['mcp', 'get', ENTRY]);
  if (r.error) return { installed: true, command_path: cmd, registered: null, error: `Claude Code antwortet nicht: ${detail(r)}` };
  return { installed: true, command_path: cmd, registered: r.code === 0 };
}

export async function setCodeEntry(add: boolean, mcpUrl: string, run: Runner, e: Env = currentEnv(), probe: Probe = realProbe): Promise<CodeStatus> {
  const cmd = findClaudeCode(e, probe);
  if (!cmd) throw new ClaudeError('Claude Code wurde nicht gefunden.');
  // `claude mcp add` refuses an existing name: remove first, so that adding again also updates a changed port.
  const removed = await run(cmd, ['mcp', 'remove', '--scope', 'user', ENTRY]);
  if (add) {
    const r = await run(cmd, ['mcp', 'add', '--scope', 'user', '--transport', 'http', ENTRY, mcpUrl]);
    if (r.error || r.code !== 0) throw new ClaudeError(`Claude Code konnte den Eintrag nicht anlegen: ${detail(r)}`, 500);
    return codeStatus(run, e, probe);
  }
  if (removed.error) throw new ClaudeError(`Claude Code antwortet nicht: ${detail(removed)}`, 500);
  const status = await codeStatus(run, e, probe);
  if (status.registered) {
    throw new ClaudeError(`Claude Code hat „${ENTRY}“ nicht in den Benutzer-Einstellungen, sondern in einem Projekt eingetragen. Bitte dort mit „claude mcp remove ${ENTRY}“ entfernen.`);
  }
  return status;
}

// ---------------------------------------------------------------------------------------------------- Together

export interface ClaudeContext {
  /** Command line for MCP over stdin/stdout (Claude Desktop). */
  stdio: string[];
  /** HTTP MCP endpoint (Claude Code). */
  mcpUrl: string;
  env?: Env;
  probe?: Probe;
  run?: Runner;
}

export interface ClaudeStatus {
  desktop: DesktopStatus;
  code: CodeStatus;
  stdio_command: string[];
  mcp_url: string;
}

export async function claudeStatus(ctx: ClaudeContext): Promise<ClaudeStatus> {
  const e = ctx.env ?? currentEnv();
  const probe = ctx.probe ?? realProbe;
  return {
    desktop: desktopStatus(ctx.stdio, e, probe),
    code: await codeStatus(ctx.run ?? execRunner(e), e, probe),
    stdio_command: ctx.stdio,
    mcp_url: ctx.mcpUrl,
  };
}

export type ClaudeClient = 'desktop' | 'code';

export async function claudeAction(ctx: ClaudeContext, client: ClaudeClient, action: 'add' | 'remove'): Promise<ClaudeStatus> {
  const e = ctx.env ?? currentEnv();
  const probe = ctx.probe ?? realProbe;
  if (client === 'desktop') setDesktopEntry(action === 'add', ctx.stdio, e, probe);
  else await setCodeEntry(action === 'add', ctx.mcpUrl, ctx.run ?? execRunner(e), e, probe);
  return claudeStatus(ctx);
}
