/**
 * Configuration from environment variables. See apps/server/.env.example.
 */
export type ProviderName = 'mistral' | 'openai' | 'anthropic' | 'mock' | 'none';

/**
 * How users authenticate:
 *  - token:     one shared PROXY_TOKEN for the plugin and MCP clients (single user / small team)
 *  - nextcloud: per Nextcloud user – the plugin signs in with Nextcloud Login Flow v2, MCP clients use a
 *               Nextcloud app password (HTTP Basic) or OAuth via Nextcloud
 *  - local:     companion mode on one computer: listens on loopback only, MCP without authentication,
 *               the plugin still uses PROXY_TOKEN
 */
export type AuthMode = 'token' | 'nextcloud' | 'local';

export interface Config {
  host: string;
  port: number;
  proxyToken: string;
  corsOrigins: string[];
  rateLimitMax: number;
  rateLimitWindow: string;
  trustProxy: boolean | string;
  bodyLimit: number;
  maxIterations: number;
  provider: ProviderName;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  /** Sent as reasoning_effort to OpenAI-compatible APIs ('' = not sent). */
  reasoningEffort: string;
  timeoutMs: number;
  logLevel: string;
  authMode: AuthMode;
  /** External URL of this proxy (e.g. https://cloud.example.org/worksheet-proxy), no trailing slash. */
  publicUrl: string;
  mcpEnabled: boolean;
  /** Nextcloud base URL as seen by users' browsers (no trailing slash). */
  nextcloudUrl: string;
  /** Nextcloud base URL as seen by this server (defaults to nextcloudUrl). */
  nextcloudInternalUrl: string;
  nextcloudOAuthClientId: string;
  nextcloudOAuthClientSecret: string;
  /** Directory for persistent state (sessions, OAuth clients and grants). */
  dataDir: string;
  /** Host names accepted in the Host header in local mode (DNS rebinding protection). */
  allowedHosts: string[];
}

const DEFAULTS: Record<ProviderName, { model: string; baseUrl: string; keyVar: string }> = {
  mistral: { model: 'mistral-large-latest', baseUrl: 'https://api.mistral.ai/v1', keyVar: 'MISTRAL_API_KEY' },
  openai: { model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', keyVar: 'OPENAI_API_KEY' },
  anthropic: { model: 'claude-sonnet-5-5', baseUrl: 'https://api.anthropic.com', keyVar: 'ANTHROPIC_API_KEY' },
  mock: { model: 'mock', baseUrl: '', keyVar: '' },
  none: { model: '', baseUrl: '', keyVar: '' },
};

const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);

function url(env: NodeJS.ProcessEnv, name: string): string {
  const raw = (env[name] || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`${name} must be an absolute URL (got "${raw}")`);
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error(`${name} must start with https:// or http://`);
  if (u.search || u.hash) throw new Error(`${name} must not contain a query or fragment`);
  return raw;
}

