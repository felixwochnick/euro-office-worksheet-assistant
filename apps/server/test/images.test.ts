import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runTurn } from '../src/agent.js';
import { loadConfig } from '../src/config.js';
import { ImageError, ImageService, ownPath, parseMultistatus, words, type HttpGet } from '../src/images.js';
import { buildSystemPrompt } from '../src/prompt.js';
import { buildServer } from '../src/server.js';
import { checkToolCall, runServerTool, toolDefinitions } from '../src/tools.js';
import type { SafeResponse } from '../src/safe-fetch.js';
import type { CompletionRequest, CompletionResult, LLMProvider } from '../src/types.js';

const TOKEN = 'test-token-0123456789';
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

function json(v: unknown): SafeResponse {
  return { status: 200, contentType: 'application/json', body: Buffer.from(JSON.stringify(v)) };
}

const ARASAAC_FOX = { _id: 2623, keywords: [{ keyword: 'Fuchs' }], tags: ['animal', 'wild'] };
const COMMONS_FOX = {
  query: {
    pages: [
      {
        index: 2, title: 'File:Fox two.png', imageinfo: [{ mime: 'image/png', width: 400, height: 300, thumburl: 'https://upload.wikimedia.org/two.png', thumbwidth: 400, thumbheight: 300, extmetadata: {} }],
      },
      {
        index: 1, title: 'File:Red fox.jpg',
        imageinfo: [{
          mime: 'image/jpeg', width: 4000, height: 3000, thumburl: 'https://thumb.wikimedia.org/red-fox-1000.jpg', thumbwidth: 1000, thumbheight: 750,
          extmetadata: { Artist: { value: '<a href="//x">Jane &amp; Doe</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' }, ImageDescription: { value: '<p>A red fox</p>' } },
        }],
      },
      { index: 3, title: 'File:Fox.pdf', imageinfo: [{ mime: 'application/pdf', thumburl: 'https://upload.wikimedia.org/x.jpg' }] },
      { index: 4, title: 'File:Evil.jpg', imageinfo: [{ mime: 'image/jpeg', thumburl: 'https://evil.example/x.jpg' }] },
    ],
  },
};

/** Fake internet: records the URLs and answers ARASAAC and Commons requests. */
function fakeHttp(log: string[] = []): HttpGet {
  return async (url) => {
    log.push(url);
    const u = new URL(url);
    if (u.hostname === 'api.arasaac.org') {
      if (u.pathname === '/v1/pictograms/de/search/Fuchs') return json([ARASAAC_FOX]);
      if (u.pathname === '/v1/pictograms/de/2623') return json(ARASAAC_FOX);
      return { status: 404, contentType: 'application/json', body: Buffer.from('[]') };
    }
    if (u.hostname === 'static.arasaac.org') return { status: 200, contentType: 'image/png', body: PNG };
    if (u.hostname === 'commons.wikimedia.org') {
      if (u.searchParams.get('generator') === 'search') return json(COMMONS_FOX);
      if (u.searchParams.get('titles') === 'File:Red fox.jpg') return json({ query: { pages: [COMMONS_FOX.query.pages[1]] } });
      return json({ query: { pages: [{ title: u.searchParams.get('titles'), missing: true }] } });
    }
    if (u.hostname === 'thumb.wikimedia.org') return { status: 200, contentType: 'image/jpeg', body: Buffer.from('jpeg') };
    return null;
  };
}

function multistatus(entries: Array<{ href: string; dir?: boolean; type?: string; id?: string; size?: number }>): string {
  return (
    '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">' +
    entries
      .map(
        (e) =>
          `<d:response><d:href>${e.href}</d:href><d:propstat><d:prop>` +
          (e.dir ? '<d:resourcetype><d:collection/></d:resourcetype>' : '<d:resourcetype/>') +
          (e.type ? `<d:getcontenttype>${e.type}</d:getcontenttype>` : '') +
          (e.size ? `<d:getcontentlength>${e.size}</d:getcontentlength>` : '') +
          (e.id ? `<oc:fileid>${e.id}</oc:fileid>` : '') +
          '</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>' +
          (e.dir ? '' : '<d:propstat><d:prop><d:quota-used-bytes/></d:prop><d:status>HTTP/1.1 404 Not Found</d:status></d:propstat>') +
          '</d:response>',
      )
      .join('') +
    '</d:multistatus>'
  );
}

