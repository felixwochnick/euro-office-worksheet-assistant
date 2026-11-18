/**
 * Simulated backend for `nuxt dev` in a browser and for UI checks (never used inside the app).
 * Scenario via URL: ?scenario=fresh (nothing set up, default) | ready | error | update | starting
 */
import type { AppInfo, ClaudeStatus, CompanionState, ServerStatus, UpdateStatus } from './types'

type Handler = (payload: unknown) => void
const listeners = new Map<string, Set<Handler>>()
const scenario = typeof window === 'undefined' ? 'fresh' : new URLSearchParams(window.location.search).get('scenario') || 'fresh'
const ready = scenario === 'ready' || scenario === 'update'

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
function emit(event: string, payload: unknown) {
  for (const h of listeners.get(event) ?? []) h(payload)
}

const server: ServerStatus = scenario === 'error'
  ? { state: 'error', url: null, version: null, code: 'already_running', message: 'Ein anderer Arbeitsblatt-Assistent läuft bereits (ältere Version im Terminal oder Autostart). Bitte beenden und erneut versuchen.', chat_error: null }
  : { state: scenario === 'starting' ? 'starting' : 'running', url: 'http://127.0.0.1:8787', version: '0.6.0', code: null, message: null, chat_error: null }

const update: UpdateStatus = scenario === 'update'
  ? { state: 'available', current: '0.6.0', version: '0.6.1', notes: '- Kleinere Fehler behoben', manual: false, url: 'https://github.com/felixwochnick/euro-office-worksheet-assistant/releases/tag/v0.6.1', progress: null, message: null, checked_at: Date.now() / 1000 }
  : { state: 'none', current: '0.6.0', version: null, notes: null, manual: false, url: null, progress: null, message: null, checked_at: Date.now() / 1000 }

const state: CompanionState = {
  version: '0.6.0',
  url: 'http://127.0.0.1:8787',
  mcp_url: 'http://127.0.0.1:8787/mcp',
  config_dir: '/home/lehrer/.config/worksheet-assistant',
  apps: [{ id: 'desktop-editors', name: 'Euro-Office / Nextcloud Office', detected: true, plugin_dir: '/home/lehrer/.local/share/euro-office/desktopeditors/sdkjs-plugins/{DA7D8078-28E2-4FFC-A41B-02BD1B9CE490}', installed: ready, configured: ready, version: ready ? '0.6.0' : '' }],
  plugin_version: '0.6.0',
  settings: { provider: ready ? 'mistral' : 'none', model: '', base_url: '', has_key: ready, extra_origins: [] },
  providers: [
    { id: 'none', label: 'Kein KI-Chat (nur MCP)', model: '', needs_key: false, base_url: '' },
    { id: 'mistral', label: 'Mistral', model: 'mistral-large-latest', needs_key: true, base_url: '' },
    { id: 'openai', label: 'OpenAI', model: 'gpt-4o-mini', needs_key: true, base_url: '' },
    { id: 'anthropic', label: 'Anthropic (Claude)', model: 'claude-sonnet-5-5', needs_key: true, base_url: '' },
    { id: 'ollama', label: 'Ollama (lokales Modell)', model: 'qwen2.5:7b', needs_key: false, base_url: 'http://127.0.0.1:11434/v1' },
    { id: 'openai-compatible', label: 'OpenAI-kompatibel (eigene URL)', model: '', needs_key: false, base_url: '' }
  ],
  chat_error: '',
  autostart: ready,
  stdio_command: ['/opt/Arbeitsblatt-Assistent/worksheet-assistant-app', 'mcp-stdio'],
  platform: 'linux',
  app: true
}

const claude: ClaudeStatus = {
  desktop: { installed: true, config_path: '/home/lehrer/.config/Claude/claude_desktop_config.json', registered: ready, current: ready },
  code: { installed: false, registered: null },
  stdio_command: state.stdio_command,
  mcp_url: state.mcp_url
}

const info: AppInfo = { version: '0.6.0', platform: 'linux', self_update: true, log_dir: '/home/lehrer/.local/share/io.github.felixwochnick.worksheet-assistant/logs' }

async function api(method: string, path: string, body: Record<string, unknown> | null): Promise<unknown> {
  await wait(250)
  if (server.state !== 'running') throw 'Der Server läuft gerade nicht.'
  if (method === 'GET' && path === 'state') return structuredClone(state)
  if (method === 'GET' && path === 'claude') {
    await wait(600)
    return structuredClone(claude)
  }
  if (path === 'install') {
    for (const a of state.apps) Object.assign(a, { installed: true, configured: true, version: state.plugin_version })
    return { ok: true, installed: state.apps.map(a => ({ app: a.name, dir: a.plugin_dir })) }
  }
  if (path === 'settings') {
    const p = state.providers.find(x => x.id === body?.provider)
    if (!p) throw 'Unbekannter Anbieter.'
    if (p.needs_key && !body?.api_key && !state.settings.has_key) throw `${p.label}: API-Schlüssel fehlt.`
    state.settings = { ...state.settings, provider: p.id, model: String(body?.model ?? ''), base_url: String(body?.base_url ?? ''), has_key: p.needs_key && (!!body?.api_key || state.settings.has_key) && !body?.clear_key }
    return { ok: true }
  }
  if (path === 'autostart') {
    state.autostart = !!body?.enabled
    return { ok: true, autostart: state.autostart }
  }
  if (path === 'claude') {
    await wait(500)
    const add = body?.action === 'add'
    if (body?.client === 'desktop') Object.assign(claude.desktop, { registered: add, current: add })
    else throw 'Claude Code wurde nicht gefunden.'
    return { ok: true, status: structuredClone(claude) }
  }
  throw `HTTP 404 (${method} ${path})`
}

export async function mockCall(command: string, args?: Record<string, unknown>): Promise<unknown> {
  switch (command) {
    case 'app_info': return { ...info }
    case 'server_status': return { ...server }
    case 'update_status': return { ...update }
    case 'api': return api(String(args?.method), String(args?.path), (args?.body as Record<string, unknown>) ?? null)
    case 'restart_server':
      Object.assign(server, { state: 'starting', code: null, message: null })
      emit('server-status', { ...server })
      await wait(800)
      Object.assign(server, { state: 'running', url: 'http://127.0.0.1:8787', version: '0.6.0' })
      emit('server-status', { ...server })
      return null
    case 'check_updates':
      emit('update-status', { ...update, state: 'checking' })
      await wait(700)
      update.checked_at = Date.now() / 1000
      emit('update-status', { ...update })
      return { ...update }
    case 'install_update':
      for (let p = 0; p <= 1; p += 0.1) {
        emit('update-status', { ...update, state: 'downloading', progress: p })
        await wait(150)
      }
      return null
    case 'open_external':
    case 'open_folder':
      window.open(String(args?.url ?? ''), '_blank')
      return null
    case 'quit_app':
      document.body.innerHTML = '<p style="padding:2rem">Beendet (Simulation).</p>'
      return null
    default:
      throw `Unbekannter Befehl ${command}`
  }
}

export function mockListen(event: string, handler: Handler): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event)!.add(handler)
  if (event === 'server-status' && server.state === 'starting') {
    setTimeout(() => {
      Object.assign(server, { state: 'running' })
      emit('server-status', { ...server })
    }, 1500)
  }
  return () => listeners.get(event)?.delete(handler)
}
