/**
 * Command line of the companion app (single executable "arbeitsblatt-assistent").
 *
 *   arbeitsblatt-assistent                 start (installs/updates the plugin, opens the settings page)
 *   arbeitsblatt-assistent --background    start without opening the browser (autostart)
 *   arbeitsblatt-assistent mcp-stdio       MCP over stdin/stdout (Claude Desktop); starts the companion if needed
 *   arbeitsblatt-assistent install-plugin [--force]
 *   arbeitsblatt-assistent uninstall       remove the plugin from the desktop apps and the autostart entry
 *   arbeitsblatt-assistent autostart on|off
 *   arbeitsblatt-assistent status | version | help
 */
import { spawn } from 'node:child_process';
import { VERSION } from '../version.js';
import { setAutostart } from './autostart.js';
import { Companion } from './companion.js';
import { uninstallPlugin } from './install.js';
import { desktopApps } from './paths.js';
import { runStdio } from './stdio.js';

const HELP = `Arbeitsblatt-Assistent ${VERSION} – Begleitprogramm für die Euro-Office-Desktop-App

  arbeitsblatt-assistent                 starten (installiert das Plugin, öffnet die Einstellungen)
  arbeitsblatt-assistent --background    im Hintergrund starten (ohne Browser)
  arbeitsblatt-assistent mcp-stdio       MCP über stdin/stdout (z. B. für Claude Desktop)
  arbeitsblatt-assistent install-plugin [--force]   Plugin in die Desktop-Apps installieren
  arbeitsblatt-assistent uninstall       Plugin und Autostart entfernen
  arbeitsblatt-assistent autostart on|off
  arbeitsblatt-assistent status | version | help

Optionen: --port <n>, --no-browser, --plugin-source <dir>
`;

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
  const background = flags.has('--background');
  const log = (s: string) => {
    if (!background) process.stdout.write(s + '\n');
  };

  if (cmd === 'help') {
    process.stdout.write(HELP);
    return 0;
  }
  if (cmd === 'version') {
    process.stdout.write(VERSION + '\n');
    return 0;
  }

  const companion = new Companion({
    port,
    pluginSourceDir: typeof flags.get('--plugin-source') === 'string' ? (flags.get('--plugin-source') as string) : undefined,
    logLevel: process.env.LOG_LEVEL || (background ? 'warn' : 'error'),
    onQuit: () => {
      void companion.stop().then(() => process.exit(0));
    },
  });

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

  if (await alreadyRunning(companion.url)) {
    log(`Der Arbeitsblatt-Assistent läuft bereits: ${companion.url}/`);
    if (!background && !flags.has('--no-browser')) openBrowser(`${companion.url}/`);
    return 0;
  }

  try {
    for (const d of companion.ensureInstalled()) log(`Plugin installiert: ${d.app} → ${d.dir}`);
  } catch (err) {
    log(`Plugin konnte nicht installiert werden: ${(err as Error).message}`);
  }
  try {
    await companion.start();
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
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
  log('Dieses Fenster offen lassen (oder in den Einstellungen den Autostart einschalten). Beenden mit Strg+C.');
  if (!background && !flags.has('--no-browser')) openBrowser(`${companion.url}/`);
  const shutdown = () => void companion.stop().then(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  return -1;
}