const DAV = '/remote.php/dav/files/anna/Arbeitsblatt-Bilder';

/** Fake Nextcloud with a picture folder Arbeitsblatt-Bilder/{Asterix/obelix.png, Asterix/idefix.jpg, notes.txt}. */
function fakeNextcloud(calls: Array<{ url: string; method: string; auth: string }>): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({ url, method: init?.method ?? 'GET', auth: headers.get('authorization') ?? '' });
    const u = new URL(url);
    if (init?.method === 'PROPFIND') {
      if (u.pathname === DAV + '/') {
        return new Response(
          multistatus([
            { href: DAV + '/', dir: true },
            { href: DAV + '/Asterix/', dir: true },
            { href: DAV + '/notes.txt', type: 'text/plain', id: '9' },
          ]),
          { status: 207 },
        );
      }
      if (u.pathname === DAV + '/Asterix/') {
        return new Response(
          multistatus([
            { href: DAV + '/Asterix/', dir: true },
            { href: DAV + '/Asterix/obelix%20tr%C3%A4gt%20Hinkelstein.png', type: 'image/png', id: '41', size: 1000 },
            { href: DAV + '/Asterix/idefix.jpg', type: 'image/jpeg', id: '42', size: 2000 },
          ]),
          { status: 207 },
        );
      }
      return new Response('', { status: 404 });
    }
    if (u.pathname === '/index.php/core/preview' && u.searchParams.get('fileId') === '41') {
      return new Response(new Uint8Array(PNG), { status: 200, headers: { 'content-type': 'image/png' } });
    }
    if (u.pathname === '/index.php/core/preview') return new Response('', { status: 404 });
    if (u.pathname === DAV + '/Asterix/idefix.jpg') return new Response('jpegdata', { status: 200, headers: { 'content-type': 'image/jpeg' } });
    return new Response('', { status: 404 });
  }) as typeof fetch;
}

function ncService(calls: Array<{ url: string; method: string; auth: string }> = []) {
  return new ImageService({
    sources: ['arasaac', 'commons', 'own'],
    folder: 'Arbeitsblatt-Bilder',
    nextcloud: {
      internalUrl: 'http://nextcloud:80',
      credentials: (u) => (u === 'anna' ? { login: 'anna@example.org', password: 'app-pass' } : undefined),
      fetchImpl: fakeNextcloud(calls),
    },
    httpGet: fakeHttp(),
  });
}

// ---------------------------------------------------------------------------

test('images: helpers', () => {
  assert.deepEqual(words('Obelix trägt den Hinkelstein_groß.png'), ['obelix', 'traegt', 'den', 'hinkelstein', 'gross', 'png']);
  assert.equal(ownPath('own:Asterix/obelix.png'), 'Asterix/obelix.png');
  assert.equal(ownPath('own:/Asterix//x.png'), null);
  assert.equal(ownPath('own:../secret.png'), null);
  assert.equal(ownPath('own:a/../../b.png'), null);
  const r = parseMultistatus(multistatus([{ href: '/a/', dir: true }, { href: '/a/b%20c.png', type: 'image/png', id: '7', size: 12 }]));
  assert.deepEqual(r, [
    { href: '/a/', collection: true, contentType: '', size: 0, fileId: undefined },
    { href: '/a/b%20c.png', collection: false, contentType: 'image/png', size: 12, fileId: '7' },
  ]);
});

