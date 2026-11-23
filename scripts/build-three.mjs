#!/usr/bin/env node
/*
 * Build the vendored three.js bundle of the plugin: vendor/three/three.min.js (global `THREE`) and
 * vendor/three/LICENSE, from the npm package `three` (exact version in the root package.json).
 *
 * The plugin only needs a few classes for the coloured 3D scenes (apps/plugin/src/js/scene3d.js); esbuild
 * bundles just those (tree-shaken, minified). scripts/build.sh --update-vendor runs this script.
 *
 *   pnpm install
 *   node scripts/build-three.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
// "three" exports no ./package.json: go up from its CommonJS entry (build/three.cjs)
const pkgDir = path.resolve(path.dirname(require.resolve('three')), '..');
const version = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version;
const outDir = path.join(root, 'vendor', 'three');

// Keep in sync with what apps/plugin/src/js/scene3d.js uses.
const EXPORTS = [
  'AmbientLight', 'BufferGeometry', 'Camera', 'ConeGeometry', 'CylinderGeometry', 'DirectionalLight', 'DoubleSide',
  'Float32BufferAttribute', 'Mesh', 'MeshLambertMaterial', 'REVISION', 'Scene', 'SphereGeometry', 'WebGLRenderer',
];

const result = await esbuild.build({
  stdin: { contents: `export { ${EXPORTS.join(', ')} } from 'three';`, resolveDir: root, loader: 'js' },
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: 'THREE',
  target: 'es2018',
  legalComments: 'none',
  write: false,
  banner: { js: `/* three.js ${version} (https://threejs.org) – MIT License, see LICENSE. Subset for the worksheet assistant: ${EXPORTS.join(', ')}. */` },
});
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'three.min.js'), result.outputFiles[0].text);
fs.copyFileSync(path.join(pkgDir, 'LICENSE'), path.join(outDir, 'LICENSE'));
console.log(`vendor/three/three.min.js: three ${version}, ${Math.round(result.outputFiles[0].contents.length / 1024)} KB`);
