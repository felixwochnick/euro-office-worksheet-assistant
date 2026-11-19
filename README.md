# Euro-Office Worksheet Assistant ("Arbeitsblatt-Assistent")

A panel plugin for the **Euro-Office** editor (a fork of ONLYOFFICE Docs, same plugin API) that creates and edits
**worksheets with AI** – for any subject: headings, instructions, cloze texts, lists, tables, writing lines, info
boxes, page breaks and **music staves** (ABC notation, rendered as printable images).

> Formerly "Noten-Assistent" (0.1, music staves only). The plugin keeps its GUID; `install-aio.sh` removes the old
> `music-notation` folder.

- **Whole worksheets by chat** – e.g. *"Erstelle ein Arbeitsblatt zum Wasserkreislauf für Klasse 5 mit drei
  Aufgaben, einer Tabelle und einem Merkkasten"*. The AI builds it from blocks (tool `insert_blocks`), shows a preview
  and inserts it at the cursor, after a heading/paragraph or at the end.
- **Designed worksheets** – every worksheet uses one consistent **design** (theme): *Klassisch* (black and white,
  toner-saving), *Modern* (blue accent) or *Grundschule* (large type, 1.5 line spacing, friendly colours). The AI only
  picks the theme; fonts, sizes, colours and spacing come from it. Title with subject and grade, name/class/date line,
  **task headers** with a number badge, work-form/activity symbols, difficulty stars and points, **info boxes** in
  seven variants (Merke, Tipp, Achtung, Beispiel, Definition, Lösung, Info) with icons.
- **Task types that look right** – cloze texts with an automatic word bank, multiple choice, true/false tables,
  matching (dots to connect or letters), **crosswords and word searches** (generated, always valid), reading texts
  with **line numbers**, **Silbenfärbung** (syllables alternately blue/red), self-assessment with smileys, cut-out
  hint cards, a points-to-grade table, two- or three-column layouts – each also as a solution version (`show_answers`).
- **Graphics** – number lines, coordinate systems, column/bar/line/pie charts (also empty for drawing), mind maps,
  QR codes, simple SVG drawings by the AI, German primary-school **lineatures** (Lineatur 1–4) and squared paper.
  Formulas are inserted as native, editable equations from LaTeX. Graphics keep their source in the alt text, so the
  AI can change them later.
