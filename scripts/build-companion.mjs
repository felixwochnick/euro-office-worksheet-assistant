#!/usr/bin/env node
/*
 * Build the companion app as a single executable for the current platform (Node.js single executable
 * application, Node >= 25.5 for --build-sea).
 *
 *   bash scripts/build.sh            # plugin (dist/worksheet-assistant/)
 *   (cd proxy && npm ci)             # server dependencies
 *   node scripts/build-companion.mjs # -> dist/companion/arbeitsblatt-assistent[.exe]
 *                                    #    dist/arbeitsblatt-assistent-<os>-<arch>.zip
 *
 * Steps: bundle server + companion + shared/abc-tools.js with esbuild into one CommonJS file, embed the plugin
 * files as an asset, build the executable with `node --build-sea`, sign it ad hoc on macOS, zip it.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist', 'companion');
const pluginDir = path.join(root, 'dist', 'worksheet-assistant');
const exeName = process.platform === 'win32' ? 'arbeitsblatt-assistent.exe' : 'arbeitsblatt-assistent';
const os = { win32: 'windows', darwin: 'macos', linux: 'linux' }[process.platform] ?? process.platform;
const hasZip = (() => {
  try {
    execFileSync('zip', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
// zip everywhere (Windows: PowerShell); .tar.gz on systems without zip.
const archive = path.join(root, 'dist', `arbeitsblatt-assistent-${os}-${process.arch}.${process.platform === 'win32' || hasZip ? 'zip' : 'tar.gz'}`);

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 25 || (major === 25 && minor < 5)) {
  console.error(`Node ${process.versions.node}: building the executable needs Node >= 25.5 (node --build-sea).`);
  process.exit(1);
}
// The executable is this Node binary plus the bundle. Distribution builds of Node (Arch, Fedora, Homebrew …)
// often link OpenSSL, libuv, ICU … from the system – such an executable only runs on that exact system.
const shared = Object.entries(process.config.variables)
  .filter(([k, v]) => k.startsWith('node_shared_') && v === true)
  .map(([k]) => k.slice('node_shared_'.length));
if (shared.length && !process.argv.includes('--allow-shared-libs')) {
  console.error(
    `This Node.js (${process.execPath}) uses system libraries (${shared.join(', ')}); the executable would not run on\n` +
      'other computers. Use an official build from nodejs.org (e.g. via nvm, fnm or actions/setup-node), or pass\n' +
      '--allow-shared-libs for a build that only runs here.',
  );
  process.exit(1);
}
if (!fs.existsSync(path.join(pluginDir, 'config.json'))) {
  console.error('dist/worksheet-assistant is missing – run bash scripts/build.sh first.');
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

console.log('==> Bundling server and companion');
const bundle = path.join(out, 'companion.cjs');
const result = await esbuild.build({
  metafile: true,
  entryPoints: [path.join(root, 'scripts', 'companion-entry.mjs')],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  // Optional native speed-ups of "ws"; not needed.
  external: ['bufferutil', 'utf-8-validate'],
  // The bundle never uses import.meta (paths come from the executable); see proxy/src/abc.ts and server.ts.
  define: { 'import.meta.url': 'undefined' },
  nodePaths: [path.join(root, 'proxy', 'node_modules')],
  legalComments: 'external',
  logLevel: 'warning',
});

console.log('==> Third-party licenses');
// Every npm package that ended up in the bundle, with its license text, plus Node.js (the executable's runtime).
const packages = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  const m = /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(input.split(path.sep).join('/'));
  if (m) packages.set(m[1], path.resolve(root, m[1]));
}
const notices = [];
for (const dir of [...packages.values()].sort()) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const licFile = fs.readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  const text = licFile ? fs.readFileSync(path.join(dir, licFile), 'utf8').trim() : `License: ${pkg.license ?? 'see package'}`;
  notices.push(`${pkg.name} ${pkg.version} (${pkg.license ?? '?'})\n${'-'.repeat(60)}\n${text}\n`);
}
const nodeLicense = [path.join(path.dirname(process.execPath), '..', 'LICENSE'), '/usr/share/licenses/nodejs/LICENSE', '/usr/share/doc/nodejs/LICENSE']
  .find((f) => fs.existsSync(f));
notices.push(
  `Node.js ${process.version} (MIT and others) – the runtime contained in the executable\n${'-'.repeat(60)}\n` +
    (nodeLicense ? fs.readFileSync(nodeLicense, 'utf8').trim() : 'https://github.com/nodejs/node/blob/main/LICENSE') +
    '\n',
);
const thirdParty = path.join(out, 'THIRD-PARTY-LICENSES.txt');
fs.writeFileSync(thirdParty, `Arbeitsblatt-Assistent companion – third-party software\n\n${notices.join('\n')}`);
console.log(`    ${packages.size} npm packages + Node.js`);

console.log('==> Embedding the plugin');
const files = {};
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else files[path.relative(pluginDir, full).split(path.sep).join('/')] = fs.readFileSync(full).toString('base64');
  }
})(pluginDir);
const assets = path.join(out, 'plugin.json');
fs.writeFileSync(assets, JSON.stringify(files));

console.log('==> Building the single executable');
const exe = path.join(out, exeName);
const seaConfig = path.join(out, 'sea-config.json');
fs.writeFileSync(
  seaConfig,
  JSON.stringify({
    main: bundle,
    output: exe,
    disableExperimentalSEAWarning: true,
    useCodeCache: false,
    useSnapshot: false,
    assets: { 'plugin.json': assets },
  }),
);
execFileSync(process.execPath, ['--build-sea', seaConfig], { stdio: 'inherit' });
if (process.platform === 'darwin') execFileSync('codesign', ['--sign', '-', '--force', exe], { stdio: 'inherit' });

console.log('==> Archive');
fs.rmSync(archive, { force: true });
const readme = path.join(out, 'LIESMICH.txt');
fs.writeFileSync(
  readme,
  [
    'Arbeitsblatt-Assistent – Begleitprogramm für die Euro-Office-Desktop-App',
    '',
    '1. Euro-Office oder Nextcloud Office (Desktop) installieren und einmal starten.',
    `2. ${exeName} starten. Das Programm installiert das Plugin und öffnet seine Einstellungen im Browser`,
    '   (http://127.0.0.1:8787/): KI-Anbieter und API-Schlüssel für den Chat, MCP für Claude & Co., Autostart.',
    '3. Desktop-App neu starten, Dokument öffnen: Plugins → Arbeitsblatt-Assistent.',
    '',
    'macOS: beim ersten Start Rechtsklick → Öffnen (das Programm ist nicht notariell beglaubigt).',
    'Windows: SmartScreen → „Weitere Informationen“ → „Trotzdem ausführen“.',
    '',
    'Hilfe: arbeitsblatt-assistent help · https://github.com/felixwochnick/eurooffice-music-notation-plugin',
    '',
  ].join(process.platform === 'win32' ? '\r\n' : '\n'),
);
for (const lic of ['LICENSE']) fs.copyFileSync(path.join(root, lic), path.join(out, 'LICENSE.txt'));
const licDir = path.join(pluginDir, 'licenses');
if (process.platform === 'win32') {
  execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${exe}','${readme}','${path.join(out, 'LICENSE.txt')}','${thirdParty}','${licDir}' -DestinationPath '${archive}'`], { stdio: 'inherit' });
} else if (hasZip) {
  execFileSync('zip', ['-qj', archive, exe, readme, path.join(out, 'LICENSE.txt'), thirdParty], { stdio: 'inherit' });
  execFileSync('zip', ['-qr', archive, 'licenses'], { cwd: pluginDir, stdio: 'inherit' });
} else {
  fs.cpSync(licDir, path.join(out, 'licenses'), { recursive: true });
  execFileSync('tar', ['-czf', archive, '-C', out, exeName, 'LIESMICH.txt', 'LICENSE.txt', 'THIRD-PARTY-LICENSES.txt', 'licenses'], { stdio: 'inherit' });
}
const size = (f) => `${(fs.statSync(f).size / 1048576).toFixed(1)} MB`;
console.log(`    ${path.relative(root, exe)} (${size(exe)})`);
console.log(`    ${path.relative(root, archive)} (${size(archive)})`);
