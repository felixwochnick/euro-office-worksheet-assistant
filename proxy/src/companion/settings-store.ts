/**
 * Settings of the companion app (config.json in the configuration folder, mode 0600: contains the AI API key).
 * They are turned into the server configuration of AUTH_MODE=local.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, type Config } from '../config.js';

export type CompanionProvider = 'none' | 'mistral' | 'openai' | 'anthropic' | 'ollama' | 'openai-compatible';

export interface CompanionSettings {
  port: number;
  /** Token of the local plugin (written into the installed plugin's local-config.js). */
  token: string;
  provider: CompanionProvider;
  model: string;
  apiKey: string;
  baseUrl: string;
  /** Additional browser origins (e.g. a Nextcloud whose web editor should use this companion). */
  extraOrigins: string[];
}

export const DEFAULT_PORT = 8787;

export const PROVIDERS: Record<CompanionProvider, { label: string; model: string; needsKey: boolean; baseUrl: string }> = {
  none: { label: 'Kein KI-Chat (nur MCP)', model: '', needsKey: false, baseUrl: '' },
  mistral: { label: 'Mistral', model: 'mistral-large-latest', needsKey: true, baseUrl: '' },
  openai: { label: 'OpenAI', model: 'gpt-4o-mini', needsKey: true, baseUrl: '' },
  anthropic: { label: 'Anthropic (Claude)', model: 'claude-sonnet-5-5', needsKey: true, baseUrl: '' },
  ollama: { label: 'Ollama (lokales Modell)', model: 'qwen2.5:7b', needsKey: false, baseUrl: 'http://127.0.0.1:11434/v1' },
  'openai-compatible': { label: 'OpenAI-kompatibel (eigene URL)', model: '', needsKey: false, baseUrl: '' },
};

export function defaults(): CompanionSettings {
  return {
    port: DEFAULT_PORT,
    token: crypto.randomBytes(24).toString('base64url'),
    provider: 'none',
    model: '',
    apiKey: '',
    baseUrl: '',
    extraOrigins: [],
  };
}

export function settingsFile(dir: string): string {
  return path.join(dir, 'config.json');
}

export function loadSettings(dir: string): { settings: CompanionSettings; created: boolean } {
  const base = defaults();
  let raw: Partial<CompanionSettings> | null = null;
  try {
    raw = JSON.parse(fs.readFileSync(settingsFile(dir), 'utf8'));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`Cannot read ${settingsFile(dir)}: ${(err as Error).message}`);
  }
  if (!raw) {
    saveSettings(dir, base);
    return { settings: base, created: true };
  }
  const s: CompanionSettings = { ...base, ...raw } as CompanionSettings;
  if (!(s.provider in PROVIDERS)) s.provider = 'none';
  if (typeof s.token !== 'string' || s.token.length < 16) s.token = base.token;
  if (!Number.isInteger(s.port) || s.port < 1024 || s.port > 65535) s.port = DEFAULT_PORT;
  if (!Array.isArray(s.extraOrigins)) s.extraOrigins = [];
  return { settings: s, created: false };
}

export function saveSettings(dir: string, s: CompanionSettings): void {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = settingsFile(dir);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function localUrl(s: CompanionSettings): string {
  return `http://127.0.0.1:${s.port}`;
}

/** Server configuration (AUTH_MODE=local) for these settings. */
export function serverConfig(s: CompanionSettings, logLevel = 'info'): Config {
  const p = PROVIDERS[s.provider];
  const provider = s.provider === 'ollama' || s.provider === 'openai-compatible' ? 'openai' : s.provider;
  const env: NodeJS.ProcessEnv = {
    AUTH_MODE: 'local',
    HOST: '127.0.0.1',
    PORT: String(s.port),
    PROXY_TOKEN: s.token,
    PUBLIC_URL: localUrl(s),
    // The desktop app's plugin pages run on file:// (Origin "null" or "file://"); the token protects the plugin
    // endpoints, the unauthenticated MCP endpoint only accepts loopback origins (server.ts).
    CORS_ORIGINS: ['null', 'file://', ...s.extraOrigins].join(','),
    LLM_PROVIDER: provider,
    LLM_MODEL: s.model || p.model,
    LLM_API_KEY: s.apiKey || (s.provider === 'ollama' || s.provider === 'openai-compatible' ? 'none' : ''),
    LLM_BASE_URL: s.baseUrl || p.baseUrl,
    RATE_LIMIT_MAX: '300',
    LOG_LEVEL: logLevel,
  };
  if (provider === 'none') delete env.LLM_MODEL;
  return loadConfig(env);
}
