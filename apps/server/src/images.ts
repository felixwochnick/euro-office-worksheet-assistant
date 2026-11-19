/**
 * Pictures for worksheets: search and fetch from
 *   - ARASAAC (pictograms for special-needs teaching, German keywords; CC BY-NC-SA 4.0)
 *   - Wikimedia Commons (photos, drawings, historical pictures; free licences)
 *   - the user's own pictures: a folder in their Nextcloud (AUTH_MODE=nextcloud) or a local folder (other modes)
 *
 * The model only sees opaque ids ("arasaac:2623", "commons:Red fox.jpg", "own:Asterix/obelix.png") and never gives
 * URLs: the free sources are only contacted on fixed hosts (no SSRF), own pictures only inside the picture folder.
 * The plugin fetches the bytes through POST /v1/images/fetch right before it builds the worksheet, so image data
 * never ends up in the chat history.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchSafe, type SafeResponse } from './safe-fetch.js';
import { VERSION } from './version.js';

export type ImageSource = 'arasaac' | 'commons' | 'own';
export const IMAGE_SOURCES: ImageSource[] = ['arasaac', 'commons', 'own'];

export interface ImageMeta {
  image_id: string;
  source: ImageSource;
  title: string;
  description?: string;
  keywords?: string[];
  width?: number;
  height?: number;
  license?: string;
  author?: string;
  /** Attribution printed under the picture ('' for own pictures). */
  credit: string;
}

export interface ImageData {
  meta: ImageMeta;
  mime: string;
  bytes: Buffer;
}

export class ImageError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'ImageError';
  }
}

export interface NextcloudCredentials {
  login: string;
  password: string;
}

/** GET through the SSRF-safe client (free sources). Injectable for tests. */
export type HttpGet = (url: string, opts: { maxBytes: number; accept?: string }) => Promise<SafeResponse | null>;

export interface ImageServiceOptions {
  sources: ImageSource[];
  /** Picture folder: path inside the user's Nextcloud, or an absolute local directory (local folder mode). */
  folder: string;
  /** Own pictures from Nextcloud (AUTH_MODE=nextcloud). */
  nextcloud?: {
    /** Base URL as seen by this server. */
    internalUrl: string;
    /** App password of the user's plugin sign-in. */
    credentials: (userId: string) => NextcloudCredentials | undefined;
    fetchImpl?: typeof fetch;
  };
  /** Own pictures from a local directory (companion / token mode). */
  localFolder?: boolean;
  httpGet?: HttpGet;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const USER_AGENT = `Arbeitsblatt-Assistent/${VERSION} (https://github.com/felixwochnick/euro-office-worksheet-assistant)`;
const FREE_HOSTS = new Set(['api.arasaac.org', 'static.arasaac.org', 'commons.wikimedia.org', 'upload.wikimedia.org', 'thumb.wikimedia.org']);
const IMAGE_MIME = /^image\/(png|jpeg|gif|webp|svg\+xml|bmp)$/;
const EXT_MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.bmp': 'image/bmp',
};
const OWN_LIST_TTL_MS = 2 * 60_000;
const OWN_MAX_FILES = 3000;
const OWN_MAX_DEPTH = 4;
/** Folders read per listing (each is one PROPFIND) – a huge photo archive must not stall the chat. */
const OWN_MAX_FOLDERS = 150;
/** Formats Nextcloud can turn into a PNG/JPEG preview (listed only when the preview can be asked for). */
const PREVIEW_ONLY_MIME = /^image\/(heic|heif|tiff)$/;
const META_CACHE_MAX = 3000;

const ARASAAC_CREDIT = 'Piktogramm: Sergio Palao, ARASAAC (arasaac.org), CC BY-NC-SA 4.0';

function defaultHttpGet(url: string, opts: { maxBytes: number; accept?: string }): Promise<SafeResponse | null> {
  return fetchSafe(url, { maxBytes: opts.maxBytes, timeoutMs: TIMEOUT_MS, accept: opts.accept, allowedHosts: FREE_HOSTS, userAgent: USER_AGENT });
}