test('images: ARASAAC and Commons search, credits, only allowed hosts and image types', async () => {
  const log: string[] = [];
  const svc = new ImageService({ sources: ['arasaac', 'commons'], folder: '', httpGet: fakeHttp(log) });
  assert.deepEqual([...svc.sources], ['arasaac', 'commons'], 'own is off without a folder backend');
  const r = await svc.search('Fuchs', { userId: 'u' });
  assert.deepEqual(r.notes, []);
  assert.deepEqual(r.results.map((m) => m.image_id), ['arasaac:2623', 'commons:Red fox.jpg', 'commons:Fox two.png']);
  const [pic, photo] = r.results;
  assert.equal(pic.title, 'Fuchs');
  assert.match(pic.credit, /Sergio Palao, ARASAAC.*CC BY-NC-SA 4\.0/);
  assert.equal(photo.author, 'Jane & Doe');
  assert.equal(photo.description, 'A red fox');
  assert.equal(photo.credit, 'Bild: Jane & Doe, CC BY-SA 4.0, Wikimedia Commons');
  assert.equal(photo.width, 1000);
  assert.ok(log.some((u) => u.includes('gsrsearch=Fuchs+filetype')));

  const img = await svc.fetch('commons:Red fox.jpg', 'u');
  assert.equal(img.mime, 'image/jpeg');
  assert.equal(img.bytes.toString(), 'jpeg');
  assert.ok(log.includes('https://thumb.wikimedia.org/red-fox-1000.jpg'));
  const png = await svc.fetch('arasaac:2623', 'u');
  assert.equal(png.mime, 'image/png');
  assert.ok(log.includes('https://static.arasaac.org/pictograms/2623/2623_500.png'));
});

test('images: describe resolves ids that were not searched in this process, rejects unknown and foreign ids', async () => {
  const svc = new ImageService({ sources: ['arasaac', 'commons'], folder: '', httpGet: fakeHttp() });
  assert.equal((await svc.describe('arasaac:2623', 'u')).title, 'Fuchs');
  assert.equal((await svc.describe('commons:Red fox.jpg', 'u')).license, 'CC BY-SA 4.0');
  // fetch after describe only (thumbnail URL from the describe call)
  assert.equal((await svc.fetch('commons:Red fox.jpg', 'u')).mime, 'image/jpeg');
  await assert.rejects(svc.describe('arasaac:99', 'u'), /Unknown picture/);
  await assert.rejects(svc.describe('arasaac:../x', 'u'), /Unknown picture/);
  await assert.rejects(svc.describe('commons:Nope.jpg', 'u'), /Unknown picture/);
  await assert.rejects(svc.describe('own:a.png', 'u'), /not available/);
  await assert.rejects(svc.describe('https://evil.example/x.png', 'u'), (e: unknown) => e instanceof ImageError && /not a picture id/.test((e as Error).message));
});

test('images: unreachable source becomes a note, the other sources still answer', async () => {
  const http: HttpGet = async (url, o) => (new URL(url).hostname === 'commons.wikimedia.org' ? null : fakeHttp()(url, o));
  const svc = new ImageService({ sources: ['arasaac', 'commons'], folder: '', httpGet: http });
  const r = await svc.search('Fuchs', { userId: 'u' });
  assert.deepEqual(r.results.map((m) => m.image_id), ['arasaac:2623']);
  assert.match(r.notes[0], /commons\.wikimedia\.org is not reachable/);
});

