#!/usr/bin/env node
/*
 * Minimal "document storage" for testing the plugin in a real Euro-Office
 * Document Server without Nextcloud (development only – no auth, JWT off).
 *
 *   GET  /                 editor page (DocsAPI.DocEditor) for files/worksheet.docx
 *        ?pluginsData=1    additionally register the plugin explicitly via editorConfig.plugins
 *        ?title=Name.docx  file name shown in the editor (default Worksheet.docx)
 *        ?spellcheck=0     no spell checking (no red underlines in screenshots)
 *   GET  /files/current    the current version of the document (downloaded by the Document Server)
 *   GET  /reset            start again from files/worksheet.docx with a new document key
 *   POST /callback         save callback; saved versions go to dev/eurooffice/out/
 *   GET  /forcesave        ask the Document Server to save now (CommandService)
 *   GET  /saved            JSON list of saved files
 *
 * Env: PORT (8099), DS_URL (browser URL of the Document Server, http://localhost:8090),
 *      DS_INTERNAL_URL (URL of the Document Server as seen from this server, = DS_URL),
 *      STORAGE_URL (this server as seen from the Document Server container,
 *      http://host.docker.internal:8099)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8099);
const DS_URL = (process.env.DS_URL || 'http://localhost:8090').replace(/\/+$/, '');
const DS_INTERNAL_URL = (process.env.DS_INTERNAL_URL || DS_URL).replace(/\/+$/, '');
const STORAGE_URL = (process.env.STORAGE_URL || `http://host.docker.internal:${PORT}`).replace(/\/+$/, '');
const PLUGIN_GUID = 'asc.{DA7D8078-28E2-4FFC-A41B-02BD1B9CE490}';
const outDir = path.join(here, 'out');
fs.mkdirSync(outDir, { recursive: true });

// The Document Server caches documents by key, and a key must not be reused
// after the document was saved (callback status 2) – like a real storage, we
// switch to the saved version and a new key then.
const original = path.join(here, 'files', 'worksheet.docx');
let currentFile = original;
let docKey = newKey();
const saved = [];

function newKey() {
  return 'worksheet-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function page(withPluginsData, title = 'Worksheet.docx', spellcheck = true) {
  const config = {
    document: {
      fileType: 'docx',
      key: docKey,
      title,
      url: `${STORAGE_URL}/files/current?key=${docKey}`,
      permissions: { edit: true, download: true },
    },
    documentType: 'word',
    editorConfig: {
      callbackUrl: `${STORAGE_URL}/callback`,
      lang: 'de',
      mode: 'edit',
      user: { id: 'teacher-1', name: 'Lehramtsstudentin' },
      customization: { forcesave: true, compactHeader: false, features: { featuresTips: false, ...(spellcheck ? {} : { spellcheck: { mode: false, change: false } }) } },
      ...(withPluginsData ? { plugins: { pluginsData: [`${DS_URL}/sdkjs-plugins/worksheet-assistant/config.json`] } } : {}),
    },
    width: '100%',
    height: '100%',
  };
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>Euro-Office Test – Noten-Assistent</title>
<style>html,body{margin:0;height:100%}#editor{height:100%}</style>
<script src="${DS_URL}/web-apps/apps/api/documents/api.js"></script></head>
<body><div id="editor"></div>
<script>
  window.pluginGuid = ${JSON.stringify(PLUGIN_GUID)};
  window.docEditor = new DocsAPI.DocEditor('editor', Object.assign(${JSON.stringify(config)}, {
    events: {
      onAppReady: function () { window.editorReady = true; },
      onDocumentReady: function () { window.documentReady = true; },
      onError: function (e) { window.editorError = e && e.data; console.error('editor error', JSON.stringify(e && e.data)); }
    }
  }));
</script></body></html>`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function onCallback(body) {
  const data = JSON.parse(body || '{}');
  console.log(`callback status=${data.status}${data.url ? ' url=' + data.url : ''}`);
  // 2 = ready for saving, 6 = force save
  if ((data.status === 2 || data.status === 6) && data.url) {
    // The URL uses the Document Server's public address; rewrite it if this server reaches it differently.
    const url = data.url.replace(DS_URL, DS_INTERNAL_URL);
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    const file = path.join(outDir, `saved-${Date.now()}.docx`);
    fs.writeFileSync(file, buf);
    saved.push({ file, status: data.status, bytes: buf.length, at: new Date().toISOString() });
    console.log(`saved ${file} (${buf.length} bytes)`);
    // Only the current session switches the document: a late "closed" callback of an earlier
    // session (e.g. after /reset) must not replace the key of the editor that is open now.
    if (data.status === 2 && (!data.key || data.key === docKey)) {
      currentFile = file;
      docKey = newKey();
      console.log(`editing session closed – next key ${docKey}`);
    }
  }
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page(url.searchParams.has('pluginsData'), url.searchParams.get('title') || undefined, url.searchParams.get('spellcheck') !== '0'));
      } else if (req.method === 'GET' && url.pathname === '/files/current') {
        const file = currentFile;
        res.writeHead(200, { 'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        fs.createReadStream(file).pipe(res);
      } else if (req.method === 'POST' && url.pathname === '/callback') {
        await onCallback(await readBody(req));
        res.writeHead(200, { 'content-type': 'application/json' }).end('{"error":0}');
      } else if (req.method === 'GET' && url.pathname === '/forcesave') {
        const r = await fetch(`${DS_INTERNAL_URL}/coauthoring/CommandService.ashx`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ c: 'forcesave', key: docKey }),
        });
        res.writeHead(200, { 'content-type': 'application/json' }).end(await r.text());
      } else if (req.method === 'GET' && url.pathname === '/reset') {
        currentFile = original;
        docKey = newKey();
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ key: docKey }));
      } else if (req.method === 'GET' && url.pathname === '/saved') {
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(saved));
      } else {
        res.writeHead(404).end();
      }
    } catch (err) {
      console.error(err);
      res.writeHead(500).end(String(err));
    }
  })
  .listen(PORT, () => {
    console.log(`Editor test page: http://localhost:${PORT}/   (document key ${docKey})`);
    console.log(`Document Server: ${DS_URL}, storage as seen from the container: ${STORAGE_URL}`);
  });