/** Lower case, umlauts folded, split into words. */
export function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function stripHtml(s: unknown, max = 200): string {
  if (typeof s !== 'string') return '';
  const t = s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

function sourceOf(id: string): ImageSource | null {
  const m = /^(arasaac|commons|own):(.+)$/s.exec(id);
  return m ? (m[1] as ImageSource) : null;
}

/** Path of an own picture, relative to the picture folder; null if it tries to leave it. */
export function ownPath(id: string): string | null {
  const rel = id.slice('own:'.length).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel || rel.length > 500) return null;
  const parts = rel.split('/');
  if (parts.some((p) => p === '' || p === '.' || p === '..' || /[\0\r\n]/.test(p))) return null;
  return parts.join('/');
}

interface OwnEntry {
  rel: string;
  mime: string;
  size: number;
  fileId?: string;
}

export class ImageService {
  readonly sources: ReadonlySet<ImageSource>;
  private readonly httpGet: HttpGet;
  private readonly metaCache = new Map<string, ImageMeta>();
  private readonly ownCache = new Map<string, { at: number; entries: OwnEntry[] }>();
  private readonly ownPending = new Map<string, Promise<OwnEntry[]>>();
  /** Commons thumbnail URL per id (search results and describe calls fill it). */
  private readonly commonsThumb = new Map<string, string>();

  constructor(private readonly opts: ImageServiceOptions) {
    const own = !!(opts.nextcloud || opts.localFolder) && !!opts.folder;
    this.sources = new Set(opts.sources.filter((s) => s !== 'own' || own));
    this.httpGet = opts.httpGet ?? defaultHttpGet;
  }

  get enabled(): boolean {
    return this.sources.size > 0;
  }

  /** Human readable name of the own picture folder (for hints to the model). */
  get folderName(): string {
    return this.opts.localFolder ? this.opts.folder : `${this.opts.folder.replace(/^\/+|\/+$/g, '')} (in Nextcloud)`;
  }

