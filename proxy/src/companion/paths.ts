/**
 * Where things live on the user's computer: the companion's own configuration and the plugin folders of the
 * Euro-Office desktop apps (Euro-Office and its Nextcloud Office brand).
 *
 * The desktop apps have no plugin manager; they load plugins from "sdkjs-plugins" in their per-user data folder.
 * A plugin folder there must be named after the plugin GUID (with braces).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PLUGIN_GUID = '{DA7D8078-28E2-4FFC-A41B-02BD1B9CE490}';
export const APP_NAME = 'Arbeitsblatt-Assistent';

export interface DesktopApp {
  id: 'euro-office' | 'nextcloud-office' | 'desktop-editors';
  name: string;
  /** The app's per-user data folder (exists once the app was started). */
  dataDir: string;
  /** Plugin folder inside dataDir. */
  pluginsDir: string;
}

export interface Env {
  platform: NodeJS.Platform;
  home: string;
  env: NodeJS.ProcessEnv;
}

export function currentEnv(): Env {
  return { platform: process.platform, home: os.homedir(), env: process.env };
}

/**
 * Per-user data folders of the desktop apps, whether installed or not. On Linux and Windows both brands
 * (Euro-Office, Nextcloud Office) use the same folder; on macOS each brand has its own (verified with 9.3.8).
 */
export function desktopApps(e: Env = currentEnv()): DesktopApp[] {
  const p = e.platform === 'win32' ? path.win32 : path.posix;
  const make = (id: DesktopApp['id'], name: string, dataDir: string): DesktopApp => ({
    id,
    name,
    dataDir,
    pluginsDir: p.join(dataDir, 'sdkjs-plugins'),
  });
  if (e.platform === 'win32') {
    const local = e.env.LOCALAPPDATA || p.join(e.home, 'AppData', 'Local');
    return [make('desktop-editors', 'Euro-Office / Nextcloud Office', p.join(local, 'Euro-Office', 'DesktopEditors', 'data'))];
  }
  if (e.platform === 'darwin') {
    const support = p.join(e.home, 'Library', 'Application Support');
    return [
      make('euro-office', 'Euro-Office', p.join(support, 'asc.euro-office.Euro-Office', 'data')),
      make('nextcloud-office', 'Nextcloud Office', p.join(support, 'asc.nextcloud-office.Nextcloud-Office', 'data')),
    ];
  }
  const share = e.env.XDG_DATA_HOME || p.join(e.home, '.local', 'share');
  return [make('desktop-editors', 'Euro-Office / Nextcloud Office', p.join(share, 'euro-office', 'desktopeditors'))];
}

/** Apps whose data folder exists (they were started at least once; installing before works, too). */
export function detectedApps(e: Env = currentEnv()): DesktopApp[] {
  return desktopApps(e).filter((a) => {
    try {
      return fs.statSync(a.dataDir).isDirectory();
    } catch {
      return false;
    }
  });
}

/** The companion's configuration folder. */
export function configDir(e: Env = currentEnv()): string {
  if (e.env.WORKSHEET_ASSISTANT_HOME) return e.env.WORKSHEET_ASSISTANT_HOME;
  if (e.platform === 'win32') return path.win32.join(e.env.APPDATA || path.win32.join(e.home, 'AppData', 'Roaming'), APP_NAME);
  if (e.platform === 'darwin') return path.posix.join(e.home, 'Library', 'Application Support', APP_NAME);
  return path.posix.join(e.env.XDG_CONFIG_HOME || path.posix.join(e.home, '.config'), 'arbeitsblatt-assistent');
}
