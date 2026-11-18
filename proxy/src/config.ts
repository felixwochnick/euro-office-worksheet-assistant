/**
 * Configuration from environment variables. See proxy/.env.example.
 */
export type ProviderName = 'mistral' | 'openai' | 'anthropic' | 'mock';

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
  timeoutMs: number;
  logLevel: string;
}

const DEFAULTS: Record<ProviderName, { model: string; baseUrl: string; keyVar: string }> = {
  mistral: { model: 'mistral-large-latest', baseUrl: 'https://api.mistral.ai/v1', keyVar: 'MISTRAL_API_KEY' },
  openai: { model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', keyVar: 'OPENAI_API_KEY' },
  anthropic: { model: 'claude-sonnet-5-5', baseUrl: 'https://api.anthropic.com', keyVar: 'ANTHROPIC_API_KEY' },
  mock: { model: 'mock', baseUrl: '', keyVar: '' },
};

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

  const proxyToken = env.PROXY_TOKEN || '';
  const allowNoToken = env.ALLOW_NO_TOKEN === 'true';
  if (!proxyToken && !allowNoToken) {
    throw new Error('PROXY_TOKEN is required (set ALLOW_NO_TOKEN=true only for local development)');
  }
  if (proxyToken && proxyToken.length < 16) {
    throw new Error('PROXY_TOKEN must be at least 16 characters long');
  }

  const trust = env.TRUST_PROXY;
  return {
    host: env.HOST || '0.0.0.0',
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
    maxTokens: int(env, 'LLM_MAX_TOKENS', 2048, 64, 64000),
    timeoutMs: int(env, 'LLM_TIMEOUT_MS', 60000, 1000, 600000),
    logLevel: env.LOG_LEVEL || 'info',
  };
}
