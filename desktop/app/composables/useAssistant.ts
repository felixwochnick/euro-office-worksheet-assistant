import type { AppInfo, ClaudeStatus, CompanionState, ServerStatus, UpdateStatus } from '~/utils/types'

const INITIAL_SERVER: ServerStatus = { state: 'starting', url: null, version: null, code: null, message: null, chat_error: null }

/**
 * Shared state of the window: the server (child process), the update check and the companion's settings.
 * `start()` runs once (app.vue); pages read the refs.
 */
export function useAssistant() {
  const server = useState<ServerStatus>('server', () => ({ ...INITIAL_SERVER }))
  const update = useState<UpdateStatus | null>('update', () => null)
  const info = useState<AppInfo | null>('info', () => null)
  const state = useState<CompanionState | null>('companion', () => null)
  const stateError = useState<string>('companion-error', () => '')
  const claude = useState<ClaudeStatus | null>('claude', () => null)
  const claudeLoading = useState<boolean>('claude-loading', () => false)

  async function refresh() {
    if (server.value.state !== 'running') return
    try {
      state.value = await companion<CompanionState>('state')
      stateError.value = ''
    } catch (err) {
      stateError.value = errorText(err)
    }
  }

  async function refreshClaude() {
    if (server.value.state !== 'running') return
    claudeLoading.value = true
    try {
      claude.value = await companion<ClaudeStatus>('claude')
    } catch (err) {
      stateError.value = errorText(err)
    } finally {
      claudeLoading.value = false
    }
  }

  async function start() {
    const [i, s, u] = await Promise.all([
      call<AppInfo>('app_info'),
      call<ServerStatus>('server_status'),
      call<UpdateStatus>('update_status')
    ])
    info.value = i
    server.value = s
    update.value = u
    await onEvent<ServerStatus>('server-status', (payload) => {
      const wasRunning = server.value.state === 'running'
      server.value = payload
      if (payload.state === 'running' && !wasRunning) {
        refresh()
        refreshClaude()
      }
    })
    await onEvent<UpdateStatus>('update-status', (payload) => {
      update.value = payload
    })
    if (s.state === 'running') {
      await refresh()
      refreshClaude()
    }
    // Desktop apps may be installed or started meanwhile: keep the plugin status current while visible.
    setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 8000)
  }

  /** Plugin installed, current and connected in at least one desktop app. */
  const pluginReady = computed(() => !!state.value?.apps.some(a => a.detected && a.installed && a.configured && a.version === state.value?.plugin_version))
  const appDetected = computed(() => !!state.value?.apps.some(a => a.detected))
  const chatReady = computed(() => !!state.value && state.value.settings.provider !== 'none' && !state.value.chat_error)
  const claudeReady = computed(() => !!claude.value && ((claude.value.desktop.registered && claude.value.desktop.current) || claude.value.code.registered === true))

  return { server, update, info, state, stateError, claude, claudeLoading, refresh, refreshClaude, start, pluginReady, appDetected, chatReady, claudeReady }
}
