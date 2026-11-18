# Euro-Office Music Notation Plugin ("Noten-Assistent")

A panel plugin for the **Euro-Office** web editor (a fork of ONLYOFFICE Docs, same plugin API) that inserts
music staves into text documents – for example worksheets for music lessons.

- **AI chat in the side panel** – e.g. *"Füge unter Aufgabe 2 eine Notenzeile mit c – f – g im Violinschlüssel ein
  und darunter eine leere Zeile zum Nachschreiben"*. The AI sees the document outline and the cursor position and
  calls tools that the plugin executes locally in the editor.
- **Manual mode without AI** – ABC editor with live preview, templates (empty treble/bass staff, example melody,
  scales) and a converter for German note names (`c – f – g`, `fis' g' a' h'`, …).
- **Printable images** – ABC is rendered with [abcjs](https://www.abcjs.net/) to SVG and rasterised to PNG at
  300 dpi. The **ABC source is stored as the image alt text**, so a staff can be selected later, loaded back into the
  panel, edited and replaced.
- **Small LLM proxy** (Node/TypeScript, Fastify) that keeps the API key on the server, solves CORS and runs the
  tool-calling agent loop. Providers: **Mistral** (default), any **OpenAI-compatible** API (e.g. Ollama),
  **Anthropic**, plus a deterministic **mock** for tests and demos.

The UI language is German (i18n-ready, English included).

```
┌──────────── Euro-Office editor (browser) ─────────────┐        ┌──────── proxy/ ────────┐
│  document  ◄── callCommand / executeMethod ──┐        │        │  POST /v1/chat         │
│                                              │        │ HTTPS  │  system prompt + tools │
│  plugin panel (iframe)                       │        │ token  │  ABC validation        │──► Mistral /
│   chat · manual ABC · settings ──────────────┼────────┼──────► │  convert_german_notes  │    OpenAI-compatible /
│   abcjs → SVG → canvas → PNG (300 dpi)       │        │ CORS   │  agent loop (max N)    │    Anthropic / mock
└──────────────────────────────────────────────┘────────┘        └────────────────────────┘
```

## Repository layout

| Path | Content |
|------|---------|
| `plugin/` | Plugin source: `config.json`, `index.html`, `css/`, `js/`, icons |
| `shared/abc-tools.js` | ABC validation/normalisation and German note names → ABC (used by plugin **and** proxy) |
| `vendor/` | Pinned third-party files: ONLYOFFICE `v1/plugins.js` + `plugins-ui.js`, `abcjs-basic-min.js` (see `vendor/SOURCES.md`) |
| `proxy/` | LLM proxy (TypeScript), `Dockerfile`, `docker-compose.yml`, `.env.example` |
| `deploy/` | Example compose: Euro-Office as its own container with the plugin as a volume, plus the proxy |
| `harness/` | Local test harness (mocked `window.Asc.plugin` and builder API) and an end-to-end test |
| `scripts/build.sh` | Builds `dist/music-notation/` and `dist/music-notation.plugin` |
| `tests/` | Unit tests (ABC validation, German note names) |

## Build

Requirements: bash, Node.js ≥ 22 (only for the config check and tests), `zip` or `python3`.

```bash
bash scripts/build.sh                  # uses the pinned copies in vendor/ (checksums are verified)
bash scripts/build.sh --update-vendor  # re-downloads abcjs and plugins.js/plugins-ui.js, then builds
```

Result:

- `dist/music-notation/` – the plugin folder (copy this into `sdkjs-plugins/`)
- `dist/music-notation.plugin` – the same as ZIP with `config.json` at the root (for editors with a plugin manager)

## Test installation in Nextcloud AIO

The AIO container `nextcloud-aio-eurooffice` serves plugins from
`/var/www/euro-office/documentserver/sdkjs-plugins`. That folder is empty by default – there is no plugin
manager and no shared `v1/plugins.js` – which is why the plugin ships everything it needs.

```bash
bash scripts/build.sh
docker cp dist/music-notation nextcloud-aio-eurooffice:/var/www/euro-office/documentserver/sdkjs-plugins/
# check
docker exec nextcloud-aio-eurooffice ls /var/www/euro-office/documentserver/sdkjs-plugins/music-notation
```

Then **reload the editor** in the browser (close and reopen the document; a hard reload with Ctrl+Shift+R helps
against cached plugin lists). The plugin appears under the *Plugins* tab as **Noten-Assistent** and opens as a
side panel.

> ⚠️ **AIO updates recreate the container and empty the folder again.** Repeat the `docker cp` after every
> update – or use the permanent setup below.

## Permanent setup: Euro-Office as its own container

Run the Euro-Office Document Server yourself (e.g. in [Coolify](https://coolify.io/) or plain Docker Compose) and
mount the plugin folder as a volume. Nextcloud uses it as an **external Document Server**.

```bash
bash scripts/build.sh
cd deploy
cp .env.example .env      # set JWT_SECRET, PROXY_TOKEN, CORS_ORIGINS, LLM_API_KEY
docker compose up -d
```

`deploy/docker-compose.yml` starts

- `eurooffice` – image `ghcr.io/euro-office/documentserver` (pin `EUROOFFICE_VERSION` in production) with
  JWT enabled, data/log volumes and `dist/music-notation` mounted read-only into
  `/var/www/euro-office/documentserver/sdkjs-plugins/music-notation`,
- `music-proxy` – the LLM proxy (see below).

Both ports are published on `127.0.0.1` only; remove the `ports:` entries when the reverse proxy reaches the
containers through the Docker network (as in Coolify). Set `TRUST_PROXY` to the reverse proxy's IP/CIDR – not to
`true` – so clients cannot spoof `X-Forwarded-For` to bypass the rate limit.

Put a TLS reverse proxy in front (Coolify does this automatically), e.g. `https://office.example.org` → `eurooffice:80`
and `https://notes-proxy.example.org` → `music-proxy:8787`. In Nextcloud, disable the AIO-internal office
integration and enter the Document Server URL (`https://office.example.org/`) and the same JWT secret in the
Euro-Office/ONLYOFFICE connector settings (*Administration settings → Office*). Both sides must use the same
`JWT_SECRET`.

In Coolify you can use the compose file as a "Docker Compose" resource; set `PLUGIN_DIR` to an absolute host path
(e.g. `/opt/eurooffice-plugins/music-notation`) and copy `dist/music-notation` there. Updating the plugin = replacing
that folder and reloading the editor – no container rebuild needed.

## Proxy deployment

```bash
cd proxy
cp .env.example .env      # edit: PROXY_TOKEN, CORS_ORIGINS, LLM_* (never commit .env)
docker compose up -d --build
curl http://localhost:8787/healthz           # {"ok":true}
curl -H "Authorization: Bearer $TOKEN" http://localhost:8787/v1/info
```

The image is built from the repository root (the proxy uses `shared/abc-tools.js`); `docker compose` handles that.
Without Docker: `cd proxy && npm ci && npm run build && node --env-file=.env build/src/server.js`.

| Variable | Default | Meaning |
|----------|---------|---------|
| `PROXY_TOKEN` | – (required) | Shared secret, min. 16 characters. The plugin sends it as `Authorization: Bearer …`. `openssl rand -hex 24` |
| `CORS_ORIGINS` | – | Comma-separated allowlist of browser origins, i.e. the origin that serves the editor (your Euro-Office / Nextcloud domain, e.g. `https://cloud.example.org`). `*` only for testing |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW` | `30` / `1 minute` | Requests per IP and window |
| `TRUST_PROXY` | `false` | IP/CIDR of your reverse proxy (e.g. `172.16.0.0/12`) so the rate limit sees real client IPs. Avoid `true` when the port is reachable directly – clients could spoof `X-Forwarded-For` |
| `LLM_PROVIDER` | `mistral` | `mistral`, `openai` (any OpenAI-compatible API), `anthropic`, `mock` |
| `LLM_MODEL` | provider default | e.g. `mistral-large-latest`, `qwen2.5:7b`, `claude-sonnet-5-5` |
| `LLM_API_KEY` | – | Provider key (alternatively `MISTRAL_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) |
| `LLM_BASE_URL` | provider default | e.g. `http://ollama:11434/v1` for Ollama |
| `LLM_TEMPERATURE`, `LLM_MAX_TOKENS`, `LLM_TIMEOUT_MS` | `0.2`, `2048`, `60000` | Model parameters |
| `MAX_ITERATIONS` | `6` | Max. tool rounds per user message; afterwards the model must answer in text |
| `BODY_LIMIT_BYTES`, `PORT`, `HOST`, `LOG_LEVEL` | `1000000`, `8787`, `0.0.0.0`, `info` | Server settings |

Local model with Ollama: `docker compose --profile ollama up -d`, `docker compose exec ollama ollama pull qwen2.5:7b`,
then `LLM_PROVIDER=openai`, `LLM_BASE_URL=http://ollama:11434/v1`, `LLM_MODEL=qwen2.5:7b`. Small local models are
noticeably less reliable with tool calls and ABC than large hosted models.

Serve the proxy via HTTPS: the editor runs on HTTPS and browsers block requests from HTTPS pages to plain HTTP
(mixed content), except to `localhost`.

### Protocol

The plugin keeps the conversation; the proxy is stateless.

```
POST /v1/chat   Authorization: Bearer <PROXY_TOKEN>
{ "messages": [ {role:"user", content} | {role:"assistant", content, tool_calls:[{id,name,arguments}]}
                | {role:"tool", tool_call_id, name, content:"<json>"} ],
  "document_context": { "elements": [{index, type, text, style, is_heading, heading_level, has_image, abc}],
                        "cursor_index": 3, "total_elements": 12 } }
→ { "messages": [...new messages...], "pending_tool_calls": [...], "done": false, "iterations": 1, "max_iterations": 6 }
```

Tools offered to the model (JSON Schema in `proxy/src/tools.ts`):

| Tool | Executed by | Purpose |
|------|-------------|---------|
| `insert_staff({abc, width_cm, position})` | plugin | render ABC and insert it as an image; `position` = `"cursor"` \| `{after_heading}` \| `{after_paragraph_index}` |
| `insert_empty_staves({clef, count, measures, width_cm, position})` | plugin | empty staves made of invisible rests (`x`) |
| `get_document_outline()` | plugin | headings/paragraphs with indices, cursor, ABC of existing staves |
| `convert_german_notes({notes, clef})` | proxy | deterministic German note names → ABC |

ABC in `insert_staff` is validated on the proxy (headers `X: M: L: K:` incl. `clef=`, no German `h`/`fis` in the
body, balanced brackets …). Invalid ABC is sent back to the model with the errors instead of reaching the editor.

## Plugin settings

Tab **Einstellungen** (stored in the browser's `localStorage`; falls back to in-memory if storage is blocked):

- **Proxy-URL** and **Zugangs-Token** – "Verbindung testen" calls `/v1/info`
- **Automatisch einfügen** – otherwise every AI insertion is shown as a preview with *Einfügen* / *Verwerfen*
- default width (cm), resolution (dpi), **Einfügemethode** (see Known limitations), language

## Example prompts for teachers

- „Füge unter Aufgabe 2 eine Notenzeile mit c – f – g im Violinschlüssel ein und darunter eine leere Zeile zum Nachschreiben.“
- „Setze an die Cursorposition die C-Dur-Tonleiter aufwärts in Vierteln, 4/4-Takt.“
- „Schreibe den Anfang von ‚Alle meine Entchen‘ in G-Dur unter die Überschrift ‚Transponieren‘.“
- „Füge nach Aufgabe 3 drei leere Notenzeilen im Bassschlüssel ohne Taktstriche ein.“
- „Erstelle eine 12 cm breite Notenzeile mit den Tönen fis' – a' – cis'' – e''.“
- „Welche Töne stehen in der Notenzeile unter Aufgabe 1?“ (the AI reads the ABC from the alt text)
- „Schreibe einen Rhythmus im 3/4-Takt: Halbe, Viertel | punktierte Halbe – alles auf g'.“

## ABC notation cheat sheet

```
X:1                 tune number (always first)
T:Aufgabe 2         title (optional)
M:4/4               meter: 3/4, 6/8, C, none
L:1/4               unit note length (here: quarter note)
K:C clef=treble     key + clef (always last header line); clef=bass for Bassschlüssel
C D E F | G2 G2 |]  the music
```

| German | ABC | | German | ABC |
|--------|-----|-|--------|-----|
| c' (eingestrichenes c, middle C) | `C` | | große Oktave C | `C,,` |
| c'' | `c` | | kleine Oktave c | `C,` |
| c''' | `c'` | | h' | `B` |
| fis' / cis' | `^F` / `^C` | | b' (= B flat) | `_B` |
| es' / as' / des' | `_E` / `_A` / `_D` | | Auflösungszeichen | `=F` |

Durations relative to `L:1/4`: `C` quarter, `C2` half, `C4` whole, `C/2` or `C/` eighth, `C3` dotted half,
`C>D` dotted rhythm. Rests: `z` (visible), `x` (invisible). Bar lines: `|`, double `||`, final `|]`, repeat `:|`.
Chords: `[CEG]`. Ties: `C2-C`. Lyrics line below the notes: `w: Al-le mei-ne Ent-chen`.

The German converter in the manual tab (and the AI tool) understands `c d e f g a h`, `b` = B flat,
`-is`/`-es` (incl. `es`, `as`, `heses`), octave marks `c'`, `c''`, `c1`, `c²`, `C`, `C,`, and `|` bar lines. Note names
without octave marks are placed in the one-line octave for treble clef (`c` → c') and in the small octave for bass clef.
Commas separate notes only in lists of lower-case names (`c, f, g`); after upper-case names they are Helmholtz octave
marks (`G, A, H,` = Kontra-Oktave).

## Development

```bash
npm install                 # root: playwright-core for the e2e test (no browser download)
(cd proxy && npm install)
npm test                    # unit tests (shared ABC helpers) + proxy tests (agent loop, providers, server)
```

### Local test harness (no Euro-Office needed)

```bash
bash scripts/build.sh
node scripts/serve.mjs 8080          # http://localhost:8080/harness/
cd proxy && cp .env.example .env     # set LLM_PROVIDER=mock, PROXY_TOKEN=dev-token-change-me-0123,
docker compose up -d                 #     CORS_ORIGINS=http://localhost:8080
```

`harness/index.html` loads the built plugin in an iframe, answers the `plugin_init` handshake of `plugins.js` and
installs mocked `callCommand`/`executeMethod` plus a fake builder API (`Api.GetDocument`, `CreateImage`, …) backed by
an in-memory document shown on the left. Commands are re-created from their source and run with a JSON copy of
`Asc.scope`, like in the real editor. Checkboxes simulate a failing `Api.CreateImage` and an older API without
`SetDescription`/`GetCurrentParagraph` to exercise the fallbacks. With the mock provider the chat understands requests
like the example above; with a real provider key the harness talks to the real model.

`npm run e2e` drives the harness with Playwright (needs a Chromium binary, `CHROMIUM_PATH`, default
`/usr/bin/chromium`).

## Known limitations

The Euro-Office build used by Nextcloud AIO could not be tested directly while writing this plugin. The editor
calls were checked against the ONLYOFFICE `sdkjs` sources (`word/apiBuilder.js`, `common/apiBase_plugins.js`);
Euro-Office may differ. For every call that is not guaranteed, the plugin uses a **primary path plus fallbacks**:

- **Images from data URLs.** Primary: `Api.CreateImage(dataUrl, w, h)` inside `callCommand` (documented upstream as
  supporting "Base64 encoded images"). Fallbacks, in order: `executeMethod("PutImageDataToSelection")` and
  `executeMethod("PasteHtml", ['<img src="data:…">'])`. If `CreateImage` *succeeds* but the picture stays empty or is
  lost after saving, choose another **Einfügemethode** in the settings – such failures cannot be detected by the
  plugin.
- **Fallback positions.** The fallbacks can only insert at the cursor. For `after_heading`/`after_paragraph_index`
  the plugin first inserts an empty paragraph and moves the cursor into it (internal API); if that fails the image
  ends up at the cursor and the chat says so. `PutImageDataToSelection` replaces a currently *selected* image.
- **Alt text (ABC source).** `ApiDrawing.SetDescription` exists only since ONLYOFFICE 10.0; older builds use the
  internal `docPr.setDescr`. With `PasteHtml` the alt attribute may or may not be kept. Without alt text, staves can't
  be loaded back for editing.
- **Cursor position.** `ApiDocument.GetCurrentParagraph` exists since 9.0; otherwise the internal
  `CurPos.ContentPos` is read. The position is reported as a top-level element index (a table counts as one element);
  inside headers/footers it is unknown.
- **"Current page".** The builder API exposes no reliable page numbers. The AI gets the document outline (up to 300
  top-level elements around the cursor, text truncated), not a page view.
- **"unter Aufgabe 2".** `after_heading` inserts directly after the matching paragraph. Whether the staff should go
  after the task's instruction text is decided by the model from the outline.
- **Replace selected image** deletes the old drawing and appends the new one to the same paragraph; images that
  share a paragraph with text may move to its end.
- **Plugin discovery.** Plugins are picked up from `sdkjs-plugins` when the editor loads. If the plugin does not
  show up, clear the browser cache; some Document Server versions build their plugin list at container start, so a
  restart of the Document Server container may be needed.
- **Rendering.** abcjs fonts for titles/lyrics come from the browser; the PNG is a raster image (300 dpi by default,
  adjustable up to 600 dpi). Staves always span the full chosen width (`%%stretchlast`).
- **AI quality.** Even with validation the model may choose unexpected rhythms or octaves; check the preview (or
  disable *Automatisch einfügen*). Small local models often fail at tool calling.
- **Security.** The token is stored in the browser and therefore visible to the user of that browser – it protects
  the proxy against strangers, not against your own users. Use the rate limit and provider-side spending limits.

## Licenses

- This project: **MIT** (`LICENSE`).
- `vendor/onlyoffice/plugins.js`, `vendor/onlyoffice/plugins-ui.js`: © Ascensio System SIA, from
  [ONLYOFFICE/onlyoffice.github.io](https://github.com/ONLYOFFICE/onlyoffice.github.io/tree/master/sdkjs-plugins/v1),
  licensed under **AGPL-3.0** (`vendor/onlyoffice/LICENSE`). They are bundled unmodified as separate files and are
  *not* covered by the MIT license. If you distribute the built plugin, you distribute these AGPL files too – keep the
  license text (the build copies it to `dist/music-notation/licenses/`) and point to the source.
- `vendor/abcjs/abcjs-basic-min.js`: [abcjs](https://github.com/paulrosen/abcjs) © Paul Rosen and Gregory Dyke,
  **MIT** (`vendor/abcjs/LICENSE.md`).

Exact versions and checksums: `vendor/SOURCES.md`.