  private remember(meta: ImageMeta): ImageMeta {
    this.metaCache.delete(meta.image_id);
    this.metaCache.set(meta.image_id, meta);
    if (this.metaCache.size > META_CACHE_MAX) this.metaCache.delete(this.metaCache.keys().next().value as string);
    return meta;
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  /** Search the given sources (default: all enabled). Errors of single sources are reported, not thrown. */
  async search(
    query: string,
    opts: { sources?: ImageSource[]; limit?: number; userId: string; lang?: string },
  ): Promise<{ results: ImageMeta[]; notes: string[] }> {
    const q = query.trim().slice(0, 100);
    const limit = Math.min(12, Math.max(1, opts.limit ?? 6));
    const wanted = (opts.sources ?? [...this.sources]).filter((s) => this.sources.has(s));
    const notes: string[] = [];
    const lists = await Promise.all(
      wanted.map(async (s) => {
        try {
          if (s === 'arasaac') return await this.searchArasaac(q, limit, opts.lang ?? 'de');
          if (s === 'commons') return await this.searchCommons(q, limit);
          return await this.searchOwn(q, limit, opts.userId);
        } catch (err) {
          notes.push((err as Error).message);
          return [] as ImageMeta[];
        }
      }),
    );
    return { results: lists.flat().map((m) => this.remember(m)), notes };
  }

  private async getJson(url: string): Promise<unknown> {
    const r = await this.httpGet(url, { maxBytes: MAX_JSON_BYTES, accept: 'application/json' });
    if (!r) throw new ImageError(`${new URL(url).hostname} is not reachable.`, 502);
    if (r.status === 404) return null;
    if (r.status !== 200) throw new ImageError(`${new URL(url).hostname} answered HTTP ${r.status}.`, 502);
    try {
      return JSON.parse(r.body.toString('utf8'));
    } catch {
      throw new ImageError(`${new URL(url).hostname} sent an unreadable answer.`, 502);
    }
  }

  private async searchArasaac(q: string, limit: number, lang: string): Promise<ImageMeta[]> {
    if (!q || q === '*') return [];
    const l = /^[a-z]{2}$/.test(lang) ? lang : 'de';
    const data = await this.getJson(`https://api.arasaac.org/v1/pictograms/${l}/search/${encodeURIComponent(q)}`);
    if (!Array.isArray(data)) return [];
    return data.slice(0, limit).map((p) => arasaacMeta(p)).filter((m): m is ImageMeta => !!m);
  }

  private commonsUrl(params: Record<string, string>): string {
    const p = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo',
      iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1000',
      iiextmetadatafilter: 'LicenseShortName|Artist|ImageDescription|ObjectName|Credit',
      ...params,
    });
    return `https://commons.wikimedia.org/w/api.php?${p}`;
  }

  private async searchCommons(q: string, limit: number): Promise<ImageMeta[]> {
    if (!q || q === '*') return [];
    const data = (await this.getJson(
      this.commonsUrl({ generator: 'search', gsrnamespace: '6', gsrsearch: `${q} filetype:bitmap|drawing`, gsrlimit: String(limit) }),
    )) as { query?: { pages?: unknown[] } } | null;
    const pages = (data?.query?.pages ?? []) as Array<Record<string, unknown>>;
    pages.sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0));
    return pages.map((p) => this.commonsPage(p)).filter((m): m is ImageMeta => !!m);
  }

  private commonsPage(page: Record<string, unknown>): ImageMeta | null {
    const r = commonsMeta(page);
    if (!r) return null;
    this.commonsThumb.set(r.meta.image_id, r.thumb);
    if (this.commonsThumb.size > META_CACHE_MAX) this.commonsThumb.delete(this.commonsThumb.keys().next().value as string);
    return r.meta;
  }

  // ---------------------------------------------------------------------------
  // Own pictures
  // ---------------------------------------------------------------------------

  private async ownEntries(userId: string): Promise<OwnEntry[]> {
    const hit = this.ownCache.get(userId);
    if (hit && Date.now() - hit.at < OWN_LIST_TTL_MS) return hit.entries;
    // Several picture blocks checked at once share one listing.
    const pending = this.ownPending.get(userId);
    if (pending) return pending;
    const p = (async () => {
      try {
        const entries = this.opts.localFolder ? await this.listLocal() : await this.listNextcloud(userId);
        this.ownCache.set(userId, { at: Date.now(), entries });
        if (this.ownCache.size > 500) this.ownCache.delete(this.ownCache.keys().next().value as string);
        return entries;
      } finally {
        this.ownPending.delete(userId);
      }
    })();
    this.ownPending.set(userId, p);
    return p;
  }

  private async searchOwn(q: string, limit: number, userId: string): Promise<ImageMeta[]> {
    const entries = await this.ownEntries(userId);
    const qw = q === '*' ? [] : words(q);
    const scored: Array<{ e: OwnEntry; score: number }> = [];
    for (const e of entries) {
      const pw = words(e.rel.replace(/\.[a-z0-9]+$/i, ''));
      let score = 0;
      let all = true;
      for (const w of qw) {
        if (pw.includes(w)) score += 2;
        else if (pw.some((p) => p.includes(w) || (w.length >= 4 && w.includes(p) && p.length >= 4))) score += 1;
        else {
          all = false;
          break;
        }
      }
      if (all) scored.push({ e, score });
    }
    scored.sort((a, b) => b.score - a.score || a.e.rel.localeCompare(b.e.rel));
    return scored.slice(0, limit).map(({ e }) => ownMeta(e));
  }

  private davBase(userId: string): string {
    const folder = this.opts.folder.replace(/^\/+|\/+$/g, '').split('/').map(encodeURIComponent).join('/');
    return `${this.opts.nextcloud!.internalUrl.replace(/\/+$/, '')}/remote.php/dav/files/${encodeURIComponent(userId)}/${folder}`;
  }

  private ncAuth(userId: string): string {
    const c = this.opts.nextcloud!.credentials(userId);
    if (!c) {
      throw new ImageError('Own pictures need the plugin to be signed in with Nextcloud (Arbeitsblatt-Assistent → Einstellungen).', 403);
    }
    return 'Basic ' + Buffer.from(`${c.login}:${c.password}`).toString('base64');
  }

  private async ncFetch(url: string, init: RequestInit): Promise<Response> {
    const f = this.opts.nextcloud!.fetchImpl ?? fetch;
    try {
      return await f(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      throw new ImageError(`Nextcloud not reachable: ${(err as Error).message}`, 502);
    }
  }

  /** Read a Nextcloud answer body; a timeout or reset while reading becomes an ImageError. */
  private async ncRead(res: Response, as: 'text'): Promise<string>;
  private async ncRead(res: Response, as: 'bytes'): Promise<Buffer>;
  private async ncRead(res: Response, as: 'text' | 'bytes'): Promise<string | Buffer> {
    try {
      return as === 'text' ? await res.text() : Buffer.from(await res.arrayBuffer());
    } catch (err) {
      throw new ImageError(`Nextcloud did not answer completely: ${(err as Error).message}`, 502);
    }
  }

  private async listNextcloud(userId: string): Promise<OwnEntry[]> {
    const authorization = this.ncAuth(userId);
    const base = this.davBase(userId);
    // Hrefs are matched by their "/remote.php/dav/files/<user>/<folder>/" part, so a Nextcloud under a sub-path
    // (overwritewebroot) or a different internal URL still matches.
    const marker = `/remote.php/dav/files/${userId}/${this.opts.folder.replace(/^\/+|\/+$/g, '')}/`;
    const out: OwnEntry[] = [];
    let folders = 0;
    const queue: Array<{ rel: string; depth: number }> = [{ rel: '', depth: 0 }];
    const body =
      '<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns"><d:prop>' +
      '<d:resourcetype/><d:getcontenttype/><d:getcontentlength/><oc:fileid/></d:prop></d:propfind>';
    while (queue.length && out.length < OWN_MAX_FILES && folders < OWN_MAX_FOLDERS) {
      const { rel, depth } = queue.shift()!;
      folders++;
      const url = base + '/' + rel.split('/').filter(Boolean).map(encodeURIComponent).join('/') + (rel ? '/' : '');
      const res = await this.ncFetch(url, { method: 'PROPFIND', headers: { authorization, depth: '1', 'content-type': 'application/xml' }, body });
      if (res.status === 404 && !rel) {
        throw new ImageError(`The folder "${this.opts.folder}" does not exist in the user's Nextcloud yet – create it and put pictures in it.`, 404);
      }
      if (res.status === 401 || res.status === 403) throw new ImageError('Nextcloud refused access to the picture folder – sign in again in the plugin.', 403);
      if (res.status !== 207) {
        if (!rel) throw new ImageError(`Nextcloud answered HTTP ${res.status} for the picture folder.`, 502);
        continue;
      }
      const xml = await this.ncRead(res, 'text');
      for (const r of parseMultistatus(xml)) {
        let p: string;
        try {
          p = decodeURIComponent(new URL(r.href, base).pathname);
        } catch {
          continue;
        }
        const at = p.indexOf(marker);
        if (at < 0) continue;
        const childRel = p.slice(at + marker.length).replace(/\/+$/, '');
        if (childRel && ownPath('own:' + childRel) !== childRel) continue;
        if (!childRel || childRel === rel) continue;
        if (r.collection) {
          if (depth + 1 < OWN_MAX_DEPTH) queue.push({ rel: childRel, depth: depth + 1 });
        } else {
          const mime = (r.contentType || EXT_MIME[path.extname(childRel).toLowerCase()] || '').split(';')[0].trim();
          if (IMAGE_MIME.test(mime) || (r.fileId && PREVIEW_ONLY_MIME.test(mime))) out.push({ rel: childRel, mime, size: r.size, fileId: r.fileId });
        }
        if (out.length >= OWN_MAX_FILES) break;
      }
    }
    return out;
  }

  private async listLocal(): Promise<OwnEntry[]> {
    const root = path.resolve(this.opts.folder);
    const out: OwnEntry[] = [];
    const walk = async (dir: string, rel: string, depth: number): Promise<void> => {
      let items: import('node:fs').Dirent[];
      try {
        items = await fs.readdir(dir, { withFileTypes: true });
      } catch (err) {
        if (!rel) throw new ImageError(`The picture folder ${root} cannot be read (${(err as NodeJS.ErrnoException).code ?? 'error'}).`, 404);
        return;
      }
      for (const it of items) {
        if (out.length >= OWN_MAX_FILES) return;
        if (it.name.startsWith('.')) continue;
        const r = rel ? `${rel}/${it.name}` : it.name;
        if (it.isDirectory()) {
          if (depth + 1 < OWN_MAX_DEPTH) await walk(path.join(dir, it.name), r, depth + 1);
        } else if (it.isFile()) {
          const mime = EXT_MIME[path.extname(it.name).toLowerCase()];
          if (mime) out.push({ rel: r, mime, size: 0 });
        }
      }
    };
    await walk(root, '', 0);
    return out;
  }

  // ---------------------------------------------------------------------------
  // Describe and fetch
  // ---------------------------------------------------------------------------

  /** Metadata of a picture id (from the search cache or the source). Throws ImageError with a message for the model. */
  async describe(id: string, userId: string): Promise<ImageMeta> {
    const source = sourceOf(id);
    if (!source) throw new ImageError(`"${id.slice(0, 80)}" is not a picture id. Use an image_id returned by search_images.`);
    if (!this.sources.has(source)) throw new ImageError(`Pictures from "${source}" are not available on this server.`);
    const cached = this.metaCache.get(id);
    if (cached && source !== 'own') return cached;
    if (source === 'arasaac') {
      const n = /^arasaac:(\d{1,7})$/.exec(id);
      if (!n) throw new ImageError(`Unknown picture "${id}". Use an image_id returned by search_images.`);
      const data = await this.getJson(`https://api.arasaac.org/v1/pictograms/de/${n[1]}`);
      const m = data ? arasaacMeta(data) : null;
      if (!m) throw new ImageError(`Unknown picture "${id}". Use an image_id returned by search_images.`, 404);
      return this.remember(m);
    }
    if (source === 'commons') {
      const title = id.slice('commons:'.length).trim();
      if (!title || title.length > 300) throw new ImageError(`Unknown picture "${id.slice(0, 80)}".`);
      const data = (await this.getJson(this.commonsUrl({ titles: `File:${title}` }))) as { query?: { pages?: unknown[] } } | null;
      const page = (data?.query?.pages ?? [])[0] as Record<string, unknown> | undefined;
      const m = page ? this.commonsPage(page) : null;
      if (!m) throw new ImageError(`Unknown picture "${id.slice(0, 80)}". Use an image_id returned by search_images.`, 404);
      return this.remember(m);
    }
    const rel = ownPath(id);
    if (!rel) throw new ImageError(`Invalid picture id "${id.slice(0, 80)}".`);
    const entry = (await this.ownEntries(userId)).find((e) => e.rel === rel);
    if (!entry) {
      throw new ImageError(`There is no picture "${rel}" in the picture folder ${this.folderName}. Use an image_id returned by search_images.`, 404);
    }
    return this.remember(ownMeta(entry));
  }

  /** The picture's bytes (for the plugin). */
  async fetch(id: string, userId: string): Promise<ImageData> {
    const meta = await this.describe(id, userId);
    if (meta.source === 'own') return this.fetchOwn(meta, userId);
    // meta.image_id is the canonical id ("arasaac:02623" -> "arasaac:2623", "commons:Red_fox.jpg" -> "commons:Red fox.jpg").
    const cid = meta.image_id;
    const url = meta.source === 'arasaac' ? arasaacPng(cid) : this.commonsThumb.get(cid) ?? (await this.refreshCommonsThumb(cid));
    if (!url) throw new ImageError(`The picture "${id}" has no downloadable version.`, 404);
    const r = await this.httpGet(url, { maxBytes: MAX_IMAGE_BYTES, accept: 'image/*' });
    if (!r || r.status !== 200) throw new ImageError(`The picture "${meta.title}" could not be downloaded${r ? ` (HTTP ${r.status})` : ''}.`, 502);
    const mime = r.contentType.split(';')[0].trim().toLowerCase();
    if (!IMAGE_MIME.test(mime)) throw new ImageError(`The picture "${meta.title}" is not an image (${mime || 'unknown type'}).`, 502);
    return { meta, mime, bytes: r.body };
  }

  private async refreshCommonsThumb(id: string): Promise<string | undefined> {
    this.metaCache.delete(id);
    await this.describe(id, '');
    return this.commonsThumb.get(id);
  }

  private async fetchOwn(meta: ImageMeta, userId: string): Promise<ImageData> {
    const rel = ownPath(meta.image_id)!;
    const entry = (await this.ownEntries(userId)).find((e) => e.rel === rel);
    if (!entry) throw new ImageError(`There is no picture "${rel}" in the picture folder.`, 404);
    if (this.opts.localFolder) {
      const root = path.resolve(this.opts.folder);
      const file = path.resolve(root, rel);
      if (!file.startsWith(root + path.sep)) throw new ImageError('Invalid picture path.');
      // Links are not followed: the real path must stay inside the folder (a file swapped for a symlink after listing).
      const real = await fs.realpath(file).catch(() => null);
      const realRoot = await fs.realpath(root).catch(() => root);
      if (!real || !real.startsWith(realRoot + path.sep)) throw new ImageError(`There is no picture "${rel}" in the picture folder.`, 404);
      const st = await fs.stat(real).catch(() => null);
      if (!st || !st.isFile()) throw new ImageError(`There is no picture "${rel}" in the picture folder.`, 404);
      if (st.size > MAX_IMAGE_BYTES) throw new ImageError(`The picture "${rel}" is larger than 8 MB – make it smaller first.`, 413);
      return { meta, mime: entry.mime, bytes: await fs.readFile(real) };
    }
    const authorization = this.ncAuth(userId);
    const nc = this.opts.nextcloud!.internalUrl.replace(/\/+$/, '');
    // A preview (at most 1600 px) keeps large photos small and turns formats the editor cannot show into PNG/JPEG.
    if (entry.fileId) {
      const res = await this.ncFetch(`${nc}/index.php/core/preview?fileId=${encodeURIComponent(entry.fileId)}&x=1600&y=1600&a=1&forceIcon=0`, {
        headers: { authorization, 'ocs-apirequest': 'true' },
      });
      const mime = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (res.status === 200 && IMAGE_MIME.test(mime)) {
        const bytes = await this.ncRead(res, 'bytes');
        if (bytes.length <= MAX_IMAGE_BYTES) return { meta, mime, bytes };
      } else {
        await res.body?.cancel().catch(() => undefined);
      }
    }
    if (PREVIEW_ONLY_MIME.test(entry.mime)) {
      throw new ImageError(`The picture "${rel}" (${entry.mime}) could not be converted by Nextcloud – save it as JPEG or PNG.`, 415);
    }
    if (entry.size > MAX_IMAGE_BYTES) throw new ImageError(`The picture "${rel}" is larger than 8 MB – make it smaller first.`, 413);
    const url = this.davBase(userId) + '/' + rel.split('/').map(encodeURIComponent).join('/');
    const res = await this.ncFetch(url, { headers: { authorization } });
    if (res.status !== 200) throw new ImageError(`The picture "${rel}" could not be loaded from Nextcloud (HTTP ${res.status}).`, 502);
    const bytes = await this.ncRead(res, 'bytes');
    if (bytes.length > MAX_IMAGE_BYTES) throw new ImageError(`The picture "${rel}" is larger than 8 MB – make it smaller first.`, 413);
    return { meta, mime: entry.mime, bytes };
  }
}

