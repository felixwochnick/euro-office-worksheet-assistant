# Changelog

## 0.2.0 – Arbeitsblatt-Assistent

- **Renamed** to "Arbeitsblatt-Assistent" / "Worksheet Assistant": an AI assistant for worksheets of any subject;
  music staves are one feature. Same GUID; the plugin folder is now `worksheet-assistant` (the install script removes
  the old `music-notation` folder and service).
- **Worksheet blocks** (`insert_blocks`): headings, paragraphs with **bold**/*italic*/__underline__, numbered and
  bulleted lists, tables with a header row, writing lines, info boxes, staves, empty staves, page breaks, spacers –
  a whole worksheet in one step, with a preview in the chat.
- **Editing**: `get_elements`, `replace_elements`, `delete_elements` (deletions are confirmed in the chat).
- Outline shows list items and table sizes; an empty document is reported as empty.
- New system prompt for worksheets (structure, age-appropriate wording, solutions on request, no copyrighted texts);
  the AI answers in the user's language.
- Fixes found in the real editor: inherited bold formatting, bold heading styles overridden, adjacent tables
  merging, table cell texts with a trailing tab.
- Tested in Euro-Office 9.3.8 with Mistral: a one-page worksheet (3 tasks, tables, info box) in ~25 s, rewording a
  task for another grade, adding a solution page.


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