test('images: own pictures from Nextcloud – folder listing, word match, preview and WebDAV download', async () => {
  const calls: Array<{ url: string; method: string; auth: string }> = [];
  const svc = ncService(calls);
  const r = await svc.search('Obelix Hinkelstein', { userId: 'anna', sources: ['own'] });
  assert.deepEqual(r.results.map((m) => m.image_id), ['own:Asterix/obelix trägt Hinkelstein.png']);
  assert.equal(r.results[0].title, 'obelix trägt Hinkelstein');
  assert.equal(r.results[0].credit, '');
  assert.equal(r.results[0].description, 'folder: Asterix');
  assert.equal(calls[0].auth, 'Basic ' + Buffer.from('anna@example.org:app-pass').toString('base64'));
  assert.equal(calls[0].url, 'http://nextcloud:80' + DAV + '/');

  const all = await svc.search('*', { userId: 'anna', sources: ['own'], limit: 12 });
  assert.deepEqual(all.results.map((m) => m.image_id).sort(), ['own:Asterix/idefix.jpg', 'own:Asterix/obelix trägt Hinkelstein.png'], 'non-images are left out');
  assert.deepEqual((await svc.search('asterix', { userId: 'anna', sources: ['own'] })).results.length, 2, 'folder names match');
  assert.equal(calls.filter((c) => c.method === 'PROPFIND').length, 2, 'listing is cached');

  const pre = await svc.fetch('own:Asterix/obelix trägt Hinkelstein.png', 'anna');
  assert.equal(pre.mime, 'image/png');
  assert.ok(calls.some((c) => c.url.startsWith('http://nextcloud:80/index.php/core/preview?fileId=41&x=1600')));
  const dl = await svc.fetch('own:Asterix/idefix.jpg', 'anna');
  assert.equal(dl.bytes.toString(), 'jpegdata', 'falls back to WebDAV when there is no preview');

  await assert.rejects(svc.describe('own:Asterix/missing.png', 'anna'), /no picture "Asterix\/missing.png"/);
  await assert.rejects(svc.search('x', { userId: 'bob', sources: ['own'] }).then((x) => { throw new Error(x.notes[0]); }), /signed in with Nextcloud/);
});

test('images: missing Nextcloud folder is explained', async () => {
  const svc = new ImageService({
    sources: ['own'],
    folder: 'Fehlt',
    nextcloud: { internalUrl: 'http://nc', credentials: () => ({ login: 'a', password: 'b' }), fetchImpl: (async () => new Response('', { status: 404 })) as typeof fetch },
    httpGet: fakeHttp(),
  });
  const r = await svc.search('x', { userId: 'a' });
  assert.match(r.notes[0], /folder "Fehlt" does not exist/);
});

