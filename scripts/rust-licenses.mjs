#!/usr/bin/env node
/*
 * License texts of the Rust crates compiled into the desktop app (apps/desktop/src-tauri), for its
 * THIRD-PARTY-LICENSES.txt. Each distinct license text is printed once, with the crates that use it.
 *
 *   node scripts/rust-licenses.mjs <target triple> > licenses.txt
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
const meta = JSON.parse(
  execFileSync('cargo', ['metadata', '--format-version', '1', '--locked', ...(target ? ['--filter-platform', target] : [])], {
    cwd: path.join(root, 'apps', 'desktop', 'src-tauri'),
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  }),
);

// Crates linked into the app: the root's normal (not build or dev) dependencies, transitively.
const nodes = new Map(meta.resolve.nodes.map((n) => [n.id, n]));
const linked = new Set();
const stack = [meta.resolve.root];
while (stack.length) {
  const id = stack.pop();
  if (linked.has(id)) continue;
  linked.add(id);
  for (const d of nodes.get(id).deps) if (d.dep_kinds.some((k) => k.kind === null)) stack.push(d.pkg);
}

const texts = new Map(); // hash → { text, crates[] }
const without = [];
for (const p of meta.packages.filter((p) => linked.has(p.id) && p.id !== meta.resolve.root).sort((a, b) => a.name.localeCompare(b.name))) {
  const dir = path.dirname(p.manifest_path);
  const files = fs.readdirSync(dir).filter((f) => /^(licen[cs]e|copying|notice)/i.test(f) && fs.statSync(path.join(dir, f)).isFile());
  const label = `${p.name} ${p.version} (${p.license ?? 'see crate'})`;
  if (!files.length) {
    without.push(label);
    continue;
  }
  for (const f of files.sort()) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8').trim();
    const hash = crypto.createHash('sha256').update(text).digest('hex');
    if (!texts.has(hash)) texts.set(hash, { text, crates: [] });
    if (!texts.get(hash).crates.includes(label)) texts.get(hash).crates.push(label);
  }
}

const out = [`Rust crates in the desktop app (${linked.size - 1})`, ''];
for (const { text, crates } of [...texts.values()].sort((a, b) => b.crates.length - a.crates.length)) {
  out.push(crates.join('\n'), '-'.repeat(60), text, '', '');
}
if (without.length) out.push('Crates without a license file (license as declared):', ...without, '');
process.stdout.write(out.join('\n'));
