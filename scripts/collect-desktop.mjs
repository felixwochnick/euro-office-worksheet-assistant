#!/usr/bin/env node
/*
 * Collect the installers of one platform from the Tauri build (scripts/build-desktop.mjs) under stable names in
 * dist/desktop/, and – when the build created signed update bundles – the platform's entry for latest.json
 * (merged by scripts/updater-json.mjs).
 *
 *   node scripts/collect-desktop.mjs <target triple>
 *
 *   worksheet-assistant_<version>_macos-arm64.dmg      + _macos-arm64.app.tar.gz(.sig)  (update bundle)
 *   worksheet-assistant_<version>_windows-x64-setup.exe (+ .sig: the installer is the update bundle)
 *   worksheet-assistant_<version>_linux-x64.AppImage    (+ .sig) and worksheet-assistant_<version>_amd64.deb
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
if (!target) {
  console.error('usage: node scripts/collect-desktop.mjs <target triple>');
  process.exit(2);
}
const version = JSON.parse(fs.readFileSync(path.join(root, 'apps', 'desktop', 'package.json'), 'utf8')).version;
const bundle = path.join(root, 'apps', 'desktop', 'src-tauri', 'target', target, 'release', 'bundle');
const out = path.join(root, 'dist', 'desktop');
fs.mkdirSync(out, { recursive: true });

const arch = target.startsWith('aarch64') ? 'arm64' : 'x64';
const os = target.includes('apple') ? 'macos' : target.includes('windows') ? 'windows' : 'linux';
/** Platform key of the Tauri updater. */
const platform = `${{ macos: 'darwin', windows: 'windows', linux: 'linux' }[os]}-${arch === 'arm64' ? 'aarch64' : 'x86_64'}`;
const name = (suffix) => `worksheet-assistant_${version}_${suffix}`;

function find(dir, re) {
  const d = path.join(bundle, dir);
  const hit = fs.existsSync(d) ? fs.readdirSync(d).find((f) => re.test(f)) : undefined;
  return hit ? path.join(d, hit) : null;
}

const copied = [];
function take(file, as) {
  if (!file) return null;
  fs.copyFileSync(file, path.join(out, as));
  copied.push(as);
  return as;
}

let update = null; // [file, its .sig]
if (os === 'macos') {
  take(find('dmg', /\.dmg$/), name(`macos-${arch}.dmg`));
  const tar = find('macos', /\.app\.tar\.gz$/);
  if (tar) update = [take(tar, name(`macos-${arch}.app.tar.gz`)), `${tar}.sig`];
} else if (os === 'windows') {
  const setup = find('nsis', /-setup\.exe$/);
  const as = take(setup, name(`windows-${arch}-setup.exe`));
  if (setup) update = [as, `${setup}.sig`];
} else {
  const appimage = find('appimage', /\.AppImage$/);
  const as = take(appimage, name(`linux-${arch}.AppImage`));
  if (appimage) update = [as, `${appimage}.sig`];
  take(find('deb', /\.deb$/), name(`${arch === 'arm64' ? 'arm64' : 'amd64'}.deb`));
}
if (!copied.length) {
  console.error(`No installers found in ${bundle}`);
  process.exit(1);
}

if (update && fs.existsSync(update[1])) {
  take(update[1], `${update[0]}.sig`);
  const entry = { platform, file: update[0], signature: fs.readFileSync(update[1], 'utf8').trim() };
  fs.writeFileSync(path.join(out, `updater-${platform}.json`), JSON.stringify(entry, null, 2));
  copied.push(`updater-${platform}.json`);
}
for (const f of copied) console.log(`dist/desktop/${f}`);
