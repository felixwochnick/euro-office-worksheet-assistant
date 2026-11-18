# Vendored third-party files

These files are bundled into the plugin because the Euro-Office `sdkjs-plugins`
directory in Nextcloud AIO is empty (no shared `v1/plugins.js`).
`scripts/build.sh` copies them into `dist/`; `scripts/build.sh --update-vendor`
re-downloads them (and prints new checksums – update this file afterwards).

| File | Source | Version | License | SHA-256 |
|------|--------|---------|---------|---------|
| `onlyoffice/plugins.js` | https://github.com/ONLYOFFICE/onlyoffice.github.io/tree/94927418d89373a647b99100a40cc57d08da44e2/sdkjs-plugins/v1 | commit `94927418d89373a647b99100a40cc57d08da44e2` | AGPL-3.0 (see `onlyoffice/LICENSE`) | `ae69fdbb8133ee8ee0df509788167a6ab5d1f6b0eeae1eb8a6f8c627bf79d3c1` |
| `onlyoffice/plugins-ui.js` | same as above | same | AGPL-3.0 | `4896dd856c75b7efb764447295582a3c0c93769c1f3b3574ac256f6bf33f6f5a` |
| `abcjs/abcjs-basic-min.js` | npm `abcjs` (`dist/abcjs-basic-min.js`) | 6.7.2 | MIT (see `abcjs/LICENSE.md`) | `3290ef44c918d5e882029d3a47ad3dd63c16c8819da5abe921f3d1e642b4f4f0` |