test('images: own pictures from a local folder, confined to it', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pics-'));
  fs.mkdirSync(path.join(dir, 'Römer'));
  fs.writeFileSync(path.join(dir, 'Römer', 'legionär.png'), PNG);
  fs.writeFileSync(path.join(dir, 'liesmich.txt'), 'x');
  fs.writeFileSync(path.join(dir, '.hidden.png'), PNG);
  fs.writeFileSync(path.join(os.tmpdir(), 'outside.png'), PNG);
  try {
    const svc = new ImageService({ sources: ['own'], folder: dir, localFolder: true, httpGet: fakeHttp() });
    const r = await svc.search('Legionär', { userId: 'default' });
    assert.deepEqual(r.results.map((m) => m.image_id), ['own:Römer/legionär.png']);
    assert.equal((await svc.search('*', { userId: 'default' })).results.length, 1);
    const img = await svc.fetch('own:Römer/legionär.png', 'default');
    assert.deepEqual(img.bytes, PNG);
    await assert.rejects(svc.fetch('own:../outside.png', 'default'), /Invalid picture id/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('tools: search_images and picture blocks', async () => {
  const images = ncService();
  const ctx = { userId: 'anna', images };
  assert.ok(toolDefinitions(ctx).some((d) => d.name === 'search_images'));
  assert.ok(!toolDefinitions({ images: null }).some((d) => d.name === 'search_images'));

  const s = (await runServerTool({ id: '1', name: 'search_images', arguments: { query: 'Fuchs', source: 'pictograms' } }, ctx)) as any;
  assert.equal(s.ok, true);
  assert.deepEqual(s.results, [{ image_id: 'arasaac:2623', source: 'pictogram', title: 'Fuchs', keywords: ['Fuchs', 'animal', 'wild'], size: '500x500', license: 'CC BY-NC-SA 4.0' }]);
  assert.match(s.hint, /picture blocks/);
  const bad = (await runServerTool({ id: '2', name: 'search_images', arguments: { query: 'x', source: 'web' } }, ctx)) as any;
  assert.equal(bad.ok, false);
  const off = (await runServerTool({ id: '3', name: 'search_images', arguments: { query: 'x' } }, { userId: 'u', images: null })) as any;
  assert.match(off.error, /switched off/);

  const ok = await checkToolCall({
    id: '4', name: 'insert_blocks',
    arguments: {
      position: 'end',
      blocks: [
        { type: 'picture', image_id: 'arasaac:2623', width_cm: 3, picture_meta: { credit: 'fake' }, picture_data: { dataUrl: 'x' } },
        { type: 'columns', columns: [[{ type: 'picture', image_id: 'own:Asterix/idefix.jpg' }], [{ type: 'paragraph', text: 'Idefix' }]] },
      ],
    },
  }, ctx);
  assert.equal(ok.ok, true, ok.error);
  const blocks = ok.args.blocks as any[];
  assert.deepEqual(blocks[0].picture_meta, { title: 'Fuchs', credit: 'Piktogramm: Sergio Palao, ARASAAC (arasaac.org), CC BY-NC-SA 4.0', width: 500, height: 500 });
  assert.equal(blocks[0].picture_data, undefined, 'the model cannot inject image data');
  assert.deepEqual(blocks[1].columns[0][0].picture_meta, { title: 'idefix', credit: '' });

  const missing = await checkToolCall({ id: '5', name: 'insert_blocks', arguments: { position: 'end', blocks: [{ type: 'picture', image_id: 'arasaac:99' }] } }, ctx);
  assert.equal(missing.ok, false);
  assert.match(missing.error!, /^Nothing was inserted\. Unknown picture/);
  const noId = await checkToolCall({ id: '6', name: 'replace_elements', arguments: { from: 0, to: 0, blocks: [{ type: 'picture', url: 'https://x/y.png' }] } }, ctx);
  assert.match(noId.error!, /call search_images first/);
  const offBlocks = await checkToolCall({ id: '7', name: 'insert_blocks', arguments: { position: 'end', blocks: [{ type: 'picture', image_id: 'arasaac:2623' }] } }, { userId: 'u', images: null });
  assert.match(offBlocks.error!, /switched off/);
});

class Scripted implements LLMProvider {
  readonly name = 'scripted';
  readonly model = 'scripted';
  requests: CompletionRequest[] = [];
  constructor(private readonly steps: CompletionResult[]) {}
  async complete(req: CompletionRequest): Promise<CompletionResult> {
    this.requests.push(req);
    return this.steps[Math.min(this.requests.length - 1, this.steps.length - 1)];
  }
}

test('agent: searches pictures on the server, then sends the picture block to the plugin', async () => {
  const provider = new Scripted([
    { content: '', tool_calls: [{ id: 's', name: 'search_images', arguments: { query: 'Fuchs' } }] },
    { content: '', tool_calls: [{ id: 'i', name: 'insert_blocks', arguments: { position: 'end', blocks: [{ type: 'picture', image_id: 'arasaac:2623' }] } }] },
  ]);
  const r = await runTurn({ provider, messages: [{ role: 'user', content: 'Ein Bild vom Fuchs' }], maxIterations: 6, userId: 'anna', images: ncService() });
  assert.equal(r.done, false);
  assert.equal(r.pending_tool_calls[0].name, 'insert_blocks');
  const block = (r.pending_tool_calls[0].arguments.blocks as any[])[0];
  assert.equal(block.picture_meta.title, 'Fuchs');
  assert.ok(!JSON.stringify(r.messages).includes('base64'), 'no image data in the conversation');
  const search = JSON.parse((r.messages[1] as { content: string }).content);
  assert.equal(search.results[0].image_id, 'arasaac:2623');
  assert.ok(provider.requests[0].tools.some((t) => t.name === 'search_images'));
  assert.match(provider.requests[0].system, /PICTURES/);

  const off = new Scripted([{ content: 'ok', tool_calls: [] }]);
  await runTurn({ provider: off, messages: [{ role: 'user', content: 'x' }], maxIterations: 6 });
  assert.ok(!off.requests[0].tools.some((t) => t.name === 'search_images'));
  assert.doesNotMatch(off.requests[0].system, /PICTURES/);
  assert.doesNotMatch(buildSystemPrompt(undefined), /search_images/);
});

test('config: picture sources and folder', () => {
  const base = { LLM_PROVIDER: 'mock', PROXY_TOKEN: TOKEN };
  assert.deepEqual(loadConfig(base).imageSources, ['arasaac', 'commons', 'own']);
  assert.equal(loadConfig(base).imageFolder, '');
  assert.deepEqual(loadConfig({ ...base, IMAGE_SOURCES: 'none' }).imageSources, []);
  assert.deepEqual(loadConfig({ ...base, IMAGE_SOURCES: '' }).imageSources, ['arasaac', 'commons', 'own'], 'empty = default (docker compose)');
  assert.deepEqual(loadConfig({ ...base, IMAGE_SOURCES: 'arasaac, arasaac' }).imageSources, ['arasaac']);
  assert.throws(() => loadConfig({ ...base, IMAGE_SOURCES: 'google' }), /IMAGE_SOURCES/);
  assert.equal(loadConfig({ LLM_PROVIDER: 'mock', AUTH_MODE: 'nextcloud', NEXTCLOUD_URL: 'https://nc.example.org' }).imageFolder, 'Arbeitsblatt-Bilder');
  assert.equal(loadConfig({ LLM_PROVIDER: 'mock', AUTH_MODE: 'nextcloud', NEXTCLOUD_URL: 'https://nc.example.org', IMAGE_FOLDER: '' }).imageFolder, 'Arbeitsblatt-Bilder');
});

test('server: POST /v1/images/fetch returns the picture as data URL (authenticated)', async () => {
  const cfg = loadConfig({ LLM_PROVIDER: 'mock', PROXY_TOKEN: TOKEN, CORS_ORIGINS: 'https://cloud.example.org', LOG_LEVEL: 'silent' });
  const images = new ImageService({ sources: ['arasaac'], folder: '', httpGet: fakeHttp() });
  const app = await buildServer(cfg, { images });
  try {
    const unauth = await app.inject({ method: 'POST', url: '/v1/images/fetch', payload: { image_id: 'arasaac:2623' } });
    assert.equal(unauth.statusCode, 401);
    const res = await app.inject({ method: 'POST', url: '/v1/images/fetch', headers: { authorization: `Bearer ${TOKEN}` }, payload: { image_id: 'arasaac:2623' } });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.data_url, `data:image/png;base64,${PNG.toString('base64')}`);
    assert.equal(body.title, 'Fuchs');
    assert.match(body.credit, /ARASAAC/);
    const bad = await app.inject({ method: 'POST', url: '/v1/images/fetch', headers: { authorization: `Bearer ${TOKEN}` }, payload: { image_id: 'commons:x.jpg' } });
    assert.equal(bad.statusCode, 400);
    assert.match(bad.json().message, /not available/);
  } finally {
    await app.close();
  }
  const off = await buildServer(cfg, { images: null });
  try {
    const res = await off.inject({ method: 'POST', url: '/v1/images/fetch', headers: { authorization: `Bearer ${TOKEN}` }, payload: { image_id: 'arasaac:2623' } });
    assert.equal(res.statusCode, 404);
  } finally {
    await off.close();
  }
});

// ---------------------------------------------------------------------------
// Review fixes
// ---------------------------------------------------------------------------

test('images: non-canonical ids are checked and fetched under their canonical id', async () => {
  const log: string[] = [];
  const base = fakeHttp(log);
  const http: HttpGet = async (url, o) => {
    const u = new URL(url);
    if (u.hostname === 'api.arasaac.org' && u.pathname === '/v1/pictograms/de/02623') return json(ARASAAC_FOX);
    if (u.hostname === 'commons.wikimedia.org' && u.searchParams.get('titles') === 'File:Red_fox.jpg') return json({ query: { pages: [COMMONS_FOX.query.pages[1]] } });
    return base(url, o);
  };
  const images = new ImageService({ sources: ['arasaac', 'commons'], folder: '', httpGet: http });
  const r = await checkToolCall({
    id: 'c', name: 'insert_blocks',
    arguments: { position: 'end', blocks: [{ type: 'picture', image_id: 'arasaac:02623' }, { type: 'picture', image_id: 'commons:Red_fox.jpg' }] },
  }, { userId: 'u', images });
  assert.equal(r.ok, true, r.error);
  assert.deepEqual((r.args.blocks as any[]).map((b) => b.image_id), ['arasaac:2623', 'commons:Red fox.jpg']);
  assert.equal((await images.fetch('arasaac:02623', 'u')).mime, 'image/png');
  assert.ok(log.includes('https://static.arasaac.org/pictograms/2623/2623_500.png'));
  assert.equal((await images.fetch('commons:Red_fox.jpg', 'u')).mime, 'image/jpeg');
});

test('images: unexpected errors while checking pictures become a tool error, not a crash', async () => {
  const images = new ImageService({ sources: ['arasaac'], folder: '', httpGet: async () => { throw new TypeError('socket hang up'); } });
  const r = await checkToolCall({ id: 'e', name: 'insert_blocks', arguments: { position: 'end', blocks: [{ type: 'picture', image_id: 'arasaac:5' }] } }, { userId: 'u', images });
  assert.equal(r.ok, false);
  assert.match(r.error!, /Nothing was inserted\. A picture could not be checked \(socket hang up\)/);
});

test('images: Nextcloud under a sub-path, one listing for parallel checks, HEIC only through the preview', async () => {
  const calls: string[] = [];
  const sub = '/nextcloud/remote.php/dav/files/anna/Arbeitsblatt-Bilder';
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(input));
    calls.push(`${init?.method ?? 'GET'} ${u.pathname}`);
    if (init?.method === 'PROPFIND') {
      await new Promise((r) => setTimeout(r, 20));
      return new Response(multistatus([
        { href: sub + '/', dir: true },
        { href: sub + '/igel.heic', type: 'image/heic', id: '5', size: 10 },
        { href: sub + '/fuchs.png', type: 'image/png', id: '6', size: 10 },
      ]), { status: 207 });
    }
    return new Response('', { status: 404 });
  }) as typeof fetch;
  const svc = new ImageService({
    sources: ['own'], folder: 'Arbeitsblatt-Bilder',
    nextcloud: { internalUrl: 'http://nc', credentials: () => ({ login: 'anna', password: 'x' }), fetchImpl: f },
    httpGet: fakeHttp(),
  });
  const metas = await Promise.all([svc.describe('own:igel.heic', 'anna'), svc.describe('own:fuchs.png', 'anna')]);
  assert.deepEqual(metas.map((m) => m.title), ['igel', 'fuchs']);
  assert.equal(calls.filter((c) => c.startsWith('PROPFIND')).length, 1, 'parallel checks share one listing');
  await assert.rejects(svc.fetch('own:igel.heic', 'anna'), /could not be converted by Nextcloud/);
});

