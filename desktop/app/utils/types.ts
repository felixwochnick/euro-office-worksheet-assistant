/** State of the local server (Rust: sidecar.rs ServerStatus). */
export interface ServerStatus {
  state: 'starting' | 'running' | 'error' | 'stopped'
  url: string | null
  version: string | null
  code: 'already_running' | 'port_in_use' | 'failed' | 'crashed' | 'missing' | null
  message: string | null
  chat_error: string | null
}

/** Update check (Rust: updates.rs UpdateStatus). */
export interface UpdateStatus {
  state: 'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'error'
  current: string
  version: string | null
  notes: string | null
  manual: boolean
  url: string | null
  progress: number | null
  message: string | null
  checked_at: number | null
}

export interface AppInfo {
  version: string
  platform: 'macos' | 'windows' | 'linux' | string
  self_update: boolean
  log_dir: string | null
}

export interface DesktopAppState {
  id: string
  name: string
  detected: boolean
  plugin_dir: string
  installed: boolean
  configured: boolean
  version: string
}

export interface Provider {
  id: string
  label: string
  model: string
  needs_key: boolean
  base_url: string
}

/** GET /companion/api/state (proxy/src/companion/companion.ts). */
export interface CompanionState {
  version: string
  url: string
  mcp_url: string
  config_dir: string
  apps: DesktopAppState[]
  plugin_version: string
  settings: { provider: string, model: string, base_url: string, has_key: boolean, extra_origins: string[] }
  providers: Provider[]
  chat_error: string
  autostart: boolean
  stdio_command: string[]
  platform: string
  app?: boolean
}

export interface ClaudeDesktopStatus {
  installed: boolean
  config_path: string
  registered: boolean
  current: boolean
  error?: string
}

export interface ClaudeCodeStatus {
  installed: boolean
  command_path?: string
  registered: boolean | null
  error?: string
}

/** GET /companion/api/claude */
export interface ClaudeStatus {
  desktop: ClaudeDesktopStatus
  code: ClaudeCodeStatus
  stdio_command: string[]
  mcp_url: string
}
