/**
 * Command line of the companion app (single executable "worksheet-assistant").
 *
 *   worksheet-assistant                 start (installs/updates the plugin, opens the settings page)
 *   worksheet-assistant --background    start without opening the browser (autostart)
 *   worksheet-assistant mcp-stdio       MCP over stdin/stdout (Claude Desktop); starts the companion if needed
 *   worksheet-assistant install-plugin [--force]
 *   worksheet-assistant uninstall       remove the plugin from the desktop apps and the autostart entry
 *   worksheet-assistant autostart on|off
 *   worksheet-assistant status | version | help
 *
 *   worksheet-assistant --app           run inside the desktop app (Tauri), which starts this program hidden:
 *                                       implies --background and --no-browser; stdout carries only JSON lines
 *                                       ({"event":"ready"|"error"|"quit",…}); quits when stdin closes.
 *                                       Env: WORKSHEET_ASSISTANT_UI_SECRET (API secret chosen by the app),
 *                                       WORKSHEET_ASSISTANT_APP (the app's executable, see launchCommand).
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import { VERSION } from '../version.js';
import { repairAutostart, setAutostart, stdioCommand } from './autostart.js';
import { repairDesktopEntry } from './claude.js';
import { Companion, type CompanionOptions } from './companion.js';
import { uninstallPlugin } from './install.js';
import fs from 'node:fs';
import { configDir, desktopApps } from './paths.js';
import { settingsFile } from './settings-store.js';
import { runStdio } from './stdio.js';

const HELP = `Arbeitsblatt-Assistent ${VERSION} – Begleitprogramm für die Euro-Office-Desktop-App

  worksheet-assistant                 starten (installiert das Plugin, öffnet die Einstellungen)
  worksheet-assistant --background    im Hintergrund starten (ohne Browser)
  worksheet-assistant mcp-stdio       MCP über stdin/stdout (z. B. für Claude Desktop)
  worksheet-assistant install-plugin [--force]   Plugin in die Desktop-Apps installieren
  worksheet-assistant uninstall       Plugin und Autostart entfernen
  worksheet-assistant autostart on|off
  worksheet-assistant status | version | help

Optionen: --port <n>, --no-browser, --plugin-source <dir>, --app (nur für die Desktop-App)
`;

/** Exit codes of start failures in app mode (the desktop app shows the message of the error event). */
const APP_EXIT = { already_running: 3, port_in_use: 4, failed: 1 } as const;
type AppErrorCode = keyof typeof APP_EXIT;

export function openBrowser(url: string): void {
  try {
    const [cmd, args] =
      process.platform === 'darwin'
        ? ['open', [url]]
        : process.platform === 'win32'
          ? ['cmd', ['/c', 'start', '', url]]
          : ['xdg-open', [url]];
    spawn(cmd as string, args as string[], { detached: true, stdio: 'ignore', windowsHide: true }).on('error', () => {}).unref();
  } catch {
    /* no browser */
  }
}

