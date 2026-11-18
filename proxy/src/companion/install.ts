/**
 * Install the plugin into the desktop apps' plugin folders.
 *
 * The plugin files are embedded in the companion executable (asset "plugin.json": {relative path: base64}); when
 * the companion runs from the repository, dist/worksheet-assistant/ is used. After copying, local-config.js tells
 * the plugin where the companion listens and which token to use, so no settings are needed in the editor.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as sea from 'node:sea';
import { PLUGIN_GUID, type DesktopApp } from './paths.js';

export type PluginFiles = Map<string, Buffer>;

function readDir(dir: string, base = dir, out: PluginFiles = new Map()): PluginFiles {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) readDir(full, base, out);
    else out.set(path.relative(base, full).split(path.sep).join('/'), fs.readFileSync(full));
  }
  return out;
}

/** The plugin files: embedded asset (single executable) or a plugin folder on disk. */
export function loadPluginFiles(fallbackDir?: string): PluginFiles {
  try {
    if (sea.isSea()) {
      const json = JSON.parse(sea.getAsset('plugin.json', 'utf8')) as Record<string, string>;
      return new Map(Object.entries(json).map(([k, v]) => [k, Buffer.from(v, 'base64')]));
    }
  } catch {
    /* not a single executable */
  }
  const dir = fallbackDir ?? process.env.WORKSHEET_PLUGIN_DIR;
  if (!dir || !fs.existsSync(path.join(dir, 'config.json'))) {
    throw new Error('Plugin files not found – run scripts/build.sh or set WORKSHEET_PLUGIN_DIR to dist/worksheet-assistant');
  }
  return readDir(dir);
}

export function pluginVersion(files: PluginFiles): string {
  try {
    return String(JSON.parse(files.get('config.json')!.toString('utf8')).version || '');
  } catch {
    return '';
  }
}

export interface LocalConfig {
  proxyUrl: string;
  token: string;
}

export function localConfigScript(c: LocalConfig): string {
  return (
    '/* Written by the Arbeitsblatt-Assistent companion app: the local server and its token. */\n' +
    `window.WORKSHEET_LOCAL = ${JSON.stringify({ proxyUrl: c.proxyUrl, token: c.token, companion: true })};\n`
  );
}

export function pluginDir(app: DesktopApp): string {
  return path.join(app.pluginsDir, PLUGIN_GUID);
}

export interface InstalledInfo {
  installed: boolean;
  version: string;
  /** local-config.js matches the current server URL and token. */
  configured: boolean;
}

export function installedInfo(app: DesktopApp, local: LocalConfig): InstalledInfo {
  const dir = pluginDir(app);
  let version = '';
  try {
    version = String(JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')).version || '');
  } catch {
    return { installed: false, version: '', configured: false };
  }
  let configured = false;
  try {
    configured = fs.readFileSync(path.join(dir, 'local-config.js'), 'utf8') === localConfigScript(local);
  } catch {
    /* missing */
  }
  return { installed: true, version, configured };
}

/** Copy the plugin into the app's plugin folder (replacing an older version) and write local-config.js. */
export function installPlugin(app: DesktopApp, files: PluginFiles, local: LocalConfig): string {
  const target = pluginDir(app);
  const tmp = `${target}.tmp-${process.pid}`;
  fs.rmSync(tmp, { recursive: true, force: true });
  for (const [rel, data] of files) {
    if (rel.includes('..') || path.isAbsolute(rel)) continue;
    const file = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
  }
  fs.writeFileSync(path.join(tmp, 'local-config.js'), localConfigScript(local));
  fs.rmSync(target, { recursive: true, force: true });
  fs.renameSync(tmp, target);
  return target;
}

export function uninstallPlugin(app: DesktopApp): boolean {
  const target = pluginDir(app);
  if (!fs.existsSync(target)) return false;
  fs.rmSync(target, { recursive: true, force: true });
  return true;
}
