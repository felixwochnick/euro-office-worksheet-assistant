# Vendored third-party files

These files are bundled into the plugin because the Euro-Office `sdkjs-plugins`
directory in Nextcloud AIO is empty (no shared `v1/plugins.js`).
`scripts/build.sh` copies them into `dist/`; `scripts/build.sh --update-vendor`
re-downloads them, rebuilds the three.js subset (and prints new checksums – update this file afterwards).

| File | Source | Version | License | SHA-256 |
|------|--------|---------|---------|---------|
| `onlyoffice/plugins.js` | https://github.com/ONLYOFFICE/onlyoffice.github.io/tree/94927418d89373a647b99100a40cc57d08da44e2/sdkjs-plugins/v1 | commit `94927418d89373a647b99100a40cc57d08da44e2` | AGPL-3.0 (see `onlyoffice/LICENSE`) | `ae69fdbb8133ee8ee0df509788167a6ab5d1f6b0eeae1eb8a6f8c627bf79d3c1` |
| `onlyoffice/plugins-ui.js` | same as above | same | AGPL-3.0 | `4896dd856c75b7efb764447295582a3c0c93769c1f3b3574ac256f6bf33f6f5a` |
| `abcjs/abcjs-basic-min.js` | npm `abcjs` (`dist/abcjs-basic-min.js`) | 6.7.2 | MIT (see `abcjs/LICENSE.md`) | `3290ef44c918d5e882029d3a47ad3dd63c16c8819da5abe921f3d1e642b4f4f0` |
| `qrcode-generator/qrcode.js` | npm `qrcode-generator` (`dist/qrcode.js`); `LICENSE` from https://github.com/kazuhikoarase/qrcode-generator at the release commit `83b7e8fe3fddd3b0368dbafd6ce56995bd25e3c8` (the npm package has none) | 2.0.4 | MIT (see `qrcode-generator/LICENSE`) | `79ec86f82856005b1c887905cfccfcfbec3821ca61c7fd5a952faa5f778f791c` |
| `dagre/dagre.min.js` | npm `@dagrejs/dagre` (`dist/dagre.min.js`, the browser build with `@dagrejs/graphlib` 4.0.6 bundled in; same author and licence text); `LICENSE` from the npm package. Node.js (proxy, desktop app, tests) uses the npm package `@dagrejs/dagre` of the same version (dependency of `packages/shared`) | 3.1.2 | MIT (see `dagre/LICENSE`) | `ebd059beec31af9281760465c70a859401ef44010386fcc0718349398737a96c` |
| `three/three.min.js` | npm `three`, a subset (the classes `apps/plugin/src/js/scene3d.js` uses: WebGL renderer, lights, Lambert material, sphere/cylinder/cone geometry) bundled and minified with esbuild by `scripts/build-three.mjs` (global `THREE`); `LICENSE` from the npm package. The version is the root devDependency `three`; only the plugin uses three.js (coloured 3D scenes) | 0.187.0 | MIT (see `three/LICENSE`) | `9857d5a55ac64ea1e90c0bd1447476a969e1574717bbbc4b3fb676af25a4e1f0` |
