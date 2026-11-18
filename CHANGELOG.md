# Changelog

## 0.4.0 – companion app for the desktop editors

- **New names:** the repository is now `euro-office-worksheet-assistant` (old links redirect; the website moved to
  https://felixwochnick.github.io/euro-office-worksheet-assistant/). The server image is
  `ghcr.io/felixwochnick/euro-office-worksheet-assistant` (the old `eurooffice-music-notation-proxy` image stays at
  0.1.0); Docker Compose services are called `worksheet-server`. All file names are English: the companion app is
  `worksheet-assistant`, its archives `worksheet-assistant-<os>-<arch>.zip` with a `README.txt`.
- **Companion app** `worksheet-assistant` (Windows, macOS, Linux; one executable built with Node.js SEA): installs
  the plugin into the Euro-Office and Nextcloud Office desktop apps, runs the server on `127.0.0.1` (AI chat with
  the user's own API key, MCP without sign-in) and offers a settings page (provider and key, MCP setup, autostart).
- The installed plugin connects to the companion automatically (`local-config.js` with address and token); MCP
  access is on by default there.
- `worksheet-assistant mcp-stdio`: MCP over stdin/stdout for Claude Desktop and other clients that start a
  command; it starts the companion if needed.
- Release packages `worksheet-assistant-<os>-<arch>.zip` (Linux x64/arm64, Windows x64, macOS arm64/x64) with
  the third-party licenses of everything bundled.
- Tested in the real desktop apps (Euro-Office and Nextcloud Office 9.3.8, Linux): installation before the first
  start, automatic connection, MCP over HTTP and stdio, reconnecting after restarts.
- Fixes found with Mistral: cloze gaps (`________`) no longer underline the text between two gaps; literal `\n` in
  worksheet texts becomes a line break; the chat shows the model's **bold** and lists instead of raw Markdown;
  temporary provider errors (429/5xx) are retried and shown as "Der KI-Anbieter ist gerade überlastet …"; the
  model no longer mistakes content it inserted for pre-existing content.


## 0.3.0 – MCP endpoint and sign-in with Nextcloud

- **MCP endpoint** (`<PUBLIC_URL>/mcp`, Streamable HTTP, stateless, MCP 2026-07-28 and 2025 clients): AI assistants
  such as Claude, ChatGPT or Le Chat read and edit the document that is open in Euro-Office – with the same tools as
  the chat (worksheet blocks, staves, lyrics, German note names) plus `list_open_documents`. Arguments are validated
  by the proxy before they reach the editor.
- **Plugin bridge**: with *MCP-Zugriff erlauben* the panel keeps a WebSocket to the proxy and executes the
  assistant's tool calls in the editor; every call is shown in the chat.
- **Sign-in modes** (`AUTH_MODE`): `token` (shared token, as before), `nextcloud` (each Nextcloud user signs in;
  MCP clients only reach their own editors) and `local` (one computer, loopback only, MCP without sign-in).
- **Nextcloud sign-in**: the plugin signs in with *Mit Nextcloud anmelden* (Login Flow v2); MCP clients use a
  Nextcloud app password or **OAuth via Nextcloud** – the proxy is the authorization server for MCP clients
  (metadata discovery, PKCE, dynamic client registration, client ID metadata documents, own consent page) and uses
  Nextcloud's OAuth2 app for the login. Revoking the access in Nextcloud ends it within an hour.
- `LLM_PROVIDER=none`: MCP only, no AI chat (*„entweder KI-API oder MCP“*).
- New public `GET /v1/meta`; the proxy image stores sign-ins in `/data` (volume).
- Hardening: wrong app passwords are throttled before they reach Nextcloud (its brute-force protection would block
  the proxy's IP for everybody); client ID metadata documents are fetched with private addresses refused at
  connection time and a 64 KB limit; no redirects before the user signed in; registered clients are stored only after
  the first sign-in; Nextcloud tokens of denied or abandoned sign-ins are revoked.
- Tested end-to-end against Nextcloud 34 (`dev/nextcloud/`) and Euro-Office 9.3.8.


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