- **Computer science diagrams (Informatik)** – UML **class diagrams** (classes, interfaces, abstract classes,
  enumerations, inheritance, associations with multiplicities, aggregation, composition), **object diagrams**,
  **sequence diagrams** (actors, calls, replies, object creation, activation bars, `alt`/`opt`/`loop` fragments),
  **state diagrams** and **finite automata** (DEA/NEA), **activity diagrams**, **use case diagrams**, **structograms**
  (Nassi-Shneiderman, DIN 66261), **flowcharts** (Programmablaufplan, DIN 66001) and **ER diagrams** (Chen, (min,max),
  crow's foot). The AI only describes the model; the layout is computed (dagre), so
  the diagrams look like those of the textbook and of [Klonk](https://github.com/felixwochnick/klonk). Every diagram
  also exists **to fill in** – gaps, writing lines, relations or transitions left out for students to draw, empty
  lines for members – with a matching **solution version** in the same layout. See
  [Computer science diagrams](#computer-science-diagrams).
- **Pictures** – worksheets for primary and special-needs schools need not be text only: the AI searches pictures
  (tool `search_images`) and places them (block `picture`, beside text with `columns`). Sources: **ARASAAC**
  pictograms (simple, consistent drawings made for special-needs teaching, German keywords), **Wikimedia Commons**
  (photos, drawings, historical pictures) and the teacher's **own pictures** – a folder in their Nextcloud
  (`Arbeitsblatt-Bilder`), e.g. comic panels for Latin or own photos. The licence credit of free pictures is printed
  under the picture automatically. See [Pictures](#pictures).
- **Page setup and house style** – paper size, orientation, margins, columns, header with school name and logo
  (from the settings) and footer with page numbers (tool `setup_page`).
- **Quality check** – after creating a worksheet the AI runs `check_worksheet`: task numbering, instructions, space
  for answers, points, solutions, leftover markup, readability for the grade (LIX) and the page layout (tasks split
  across pages, nearly empty last page) – and fixes what it finds. Headings and task headers are kept with the
  following content, so no task starts at the bottom of a page.
- **Edit existing content** – *"Ändere die Anweisung in Aufgabe 1 für Klasse 3"*, *"Füge am Ende eine Lösungsseite
  hinzu"*, *"Lösche Aufgabe 3"* (`get_elements`, `replace_elements`, `delete_elements`; deletions are confirmed).
- **AI chat in the side panel** – e.g. *"Füge unter Aufgabe 2 eine Notenzeile mit c – f – g im Violinschlüssel ein
  und darunter eine leere Zeile zum Nachschreiben"*. The AI sees the document outline and the cursor position and
  calls tools that the plugin executes locally in the editor.
- **Manual mode without AI** – ABC editor with live preview, templates (empty treble/bass staff, example melody
  with lyrics, scales), a converter for German note names (`c – f – g`, `fis' g' a' h'`, …) and a **lyrics field**
  that distributes syllables over the notes (also as additional verses).
- **Song text (lyrics)** – by chat („Füge zu Zeile 1 den Text hinzu: Hänschen klein ging allein“) or manually; the
  syllables are placed under the notes (ABC `w:` lines), dense lines are broken evenly by whole measures.
- **Printable images** – ABC is rendered with [abcjs](https://www.abcjs.net/) to SVG and rasterised to PNG at
  300 dpi. The **ABC source is stored as the image alt text**, so a staff can be selected later, loaded back into the
  panel, edited and replaced.
- **Change existing staves by chat** – „Bitte ändere Zeile 2: statt bc #c“ or „in der markierten Zeile …“: the AI
  edits the ABC of that staff and replaces it in place (tool `replace_staff`).
- **MCP endpoint** – *either* the built-in AI chat *or* your own AI assistant: Claude, ChatGPT, Le Chat or any
  other MCP client can read and edit the document that is open in Euro-Office (same tools as the chat). Sign-in
  with a Nextcloud app password or OAuth via Nextcloud; on a single computer without sign-in.
- **Small server** (`apps/server/`, Node/TypeScript, Fastify) that keeps the API key on the server, solves CORS, runs the
  tool-calling agent loop and serves the MCP endpoint. Providers: **Mistral** (default), any **OpenAI-compatible**
  API (e.g. Ollama), **Anthropic**, a deterministic **mock** for tests and demos – or **none** (MCP only).

The UI language is German (i18n-ready, English included).

```
┌──────────── Euro-Office editor (browser) ─────────────┐        ┌───── apps/server/ ─────┐
│  document  ◄── callCommand / executeMethod ──┐        │        │  POST /v1/chat         │
│                                              │        │ HTTPS  │  system prompt + tools │
│  plugin panel (iframe)                       │        │ token  │  ABC validation        │──► Mistral /
│   chat · manual ABC · settings ──────────────┼────────┼──────► │  convert_german_notes  │    OpenAI-compatible /
│   abcjs → SVG → canvas → PNG (300 dpi)       │        │ CORS   │  agent loop (max N)    │    Anthropic / mock
│   MCP bridge  ◄──────── WebSocket ───────────┼────────┼─────── │  GET /v1/bridge        │
└──────────────────────────────────────────────┘────────┘        │  POST /mcp  ◄──────────┼── Claude / ChatGPT /
                                                                 └────────────────────────┘   Le Chat (MCP clients)
```

## What runs where

The plugin itself needs **no server of its own**. Only the AI chat and the MCP endpoint need a small additional
service, the proxy.

| Component | What it is | Where it runs | Needed for | Resources |
|-----------|-----------|---------------|------------|-----------|
| **Plugin** (`worksheet-assistant/`) | Static files (HTML, JavaScript, icons, abcjs, qrcode-generator) | Served from the Document Server's `sdkjs-plugins` folder; **executed in the browser** inside the editor | Everything: inserting and editing worksheet content, rendering staves, lyrics, manual mode | ≈ 1.2 MB of files, no process |
| **Proxy** (`apps/server/`) | Small Node.js server (Docker image) | Any host with Docker that browsers reach via **HTTPS** – e.g. the Nextcloud AIO host behind its reverse proxy. With the desktop editors: inside the desktop app on the user's computer (installation D) | **Only the AI chat and MCP** | Image ≈ 255 MB, ≈ 30 MB RAM, ≈ 0 % CPU when idle (measured locally) |
| **Language model** | Mistral / OpenAI-compatible / Anthropic API, or a local model via Ollama | At the provider (or your Ollama host) | Only the AI chat (MCP clients bring their own) | Billed by the provider / your hardware |

- **Without the proxy** the music features work in the *Noten* tab (ABC editor, templates, German note names,
  lyrics, load/replace staves). The chat tab then asks for a proxy URL.
- **Why a proxy at all?**
  - It keeps the API key on the server. In the browser it would be readable by every user and could be used at
    your expense.
  - It protects access with a token, an origin allowlist (CORS) and a rate limit.
  - It holds the system prompt and the tools, validates ABC before it reaches the document, and converts German
    note names deterministically.
  - It lets you switch the model (Mistral, OpenAI-compatible such as Ollama, Anthropic) without touching the plugin.
- The proxy keeps no conversations or documents; its log contains request metadata (time, path, status, client IP)
  and errors. With each chat request the plugin sends the chat history and the document outline (paragraph texts,
  staff ABC); the proxy forwards them to the configured model provider – choose the provider accordingly (e.g. an EU
  provider such as Mistral, or a local model via Ollama).

**Website:** https://felixwochnick.github.io/euro-office-worksheet-assistant/ – overview, live demo of the German
note converter and installation guide in German, English, French, Spanish, Italian, Dutch and Polish.

## Repository layout

A monorepo with a pnpm workspace (`pnpm-workspace.yaml`): one `pnpm install` in the root installs everything (one
`pnpm-lock.yaml`; pnpm's version is pinned in `packageManager` of `package.json`, e.g. via `corepack enable`); the
packages are named `@worksheet-assistant/<name>`.

| Path | Content |
|------|---------|
| `apps/plugin/` | The Euro-Office plugin: source in `src/` (`config.json`, `index.html`, `css/`, `js/`, icons); `harness/` – local test harness (mocked `window.Asc.plugin` and builder API) and an end-to-end test |
| `apps/server/` | The server (proxy, TypeScript, Fastify): AI chat, MCP endpoint, `Dockerfile`, `docker-compose.yml`, `compose.release.yml`, `.env.example` |
| `apps/server/src/companion/` | The desktop app's server program `worksheet-assistant` (plugin installation, local server, autostart, MCP over stdio; `claude.ts`: Claude Desktop / Claude Code entries); `scripts/build-companion.mjs` builds it as a single executable |
| `apps/desktop/` | Desktop app for the desktop editors (installation D): UI of the window in `app/` (Nuxt 4 + Nuxt UI 4), Tauri 2 shell in `src-tauri/` (`src/sidecar.rs` starts and supervises the server program, `src/tray.rs` tray / menu bar icon, `src/updates.rs` update check); icon sources in `icon-src/` |
| `apps/website/` | Project website (Nuxt 4 + Nuxt UI, static on GitHub Pages) with a live demo of the converter |
| `packages/shared/` | Modules shared by the plugin (browser globals), the server and the website (CommonJS), with their unit tests in `test/`: |
| ↳ `abc-tools.js` | ABC validation/normalisation and German note names → ABC |
| ↳ `worksheet-layout.js` | Worksheet blocks → document elements (design decisions; used by the plugin and, for validation, by the server) |
| ↳ `worksheet-themes.js` | Designs (fonts, sizes, colours) and printed labels in seven languages |
| ↳ `worksheet-generators.js` | Crossword, word search, cloze, matching, grade key (deterministic) |
| ↳ `worksheet-svg.js` | Icons, task badges, lineatures, number lines, coordinate systems, charts, mind maps, QR codes, SVG sanitiser |
| ↳ `worksheet-diagrams.js` | Computer science diagrams: UML class, object, sequence, state, activity and use case diagrams, finite automata, structograms, flowcharts (PAP), ER diagrams (layout with dagre; fill-in and solution versions) |
| ↳ `german-syllables.js`, `worksheet-check.js` | Syllables for Silbenfärbung; the worksheet quality check |
| `vendor/` | Pinned third-party files: ONLYOFFICE `v1/plugins.js` + `plugins-ui.js`, `abcjs-basic-min.js`, `qrcode-generator`, `dagre` (see `vendor/SOURCES.md`) |
| `scripts/build.sh` | Builds the plugin: `dist/worksheet-assistant/`, `.plugin`, `.tar.gz` and `.zip` |
| `scripts/install-aio.sh` | Installs the plugin into Nextcloud AIO's Euro-Office container (optionally with auto re-install) |
| `scripts/build-desktop.mjs`, `scripts/collect-desktop.mjs`, `scripts/updater-json.mjs` | Build the desktop app; copy its installers under the release names to `dist/desktop/`; write `latest.json` for the app's updater |
| `deploy/` | Example compose: Euro-Office as its own container with the plugin as a volume, plus the proxy |
| `dev/` | Test setups with a real Euro-Office and Nextcloud (end-to-end tests, website screenshots) |
| `.github/workflows/` | CI (tests, build, e2e, Docker, desktop app on all platforms), release (packages, desktop app installers, proxy image on GHCR), website (GitHub Pages) |

Root scripts:

| Command | What it does |
|---------|--------------|
| `pnpm install` | Installs all packages (CI installs only the ones a job needs, e.g. `pnpm install --frozen-lockfile --filter '!@worksheet-assistant/desktop' --filter '!@worksheet-assistant/website'`) |
| `pnpm test` | Unit tests of `packages/shared` and `apps/server` |
| `pnpm build` | Plugin (`scripts/build.sh`) and server (`tsc`) |
| `pnpm build:companion` / `build:desktop` / `build:website` | The desktop app's server program / the desktop app / the website |
| `pnpm e2e` | End-to-end test of the plugin in the harness (see [Local test harness](#local-test-harness-no-euro-office-needed)) |
| `pnpm dev:server` / `dev:desktop` / `dev:website` | Server with `apps/server/.env` / the desktop app (`tauri dev`) / the website |

## Build

Requirements: bash, Node.js ≥ 22 (only for the config check and tests), `zip` or `python3`.

```bash
bash scripts/build.sh                  # uses the pinned copies in vendor/ (checksums are verified)
bash scripts/build.sh --update-vendor  # re-downloads abcjs, qrcode-generator and plugins.js/plugins-ui.js, then builds
```

Result:

- `dist/worksheet-assistant/` – the plugin folder (copy this into `sdkjs-plugins/`)
- `dist/worksheet-assistant.plugin` – the same as ZIP with `config.json` at the root (for editors with a plugin manager)
- `dist/worksheet-assistant.tar.gz` / `.zip` – archives with the `worksheet-assistant/` folder (for `install-aio.sh --archive`)

### Desktop app

Requirements: Rust (stable) and the official **Node.js 24 LTS** from nodejs.org, nvm or fnm (newer official Linux
builds need `libatomic.so.1`, distribution packages link system libraries – the server program would not run
everywhere). On Linux also `libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf`.

```bash
pnpm install                           # all packages (or: pnpm build:desktop, which installs if needed)
node scripts/build-desktop.mjs         # -> apps/desktop/src-tauri/target/<target>/release/bundle/
node scripts/collect-desktop.mjs <target>   # optional: installers under the release names in dist/desktop/
```

`build-desktop.mjs` builds the plugin (if `dist/worksheet-assistant/` is missing), the server program
(`scripts/build-companion.mjs --no-archive`) and the Tauri bundles (`.dmg`, NSIS setup, `.deb`, AppImage);
`scripts/updater-json.mjs` writes `latest.json` for the app's updater (release workflow). CI builds the app for
Linux x64/arm64, Windows x64 and macOS arm64/x64, starts the server program in app mode, calls an MCP tool and
checks that the server program starts on a minimal Ubuntu.

Working on the window's UI:

- without Rust: `pnpm --filter @worksheet-assistant/desktop dev` opens the UI in the browser with a simulated backend
  (URL parameter `?scenario=fresh|ready|error|update|starting`);
- with Rust: `node scripts/build-desktop.mjs --stub` (placeholders for the server program), then
  `pnpm dev:desktop` (`tauri dev`).

## Installation

There are three parts: the **plugin** (in the Euro-Office Document Server), the **proxy** (holds the AI key) and the
**settings** in the plugin. Without the proxy the manual mode works; the AI chat needs it.

| Setup | Effort | Survives updates | Recommended for |
|-------|--------|------------------|-----------------|
| **A – Nextcloud AIO + install script with `--watch`** | one command | ✅ (re-installed automatically after every AIO update) | AIO users |
| B – own Euro-Office container, plugin as volume (`deploy/`) | own Document Server + reverse proxy | ✅ | if you run the Document Server yourself anyway |
| C – `docker cp` by hand | one command | ❌ (gone after every AIO update) | quick tests |
| **D – desktop app (Windows, macOS, Linux)** for the Euro-Office / Nextcloud Office desktop editors | download, install | ✅ (the app keeps the plugin up to date) | working locally with the Euro-Office / Nextcloud Office desktop editors |

Prebuilt packages are attached to each [GitHub release](https://github.com/felixwochnick/euro-office-worksheet-assistant/releases)
(`worksheet-assistant.tar.gz`, `.zip`, `.plugin`; up to 0.1.0 `music-notation.*`; from 0.6.0 the desktop app's
installers `Arbeitsblatt-Assistent_<version>_…`); the proxy image is `ghcr.io/felixwochnick/euro-office-worksheet-assistant`.
Releases are created by pushing a tag (see [Releases](#releases)).
Until the first release exists, build locally with `bash scripts/build.sh` and use `--source dist/worksheet-assistant`.

### A – Nextcloud AIO (recommended)

In AIO the Euro-Office container (`nextcloud-aio-eurooffice`) has no plugin manager, its plugin folder
`/var/www/euro-office/documentserver/sdkjs-plugins` is empty, and **AIO updates re-create the container**, which
removes plugins copied into it. AIO offers no supported way to mount own plugins. Therefore:

**1. Plugin** – on the AIO host:

```bash
# latest release
curl -fsSL https://raw.githubusercontent.com/felixwochnick/euro-office-worksheet-assistant/main/scripts/install-aio.sh \
  | sudo bash -s -- --watch

# or from a checkout / local build
bash scripts/build.sh
sudo scripts/install-aio.sh --source dist/worksheet-assistant --watch
```

The script copies the plugin into the running container, checks that the Document Server lists it, stores a copy
in `/opt/eurooffice-plugins/` and – with `--watch` – installs the systemd service `eurooffice-worksheet-assistant`, which
waits for the container to start (`docker events`) and copies the plugin in again. AIO updates therefore need no
manual step. Then reopen the document in Nextcloud: *Plugins* → **Arbeitsblatt-Assistent**. No container restart is needed.

```bash
systemctl status eurooffice-worksheet-assistant       # watcher
sudo scripts/install-aio.sh --print-unit         # show the unit before installing
sudo scripts/install-aio.sh --version v0.2.0 --watch   # update to another release
sudo scripts/install-aio.sh --uninstall          # remove plugin and service
```

Options: `--container NAME`, `--plugin-dir PATH` (if your container differs), `--archive FILE` (a downloaded
`.tar.gz`/`.zip`). Tested with a fresh `ghcr.io/euro-office/documentserver` 9.3.8 container, including a simulated
update (container removed and re-created → plugin re-installed by the watcher within ~15 s).

**2. Proxy** – on any host with Docker that is reachable via **HTTPS** (the editor runs on HTTPS; browsers block
plain HTTP from there). On the AIO host itself, put it behind your reverse proxy (e.g. `https://noten-proxy.example.org`
→ `localhost:8787`):

```bash
mkdir worksheet-server && cd worksheet-server
curl -fsSLO https://raw.githubusercontent.com/felixwochnick/euro-office-worksheet-assistant/main/apps/server/compose.release.yml
curl -fsSL https://raw.githubusercontent.com/felixwochnick/euro-office-worksheet-assistant/main/apps/server/.env.example -o .env
nano .env        # PROXY_TOKEN (openssl rand -hex 24), CORS_ORIGINS, LLM_API_KEY
docker compose -f compose.release.yml up -d
```

(From a checkout: `cd apps/server && docker compose up -d --build`. If pulling the image fails with "denied", set the
package `euro-office-worksheet-assistant` to *public* once under GitHub → Packages → Package settings.)

**3. Settings** – in the editor: *Plugins* → *Arbeitsblatt-Assistent* → *Einstellungen*: enter the proxy URL and the token.
Below the token field the plugin shows **the origin to add to `CORS_ORIGINS`** (the address of the Document Server
as seen by the browser). Add it to the proxy's `.env`, restart the proxy (`docker compose … up -d`) and click
*Verbindung testen*. The settings are stored per browser (`localStorage`).

### B – Euro-Office as its own container

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
  JWT enabled, data/log volumes and `dist/worksheet-assistant` mounted read-only into
  `/var/www/euro-office/documentserver/sdkjs-plugins/worksheet-assistant`,
- `worksheet-server` – the LLM proxy (see below).

Both ports are published on `127.0.0.1` only; remove the `ports:` entries when the reverse proxy reaches the
containers through the Docker network (as in Coolify). Set `TRUST_PROXY` to the reverse proxy's IP/CIDR – not to
`true` – so clients cannot spoof `X-Forwarded-For` to bypass the rate limit.

Put a TLS reverse proxy in front (Coolify does this automatically), e.g. `https://office.example.org` → `eurooffice:80`
and `https://worksheets.example.org` → `worksheet-server:8787`. In Nextcloud, disable the AIO-internal office
integration and enter the Document Server URL (`https://office.example.org/`) and the same JWT secret in the
Euro-Office/ONLYOFFICE connector settings (*Administration settings → Office*). Both sides must use the same
`JWT_SECRET`.

In Coolify you can use the compose file as a "Docker Compose" resource; set `PLUGIN_DIR` to an absolute host path
(e.g. `/opt/eurooffice-plugins/worksheet-assistant`) and copy `dist/worksheet-assistant` there. Updating the plugin = replacing
that folder and reloading the editor – no container rebuild needed.

### C – manual copy (quick test)

```bash
bash scripts/build.sh
docker cp dist/worksheet-assistant nextcloud-aio-eurooffice:/var/www/euro-office/documentserver/sdkjs-plugins/
```

Reopen the document. The plugin is gone after the next AIO update – use A to avoid that.

### D – desktop app (Windows, macOS, Linux)

The desktop editors (Euro-Office, Nextcloud Office) have no plugin manager, and there is no Document Server to put
a proxy next to. The **desktop app "Arbeitsblatt-Assistent"** does both on your computer: it installs the plugin
into the desktop editors and runs the local server (AI chat and MCP) invisibly in the background. No terminal, no
browser.

You need the Euro-Office or Nextcloud Office desktop editor: install it and start it once.

**1. Download** the installer for your system from the
[latest release](https://github.com/felixwochnick/euro-office-worksheet-assistant/releases/latest):

| System | File |
|--------|------|
| Windows (x64) | `Arbeitsblatt-Assistent_<version>_windows-x64-setup.exe` – installs for the current user, no admin rights needed |
| macOS, Apple silicon | `Arbeitsblatt-Assistent_<version>_macos-arm64.dmg` |
| macOS, Intel | `Arbeitsblatt-Assistent_<version>_macos-x64.dmg` |
| Linux (AppImage) | `Arbeitsblatt-Assistent_<version>_linux-x64.AppImage` / `_linux-arm64.AppImage` |
| Linux (Debian, Ubuntu) | `Arbeitsblatt-Assistent_<version>_amd64.deb` / `_arm64.deb` |

**2. Install** it like any other app: run the Windows setup; on macOS open the `.dmg` and drag the app into
*Applications* – start it from there, not from the disk image (the app asks for this: autostart, the Claude entry
and updates need its final place); on Linux make the AppImage executable and start it, or install the `.deb`
(`sudo apt install ./Arbeitsblatt-Assistent_<version>_amd64.deb`).

On macOS the app is signed with a Developer ID and notarized by Apple (from 0.7.1), so it opens without a warning.
On Windows it has no developer signature yet: SmartScreen may warn on the first start – *More info → Run anyway*.

**3. First start.** A window opens. The app installs (or updates) the plugin in the Euro-Office and Nextcloud Office
desktop editors and starts the local server in the background. The page *Übersicht* (overview) shows what is set up:

1. *Plugin in der Desktop-App* – done automatically. Open a new document in the desktop editor (or restart it):
   **Plugins → Arbeitsblatt-Assistent**. The plugin is already connected to the app; *MCP-Zugriff erlauben* is on.
2. *KI-Chat* (optional) – on the page *KI-Chat* choose the provider (Mistral, OpenAI, Anthropic, Ollama, any
   OpenAI-compatible API – or none) and enter the API key, the model and, if needed, the URL. The key stays on your
   computer.
3. *Claude verbinden* (optional) – see *Claude* below.

The other pages: *Desktop-App* (plugin status per desktop editor, button to install or update the plugin),
*Bilder* (pictures from the internet on or off; *Ordner wählen* for your own picture folder, e.g. comic panels or
own photos – see [Pictures](#pictures)), *Claude & MCP*, *Einstellungen* (autostart, updates, settings and log
folders, quit).

**4. Closing the window** does not quit the app. It keeps running with an icon in the system tray (Windows, Linux)
or in the menu bar (macOS); its menu has *Arbeitsblatt-Assistent öffnen*, a status line, *Version x verfügbar …*
when an update exists, and *Beenden* (quit). You can also quit under *Einstellungen*. Starting the app again opens
the window of the running app.

**Autostart** is off by default. Switch it on under *Einstellungen* (recommended): the app then starts hidden in the
tray when you log in, so the AI chat and Claude work without opening it first.

**Linux tray:** GNOME shows tray icons only with the extension *AppIndicator and KStatusNotifierItem Support*. The app
checks for it: without a tray, closing the window only minimizes it (quit under *Einstellungen*).

**Claude.** On the page *Claude & MCP*:

- **Claude Desktop** – one click adds (or removes) the entry in Claude Desktop's configuration. Other entries are
  kept and a `.bak` backup is written. Quit Claude Desktop completely and start it again afterwards. If the app is
  not running, Claude Desktop starts it in the background.
- **Claude Code** – one click if its `claude` command is found, otherwise the page shows the command to copy.
- **Other MCP clients** – the page shows the MCP URL `http://127.0.0.1:8787/mcp` and the command entry to copy.

**Updates.** The app checks the GitHub releases shortly after the start and every 6 hours (and with *Nach Updates
suchen* under *Einstellungen*). On macOS, Windows and with the AppImage it shows a notice in the window and in the
tray menu; one click downloads and installs the update and restarts the app. It does not update silently, because
the restart briefly interrupts a running AI chat. The `.deb` package cannot replace itself: the app shows the new
version with a link to the download page. The new app version updates the plugin in the desktop editors
automatically.

**Updating from 0.4/0.5** (formerly: companion app – the standalone program `worksheet-assistant` that was
started from a terminal): install the app and start it. It stops a still running old program automatically and
rewrites the old autostart entry and the Claude Desktop entry to point to the app. Your settings (AI provider, API
key, port, plugin token) are kept – the app uses the same settings folder. The old executable can be deleted.

**Uninstalling** on Windows (*Settings → Apps*) also removes the plugin from the desktop editors, the autostart entry
and the entry in Claude Desktop; elsewhere run `worksheet-assistant uninstall` (see the command line below) before
deleting the app.

Reference:

| | |
|---|---|
| Plugin folders | Linux `~/.local/share/euro-office/desktopeditors/sdkjs-plugins/` and Windows `%LOCALAPPDATA%\Euro-Office\DesktopEditors\data\sdkjs-plugins\` (shared by Euro-Office and Nextcloud Office), macOS `~/Library/Application Support/asc.euro-office.Euro-Office/data/sdkjs-plugins/` resp. `…/asc.nextcloud-office.Nextcloud-Office/data/sdkjs-plugins/`. The plugin folder must be a real folder (no symlink) named after the plugin GUID `{DA7D8078-28E2-4FFC-A41B-02BD1B9CE490}`. The installed plugin contains `local-config.js` with the server address and a random token. New documents pick up a newly installed plugin without restarting the desktop editor |
| Settings | Linux `~/.config/worksheet-assistant/`, Windows `%APPDATA%\Worksheet Assistant\`, macOS `~/Library/Application Support/Worksheet Assistant/` (`config.json`, mode 0600 – contains the API key); the same folders as the standalone program of 0.4/0.5 |
| Server | The app runs its server program `worksheet-assistant` invisibly (`--app` mode) on `127.0.0.1:8787` (AI chat proxy and MCP). `AUTH_MODE=local`: listens on `127.0.0.1` only; the plugin uses the token, MCP needs no sign-in (Host and Origin are checked) |
| Autostart | Off by default; switch under *Einstellungen*. Linux XDG autostart, macOS LaunchAgent, Windows `HKCU\…\Run`; starts the app hidden in the tray / menu bar |
| MCP | Streamable HTTP `http://127.0.0.1:8787/mcp`, or `<app executable> mcp-stdio` for clients that start a command. Claude Desktop entry (`claude_desktop_config.json`): `{"mcpServers":{"worksheet-assistant":{"command":"<app executable>","args":["mcp-stdio"]}}}`, e.g. macOS `/Applications/Arbeitsblatt-Assistent.app/Contents/MacOS/worksheet-assistant-app` |
| Command line | The server program `worksheet-assistant` inside the app: Linux (`.deb`) `/usr/bin/worksheet-assistant`, macOS `Arbeitsblatt-Assistent.app/Contents/MacOS/worksheet-assistant`, Windows next to `worksheet-assistant-app.exe` in the install folder. Same commands as before: `status`, `install-plugin [--force]`, `uninstall`, `autostart on\|off`, `mcp-stdio`, `help`. `--app` is only for the desktop app (JSON events on stdout, quits when stdin closes) |
| Log | `server.log` in the app's log folder: Linux `~/.local/share/io.github.felixwochnick.worksheet-assistant/logs/`, macOS `~/Library/Logs/io.github.felixwochnick.worksheet-assistant/`, Windows `%LOCALAPPDATA%\io.github.felixwochnick.worksheet-assistant\logs\`. *Einstellungen* has buttons to open the settings and log folders |

Building the app yourself: see [Build → Desktop app](#desktop-app).

## Proxy configuration

```bash
cd apps/server
cp .env.example .env      # edit: PROXY_TOKEN, CORS_ORIGINS, LLM_* (never commit .env)
docker compose up -d --build
curl http://localhost:8787/healthz           # {"ok":true}
curl -H "Authorization: Bearer $TOKEN" http://localhost:8787/v1/info
```

The image is built from the repository root (pnpm workspace: the proxy uses `packages/shared`); `docker compose`
handles that. Without Docker: `pnpm install` in the repository root, then `pnpm dev:server` (builds and starts it with
`apps/server/.env`).

| Variable | Default | Meaning |
|----------|---------|---------|
| `AUTH_MODE` | `token` | `token`: one shared `PROXY_TOKEN` for the plugin and MCP clients · `nextcloud`: every Nextcloud user signs in (plugin: *Mit Nextcloud anmelden*; MCP: app password or OAuth) · `local`: one computer, listens on `127.0.0.1` only, MCP without sign-in |
| `PROXY_TOKEN` | – (required for `token`/`local`) | Shared secret, min. 16 characters. The plugin sends it as `Authorization: Bearer …`. `openssl rand -hex 24` |
| `PUBLIC_URL` | – | External URL of the proxy, e.g. `https://worksheet.example.org`. Shown in the plugin as MCP address (`<PUBLIC_URL>/mcp`); required for OAuth |
| `NEXTCLOUD_URL` | – | `AUTH_MODE=nextcloud`: your Nextcloud, e.g. `https://cloud.example.org` (`NEXTCLOUD_INTERNAL_URL` if the proxy reaches it under another URL) |
| `NEXTCLOUD_OAUTH_CLIENT_ID` / `_SECRET` | – | OAuth sign-in for MCP clients (see [MCP](#mcp-claude-chatgpt-le-chat-)) |
| `MCP_ENABLED` | `true` | `false` switches the MCP endpoint and the plugin bridge off |
| `DATA_DIR` | `data` (image: `/data`) | Sign-ins, registered OAuth clients and grants (`AUTH_MODE=nextcloud`); keep it private |
| `CORS_ORIGINS` | – | Comma-separated allowlist of browser origins, i.e. the origin that serves the editor (your Euro-Office / Nextcloud domain, e.g. `https://cloud.example.org`). `*` only for testing |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW` | `30` / `1 minute` | Requests per IP and window |
| `TRUST_PROXY` | `false` (`deploy/`: `loopback,uniquelocal`) | IP/CIDR of your reverse proxy (e.g. `172.16.0.0/12`, or the presets `loopback`, `uniquelocal`) so the rate limits see real client IPs – without it all users behind the reverse proxy share one limit. Avoid `true` when the port is reachable directly – clients could spoof `X-Forwarded-For` |
| `LLM_PROVIDER` | `mistral` | `mistral`, `openai` (any OpenAI-compatible API), `anthropic`, `mock`, `none` (no chat – MCP only) |
| `LLM_MODEL` | provider default | e.g. `mistral-large-latest`, `qwen2.5:7b`, `claude-sonnet-5-5` |
| `LLM_API_KEY` | – | Provider key (alternatively `MISTRAL_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) |
| `LLM_BASE_URL` | provider default | e.g. `http://ollama:11434/v1` for Ollama |
| `LLM_TEMPERATURE`, `LLM_MAX_TOKENS`, `LLM_TIMEOUT_MS` | `0.2`, `8192`, `120000` | Model parameters. Reasoning models (current `mistral-large-latest`) spend part of `LLM_MAX_TOKENS` on "thinking" – values that are too low end in empty answers |
| `LLM_REASONING_EFFORT` | `medium` for Mistral, otherwise not sent | `reasoning_effort` for reasoning models (`low`/`medium`/`high`, `off` = not sent). Without it `mistral-large-latest` can "think" for minutes and run out of tokens. Models that reject it are retried automatically without the parameter |
| `MAX_ITERATIONS` | `6` | Max. tool rounds per user message; afterwards the model must answer in text |
| `IMAGE_SOURCES` | `arasaac,commons,own` | Picture sources for worksheets (see [Pictures](#pictures)); `none` switches pictures off |
| `IMAGE_FOLDER` | `Arbeitsblatt-Bilder` with `AUTH_MODE=nextcloud`, otherwise – | Own pictures: folder in each user's Nextcloud; in `token`/`local` mode an absolute local path (e.g. `/pictures`, mounted into the container) |
| `BODY_LIMIT_BYTES`, `PORT`, `HOST`, `LOG_LEVEL` | `1000000`, `8787`, `0.0.0.0`, `info` | Server settings |

Local model with Ollama: `docker compose --profile ollama up -d`, `docker compose exec ollama ollama pull qwen2.5:7b`,
then `LLM_PROVIDER=openai`, `LLM_BASE_URL=http://ollama:11434/v1`, `LLM_MODEL=qwen2.5:7b`. Small local models are
noticeably less reliable with tool calls and ABC than large hosted models.

Serve the proxy via HTTPS: the editor runs on HTTPS and browsers block requests from HTTPS pages to plain HTTP
(mixed content), except to `localhost`.

### Protocol

| Endpoint | Purpose |
|----------|---------|
| `GET /healthz` | health check |
| `GET /v1/meta` | public: version, `auth_mode`, chat available, MCP address |
| `GET /v1/info` | connection test (authenticated) |
| `POST /v1/chat` | one agent step of the AI chat (below) |
| `POST /v1/images/fetch` | a picture for a worksheet as data URL (`{image_id}` from `search_images`; the plugin loads pictures right before inserting, so no image data is kept in the chat history) |
| `POST /v1/auth/login`, `/v1/auth/login/poll`, `/v1/auth/logout` | `AUTH_MODE=nextcloud`: plugin sign-in with Nextcloud Login Flow v2 |
| `GET /v1/bridge` | WebSocket from the plugin (MCP bridge) |
| `POST /mcp` | MCP endpoint (Streamable HTTP, stateless; protocol 2026-07-28 and 2025 clients) |
| `/.well-known/oauth-*`, `/oauth/*` | OAuth for MCP clients (`AUTH_MODE=nextcloud` with an OAuth client) |

The plugin keeps the conversation; the proxy is stateless.

```
POST /v1/chat   Authorization: Bearer <PROXY_TOKEN>
{ "messages": [ {role:"user", content} | {role:"assistant", content, tool_calls:[{id,name,arguments}]}
                | {role:"tool", tool_call_id, name, content:"<json>"} ],
  "document_context": { "elements": [{index, type, text, style, is_heading, heading_level, has_image, abc}],
                        "cursor_index": 3, "total_elements": 12 } }
→ { "messages": [...new messages...], "pending_tool_calls": [...], "done": false, "iterations": 1, "max_iterations": 6 }
```

Tools offered to the model (JSON Schema in `apps/server/src/tools.ts`):

| Tool | Executed by | Purpose |
|------|-------------|---------|
| `insert_blocks({position, blocks})` | plugin | worksheet content: `heading`, `paragraph`, `list`, `table`, `lines` (writing lines), `box` (info box), `staff`, `empty_staves`, `page_break`, `spacer`; text supports `**bold**`, `*italic*`, `__underline__`; position also `"start"` / `"end"` |
| `replace_elements({from, to, blocks})` | plugin | replace the top-level elements from..to with new blocks |
| `delete_elements({from, to})` | plugin | delete elements (the user confirms unless *Automatisch einfügen* is on) |
| `get_elements({from, to})` | plugin | full content of elements (texts, table cells, staff ABC) |
| `insert_staff({abc, width_cm, position})` | plugin | render ABC and insert it as an image; `position` = `"cursor"` \| `{after_heading}` \| `{after_paragraph_index}` |
| `insert_empty_staves({clef, count, measures, width_cm, position})` | plugin | empty staves made of invisible rests (`x`) |
| `replace_staff({index, abc, width_cm})` | plugin | change an existing staff in place (keeps its width); the outline numbers staves ("Notenzeile 1, 2, …") and marks a selected one |
| `get_document_outline()` | plugin | headings/paragraphs with indices, cursor, ABC of existing staves |
| `convert_german_notes({notes, clef, digits})` | proxy | deterministic German note names → ABC |
| `add_lyrics({abc, lyrics, mode})` | proxy | distribute hyphenated text over the notes (`w:` lines); `mode: "verse"` adds a verse |
| `search_images({query, source, limit})` | proxy | pictures for worksheets: `pictograms` (ARASAAC), `photos` (Wikimedia Commons), `own` (picture folder) or `all`; returns `image_id`s for `picture` blocks |

ABC in `insert_staff` is validated on the proxy (headers `X: M: L: K:` incl. `clef=`, no German `h`/`fis` in the
body, balanced brackets …). Invalid ABC is sent back to the model with the errors instead of reaching the editor.

## Plugin settings

Tab **Einstellungen** (stored in the browser's `localStorage`; falls back to in-memory if storage is blocked):

- **Proxy-URL** and **Zugangs-Token** – "Verbindung testen" calls `/v1/info`
- **Automatisch einfügen** – otherwise every AI insertion is shown as a preview with *Einfügen* / *Verwerfen*
- default width (cm), resolution (dpi), **Einfügemethode** (see Known limitations), language
- **Mit Nextcloud anmelden** (only when the proxy runs with `AUTH_MODE=nextcloud`; replaces the token field)
- **MCP-Zugriff erlauben** – connects this editor to the proxy so MCP clients can work on the document (off by default)
- **Hausstil** – design for new worksheets (Modern, Grundschule, Klassisch), optionally an own font (e.g. a school
  handwriting font – it must be installed on the Document Server), the school name and a logo for the page header
  (the logo is scaled to at most 600 px and stored with the settings). Existing documents keep the design they
  were made with (stored in the document's custom properties).

## MCP: Claude, ChatGPT, Le Chat …

Instead of the built-in chat you can use your own AI assistant. The proxy offers an
[MCP](https://modelcontextprotocol.io) endpoint at `<PUBLIC_URL>/mcp`; the assistant then works on the document
that is open in Euro-Office:

1. Open the document, open the panel **Arbeitsblatt-Assistent**, switch on **MCP-Zugriff erlauben** in
   *Einstellungen* (status: *MCP: verbunden*). The panel must stay open – it executes the assistant's changes.
2. Add the MCP address to your assistant (see below) and ask, e.g. *„Erstelle im geöffneten Dokument ein
   Arbeitsblatt zum Wasserkreislauf für Klasse 5“*.

The assistant gets the same tools as the chat (`get_document_outline`, `get_elements`, `insert_blocks`,
`replace_elements`, `delete_elements`, `insert_staff`, `insert_empty_staves`, `replace_staff`,
`convert_german_notes`, `add_lyrics`) plus `list_open_documents` (several open documents: pass `document_id`),
and the worksheet/ABC guidelines as server instructions. Arguments are validated by the proxy before they reach
the editor. Changes are applied **without preview** (MCP clients ask before calling tools); every call appears in
the panel's chat and can be undone in the editor (Ctrl+Z).

**Sign-in** (`AUTH_MODE`):

| Mode | MCP clients sign in with | Plugin signs in with | For |
|------|--------------------------|----------------------|-----|
| `token` | `Authorization: Bearer <PROXY_TOKEN>` | the same token | one person / a small team (everyone reaches every open editor) |
| `nextcloud` | a Nextcloud **app password** (`Authorization: Basic <login:app-password>`) or **OAuth** (sign-in window with your Nextcloud account) | *Mit Nextcloud anmelden* (Nextcloud Login Flow v2 – creates an app password that the proxy keeps) | schools / several users – each user only reaches **their own** open editors |
| `local` | nothing (listens on `127.0.0.1` only, Host and Origin are checked) | `PROXY_TOKEN` | a single computer (desktop app, installation D) |

**Set up `AUTH_MODE=nextcloud`:**

```bash
# apps/server/.env
AUTH_MODE=nextcloud
NEXTCLOUD_URL=https://cloud.example.org
PUBLIC_URL=https://worksheet.example.org      # how browsers and AI clients reach the proxy
CORS_ORIGINS=https://office.example.org       # origin of the editor
LLM_PROVIDER=mistral                          # or "none" for MCP only
# optional, for OAuth (claude.ai, ChatGPT and other clients that cannot send custom headers):
NEXTCLOUD_OAUTH_CLIENT_ID=…
NEXTCLOUD_OAUTH_CLIENT_SECRET=…
```

For OAuth, register the proxy in Nextcloud once: *Administration settings → Security → OAuth 2.0 clients*, name
`Arbeitsblatt-Assistent`, redirect URI `<PUBLIC_URL>/oauth/callback` (or
`occ oauth2:add-client Arbeitsblatt-Assistent <PUBLIC_URL>/oauth/callback`), and put the client id and secret into
the `.env`. Nextcloud's OAuth app supports neither PKCE nor client registration, so the proxy acts as the
authorization server for MCP clients (metadata discovery, PKCE, dynamic client registration and client ID metadata
documents) and uses Nextcloud only for the login: the user signs in at Nextcloud, then confirms on the proxy's own
page *„<Client> möchte als <Name> auf deine in Euro-Office geöffneten Dokumente zugreifen“*. The access ends at the
latest one hour after it is revoked in Nextcloud (*Settings → Security → Devices & sessions*).

**App passwords:** create one per assistant in Nextcloud (*Settings → Security → Devices & sessions → Create new
app password*) – do not use your login password (Nextcloud accepts it unless the admin enforces token
authentication). Nextcloud's brute-force protection blocks **all** logins from one IP after about 10 failed
attempts in 30 minutes; for Nextcloud every MCP sign-in comes from the proxy's IP. The proxy therefore stops wrong
app passwords itself (5 per login and 10 per client IP in 15 minutes) before they reach Nextcloud, and you should put
the proxy's IP on Nextcloud's brute-force allow list:
`occ config:app:set bruteForce whitelist_1 --value=<proxy-IP>/32`.

The reverse proxy in front of the proxy must pass **WebSockets** (`/v1/bridge`) and must not buffer responses.
Serve the proxy at the root of its own (sub)domain for OAuth: clients look for the metadata under
`https://<host>/.well-known/…`.

**Add it to your assistant** (`https://worksheet.example.org/mcp` as an example):

- **Claude Code:** `claude mcp add --transport http worksheet-assistant https://worksheet.example.org/mcp`
  (OAuth: sign in when asked) – or with an app password:
  `claude mcp add --transport http worksheet-assistant https://worksheet.example.org/mcp --header "Authorization: Basic $(printf 'login:app-password' | base64)"`
- **claude.ai / Claude Desktop, ChatGPT, Le Chat and other assistants with "custom connectors" / remote MCP
  servers:** add the URL as a custom connector; they sign in with OAuth (`AUTH_MODE=nextcloud` with an OAuth
  client). Hosted assistants call the proxy from the internet – it must be publicly reachable via HTTPS.
- **`AUTH_MODE=token`:** clients that can send headers use `Authorization: Bearer <PROXY_TOKEN>`.
- **Desktop app (installation D):** one click on the app's page *Claude & MCP* adds the entry to Claude Desktop or
  Claude Code; other clients use `http://127.0.0.1:8787/mcp` without sign-in.

## Example prompts for teachers

Worksheets (any subject):

- „Erstelle ein Arbeitsblatt zum Wasserkreislauf für Klasse 5 mit drei abwechslungsreichen Aufgaben, einer Tabelle und einem Merkkasten.“
- „Ändere in Aufgabe 1 die Anweisung so, dass sie für Klasse 3 verständlich ist.“
- „Mach aus Aufgabe 2 einen Lückentext mit 8 Lücken.“
- „Füge am Ende eine Lösungsseite hinzu.“
- „Lösche Aufgabe 3.“
- „Gestalte ein Arbeitsblatt zu den Wortarten für Klasse 3 mit Lückentext, Zuordnung und Kreuzworträtsel.“
- „Erstelle einen Test zu Brüchen für Klasse 6 mit Punkten und Notenschlüssel, insgesamt 30 Punkte.“
- „Mach eine Version in Silbenfärbung für die erste Klasse.“
- „Füge ein leeres Säulendiagramm (Monate, Regentage) zum Einzeichnen ein.“
- „Richte die Seite im Querformat ein, mit unserem Schullogo in der Kopfzeile und Seitenzahlen.“
- „Füge die Lösungen auf einer neuen Seite hinzu.“
- „Prüfe das Arbeitsblatt.“
- „Erstelle ein Arbeitsblatt zu Haustieren für die Förderschule (Lernen), Klasse 2 – mit Piktogrammen zu jedem Wort.“
- „Setze neben Aufgabe 1 ein Bild von einem Fuchs.“
- „Nimm für das Latein-Arbeitsblatt Bilder aus meinem Asterix-Ordner.“ (own pictures, see [Pictures](#pictures))

Computer science (see [Computer science diagrams](#computer-science-diagrams)):

- „Erstelle ein Arbeitsblatt zur Vererbung für Klasse 10 (Java): Klassendiagramm mit Tier, Hund und Katze, in dem die Schüler die Vererbung einzeichnen und die Methoden ergänzen – mit Lösungsseite.“
- „Füge ein Sequenzdiagramm zum Geldabheben am Automaten ein, mit alt-Fragment für zu wenig Guthaben.“
- „Zeichne einen DEA, der alle Wörter über {a, b} erkennt, die auf ab enden. Die Übergänge sollen die Schüler beschriften.“
- „Erstelle ein Struktogramm zum euklidischen Algorithmus, in dem die Bedingung und eine Anweisung fehlen.“
- „Zeichne denselben Algorithmus als Programmablaufplan.“
- „Erstelle ein Anwendungsfalldiagramm für eine Schulbibliothek mit Schüler, Bibliothekarin und include/extend.“
- „Zeichne ein Aktivitätsdiagramm zum Ablauf einer Online-Bestellung mit Verzweigung und paralleler Verarbeitung; die Bedingungen sollen die Schüler ergänzen.“
- „Modelliere Schüler, Kurs und Lehrer als ER-Diagramm in Chen-Notation, die Kardinalitäten als Lücken.“
- „Zeige dasselbe Datenmodell in Krähenfußnotation.“

Music:

- „Füge unter Aufgabe 2 eine Notenzeile mit c – f – g im Violinschlüssel ein und darunter eine leere Zeile zum Nachschreiben.“
- „Setze an die Cursorposition die C-Dur-Tonleiter aufwärts in Vierteln, 4/4-Takt.“
- „Schreibe den Anfang von ‚Alle meine Entchen‘ in G-Dur unter die Überschrift ‚Transponieren‘.“
- „Füge nach Aufgabe 3 drei leere Notenzeilen im Bassschlüssel ohne Taktstriche ein.“
- „Erstelle eine 12 cm breite Notenzeile mit den Tönen fis' – a' – cis'' – e''.“
- „Welche Töne stehen in der Notenzeile unter Aufgabe 1?“ (the AI reads the ABC from the alt text)
- „Bitte ändere Zeile 1: statt bc #c“ (changes the existing staff in place – staves are counted in document order)
- „In der markierten Zeile soll das große C am Ende ein c' werden.“ (select the staff image first)
- „Füge zu Zeile 1 den Text hinzu: Hänschen klein ging allein“ (the AI adds the syllable breaks)
- „Und darunter als zweite Strophe: Stock und Hut steht ihm gut“
- „Schreibe die Tonnamen als Lösung unter Notenzeile 2.“
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
Chords: `[CEG]`. Ties: `C2-C`. Chord symbols above a note: `"Am"A`; free text above/below: `"^Text"C` / `"_Text"C`.

**Lyrics** – a `w:` line directly below a music line, one syllable per note (rests are skipped):

```
C D E F | G2 G2 |
w: Al-le mei-ne Ent-chen
w: Hän-schen klein ging al-lein     ← second verse
```

`-` between syllables of a word · `_` hold the previous syllable for one more note · `*` note without text ·
`~` two words on one note (`a~b`). In the manual tab you only type the hyphenated text into *Liedtext*; the plugin
distributes it over all music lines and reports if syllables and notes do not match.

### German note names (converter in the manual tab and AI tool `convert_german_notes`)

| Input | Meaning |
|-------|---------|
| `c d e f g a h`, `b` | note names (`h` = B, `b` = B flat) |
| `fis`, `cis`, `es`, `as`, `des`, `heses` | German accidental suffixes |
| `bc`, `♭e`, `#f`, `♯g` | accidental written **in front** of the note (`bc` = ces, `be` = es) |
| `c'`, `c''`, `c¹`, `C`, `C,` | Helmholtz octaves; bare lower-case names: treble → one-line (`c` = c'), bass → small octave |
| `4/4`, `3/4-Takt` | time signature; bar lines are added automatically (unless the input contains `\|`) |
| `\|` | bar line |
| `p`, `pause` | rest |

**Digits are ambiguous** – German school notation uses them as octave marks (`c1` = c'), others write note values
(`c1` = whole note, `g2` = half, `c4` = quarter, `c8` = eighth, `.` = dotted). The setting *Ziffern* chooses:

- **Oktave** – `c1` = c', `c2` = c''
- **Notenwert** – `c1` = whole note …; a note without value repeats the previous value; octaves with `'`/`,`
- **automatisch** (default) – note values if the digits include 4/8/16, if apostrophes and digits are combined
  (`c'4`), or if a time signature is given and two or more different values fill whole bars. Otherwise octave marks.
  Example: `4/4 bc1, f1, g2, be2, c1, C` → note values (5 full bars: ces' 𝅝 | f' 𝅝 | g' 𝅗𝅥 es' 𝅗𝅥 | c' 𝅝 | C 𝅝).

The converter always reports how it read the digits, the bars, and warnings (e.g. `C` = great octave, far below the
treble staff). Unknown entries are listed; the converter then inserts nothing instead of a partial staff. Commas
separate notes only in lists of lower-case names (`c, f, g`); after upper-case names they are Helmholtz octave marks
(`G, A, H,` = Kontra-Oktave). Within a bar, naturals are added automatically (`bc c` → `_C =C`).

## Development

```bash
pnpm install                # all packages; playwright-core for the e2e test (no browser download)
pnpm test                   # unit tests (packages/shared) + server tests (agent loop, providers, server, companion)
```

### Releases

Push a tag: `git tag v0.6.0 && git push origin v0.6.0` (`.github/workflows/release.yml`). The release job checks that
the `package.json` files (root, `packages/shared`, `apps/plugin`, `apps/server`, `apps/desktop`) and
`apps/plugin/src/config.json` carry the tag's version (also bump `apps/server/src/version.ts`,
`apps/plugin/src/js/bridge.js`, the about line in `apps/plugin/src/index.html` and `apps/desktop/src-tauri/Cargo.toml`),
then:

1. creates the GitHub release as a **draft** with the plugin packages and pushes the proxy image to GHCR,
2. builds the desktop app's installers on Linux x64/arm64 (Ubuntu 22.04), Windows x64 and macOS arm64/x64 and
   uploads them – with the signing key below also `latest.json` for the app's updater,
3. publishes the release. Only then do installed apps see the update (their check reads the latest release).

**Signing key for the app's self-updates** (once): create a key pair with

```bash
pnpm install && pnpm --filter @worksheet-assistant/desktop exec tauri signer generate -w ~/.tauri/worksheet-assistant.key
```

and store the private key as repository secret `TAURI_SIGNING_PRIVATE_KEY` (its password as
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) and the public key as repository variable `TAURI_UPDATER_PUBKEY` (*Settings →
Secrets and variables → Actions*). Without them releases still work, but the app only links to the download page
instead of installing updates.

**macOS signature and notarization** (once, needs a paid Apple Developer account): create a *Developer ID
Application* certificate, export it with its private key as `.p12` and store these repository secrets:

| Secret | Value |
|---|---|
| `APPLE_CERTIFICATE` | the `.p12` file, base64 (`base64 -i developer-id.p12`) |
| `APPLE_CERTIFICATE_PASSWORD` | the `.p12` export password |
| `APPLE_ID` | the Apple account's email address |
| `APPLE_PASSWORD` | an app-specific password of that account (account.apple.com) |
| `APPLE_TEAM_ID` | the 10-character team ID (developer.apple.com → *Membership details*) |

The macOS jobs then sign the app and its server program with the certificate (hardened runtime, the entitlements
in `apps/desktop/src-tauri/macos/entitlements.plist`); Tauri notarizes and staples the app, and
`scripts/check-macos-signature.sh` checks the Developer ID signature, the ticket and Gatekeeper – a failure keeps
the release a draft. Without the secrets macOS builds stay ad-hoc signed (users then need *System Settings →
Privacy & Security → Open Anyway*). Windows installers have no developer signature (SmartScreen, see
[D](#d--desktop-app-windows-macos-linux)).

### Website

```bash
pnpm install
pnpm dev:website                                                    # http://localhost:3000
NUXT_APP_BASE_URL=/euro-office-worksheet-assistant/ pnpm build:website   # static site in apps/website/.output/public
```

The live demo imports `@worksheet-assistant/shared/abc-tools.js`, so it always uses the same converter as the plugin. The site is
deployed by `.github/workflows/pages.yml` on pushes to `main` (one-time setup: *Settings → Pages → Source: GitHub
Actions*). Texts live in `apps/website/app/content/<language>.ts` (typed by `types.ts`, so a missing text fails the build);
German is served at `/`, the other languages at `/en/`, `/fr/`, `/es/`, `/it/`, `/nl/`, `/pl/` (`@nuxtjs/i18n`, with
hreflang links). The screenshots in `apps/website/public/img/` were taken in a real Euro-Office 9.3.8 with Mistral by
`dev/eurooffice/website-screenshots.mjs`, except `companion.webp` (the desktop app's window, page *Übersicht*).

### Local test harness (no Euro-Office needed)

```bash
bash scripts/build.sh
node scripts/serve.mjs 8080               # http://localhost:8080/apps/plugin/harness/
cd apps/server && cp .env.example .env    # set LLM_PROVIDER=mock, PROXY_TOKEN=dev-token-change-me-0123,
docker compose up -d                      #     CORS_ORIGINS=http://localhost:8080
```

`apps/plugin/harness/index.html` loads the built plugin in an iframe, answers the `plugin_init` handshake of `plugins.js` and
installs mocked `callCommand`/`executeMethod` plus a fake builder API (`Api.GetDocument`, `CreateImage`, …) backed by
an in-memory document shown on the left. Commands are re-created from their source and run with a JSON copy of
`Asc.scope`, like in the real editor. Checkboxes simulate a failing `Api.CreateImage` and an older API without
`SetDescription`/`GetCurrentParagraph` to exercise the fallbacks. With the mock provider the chat understands requests
like the example above; with a real provider key the harness talks to the real model.

Note: with `LLM_PROVIDER=mock` the chat is **not an AI** – the mock only recognises a note list (the longest run of
note names in the message), a task heading ("Aufgabe 2") and "leere Zeile". Use a real provider to test free-form requests.

`pnpm e2e` drives the harness with Playwright (needs a Chromium binary, `CHROMIUM_PATH`, default
`/usr/bin/chromium`).

### Testing with a real Nextcloud (sign-in, MCP, OAuth)

`dev/nextcloud/` starts Nextcloud 34 on `http://localhost:8091` with the users `admin` and `lehrer` and an OAuth
client; `e2e-nextcloud.mjs` runs the plugin sign-in (Login Flow v2), MCP with app passwords and the complete OAuth
flow (registration, PKCE, Nextcloud login, consent, refresh, revocation in Nextcloud) against it and the local
Euro-Office (next section):

```bash
bash scripts/build.sh && pnpm build:server
(cd dev/eurooffice && docker compose up -d)
(cd dev/nextcloud && docker compose up -d && ./setup.sh)
node dev/nextcloud/e2e-nextcloud.mjs
```

### Testing in a real Euro-Office editor (without Nextcloud)

`dev/eurooffice/` starts a real Euro-Office Document Server (JWT off – development only) with the built plugin
mounted, plus a tiny document storage (`server.mjs`) that serves a test worksheet (`files/worksheet.docx`,
generated by `make-worksheet.py`), the editor page and the save callback (saved versions go to `dev/eurooffice/out/`).

```bash
bash scripts/build.sh
(cd dev/eurooffice && docker compose up -d)   # first start takes ~40 s (font generation); image ~4 GB
open http://localhost:8099/                   # Plugins → Arbeitsblatt-Assistent
# for the chat: proxy with CORS_ORIGINS=http://localhost:8090 (origin of the plugin iframe)
node dev/eurooffice/e2e-real-editor.mjs       # automated test incl. saving and inspecting the .docx
```

After a rebuild the mounted plugin is updated in place; just reload the editor page. `GET /reset` on the storage
starts again from the original worksheet with a new document key.

## Pictures

The AI can put pictures on worksheets – by default in primary and special-needs worksheets, otherwise when asked. It
searches with `search_images`, chooses by title, keywords and description and places a `picture` block (size,
alignment, caption; beside text with `columns`). Pictures keep their id in the alt text, so the AI can change or
replace them later.

| Source | What | Licence / credit |
|--------|------|------------------|
| `arasaac` | [ARASAAC](https://arasaac.org) pictograms: simple, consistent drawings of objects, animals, actions and feelings, made for special-needs teaching; searched in German | CC BY-NC-SA 4.0 – free for non-commercial use such as school; the credit (*Sergio Palao, ARASAAC*) is printed under the picture |
| `commons` | [Wikimedia Commons](https://commons.wikimedia.org): photos, drawings, maps, art and historical pictures | free licences (CC0, CC BY, CC BY-SA …); author and licence are printed under the picture |
| `own` | the teacher's own pictures in the picture folder, matched by file and folder names (`Asterix/obelix-hinkelstein.png`) | none – the teacher decides what may be used in class |

**Own pictures:** with `AUTH_MODE=nextcloud` every user creates the folder **`Arbeitsblatt-Bilder`** (`IMAGE_FOLDER`)
in their Nextcloud and puts pictures in it (subfolders up to three levels and 150 folders, PNG, JPEG, GIF, WebP, SVG,
and HEIC/TIFF when Nextcloud can make previews of them; good file names help the AI find them). The proxy reads it with the app password of the user's plugin sign-in (so the plugin must be
signed in, also for MCP clients) and loads large photos as a Nextcloud preview (max. 1600 px). In `token`/`local`
mode (one school server) `IMAGE_FOLDER` can be an absolute local folder that all users share. In the **desktop app**
the page *Bilder* sets it: *Ordner wählen* picks the folder (the app shows how many pictures it finds there), and a
switch turns the pictures from the internet on or off.
Copyrighted material such as comic panels is only ever taken from this folder – the assistant never downloads it
from the internet.

The proxy needs HTTPS access to `api.arasaac.org`, `static.arasaac.org`, `commons.wikimedia.org`,
`upload.wikimedia.org` and `thumb.wikimedia.org` (only these hosts are contacted; the model never gives URLs).
Pictures are at most 8 MB. `IMAGE_SOURCES=none` switches the feature off; `IMAGE_SOURCES=arasaac,own` e.g. keeps
photos from the internet out.

## Computer science diagrams

Nine blocks for Informatik worksheets (`packages/shared/worksheet-diagrams.js`; the diagrams of
[Klonk](https://github.com/felixwochnick/klonk), the same author's programming-learning app, ported and extended):

| Block | Shows | The AI describes |
|-------|-------|------------------|
| `class_diagram` | UML classes, interfaces («interface»), abstract classes («abstract», italic), enumerations; static members underlined, abstract ones italic; inheritance, implementation, association (label, multiplicities, navigability), aggregation, composition, dependency | `classes [{name, kind, attributes ["- name: String"], methods ["+ getName(): String"]}]`, `relations [{from, to, kind, label, from_mult, to_mult}]` |
| `object_diagram` | objects `name : Klasse` (underlined) with attribute values, links | `objects [{name, class, values ["kontostand = 100"]}]`, `links` |
| `sequence_diagram` | lifelines (objects, actors), synchronous/asynchronous calls, replies, object creation, self calls, activation bars, `alt`/`opt`/`loop`/`par`/`break` fragments | `participants`, `messages [{from, to, text, kind}]` or `{fragment, label, messages, else}` |
| `state_diagram` | UML states with entry/do/exit, initial and final state, transitions `event [guard] / action`; with `notation: "automaton"` a finite automaton (circles, accepting states as double circles, start arrow) | `states`, `transitions [{from, to, label}]` (`[*]` = initial/final state), `initial`, `accepting` |
| `activity_diagram` | UML activity diagram: start and end node, flow end, actions, decision/merge, fork/join, object nodes; guards on the edges | `nodes [{id, kind, text}]`, `edges [{from, to, label}]` (without edges: a sequence) |
| `use_case_diagram` | UML use case diagram: system boundary, actors (left or right), use cases, associations, «include», «extend», generalization | `system`, `actors`, `use_cases`, `links [{from, to, kind}]` |
| `structogram` | Nassi-Shneiderman diagram (DIN 66261): statements, branches (*wahr*/*falsch*), case selection (*sonst*), pre-/post-test and endless loops, calls, exits | `steps ["…", {if, then, else}, {while, do}, {repeat, until}, {switch, cases}, …]` |
| `flowchart` | Programmablaufplan (DIN 66001): start/end (*Start*/*Ende* in the worksheet's language), operations, decisions, input/output, subroutines, connectors, loops | `nodes [{id, kind, text}]`, `edges [{from, to, label "ja"/"nein"}]` |
| `er_diagram` | Chen notation (1:n, n:m) or (min,max): entities, attributes (keys underlined), relationships with attributes; or crow's foot with PK/FK | `entities [{name, attributes ["__id__"]}]`, `relationships [{name, from, to, from_card, to_card}]`, `notation` |

**To fill in:** `[[answer]]` in any text is a gap (a dotted writing line; a text that is only a gap becomes a whole
writing line, e.g. an attribute to add; `[[[x > 0]]]` is a guard in brackets to fill in), `blank: true` leaves out a
relation, link, message, transition, edge or relationship for the students to draw, a number instead of a list of
attributes/methods gives empty lines, and an empty text gives an empty box (structogram, activity diagram, flowchart).
`show_answers: true` is the solution: the same layout, the answers in the design's accent colour. The quality check
counts such a diagram as space to answer.

The layout is computed with [dagre](https://github.com/dagrejs/dagre) (layered graph layout; MIT): vendored for the
plugin (`vendor/dagre/dagre.min.js`), the npm package `@dagrejs/dagre` of the same version for the proxy and the
desktop app. Text is 3.4 mm high; a diagram that does not fit the text width is scaled down to at most 76 % (text ≥
2.6 mm), otherwise the AI is told to split it. Like all graphics, a diagram keeps its source in the alt text, so the
AI can change it later.

## Known limitations

### Plugin updates and the browser cache

The Document Server serves `sdkjs-plugins/` as "immutable" and its service worker caches these files "cache first"
per Document Server version. After updating only the plugin, browsers that opened the editor before would keep
running the old plugin files. From 0.5.0 on, the panel compares its cached `config.json` with the one on the server
when it starts; after an update it removes the old files from the caches, loads the new ones and asks the user to
close and reopen the document. **When updating from 0.4.x or older** (which has no such check), each user has to clear
the site data of the Document Server once (browser settings, or reload with an emptied cache) – or the new version
appears with the next Document Server update.

### Tested with Euro-Office 9.3.8

The plugin was tested end-to-end in a real Euro-Office Document Server
(`ghcr.io/euro-office/documentserver:latest`, version 9.3.8, see `dev/eurooffice/`). Results:

| Feature | Result in 9.3.8 |
|---------|-----------------|
| Plugin discovery from `sdkjs-plugins/` | ✅ automatic (`/plugins.json` is generated per request – `docker cp` into a running container works without restart) |
| Panel + `plugins.js` handshake | ✅ |
| `Api.CreateImage(dataUrl, …)` | ✅ image is embedded as PNG in the saved `.docx` |
| `after_paragraph_index` / `after_heading` / cursor | ✅ |
| Alt text (ABC source) | ✅ via the internal `docPr.setDescr` fallback (`ApiDrawing.SetDescription` exists only from ONLYOFFICE 10.0); survives saving (`<wp:docPr descr="X:1…" title="ABC-Notation">`) |
| `GetCurrentParagraph`, `GetSelectedDrawings`, `GetParentParagraph` | ✅ available |
| Load + replace a selected staff | ✅ |
| Fallbacks `PutImageDataToSelection`, `PasteHtml` | ✅ both work, incl. alt text |
| Worksheet blocks (headings, lists, tables, writing lines, info boxes, page breaks) | ✅ incl. replace / delete of element ranges |

Other versions may differ. Every call that is not guaranteed has a **primary path plus fallbacks**:

- **Images from data URLs.** Primary: `Api.CreateImage(dataUrl, w, h)` inside `callCommand`. Fallbacks, in order:
  `executeMethod("PutImageDataToSelection")` and `executeMethod("PasteHtml", ['<img src="data:…">'])`. If
  `CreateImage` *succeeds* in another build but the picture stays empty or is lost after saving, choose another
  **Einfügemethode** in the settings – such failures cannot be detected by the plugin.
- **Fallback positions.** The fallbacks can only insert at the cursor. The plugin therefore first inserts an empty
  paragraph after the target (or after the current paragraph), clears any drawing selection (otherwise
  `PutImageDataToSelection` would *replace* the selected image) and moves the cursor there using internal editor
  functions; if that fails the image ends up at the cursor and the chat says so.
- **Alt text.** Set via `ApiDrawing.SetDescription` (ONLYOFFICE ≥ 10.0) or the internal `docPr.setDescr`. Without alt
  text, staves can't be loaded back for editing.
- **"At the cursor"** means: as a new paragraph *after* the paragraph containing the cursor (or the selected image);
  an empty paragraph at the cursor is used directly. The staff never splits a paragraph and never replaces selected
  text (found in testing: inserting at the exact cursor position replaced a selected sentence).
- **Cursor position.** `ApiDocument.GetCurrentParagraph` (≥ 9.0), otherwise the internal `CurPos.ContentPos`. The
  position is reported as a top-level element index (a table counts as one element); inside headers/footers it is
  unknown.
- **Saving.** Co-editing changes reach the Document Server asynchronously; a save triggered within a second of the
  last change may not contain it yet (normal editor behaviour, relevant for scripted tests).
- **"Current page".** The builder API exposes no reliable page numbers. The AI gets the document outline (up to 300
  top-level elements around the cursor, text truncated), not a page view.
- **"unter Aufgabe 2".** `after_heading` inserts directly after the matching paragraph. Whether the staff should go
  after the task's instruction text is decided by the model from the outline.
- **Replace selected image** deletes the old drawing and appends the new one to the same paragraph; images that
  share a paragraph with text may move to its end.
- **Plugin discovery.** Plugins are picked up from `sdkjs-plugins` when the editor loads. If the plugin does not
  show up, reload the editor with a cleared browser cache.
- **Rendering.** abcjs fonts for titles/lyrics come from the browser; the PNG is a raster image (300 dpi by default,
  adjustable up to 600 dpi). Staves always span the full chosen width (`%%stretchlast`). If a line is too dense for
  the width (typically with lyrics), the image is rendered with lines broken evenly by whole measures (syllables move
  along); the ABC stored in the alt text is not changed. The image is never wider than the chosen width.
- **Lyrics.** German syllable breaks are not computed by the plugin: in the manual tab type them with `-`
  (`Al-le mei-ne`); the AI hyphenates itself. Lyrics with `|` (bar advance) are not re-broken.
- **AI quality.** Even with validation the model may choose unexpected rhythms or octaves; check the preview (or
  disable *Automatisch einfügen*). Small local models often fail at tool calling. Melodies "from memory" (e.g.
  „Alle meine Entchen“) are not reliable – in tests Mistral produced the right melody once and a variant once; give
  the notes (or use the manual template) when exactness matters.
- **Worksheet formatting.** Headings use the document's styles `Heading 1`–`3` (documents without these styles get
  bold, larger paragraphs instead – an untested fallback); tables use `Table Grid` with a shaded header row; writing lines are paragraphs with a
  bottom border; info boxes are one-cell tables. Fonts and colours follow the document. Lists get their own
  numbering (`1.` or bullets) – the builder API cannot continue an existing list. Images other than staves (photos,
  diagrams) and formulas are not generated.
- **Editing by element index.** `replace_elements` / `delete_elements` work on top-level elements (paragraphs and
  whole tables); a single table cell or part of a paragraph cannot be changed. Indices come from the outline sent with
  each message – if the document is edited meanwhile, the AI may hit the wrong element. Deletions are therefore
  shown for confirmation.
- **Nextcloud sign-in (tested with Nextcloud 34.0.6).** Nextcloud's OAuth consent cannot be remembered: every
  OAuth sign-in shows Nextcloud's *Log in* / *Grant access* pages and then the proxy's own consent page, and adds an
  entry *Arbeitsblatt-Assistent* under *Devices & sessions* (that is where it is revoked). Revoked app passwords and
  tokens may keep working for about 10 seconds (Nextcloud caches token checks). Two-factor authentication and SSO
  logins were not tested. Signing out in the plugin deletes its app password in Nextcloud.
- **MCP.** The editor must be open with the panel *Arbeitsblatt-Assistent* and *MCP-Zugriff erlauben* switched on –
  the panel executes the changes (closing it disconnects the document). With several open documents the assistant
  works on the most recently used one unless it passes `document_id`. MCP changes are applied without preview. Tested
  with the MCP TypeScript SDK client (protocol 2026-07-28) and plain 2025-era JSON-RPC requests, OAuth with a scripted
  client against Nextcloud 34; hosted assistants (claude.ai, ChatGPT, Le Chat) were not tested against a public
  installation yet. With `AUTH_MODE=token` every
  holder of the token reaches every connected editor.
- **Security.** The token is stored in the browser and therefore visible to the user of that browser – it protects
  the proxy against strangers, not against your own users. Use the rate limit and provider-side spending limits.

## Licenses

- This project: **MIT** (`LICENSE`).
- `vendor/onlyoffice/plugins.js`, `vendor/onlyoffice/plugins-ui.js`: © Ascensio System SIA, from
  [ONLYOFFICE/onlyoffice.github.io](https://github.com/ONLYOFFICE/onlyoffice.github.io/tree/master/sdkjs-plugins/v1),
  licensed under **AGPL-3.0** (`vendor/onlyoffice/LICENSE`). They are bundled unmodified as separate files and are
  *not* covered by the MIT license. If you distribute the built plugin, you distribute these AGPL files too – keep the
  license text (the build copies it to `dist/worksheet-assistant/licenses/`) and point to the source.
- `vendor/abcjs/abcjs-basic-min.js`: [abcjs](https://github.com/paulrosen/abcjs) © Paul Rosen and Gregory Dyke,
  **MIT** (`vendor/abcjs/LICENSE.md`).
- `vendor/qrcode-generator/qrcode.js`: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)
  © Kazuhiko Arase, **MIT** (`vendor/qrcode-generator/LICENSE`) – QR codes on worksheets.
- `vendor/dagre/dagre.min.js`: [dagre](https://github.com/dagrejs/dagre) with graphlib © Chris Pettitt, **MIT**
  (`vendor/dagre/LICENSE`) – layout of the computer science diagrams.

Exact versions and checksums: `vendor/SOURCES.md`.

Pictures that the AI puts on worksheets are not part of this project: ARASAAC pictograms are by Sergio Palao,
property of the Government of Aragón, licensed **CC BY-NC-SA 4.0**; Wikimedia Commons files carry their own free
licences. The credit is printed under each picture.