test('images: local folder does not follow a symlink out of the folder; relative folder refused', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pics-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-'));
  fs.writeFileSync(path.join(dir, 'bild.png'), PNG);
  fs.writeFileSync(path.join(outside, 'secret.png'), Buffer.from('secret'));
  try {
    const svc = new ImageService({ sources: ['own'], folder: dir, localFolder: true, httpGet: fakeHttp() });
    assert.equal((await svc.search('*', { userId: 'default' })).results.length, 1);
    fs.rmSync(path.join(dir, 'bild.png'));
    fs.symlinkSync(path.join(outside, 'secret.png'), path.join(dir, 'bild.png'));
    await assert.rejects(svc.fetch('own:bild.png', 'default'), /no picture/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
  assert.throws(() => loadConfig({ LLM_PROVIDER: 'mock', PROXY_TOKEN: TOKEN, IMAGE_FOLDER: 'bilder' }), /absolute/);
});

test('tools: without pictures the block documentation does not mention picture blocks', () => {
  const off = toolDefinitions({ images: null });
  const ins = off.find((d) => d.name === 'insert_blocks')!;
  const json = JSON.stringify(ins.parameters);
  assert.doesNotMatch(json, /search_images|image_id/);
  assert.ok(!(ins.parameters as any).properties.blocks.items.properties.type.enum.includes('picture'));
  const on = toolDefinitions({ images: ncService() }).find((d) => d.name === 'insert_blocks')!;
  assert.match(JSON.stringify(on.parameters), /image_id ONLY from search_images/);
});