// ---------------------------------------------------------------------------
// Source-specific parsing
// ---------------------------------------------------------------------------

function arasaacPng(id: string): string {
  const n = id.slice('arasaac:'.length);
  return `https://static.arasaac.org/pictograms/${n}/${n}_500.png`;
}

function arasaacMeta(p: unknown): ImageMeta | null {
  const o = p as { _id?: unknown; keywords?: Array<{ keyword?: unknown }>; tags?: unknown[] } | null;
  const n = Number(o?._id);
  if (!o || !Number.isInteger(n) || n <= 0) return null;
  const kws = (o.keywords ?? []).map((k) => String(k?.keyword ?? '')).filter(Boolean).slice(0, 6);
  return {
    image_id: `arasaac:${n}`,
    source: 'arasaac',
    title: kws[0] || `Piktogramm ${n}`,
    keywords: [...kws, ...(o.tags ?? []).map(String).slice(0, 5)],
    width: 500,
    height: 500,
    license: 'CC BY-NC-SA 4.0',
    author: 'Sergio Palao (ARASAAC)',
    credit: ARASAAC_CREDIT,
  };
}

function commonsMeta(page: Record<string, unknown>): { meta: ImageMeta; thumb: string } | null {
  const title = String(page.title ?? '');
  const info = (page.imageinfo as Array<Record<string, unknown>> | undefined)?.[0];
  if (!title.startsWith('File:') || !info || page.missing) return null;
  const mime = String(info.mime ?? '');
  if (!/^image\/(png|jpeg|gif|svg\+xml|webp|tiff)$/.test(mime)) return null;
  const thumb = String(info.thumburl ?? '');
  let host = '';
  try {
    host = new URL(thumb).hostname;
  } catch {
    return null;
  }
  if (!FREE_HOSTS.has(host)) return null;
  const ext = (info.extmetadata ?? {}) as Record<string, { value?: unknown }>;
  const name = title.slice('File:'.length);
  const id = `commons:${name}`;
  const author = stripHtml(ext.Artist?.value, 80) || stripHtml(ext.Credit?.value, 80);
  const license = stripHtml(ext.LicenseShortName?.value, 40);
  const tw = Number(info.thumbwidth) || Number(info.width) || undefined;
  const th = Number(info.thumbheight) || Number(info.height) || undefined;
  const meta: ImageMeta = {
    image_id: id,
    source: 'commons',
    title: stripHtml(ext.ObjectName?.value, 120) || name.replace(/\.[a-z0-9]+$/i, ''),
    description: stripHtml(ext.ImageDescription?.value, 200) || undefined,
    width: tw,
    height: th,
    license: license || undefined,
    author: author || undefined,
    credit: ['Bild: ' + (author || 'Wikimedia Commons'), license, author ? 'Wikimedia Commons' : ''].filter(Boolean).join(', '),
  };
  return { meta, thumb };
}