async function alreadyRunning(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/v1/meta`, { signal: AbortSignal.timeout(1500) });
    return res.ok && ((await res.json()) as { auth_mode?: string }).auth_mode === 'local';
  } catch {
    return false;
  }
}

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen({ host: '127.0.0.1', port, exclusive: true }, () => s.close(() => resolve(true)));
  });
}

/**
 * Stop a companion that already listens on our port: the standalone program of an older version, started from a
 * terminal or its autostart. Its settings page contains the API secret and its API has a quit command.
 * True once the port is free.
 */
async function stopOtherInstance(url: string, port: number): Promise<boolean> {
  try {
    const page = await (await fetch(`${url}/`, { signal: AbortSignal.timeout(3000) })).text();
    const m = /const SECRET = ("(?:[^"\\]|\\.)*");/.exec(page);
    if (!m) return false;
    const res = await fetch(`${url}/companion/api/quit`, {
      method: 'POST',
      headers: { 'x-companion-secret': JSON.parse(m[1]) as string, 'content-type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
  } catch {
    return false;
  }
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (!(await alreadyRunning(url)) && (await portFree(port))) return true;
  }
  return false;
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port' || a === '--plugin-source') flags.set(a, argv[++i] ?? '');
    else if (a.startsWith('-')) flags.set(a, true);
    else positional.push(a);
  }
  const cmd = positional[0] ?? (flags.has('--version') ? 'version' : flags.has('--help') || flags.has('-h') ? 'help' : 'run');
  const port = flags.has('--port') ? Number(flags.get('--port')) : undefined;
  const app = flags.has('--app');
  const background = app || flags.has('--background');
  const openPage = !background && !flags.has('--no-browser');
  const log = (s: string) => {
    if (app) process.stderr.write(s + '\n'); // stdout belongs to the handshake with the desktop app
    else if (!background) process.stdout.write(s + '\n');
  };
  /** App mode: one JSON object per line on stdout. Resolves once written, so that exiting afterwards loses nothing. */
  const emit = (event: Record<string, unknown>): Promise<void> =>
    new Promise((resolve) => {
      if (!app) return resolve();
      process.stdout.write(JSON.stringify(event) + '\n', () => resolve());
    });
  const appError = (err: NodeJS.ErrnoException): { code: AppErrorCode; message: string } =>
    err.code === 'EADDRINUSE'
      ? { code: 'port_in_use', message: `Port ${companion?.settings.port ?? port} wird von einem anderen Programm benutzt.` }
      : { code: 'failed', message: `Der Arbeitsblatt-Assistent konnte nicht starten: ${err.message}` };

  // Chosen by the desktop app for its window; not passed on to programs started from here.
  const uiSecret = process.env.WORKSHEET_ASSISTANT_UI_SECRET;
  delete process.env.WORKSHEET_ASSISTANT_UI_SECRET;
  if (uiSecret && uiSecret.length < 16) process.stderr.write('WORKSHEET_ASSISTANT_UI_SECRET is shorter than 16 characters and is ignored.\n');

  if (cmd === 'help') {
    process.stdout.write(HELP);
    return 0;
  }
  if (cmd === 'version') {
    process.stdout.write(VERSION + '\n');
    return 0;
  }
  if (cmd === 'status' && !fs.existsSync(settingsFile(configDir()))) {
    // Read-only: do not create the configuration.
    process.stdout.write(JSON.stringify({ running: false, configured: false, config_dir: configDir() }, null, 2) + '\n');
    return 0;
  }

  let stopping = false;
  const shutdown = async (quitEvent = false) => {
    if (stopping) return;
    stopping = true;
    if (quitEvent) await emit({ event: 'quit' }); // the desktop app then quits as well
    await companion.stop().catch(() => {});
    process.exit(0);
  };
  const options: CompanionOptions = {
    port,
    pluginSourceDir: typeof flags.get('--plugin-source') === 'string' ? (flags.get('--plugin-source') as string) : undefined,
    logLevel: process.env.LOG_LEVEL || (background ? 'warn' : 'error'),
    secret: uiSecret,
    app,
    logStream: app ? process.stderr : undefined,
    onListening: () => void emit({ event: 'ready', url: companion.url, version: VERSION, chat_error: companion.chatError }),
    onRestartError: (err) => {
      const e = appError(err);
      process.stderr.write(`Neustart fehlgeschlagen: ${err.message}\n`);
      void emit({ event: 'error', ...e }).then(() => process.exit(app ? APP_EXIT[e.code] : 1));
    },
    onQuit: () => void shutdown(true),
  };
  let companion: Companion;
  try {
    companion = new Companion(options);
  } catch (err) {
    if (!app || cmd !== 'run') throw err;
    const f = appError(err as Error); // e.g. an unreadable config.json
    process.stderr.write(`${f.message}\n`);
    await emit({ event: 'error', ...f });
    return APP_EXIT[f.code];
  }

  switch (cmd) {
    case 'mcp-stdio':
      await runStdio(companion.url);
      return -1; // keep running
    case 'install-plugin': {
      const done = companion.install(flags.has('--force'));
      if (!done.length) log('Keine Desktop-App gefunden (einmal starten oder --force verwenden).');
      for (const d of done) log(`Plugin installiert: ${d.app} → ${d.dir}`);
      return 0;
    }
    case 'uninstall': {
      for (const a of desktopApps(companion.env)) if (uninstallPlugin(a)) log(`Plugin entfernt: ${a.name}`);
      setAutostart(false, companion.configDir, companion.env);
      log(`Autostart entfernt. Einstellungen liegen noch in ${companion.configDir}`);
      return 0;
    }
    case 'autostart': {
      const on = positional[1] !== 'off';
      setAutostart(on, companion.configDir, companion.env);
      log(on ? 'Autostart eingerichtet.' : 'Autostart entfernt.');
      return 0;
    }
    case 'status': {
      process.stdout.write(JSON.stringify({ running: await alreadyRunning(companion.url), ...companion.state() }, null, 2) + '\n');
      return 0;
    }
    case 'run':
      break;
    default:
      process.stderr.write(`Unbekannter Befehl: ${cmd}\n\n${HELP}`);
      return 2;
  }

  if (app) {
    // The desktop app keeps our stdin open: it ends when the app quits or dies, and so do we.
    process.stdin.on('end', () => void shutdown());
    process.stdin.on('close', () => void shutdown());
    process.stdin.on('error', () => void shutdown());
    process.stdin.resume();
    process.stdout.on('error', () => void shutdown()); // EPIPE: nobody reads our events any more
    // Entries written by the standalone program (e.g. from ~/Downloads) now start the app.
    try {
      if (repairAutostart(companion.configDir, companion.env)) log('Autostart startet jetzt die App.');
    } catch (err) {
      log(`Autostart konnte nicht aktualisiert werden: ${(err as Error).message}`);
    }
    try {
      if (repairDesktopEntry(stdioCommand(companion.env), companion.env)) log('Eintrag in Claude Desktop aktualisiert.');
    } catch (err) {
      log(`Eintrag in Claude Desktop konnte nicht aktualisiert werden: ${(err as Error).message}`);
    }
  }

  if (await alreadyRunning(companion.url)) {
    if (!app) {
      log(`Der Arbeitsblatt-Assistent läuft bereits: ${companion.url}/`);
      if (openPage) openBrowser(`${companion.url}/`);
      return 0;
    }
    log(`Ein anderer Arbeitsblatt-Assistent läuft auf ${companion.url} – er wird beendet.`);
    if (!(await stopOtherInstance(companion.url, companion.settings.port))) {
      await emit({
        event: 'error',
        code: 'already_running',
        message: 'Ein anderer Arbeitsblatt-Assistent läuft bereits (ältere Version im Terminal oder Autostart). Bitte beenden und erneut versuchen.',
      });
      return APP_EXIT.already_running;
    }
  }

  try {
    for (const d of companion.ensureInstalled()) log(`Plugin installiert: ${d.app} → ${d.dir}`);
  } catch (err) {
    log(`Plugin konnte nicht installiert werden: ${(err as Error).message}`);
  }
  try {
    await companion.start(); // app mode: emits the ready event
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (app) {
      const f = appError(e);
      process.stderr.write(`${f.message}\n`);
      await emit({ event: 'error', ...f });
      return APP_EXIT[f.code];
    }
    process.stderr.write(
      e.code === 'EADDRINUSE'
        ? `Port ${companion.settings.port} ist belegt (anderes Programm). Mit --port <n> einen anderen wählen.\n`
        : `Start fehlgeschlagen: ${e.message}\n`,
    );
    return 1;
  }
  log(`Arbeitsblatt-Assistent ${VERSION} läuft.`);
  log(`  Einstellungen: ${companion.url}/`);
  log(`  MCP:           ${companion.url}/mcp`);
  if (companion.chatError) log(`  KI-Chat aus:   ${companion.chatError}`);
  if (!app) log('Dieses Fenster offen lassen (oder in den Einstellungen den Autostart einschalten). Beenden mit Strg+C.');
  if (openPage) openBrowser(`${companion.url}/`);
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
  return -1;
}
