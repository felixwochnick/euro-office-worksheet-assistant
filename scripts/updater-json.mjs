#!/usr/bin/env node
/*
 * latest.json for the desktop app's updater from the per-platform entries of scripts/collect-desktop.mjs.
 * The app reads it from https://github.com/<repo>/releases/latest/download/latest.json.
 *
 *   node scripts/updater-json.mjs <dir with updater-*.json> <tag, e.g. v0.6.0> <owner/repo> > latest.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [dir, tag, repo] = process.argv.slice(2);
if (!dir || !tag || !repo) {
  console.error('usage: node scripts/updater-json.mjs <dir> <tag> <owner/repo>');
  process.exit(2);
}
const version = tag.replace(/^v/, '');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Release notes: the section "## <version>" of CHANGELOG.md (shown in the app before updating).
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8').split('\n');
const start = changelog.findIndex((l) => new RegExp(`^## ${version.replace(/\./g, '\\.')}( |$)`).test(l));
let notes = '';
if (start !== -1) {
  const end = changelog.findIndex((l, i) => i > start && l.startsWith('## '));
  notes = changelog.slice(start + 1, end === -1 ? undefined : end).join('\n').trim();
}

const platforms = {};
for (const f of fs.readdirSync(dir).filter((f) => /^updater-.+\.json$/.test(f)).sort()) {
  const e = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  platforms[e.platform] = {
    signature: e.signature,
    url: `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(e.file)}`,
  };
}
if (!Object.keys(platforms).length) {
  console.error(`No updater-*.json in ${dir}`);
  process.exit(1);
}
process.stdout.write(JSON.stringify({ version, notes, pub_date: new Date().toISOString(), platforms }, null, 2) + '\n');
