#!/usr/bin/env node
/*
 * Build the desktop app (Tauri + Nuxt UI, desktop/) with the companion as its server program.
 *
 *   node scripts/build-desktop.mjs                 # plugin → companion executable → installers
 *   node scripts/build-desktop.mjs --stub          # only placeholders for the server program and its licenses,
 *                                                  # enough for cargo check/clippy/test and `tauri dev` UI work
 *   node scripts/build-desktop.mjs -- --bundles deb   # arguments after -- go to `tauri build`
 *
 * Options: --target <rust target triple> (default: this machine), --allow-libatomic / --allow-shared-libs
 * (passed to scripts/build-companion.mjs for local builds with a distribution Node.js).
 *
 * Updater: with TAURI_SIGNING_PRIVATE_KEY and WORKSHEET_ASSISTANT_UPDATER_PUBKEY in the environment the
 * update bundles are created and signed and the public key goes into the app's configuration, which turns its
 * self-updates on (release workflow).
 *
 * Result: desktop/src-tauri/target/<target>/release/bundle/ (dmg + app, nsis, deb + appimage).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desktop = path.join(root, 'desktop');
const tauriDir = path.join(desktop, 'src-tauri');
const argv = process.argv.slice(2);
const dashdash = argv.indexOf('--');
const own = dashdash === -1 ? argv : argv.slice(0, dashdash);
const tauriArgs = dashdash === -1 ? [] : argv.slice(dashdash + 1);
const stub = own.includes('--stub');
const win = process.platform === 'win32';
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', cwd: root, shell: win && /^(npm|npx)$/.test(cmd), ...opts });

function hostTriple() {
  const out = execFileSync('rustc', ['-vV'], { encoding: 'utf8' });
  const m = /^host: (\S+)$/m.exec(out);
  if (!m) throw new Error('rustc -vV printed no host triple');
  return m[1];
}
const targetIdx = own.indexOf('--target');
const target = targetIdx === -1 ? hostTriple() : own[targetIdx + 1];
const exeSuffix = target.includes('windows') ? '.exe' : '';
const sidecar = path.join(tauriDir, 'binaries', `worksheet-assistant-${target}${exeSuffix}`);
const resources = path.join(tauriDir, 'resources');

fs.mkdirSync(path.dirname(sidecar), { recursive: true });
fs.rmSync(resources, { recursive: true, force: true });
fs.mkdirSync(resources, { recursive: true });
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(resources, 'LICENSE.txt'));

if (stub) {
  // Tauri checks at compile time that the server program and the resources exist.
  if (!fs.existsSync(sidecar)) {
    fs.writeFileSync(sidecar, '#!/bin/sh\necho "placeholder – build with: node scripts/build-desktop.mjs" >&2\nexit 1\n', { mode: 0o755 });
  }
  fs.writeFileSync(path.join(resources, 'THIRD-PARTY-LICENSES.txt'), 'placeholder\n');
  console.log(`==> Placeholders: ${path.relative(root, sidecar)}, ${path.relative(root, resources)}`);
  process.exit(0);
}

if (!fs.existsSync(path.join(root, 'dist', 'worksheet-assistant', 'config.json'))) {
  console.log('==> Plugin');
  run('bash', ['scripts/build.sh']);
}

console.log('==> Companion (server program)');
run(process.execPath, [
  'scripts/build-companion.mjs',
  '--no-archive',
  ...own.filter((a) => a === '--allow-libatomic' || a === '--allow-shared-libs'),
]);
const companionDir = path.join(root, 'dist', 'companion');
fs.copyFileSync(path.join(companionDir, `worksheet-assistant${exeSuffix}`), sidecar);
fs.chmodSync(sidecar, 0o755);
// Third-party licenses: the server program's npm packages and Node.js, then the app's Rust crates.
const rustLicenses = execFileSync(process.execPath, [path.join(root, 'scripts', 'rust-licenses.mjs'), target], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
fs.writeFileSync(
  path.join(resources, 'THIRD-PARTY-LICENSES.txt'),
  `${fs.readFileSync(path.join(companionDir, 'THIRD-PARTY-LICENSES.txt'), 'utf8')}\n\n${'='.repeat(60)}\n${rustLicenses}`,
);
fs.cpSync(path.join(root, 'dist', 'worksheet-assistant', 'licenses'), path.join(resources, 'licenses'), { recursive: true });

console.log('==> Desktop app');
if (!fs.existsSync(path.join(desktop, 'node_modules'))) run('npm', ['ci'], { cwd: desktop });
const pubkey = (process.env.WORKSHEET_ASSISTANT_UPDATER_PUBKEY || '').trim();
const signed = !!(process.env.TAURI_SIGNING_PRIVATE_KEY && pubkey);
console.log(signed ? '    with signed update bundles' : '    without update bundles (TAURI_SIGNING_PRIVATE_KEY / WORKSHEET_ASSISTANT_UPDATER_PUBKEY not set)');
// The updater key goes into the app's configuration (the app turns self-updates on with it; the CLI signs the
// bundles against it). A config file, not inline JSON: on Windows npx runs through cmd.exe, which mangles quotes.
const updaterConfig = path.join(tauriDir, 'tauri.updater.gen.json');
fs.rmSync(updaterConfig, { force: true });
if (signed) {
  fs.writeFileSync(updaterConfig, JSON.stringify({ bundle: { createUpdaterArtifacts: true }, plugins: { updater: { pubkey } } }, null, 2));
}
run('npx', ['tauri', 'build', '--target', target, ...(signed ? ['--config', updaterConfig] : []), ...tauriArgs], { cwd: desktop });
console.log(`==> ${path.relative(root, path.join(tauriDir, 'target', target, 'release', 'bundle'))}`);
