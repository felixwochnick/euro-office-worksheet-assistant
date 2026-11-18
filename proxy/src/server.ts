/**
 * HTTP server: POST /v1/chat (agent step), GET /v1/info, GET /healthz.
 *
 * Security:
 *  - shared token (Authorization: Bearer <PROXY_TOKEN>) for /v1/*
 *  - CORS allowlist (CORS_ORIGINS = origin of the Euro-Office / Nextcloud domain)
 *  - per-IP rate limit
 *  - the LLM API key never leaves the server
 */
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { runTurn } from './agent.js';
import { loadConfig, type Config } from './config.js';
import { createProvider } from './providers/index.js';
import { ProviderError, type ChatMessage, type DocumentContext, type LLMProvider } from './types.js';

const chatBodySchema = {
  type: 'object',
  required: ['messages'],
  additionalProperties: false,
  properties: {
    messages: {
      type: 'array',
      minItems: 1,
      maxItems: 200,
      items: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { type: 'string', enum: ['user', 'assistant', 'tool'] },
          content: { type: ['string', 'null'], maxLength: 50000 },
          tool_call_id: { type: 'string', maxLength: 128 },
          name: { type: 'string', maxLength: 64 },
          tool_calls: {
            type: 'array',
            maxItems: 20,
            items: {
              type: 'object',
              required: ['id', 'name'],
              properties: {
                id: { type: 'string', maxLength: 128 },
                name: { type: 'string', maxLength: 64 },
                arguments: { type: 'object' },
              },
            },
          },
        },
      },
    },
    document_context: { type: 'object' },
  },
} as const;

function tokenMatches(given: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/** Make sure the client history is consistent before sending it upstream. */
function sanitizeMessages(raw: any[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  const openCalls = new Set<string>();
  for (const m of raw) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: String(m.content ?? '') });
    } else if (m.role === 'assistant') {
      const calls = Array.isArray(m.tool_calls)
        ? m.tool_calls.map((c: any) => ({ id: String(c.id), name: String(c.name), arguments: c.arguments ?? {} }))
        : [];
      calls.forEach((c: { id: string }) => openCalls.add(c.id));
      out.push(calls.length ? { role: 'assistant', content: String(m.content ?? ''), tool_calls: calls } : { role: 'assistant', content: String(m.content ?? '') });
    } else if (m.role === 'tool') {
      if (!m.tool_call_id || !openCalls.has(m.tool_call_id)) {
        throw Object.assign(new Error('Tool message without matching tool call'), { statusCode: 400 });
      }
      openCalls.delete(m.tool_call_id);
      out.push({ role: 'tool', tool_call_id: m.tool_call_id, name: String(m.name ?? ''), content: String(m.content ?? '') });
    }
  }
  if (openCalls.size) {
    throw Object.assign(new Error('Missing tool results for: ' + [...openCalls].join(', ')), { statusCode: 400 });
  }
  return out;
}

export async function buildServer(cfg: Config, provider: LLMProvider = createProvider(cfg)): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: cfg.logLevel, redact: ['req.headers.authorization'] },
    bodyLimit: cfg.bodyLimit,
    trustProxy: cfg.trustProxy,
  });

  const allowAll = cfg.corsOrigins.includes('*');
  if (allowAll) app.log.warn('CORS_ORIGINS=* allows every origin – only use this for testing');
  if (!cfg.corsOrigins.length) app.log.warn('CORS_ORIGINS is empty – browsers on other origins cannot call the proxy');
  if (!cfg.proxyToken) app.log.warn('Running WITHOUT PROXY_TOKEN (ALLOW_NO_TOKEN=true) – do not expose this publicly');

  await app.register(cors, {
    origin: (origin, cb) => {
      // Requests without Origin (curl, server-to-server) are not subject to CORS.
      if (!origin) return cb(null, true);
      cb(null, allowAll || cfg.corsOrigins.includes(origin.replace(/\/+$/, '')));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type', 'x-proxy-token'],
    maxAge: 600,
  });

  await app.register(rateLimit, {
    max: cfg.rateLimitMax,
    timeWindow: cfg.rateLimitWindow,
    // Health checks are not rate limited.
    allowList: (req) => req.url === '/healthz',
  });

  const auth = async (req: FastifyRequest, reply: FastifyReply) => {
    if (!cfg.proxyToken) return;
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : (req.headers['x-proxy-token'] as string | undefined);
    if (!token || !tokenMatches(token, cfg.proxyToken)) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Invalid or missing proxy token' });
    }
  };

  app.get('/healthz', async () => ({ ok: true }));

  app.get('/v1/info', { preHandler: auth }, async () => ({
    ok: true,
    provider: provider.name,
    model: provider.model,
    max_iterations: cfg.maxIterations,
  }));

  app.post('/v1/chat', { preHandler: auth, schema: { body: chatBodySchema } }, async (req, reply) => {
    const body = req.body as { messages: any[]; document_context?: DocumentContext };
    let messages: ChatMessage[];
    try {
      messages = sanitizeMessages(body.messages);
    } catch (err) {
      return reply.code(400).send({ error: 'bad_request', message: (err as Error).message });
    }
    try {
      const result = await runTurn({
        provider,
        messages,
        documentContext: body.document_context,
        maxIterations: cfg.maxIterations,
      });
      return result;
    } catch (err) {
      if (err instanceof ProviderError) {
        req.log.error({ err: err.message }, 'provider error');
        return reply.code(err.status ?? 502).send({ error: 'llm_error', message: err.message });
      }
      throw err;
    }
  });

  return app;
}

async function main() {
  let cfg: Config;
  try {
    cfg = loadConfig();
  } catch (err) {
    console.error(`Configuration error: ${(err as Error).message}`);
    process.exit(1);
  }
  const app = await buildServer(cfg);
  app.log.info({ provider: cfg.provider, model: cfg.model, cors: cfg.corsOrigins }, 'starting music notation proxy');
  const shutdown = () => {
    app.close().then(() => process.exit(0), () => process.exit(1));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  await app.listen({ host: cfg.host, port: cfg.port });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
