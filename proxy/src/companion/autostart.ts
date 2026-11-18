/**
 * Start the companion when the user logs in:
 *   Linux   ~/.config/autostart/worksheet-assistant.desktop (XDG autostart)
 *   macOS   ~/Library/LaunchAgents/io.github.felixwochnick.worksheet-assistant.plist
 *   Windows HKCU\Software\Microsoft\Windows\CurrentVersion\Run, through a small VBScript that starts the
 *           program without a console window
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as sea from 'node:sea';
import { currentEnv, type Env } from './paths.js';

const ID = 'worksheet-assistant';
const MAC_LABEL = 'io.github.felixwochnick.worksheet-assistant';
const WIN_VALUE = 'Worksheet Assistant';

/** The command that starts this program in the background. */
export function launchCommand(): string[] {
  const background = '--background';
  if (sea.isSea()) return [process.execPath, background];
  return [process.execPath, path.resolve(process.argv[1] || ''), background];
}

function xmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
}

function desktopQuote(arg: string): string {
  return /[\s"'\\$`]/.test(arg) ? `"${arg.replace(/(["\\$`])/g, '\\$1')}"` : arg;
}

export interface AutostartTarget {
  file: string;
  content: string;
}

/** What would be written (also used by tests). */
export function autostartTarget(cmd: string[], configDir: string, e: Env = currentEnv()): AutostartTarget {
  if (e.platform === 'darwin') {
    return {
      file: path.posix.join(e.home, 'Library', 'LaunchAgents', `${MAC_LABEL}.plist`),
      content:
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
        '<plist version="1.0"><dict>\n' +
        `  <key>Label</key><string>${MAC_LABEL}</string>\n` +
        `  <key>ProgramArguments</key><array>${cmd.map((a) => `<string>${xmlEscape(a)}</string>`).join('')}</array>\n` +
        '  <key>RunAtLoad</key><true/>\n' +
        '</dict></plist>\n',
    };
  }
  if (e.platform === 'win32') {
    const quoted = cmd.map((a) => `""${a}""`).join(' ');
    return {
      file: path.win32.join(configDir, 'autostart.vbs'),
      content: `' Starts the Worksheet Assistant companion app without a console window.\r\nCreateObject("WScript.Shell").Run "${quoted}", 0, False\r\n`,
    };
  }
  const configHome = e.env.XDG_CONFIG_HOME || path.posix.join(e.home, '.config');
  return {
    file: path.posix.join(configHome, 'autostart', `${ID}.desktop`),
    content:
      '[Desktop Entry]\nType=Application\nName=Worksheet Assistant\n' +
      'Comment=Local server for the worksheet assistant plugin (AI chat and MCP)\n' +
      `Exec=${cmd.map(desktopQuote).join(' ')}\nTerminal=false\nX-GNOME-Autostart-enabled=true\n`,
  };
}

export function autostartEnabled(configDir: string, e: Env = currentEnv()): boolean {
  const t = autostartTarget(launchCommand(), configDir, e);
  if (e.platform === 'win32') {
    try {
      const out = execFileSync('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', WIN_VALUE], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return out.includes(WIN_VALUE) && fs.existsSync(t.file);
    } catch {
      return false;
    }
  }
  return fs.existsSync(t.file);
}

export function setAutostart(enabled: boolean, configDir: string, e: Env = currentEnv()): void {
  const t = autostartTarget(launchCommand(), configDir, e);
  if (!enabled) {
    fs.rmSync(t.file, { force: true });
    if (e.platform === 'win32') {
      try {
        execFileSync('reg', ['delete', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', WIN_VALUE, '/f'], { stdio: 'ignore' });
      } catch {
        /* not set */
      }
    }
    return;
  }
  fs.mkdirSync(path.dirname(t.file), { recursive: true });
  fs.writeFileSync(t.file, t.content);
  if (e.platform === 'win32') {
    execFileSync('reg', ['add', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', WIN_VALUE, '/t', 'REG_SZ', '/d', `wscript.exe "${t.file}"`, '/f'], { stdio: 'ignore' });
  }
}
