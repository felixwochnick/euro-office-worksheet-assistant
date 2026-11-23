#!/usr/bin/env node
/*
 * Browser check of the 3D scenes (block scene_3d) with the built plugin files: the line drawing, the coloured
 * version (three.js/WebGL) and the fallback without WebGL. No editor and no proxy needed.
 *
 * Prerequisites: pnpm install, bash scripts/build.sh, a Chromium/Chrome binary (CHROMIUM_PATH, default /usr/bin/chromium).
 *
 *   node apps/plugin/harness/scene3d-check.mjs [<directory for PNG files>]
 */
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dist = path.join(root, 'dist', 'worksheet-assistant');
const shots = process.argv[2];
const SCRIPTS = ['vendor/three.min.js', 'js/worksheet-themes.js', 'js/worksheet-generators.js', 'js/worksheet-svg.js', 'js/worksheet-diagrams.js',
  'js/worksheet-3d.js', 'js/german-syllables.js', 'js/worksheet-layout.js', 'js/renderer.js', 'js/scene3d.js', 'js/blocks.js'];
for (const s of SCRIPTS) if (!fs.existsSync(path.join(dist, s))) throw new Error(`dist/worksheet-assistant/${s} is missing – run bash scripts/build.sh`);

const page = `<!doctype html><meta charset="utf-8"><body>${SCRIPTS.map((s) => `<script src="/${s}"></script>`).join('')}</body>`;
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(page);
  }
  const file = path.join(dist, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(dist) || !fs.existsSync(file)) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const SCENE = {
  type: 'scene_3d',
  bodies: [
    { id: 'haus', shape: 'cuboid', size: [3, 2, 3], at: [0, 0] },
    { shape: 'triangular_prism', lying: true, size: [3, 1.2, 3], on: 'haus' },
    { id: 'turm', shape: 'cylinder', radius: 1, height: 4, at: [5, 1] },
    { shape: 'cone', radius: 1.2, height: 2, on: 'turm' },
    { shape: 'sphere', radius: 1, at: [-3, 2], label: '3' },
    { shape: 'pyramid', size: [2, 1.5, 2], at: [2.5, -3] },
  ],
};

/** Runs in the page: compose + rasterise one scene, count coloured pixels of the PNG. */
async function run(block) {
  const composed = window.WorksheetLayout.compose([block], { theme: 'modern', lang: 'de', textWidthMm: 170 });
  const warnings = composed.warnings.slice();
  await window.WorksheetDoc.rasterize(composed.elements, { dpi: 150 }, warnings);
  const img = window.WorksheetLayout.collectImages(composed.elements)[0];
  const el = new Image();
  await new Promise((res, rej) => { el.onload = res; el.onerror = rej; el.src = img.dataUrl; });
  const c = document.createElement('canvas');
  c.width = el.naturalWidth;
  c.height = el.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(el, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let colored = 0;
  let dark = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const max = Math.max(d[i], d[i + 1], d[i + 2]);
    const min = Math.min(d[i], d[i + 1], d[i + 2]);
    if (max - min > 60) colored++;
    if (max < 90) dark++;
  }
  return { colored: colored / (c.width * c.height), dark: dark / (c.width * c.height), width: c.width, height: c.height, warnings, dataUrl: img.dataUrl };
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
let failed = false;
try {
  const p = await browser.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base);
  await p.waitForFunction(() => window.WorksheetDoc && window.Scene3dRenderer && window.THREE);

  const outline = await p.evaluate(run, SCENE);
  const colored = await p.evaluate(run, { ...SCENE, style: 'colored' });
  // fallback: WebGL is not available
  await p.evaluate(() => { window.Scene3dRenderer.available = () => false; });
  const fallback = await p.evaluate(run, { ...SCENE, style: 'colored' });

  if (shots) {
    for (const [name, r] of Object.entries({ outline, colored, fallback })) {
      fs.writeFileSync(path.join(shots, `scene3d-${name}.png`), Buffer.from(r.dataUrl.split(',')[1], 'base64'));
    }
  }
  console.log('outline ', outline.width, 'x', outline.height, 'coloured', outline.colored.toFixed(3), 'dark', outline.dark.toFixed(3), outline.warnings);
  console.log('colored ', colored.width, 'x', colored.height, 'coloured', colored.colored.toFixed(3), 'dark', colored.dark.toFixed(3), colored.warnings);
  console.log('fallback', fallback.width, 'x', fallback.height, 'coloured', fallback.colored.toFixed(3), fallback.warnings);

  assert.equal(outline.colored, 0, 'the colouring picture has no colour');
  assert.ok(outline.dark > 0.005, 'the colouring picture has lines');
  assert.deepEqual(outline.warnings, []);
  assert.ok(colored.colored > 0.15, 'the coloured version is coloured');
  assert.ok(colored.dark > 0.003, 'the coloured version keeps its outlines');
  assert.deepEqual(colored.warnings, []);
  assert.equal(colored.width, outline.width);
  assert.equal(fallback.colored, 0, 'fallback: the line drawing');
  assert.match(fallback.warnings.join('\n'), /needs WebGL/);
  assert.deepEqual(errors, []);
  console.log('scene3d check passed');
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