function ownMeta(e: OwnEntry): ImageMeta {
  const base = e.rel.split('/').pop()!.replace(/\.[a-z0-9]+$/i, '');
  const folder = e.rel.includes('/') ? e.rel.slice(0, e.rel.lastIndexOf('/')) : '';
  return {
    image_id: `own:${e.rel}`,
    source: 'own',
    title: base.replace(/[_-]+/g, ' ').trim() || base,
    description: folder ? `folder: ${folder}` : undefined,
    credit: '',
  };
}

/** Parse a WebDAV multistatus answer (Nextcloud uses the d: and oc: prefixes, but any prefix is accepted). */
export function parseMultistatus(xml: string): Array<{ href: string; collection: boolean; contentType: string; size: number; fileId?: string }> {
  const out: Array<{ href: string; collection: boolean; contentType: string; size: number; fileId?: string }> = [];
  const tag = (name: string) => new RegExp(`<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`);
  const responses = xml.match(/<(?:[\w-]+:)?response(?:\s[^>]*)?>[\s\S]*?<\/(?:[\w-]+:)?response>/g) ?? [];
  for (const r of responses) {
    const href = tag('href').exec(r)?.[1]?.trim();
    if (!href) continue;
    // Only the properties that were found (status 200) count.
    const ok = (r.match(/<(?:[\w-]+:)?propstat(?:\s[^>]*)?>[\s\S]*?<\/(?:[\w-]+:)?propstat>/g) ?? []).filter((p) => / 200 /.test(p)).join('');
    out.push({
      href: href.replace(/&amp;/g, '&'),
      collection: /<(?:[\w-]+:)?collection\s*\/>/.test(ok),
      contentType: tag('getcontenttype').exec(ok)?.[1]?.trim() ?? '',
      size: Number(tag('getcontentlength').exec(ok)?.[1] ?? 0) || 0,
      fileId: tag('fileid').exec(ok)?.[1]?.trim() || undefined,
    });
  }
  return out;
}

/** Create the service from the configuration; null when pictures are switched off. */
export function createImageService(opts: ImageServiceOptions): ImageService | null {
  const svc = new ImageService(opts);
  if (!svc.enabled) return null;
  return svc;
}

