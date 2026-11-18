/**
 * Settings page of the companion app (German UI, self-contained: no external resources).
 */
export function settingsPage(secret: string): string {
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Arbeitsblatt-Assistent</title>
<style>
:root{--bg:#f4f5f9;--card:#fff;--text:#1f2330;--muted:#5b6070;--accent:#3949ab;--ok:#2e7d32;--bad:#c62828;--border:#d9dce6}
@media (prefers-color-scheme:dark){:root{--bg:#15171d;--card:#1f222b;--text:#e8eaf0;--muted:#a0a5b5;--accent:#8c9eff;--ok:#81c784;--bad:#ef9a9a;--border:#343846}}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--text);line-height:1.5}
main{max-width:760px;margin:0 auto;padding:24px 16px 48px}
header{display:flex;align-items:center;gap:12px;margin-bottom:8px}header h1{font-size:1.4rem;margin:0}
.pill{font-size:.8rem;padding:2px 10px;border-radius:99px;background:color-mix(in srgb,var(--ok) 15%,transparent);color:var(--ok)}
section{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-top:16px}
h2{font-size:1.05rem;margin:0 0 10px}p{margin:6px 0}small,.muted{color:var(--muted)}
label{display:block;margin:10px 0 4px;font-weight:600;font-size:.9rem}
input[type=text],input[type=password],select{width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font:inherit}
button{font:inherit;padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer}
button.primary{background:var(--accent);border-color:var(--accent);color:#fff}button:disabled{opacity:.6;cursor:default}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}
code,pre{font-family:ui-monospace,Consolas,"DejaVu Sans Mono",monospace;font-size:.85rem}
pre{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;overflow:auto;white-space:pre-wrap;word-break:break-all;margin:6px 0}
.app{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:8px 0;border-top:1px solid var(--border)}.app:first-of-type{border-top:0}
.ok{color:var(--ok)}.bad{color:var(--bad)}.msg{min-height:1.5em;margin-top:8px}
details summary{cursor:pointer;font-weight:600;margin-top:8px}
</style></head><body><main>
<header><h1>Arbeitsblatt-Assistent</h1><span class="pill" id="running">läuft</span></header>
<p class="muted">Begleitprogramm für die Euro-Office-Desktop-App: KI-Chat mit eigenem Schlüssel und MCP für KI-Assistenten wie Claude – alles auf diesem Computer.</p>

<section><h2>1. Plugin in der Desktop-App</h2>
<div id="apps"></div>
<div class="row"><button class="primary" id="install">Plugin installieren / aktualisieren</button><span class="msg" id="install-msg"></span></div>
<p><small>Danach in der Desktop-App ein neues Dokument öffnen (oder die App neu starten): <b>Plugins → Arbeitsblatt-Assistent</b>. Das Plugin ist bereits mit diesem Programm verbunden – keine Einstellungen nötig.</small></p>
</section>

<section><h2>2. KI-Chat im Plugin</h2>
<p class="muted">Welches Sprachmodell der Chat im Plugin nutzt. Der Schlüssel bleibt auf diesem Computer.</p>
<label for="provider">Anbieter</label><select id="provider"></select>
<div id="key-row"><label for="key">API-Schlüssel</label><input type="password" id="key" autocomplete="off" placeholder=""></div>
<label for="model">Modell <small>(leer = Standard)</small></label><input type="text" id="model" autocomplete="off">
<div id="url-row"><label for="base">API-URL</label><input type="text" id="base" autocomplete="off" placeholder="http://127.0.0.1:11434/v1"></div>
<div class="row"><button class="primary" id="save">Speichern</button><span class="msg" id="save-msg"></span></div>
<p class="bad" id="chat-error"></p>
</section>

<section><h2>3. KI-Assistenten über MCP</h2>
<p>Claude, ChatGPT und andere KI-Assistenten können das in der Desktop-App geöffnete Dokument bearbeiten. Im Plugin muss dazu <b>„MCP-Zugriff erlauben“</b> eingeschaltet sein (bei diesem Programm voreingestellt).</p>
<details open><summary>Claude Desktop</summary>
<p>In <code id="claude-config-path"></code> eintragen (Claude → Einstellungen → Entwickler → Konfiguration bearbeiten) und Claude neu starten:</p>
<pre id="claude-config"></pre><button data-copy="claude-config">Kopieren</button></details>
<details><summary>Claude Code</summary><pre id="claude-code"></pre><button data-copy="claude-code">Kopieren</button></details>
<details><summary>Andere MCP-Clients (Streamable HTTP, ohne Anmeldung)</summary><pre id="mcp-url"></pre><button data-copy="mcp-url">Kopieren</button></details>
</section>

<section><h2>4. Start</h2>
<label style="font-weight:400"><input type="checkbox" id="autostart"> Beim Anmelden am Computer automatisch starten</label>
<span class="msg" id="autostart-msg"></span>
<div class="row"><button id="quit">Programm beenden</button></div>
<p><small id="footer"></small></p>
</section>
</main>
<script>
const SECRET = ${JSON.stringify(secret)};
const $ = (id) => document.getElementById(id);
let state = null;
async function api(path, body) {
  const res = await fetch('/companion/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: Object.assign({ 'x-companion-secret': SECRET }, body ? { 'content-type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
  return data;
}
function msg(id, text, ok) { const el = $(id); el.textContent = text; el.className = 'msg ' + (ok === false ? 'bad' : ok ? 'ok' : ''); }
function render() {
  const s = state;
  $('apps').innerHTML = '';
  for (const a of s.apps) {
    const div = document.createElement('div'); div.className = 'app';
    const left = document.createElement('div');
    const name = document.createElement('b'); name.textContent = a.name; left.appendChild(name);
    const dir = document.createElement('div'); dir.innerHTML = '<small></small>'; dir.firstChild.textContent = a.plugin_dir; left.appendChild(dir);
    const right = document.createElement('span');
    if (!a.detected) { right.textContent = 'nicht gefunden'; right.className = 'muted'; }
    else if (!a.installed) { right.textContent = 'Plugin fehlt'; right.className = 'bad'; }
    else if (a.version !== s.plugin_version || !a.configured) { right.textContent = 'Update verfügbar (' + (a.version || '?') + ')'; right.className = 'bad'; }
    else { right.textContent = 'Plugin ' + a.version + ' installiert'; right.className = 'ok'; }
    div.appendChild(left); div.appendChild(right); $('apps').appendChild(div);
  }
  if (!s.apps.some((a) => a.detected)) {
    const p = document.createElement('p'); p.className = 'muted';
    p.textContent = 'Keine Desktop-App gefunden. Installiere Euro-Office oder Nextcloud Office (Desktop), starte es einmal und klicke dann auf „Plugin installieren“.';
    $('apps').appendChild(p);
  }
  $('provider').innerHTML = '';
  for (const p of s.providers) { const o = document.createElement('option'); o.value = p.id; o.textContent = p.label; $('provider').appendChild(o); }
  $('provider').value = s.settings.provider;
  $('model').value = s.settings.model; $('base').value = s.settings.base_url;
  $('key').value = ''; $('key').placeholder = s.settings.has_key ? 'gespeichert – leer lassen, um ihn zu behalten' : '';
  updateProvider();
  $('chat-error').textContent = s.chat_error ? 'Der KI-Chat ist aus: ' + s.chat_error : '';
  $('mcp-url').textContent = s.mcp_url;
  $('claude-code').textContent = 'claude mcp add --transport http arbeitsblatt ' + s.mcp_url;
  const cmd = s.stdio_command;
  $('claude-config').textContent = JSON.stringify({ mcpServers: { arbeitsblatt: { command: cmd[0], args: cmd.slice(1) } } }, null, 2);
  $('claude-config-path').textContent = s.platform === 'win32' ? '%APPDATA%\\\\Claude\\\\claude_desktop_config.json'
    : s.platform === 'darwin' ? '~/Library/Application Support/Claude/claude_desktop_config.json' : '~/.config/Claude/claude_desktop_config.json';
  $('autostart').checked = s.autostart;
  $('footer').textContent = 'Version ' + s.version + ' · Server ' + s.url + ' · Einstellungen in ' + s.config_dir;
}
function updateProvider() {
  const p = state.providers.find((x) => x.id === $('provider').value);
  $('key-row').style.display = p.needs_key ? '' : 'none';
  $('url-row').style.display = p.id === 'ollama' || p.id === 'openai-compatible' ? '' : 'none';
  $('model').placeholder = p.model;
  if (!$('base').value && p.base_url) $('base').placeholder = p.base_url;
  $('model').disabled = p.id === 'none';
}
async function load() { state = await api('state'); render(); }
$('provider').addEventListener('change', updateProvider);
$('install').addEventListener('click', async () => {
  msg('install-msg', '…');
  try {
    const force = !state.apps.some((a) => a.detected);
    const r = await api('install', { force });
    msg('install-msg', r.installed.length ? 'Installiert für ' + r.installed.map((x) => x.app).join(', ') + '. Neues Dokument öffnen oder die App neu starten.' : 'Keine Desktop-App gefunden.', !!r.installed.length);
    await load();
  } catch (e) { msg('install-msg', e.message, false); }
});
$('save').addEventListener('click', async () => {
  msg('save-msg', '…');
  try {
    await api('settings', { provider: $('provider').value, model: $('model').value, base_url: $('base').value, api_key: $('key').value });
    msg('save-msg', 'Gespeichert – der Server startet neu.', true);
    setTimeout(load, 1500);
  } catch (e) { msg('save-msg', e.message, false); }
});
$('autostart').addEventListener('change', async () => {
  try { const r = await api('autostart', { enabled: $('autostart').checked }); $('autostart').checked = r.autostart; msg('autostart-msg', r.autostart ? 'Eingerichtet.' : 'Ausgeschaltet.', true); }
  catch (e) { msg('autostart-msg', e.message, false); }
});
$('quit').addEventListener('click', async () => {
  if (!confirm('Programm beenden? KI-Chat und MCP funktionieren dann nicht mehr, bis es wieder gestartet wird.')) return;
  await api('quit', {}).catch(() => {});
  $('running').textContent = 'beendet'; $('running').className = 'pill bad';
});
document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => {
  navigator.clipboard.writeText($(b.getAttribute('data-copy')).textContent).then(() => { b.textContent = 'Kopiert'; setTimeout(() => { b.textContent = 'Kopieren'; }, 1500); });
}));
load().catch((e) => { document.querySelector('main').insertAdjacentHTML('beforeend', '<p class="bad"></p>'); document.querySelector('main p.bad:last-child').textContent = 'Fehler: ' + e.message; });
</script></body></html>`;
}
