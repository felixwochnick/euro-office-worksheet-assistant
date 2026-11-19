# Pictures on worksheets – design

Date: 2026-11-19 · Status: approved (owner chose sources 1+3 and approach A, then delegated all further calls)

## Intent

Worksheets for primary and special-needs schools (Grundschule, Förderschule) should not be text only. The AI must be
able to put pictures that fit the task or the topic onto the sheet – the way a Latin teacher puts Asterix panels on
his worksheets. Pictures carry meaning for weak readers (pictograms next to words), motivate, and break up the page.

## Goals

- The AI can **search** for pictures and **place** them on a worksheet, both in the built-in chat and for MCP clients.
- Two kinds of sources:
  1. **Free sources** online: ARASAAC pictograms (simple, consistent, made for special-needs teaching, German
     keywords) and Wikimedia Commons (photos, drawings, historical pictures – e.g. Roman legionaries for Latin).
  2. **The teacher's own pictures**: a folder in their Nextcloud (or, without Nextcloud, a local folder of the
     companion app). This is how copyrighted material the teacher may use in class (Asterix panels, scans, own
     photos) gets onto the sheet – the tool never ships or downloads such material on its own.
- Attribution required by the licence is printed automatically under the picture.
- Pictures stay editable by the AI later (source stored in the alt text, like all generated graphics).

## Non-goals

- AI image generation.
- The model looking at thumbnails to choose (vision). It picks by title, keywords and description for now; this can
  be added later.
- Picture-based task types (match picture ↔ word with pictures inside the matching table, picture crosswords).
  Pictures beside text are possible with the existing `columns` block.
- A bundled clipart collection (OpenMoji etc.).

## Anti-goals

- Never fetch arbitrary URLs given by the model (SSRF): only fixed hosts of the free sources, and the user's own
  Nextcloud/folder.
- Never bloat the chat history with image bytes (the plugin sends the whole history on every request).
- Never print a free picture without its licence credit.

## Approaches considered

- **A. Proxy searches, plugin fetches the bytes through the proxy (chosen).** A server tool `search_images` and a
  block `picture {image_id}`. The proxy resolves ids, talks to the sources and to Nextcloud with the credentials it
  already holds. Works identically for chat and MCP; credentials stay on the server.
- B. The plugin fetches in the browser. CORS blocks WebDAV, MCP would still need the bridge; duplicate code.
- Rejected variant of A: the proxy inlines the bytes into the tool call. The arguments are stored in the chat
  history the plugin resends on every request – megabytes per turn.

## Design

### Ids

Opaque strings the model copies from search results:

| Source | id | bytes from |
|---|---|---|
| ARASAAC | `arasaac:<number>` | `https://static.arasaac.org/pictograms/<n>/<n>_500.png` |
| Wikimedia Commons | `commons:<File title without "File:">` | `thumburl` (800 px) from the Commons API, hosts `upload.wikimedia.org`, `thumb.wikimedia.org` |
| own (Nextcloud) | `own:<path relative to the picture folder>` | Nextcloud preview (`/index.php/core/preview?fileId=…&x=1600&y=1600`), fallback: WebDAV download |
| own (local folder) | `own:<path relative to the folder>` | file system, path confined to the folder |

### Proxy (`proxy/src/images.ts`)

- `ImageService` with `search(query, {source, limit}, user)` and `fetch(id, user)` (→ bytes, mime, width/height when
  known, title, credit) and `describe(id, user)` (metadata only, cached).
- Binary HTTPS fetch with the same SSRF protection as `safe-fetch.ts` plus a host allow-list, no redirects, size
  limit (8 MB), timeout.
- Nextcloud: credentials from the user's most recent plugin session (the plugin must be signed in anyway for chat
  and MCP). Recursive PROPFIND (Depth 1 per folder, max depth 4, max 3000 files), listing cached 2 minutes per user.
  Match: normalised query words (lower case, umlauts folded) against path words; every word must match. Query `*`
  lists everything.
- Search results are cached (id → metadata) so `describe` is cheap; unknown ids are resolved on demand.
- Config: `IMAGE_SOURCES` (default `arasaac,commons,own`; `none` disables the feature and the tool),
  `IMAGE_FOLDER` (default `Arbeitsblatt-Bilder`; folder in Nextcloud, or absolute local path in token/local mode).

### Tool and block

- Server tool `search_images {query, source? all|pictograms|commons|own, limit? 1-12}` → results
  `{image_id, title, description?, keywords?, source, width?, height?, license?, author?}` plus hints.
  Async server tools: `executeServerTool` becomes async and gets a context (user, image service).
- Block `picture {image_id, width_cm? (default 5), align? left|center|right, caption?}`. The proxy checks the id
  (exists, allowed source) before the call reaches the editor and stores the aspect ratio/title/credit on the block
  (`picture_meta`, small).
- Endpoint `POST /v1/images/fetch {image_id}` (plugin auth) → `{data_url, width, height, credit, title}`.

### Plugin

- `prepare()` loads all picture blocks (top level and inside `columns`) through the proxy before `compose`, converts
  non-PNG/JPEG/GIF images to PNG on a canvas, and puts the data on the block (`picture_data`).
- Layout builder `picture`: image run with `dataUrl`, size from width and aspect ratio, alt text with the graphic
  marker `{type:'picture', image_id, width_cm, align, caption}`; credit line in small muted type under the picture,
  then the caption.
- Without `picture_data` (proxy-side validation) the builder lays out a placeholder of the right size.

### Prompt

Guidance: for primary/special-needs worksheets add 1–3 pictures that support the content (pictograms next to words
for weak readers, an illustration for the topic); always `search_images` first and use only returned ids; ARASAAC
for simple objects/actions (German words), Commons for real photos/art/history (English terms often work better),
`own` when the user mentions their own pictures or a character/series (e.g. Asterix) that free sources cannot have;
put a picture beside text with `columns`; credits are added automatically.

## Left to the builder

Exact scoring of own-folder matches, cache sizes, wording of hints, test structure.
