# Changelog

## 0.1.0 – first release

### Plugin („Noten-Assistent“)

- Side panel for the Euro-Office word editor (ONLYOFFICE plugin API, `type: panel` + `isInsideMode`), German UI,
  i18n-ready (English included). Ships its own copies of `plugins.js`, `plugins-ui.js` and abcjs – works with an
  empty `sdkjs-plugins` folder as in Nextcloud AIO.
- **AI chat**: insert staves and empty staves at the cursor, after a heading or after a paragraph; change existing
  staves („ändere Zeile 1: statt bc #c“, „die markierte Zeile …“); add song text and verses. Preview before
  inserting or automatic insertion.
- **Manual mode** without AI: ABC editor with live preview, templates, German note names → ABC, lyrics field,
  load / replace the selected staff.
- Printable images: abcjs → SVG → PNG (300 dpi). The ABC source is stored as alt text, so staves stay editable.
  Dense lines (e.g. with lyrics) are broken evenly by whole measures.
- German note names: `h`/`b`, `-is`/`-es`, accidentals in front (`bc`, `#f`), Helmholtz octaves, time
  signatures with automatic bar lines, digits as octave marks or note values (auto-detected and reported).
- Fallbacks for editor API differences (`Api.CreateImage` → `PutImageDataToSelection` → `PasteHtml`, internal alt
  text / cursor APIs for builds before ONLYOFFICE 10 / 9).

### Proxy (only needed for the AI chat)

- Fastify/TypeScript, Docker image. Keeps the API key on the server; shared token, CORS allowlist, rate limit.
- Providers: Mistral (default), OpenAI-compatible (e.g. Ollama), Anthropic, mock.
- Agent loop with iteration limit. Server-side tools `convert_german_notes` and `add_lyrics`. ABC and lyrics are
  validated before they reach the editor.
- Reasoning models: `reasoning_effort` (default `medium` for Mistral), larger token budget, clear message when an
  answer is cut off by the token limit.

### Installation & development

- `scripts/install-aio.sh`: installs the plugin into Nextcloud AIO's Euro-Office container; `--watch`
  re-installs it automatically after AIO updates (systemd + `docker events`).
- Release packages (`.tar.gz`, `.zip`, `.plugin`) and a multi-arch proxy image on GHCR.
- Test harness with mocked editor API and a local real Euro-Office test environment (`dev/eurooffice/`), unit and
  end-to-end tests, GitHub Actions CI.

Tested with Euro-Office 9.3.8 (`ghcr.io/euro-office/documentserver`) and Mistral `mistral-large-latest`.
Not yet tested inside a real Nextcloud AIO installation – see *Known limitations* in the README.