function int(env: NodeJS.ProcessEnv, name: string, def: number, min: number, max: number): number {
  const raw = env[name];
  if (raw == null || raw === '') return def;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${name} must be a number between ${min} and ${max}`);
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const provider = (env.LLM_PROVIDER || 'mistral').toLowerCase() as ProviderName;
  if (!(provider in DEFAULTS)) {
    throw new Error(`LLM_PROVIDER must be one of ${Object.keys(DEFAULTS).join(', ')} (got "${provider}")`);
  }
  const d = DEFAULTS[provider];
  const apiKey = env.LLM_API_KEY || (d.keyVar ? env[d.keyVar] : '') || '';
  const baseUrl = env.LLM_BASE_URL || d.baseUrl;

  if (provider === 'mistral' || provider === 'anthropic') {
    if (!apiKey) throw new Error(`Missing API key: set LLM_API_KEY or ${d.keyVar}`);
  }
  if (provider === 'openai' && !apiKey && /api\.openai\.com/.test(baseUrl)) {
    throw new Error('Missing API key: set LLM_API_KEY or OPENAI_API_KEY (or LLM_BASE_URL for a local server such as Ollama)');
  }

  const authMode = (env.AUTH_MODE || 'token').trim().toLowerCase() as AuthMode;
  if (!['token', 'nextcloud', 'local'].includes(authMode)) {
    throw new Error(`AUTH_MODE must be token, nextcloud or local (got "${authMode}")`);
  }
  const host = env.HOST || (authMode === 'local' ? '127.0.0.1' : '0.0.0.0');
  if (authMode === 'local' && !LOOPBACK.has(host)) {
    throw new Error('AUTH_MODE=local serves MCP without authentication and must listen on 127.0.0.1, ::1 or localhost (HOST)');
  }

  const proxyToken = env.PROXY_TOKEN || '';
  const allowNoToken = env.ALLOW_NO_TOKEN === 'true';
  // In nextcloud mode users sign in individually; a shared token is optional there.
  if (!proxyToken && !allowNoToken && authMode !== 'nextcloud') {
    throw new Error('PROXY_TOKEN is required (set ALLOW_NO_TOKEN=true only for local development)');
  }
  if (proxyToken && proxyToken.length < 16) {
    throw new Error('PROXY_TOKEN must be at least 16 characters long');
  }

  const nextcloudUrl = url(env, 'NEXTCLOUD_URL');
  const nextcloudOAuthClientId = (env.NEXTCLOUD_OAUTH_CLIENT_ID || '').trim();
  const nextcloudOAuthClientSecret = (env.NEXTCLOUD_OAUTH_CLIENT_SECRET || '').trim();
  const publicUrl = url(env, 'PUBLIC_URL');
  if (authMode === 'nextcloud') {
    if (!nextcloudUrl) throw new Error('AUTH_MODE=nextcloud needs NEXTCLOUD_URL (e.g. https://cloud.example.org)');
    if (!!nextcloudOAuthClientId !== !!nextcloudOAuthClientSecret) {
      throw new Error('Set both NEXTCLOUD_OAUTH_CLIENT_ID and NEXTCLOUD_OAUTH_CLIENT_SECRET (or neither)');
    }
    if (nextcloudOAuthClientId && !publicUrl) {
      throw new Error('OAuth sign-in for MCP clients needs PUBLIC_URL (the external URL of this proxy)');
    }
  }

  const trust = env.TRUST_PROXY;
  return {
    host,
    port: int(env, 'PORT', 8787, 1, 65535),
    proxyToken,
    corsOrigins: (env.CORS_ORIGINS || '')
      .split(',')
      .map((s) => s.trim().replace(/\/+$/, ''))
      .filter(Boolean),
    rateLimitMax: int(env, 'RATE_LIMIT_MAX', 30, 1, 100000),
    rateLimitWindow: env.RATE_LIMIT_WINDOW || '1 minute',
    trustProxy: trust === 'true' ? true : trust && trust !== 'false' ? trust : false,
    bodyLimit: int(env, 'BODY_LIMIT_BYTES', 1_000_000, 10_000, 20_000_000),
    maxIterations: int(env, 'MAX_ITERATIONS', 6, 1, 20),
    provider,
    model: env.LLM_MODEL || d.model,
    apiKey,
    baseUrl,
    temperature: int(env, 'LLM_TEMPERATURE', 0.2, 0, 2),
    // Reasoning models (e.g. current mistral-large) spend part of the budget on "thinking".
    maxTokens: int(env, 'LLM_MAX_TOKENS', 8192, 64, 64000),
    // Reasoning models think for a very long time by default (mistral-large-latest used
    // 8000+ tokens on "Alle meine Entchen"); "medium" keeps answers fast and accurate.
    // "off" = do not send the parameter.
    reasoningEffort: ((): string => {
      const v = (env.LLM_REASONING_EFFORT ?? '').trim().toLowerCase();
      if (v === 'off' || v === 'none-sent') return '';
      if (v) return v;
      return provider === 'mistral' ? 'medium' : '';
    })(),
    timeoutMs: int(env, 'LLM_TIMEOUT_MS', 120000, 1000, 600000),
    logLevel: env.LOG_LEVEL || 'info',
    authMode,
    publicUrl,
    mcpEnabled: env.MCP_ENABLED !== 'false',
    nextcloudUrl,
    nextcloudInternalUrl: url(env, 'NEXTCLOUD_INTERNAL_URL') || nextcloudUrl,
    nextcloudOAuthClientId,
    nextcloudOAuthClientSecret,
    dataDir: env.DATA_DIR || 'data',
    allowedHosts: (env.ALLOWED_HOSTS || 'localhost,127.0.0.1,[::1]')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  };
}
