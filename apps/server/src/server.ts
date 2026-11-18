/**
 * HTTP server.
 *
 *   GET  /healthz                 health check
 *   GET  /v1/meta                 public: auth mode, MCP endpoint, chat available (used by the plugin settings)
 *   GET  /v1/info                 connection test (authenticated)
 *   POST /v1/chat                 one agent step of the AI chat
 *   POST /v1/auth/login           AUTH_MODE=nextcloud: start Nextcloud Login Flow v2 for the plugin
 *   POST /v1/auth/login/poll      … poll until the user granted access -> plugin session token
 *   POST /v1/auth/logout          … sign out (deletes the Nextcloud app password)
 *   GET  /v1/bridge               WebSocket: open editors connect here so MCP clients can reach them
 *   POST /mcp                     MCP endpoint (Streamable HTTP, stateless)
 *   /.well-known/*, /oauth/*      OAuth for MCP clients (AUTH_MODE=nextcloud with an OAuth client configured)
 *
 * Security:
 *  - plugin requests: shared PROXY_TOKEN or per-user sign-in with Nextcloud (AUTH_MODE)
 *  - MCP: PROXY_TOKEN, Nextcloud app password, OAuth via Nextcloud, or none in local mode (loopback only)
 *  - CORS allowlist (CORS_ORIGINS = origin of the Euro-Office / Nextcloud domain); the same list is used for the
 *    Origin check of WebSocket and MCP requests; Host header check in local mode (DNS rebinding)
 *  - per-IP rate limit; the LLM API key never leaves the server
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { validateHostHeader } from '@modelcontextprotocol/server';
import { runTurn } from './agent.js';
import { AuthError, AuthService, bearer, type Identity } from './auth.js';
import { Bridge } from './bridge.js';
import { loadConfig, type Config } from './config.js';
import { createMcpEndpoint } from './mcp.js';
import { OAuthServer } from './oauth.js';
import { createProvider } from './providers/index.js';
import { AuthStore } from './store.js';
import { ProviderError, type ChatMessage, type DocumentContext, type LLMProvider } from './types.js';
import { VERSION } from './version.js';

const chatBodySchema = {
  type: 'object',
  required: ['messages'],
  additionalProperties: false,
  properties: {
    messages: {
      type: 'array',
      minItems: 1,
      maxItems: 400,
      items: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { type: 'string', enum: ['user', 'assistant', 'tool'] },
          content: { type: ['string', 'null'], maxLength: 200000 },
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

/** Paths that browser-based MCP clients call cross-origin without credentials (discovery, token, registration). */
const PUBLIC_CORS_PATHS = /^\/(\.well-known\/|oauth\/(token|register|revoke)$)/;

export interface ServerDeps {
  provider?: LLMProvider;
  store?: AuthStore;
  auth?: AuthService;
  /** Extra routes (the companion app's settings page). */
  extend?: (app: FastifyInstance) => void | Promise<void>;
  /** Shown to users when the chat is switched off (e.g. the companion's settings page). */
  settingsUrl?: string;
  /** The chat is set up in the desktop app's window (no page to link to). */
  settingsInApp?: boolean;
  /** Where the log goes (default stdout; the companion's app mode keeps stdout for its handshake with the app). */
  logStream?: { write(msg: string): void };
}

declare module 'fastify' {
  interface FastifyRequest {
    identity?: Identity;
  }
}

export async function buildServer(cfg: Config, deps: ServerDeps = {}): Promise<FastifyInstance> {
  const provider = deps.provider ?? createProvider(cfg);
  const app = Fastify({
    logger: {
      level: cfg.logLevel,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      ...(deps.logStream ? { stream: deps.logStream } : {}),
    },
    bodyLimit: cfg.bodyLimit,
    trustProxy: cfg.trustProxy,
  });

  const allowAll = cfg.corsOrigins.includes('*');
  if (allowAll) app.log.warn('CORS_ORIGINS=* allows every origin – only use this for testing');
  if (!cfg.corsOrigins.length) app.log.warn('CORS_ORIGINS is empty – browsers on other origins cannot call the proxy');
  if (!cfg.proxyToken && cfg.authMode !== 'nextcloud') app.log.warn('Running WITHOUT PROXY_TOKEN (ALLOW_NO_TOKEN=true) – do not expose this publicly');

  const originAllowed = (origin: string | undefined): boolean =>
    !origin || allowAll || cfg.corsOrigins.includes(origin.replace(/\/+$/, ''));

  const store =
    deps.store ??
    new AuthStore(cfg.authMode === 'nextcloud' ? path.resolve(cfg.dataDir, 'auth.json') : null, (err) =>
      app.log.error({ err: (err as Error).message }, 'cannot save auth state'),
    );
  const auth = deps.auth ?? new AuthService(cfg, store);
  const oauth =
    cfg.authMode === 'nextcloud' && auth.nextcloud?.oauthConfigured && cfg.publicUrl
      ? new OAuthServer({ publicUrl: cfg.publicUrl, nextcloud: auth.nextcloud, store })
      : null;
  auth.oauth = oauth;
  const bridge = new Bridge({ authenticate: (token) => auth.authenticatePlugin(token), log: app.log });
  app.addHook('onClose', async () => {
    bridge.close();
    auth.close();
    oauth?.close();
    store.flush();
  });

  // DNS rebinding protection for the unauthenticated local mode.
  if (cfg.authMode === 'local') {
    app.addHook('onRequest', async (req, reply) => {
      const r = validateHostHeader(req.headers.host, cfg.allowedHosts);
      if (!r.ok) return reply.code(403).send({ error: 'forbidden', message: r.message });
    });
  }

  await app.register(cors, () => (req: FastifyRequest, cb: (err: Error | null, opts: object) => void) => {
    const url = (req.url || '').split('?')[0];
    if (PUBLIC_CORS_PATHS.test(url)) return cb(null, { origin: '*', methods: ['GET', 'POST', 'OPTIONS'], maxAge: 600 });
    cb(null, {
      // Requests without Origin (curl, server-to-server) are not subject to CORS.
      origin: (origin: string | undefined, done: (e: Error | null, allow: boolean) => void) => done(null, originAllowed(origin)),
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['authorization', 'content-type', 'x-proxy-token', 'mcp-protocol-version', 'mcp-session-id'],
      exposedHeaders: ['www-authenticate', 'mcp-session-id'],
      maxAge: 600,
    });
  });

  await app.register(rateLimit, {
    max: cfg.rateLimitMax,
    timeWindow: cfg.rateLimitWindow,
    // Health checks are not rate limited; MCP requests are counted per user below.
    allowList: (req) => req.url === '/healthz',
  });

  await app.register(websocket, { options: { maxPayload: 8 * 1024 * 1024 } });

  // OAuth token / registration requests and the consent form are form-encoded.
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string', bodyLimit: 65536 }, (_req, body, done) => {
    try {
      done(null, Object.fromEntries(new URLSearchParams(body as string)));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  const pluginToken = (req: FastifyRequest): string | undefined =>
    bearer(req.headers.authorization) ?? (req.headers['x-proxy-token'] as string | undefined);

  const requirePlugin = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      req.identity = await auth.authenticatePlugin(pluginToken(req));
    } catch (err) {
      if (err instanceof AuthError) return reply.code(err.status).send({ error: 'unauthorized', message: err.message });
      throw err;
    }
  };

  app.get('/healthz', async () => ({ ok: true }));

  app.get('/v1/meta', async () => ({
    ok: true,
    version: VERSION,
    auth_mode: cfg.authMode,
    chat: provider.name !== 'none',
    settings_url: deps.settingsUrl ?? null,
    settings_in_app: !!deps.settingsInApp,
    mcp: cfg.mcpEnabled
      ? {
          url: cfg.publicUrl ? `${cfg.publicUrl}/mcp` : null,
          auth: cfg.authMode === 'local' ? 'none' : cfg.authMode === 'token' ? 'token' : oauth ? 'oauth+app_password' : 'app_password',
        }
      : null,
  }));

  app.get('/v1/info', { preHandler: requirePlugin }, async (req) => ({
    ok: true,
    version: VERSION,
    provider: provider.name,
    model: provider.model,
    max_iterations: cfg.maxIterations,
    auth_mode: cfg.authMode,
    user: req.identity && req.identity.via === 'session' ? { id: req.identity.userId, display_name: req.identity.displayName } : null,
    mcp: cfg.mcpEnabled,
  }));

  app.post('/v1/chat', { preHandler: requirePlugin, schema: { body: chatBodySchema } }, async (req, reply) => {
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
        const busy = err.upstreamStatus !== undefined && [429, 502, 503, 504, 529].includes(err.upstreamStatus);
        return reply.code(busy ? 503 : (err.status ?? 502)).send({ error: busy ? 'llm_busy' : 'llm_error', message: err.message });
      }
      throw err;
    }
  });

  // --- plugin sign-in with Nextcloud (Login Flow v2) ---
  if (cfg.authMode === 'nextcloud') {
    const authFail = (reply: FastifyReply, err: unknown) => {
      if (err instanceof AuthError) return reply.code(err.status).send({ error: 'auth', message: err.message });
      reply.log.warn({ err: (err as Error).message }, 'nextcloud sign-in failed');
      return reply.code(502).send({ error: 'nextcloud', message: (err as Error).message });
    };
    app.post('/v1/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
      try {
        const r = await auth.loginStart(req.ip);
        return { flow_id: r.flowId, login_url: r.loginUrl };
      } catch (err) {
        return authFail(reply, err);
      }
    });
    app.post(
      '/v1/auth/login/poll',
      {
        // Keyed by flow id: several users behind one IP (school network) poll at the same time.
        config: { rateLimit: { max: 40, timeWindow: '1 minute', keyGenerator: (req: FastifyRequest) => 'poll:' + String((req.body as { flow_id?: string } | undefined)?.flow_id ?? req.ip) } },
        schema: { body: { type: 'object', required: ['flow_id'], properties: { flow_id: { type: 'string', maxLength: 100 } } } },
      },
      async (req, reply) => {
        try {
          const r = await auth.loginPoll((req.body as { flow_id: string }).flow_id);
          if (!r) return { done: false };
          return { done: true, token: r.token, user: { id: r.userId, display_name: r.displayName } };
        } catch (err) {
          return authFail(reply, err);
        }
      },
    );
    app.post('/v1/auth/logout', async (req) => {
      await auth.logout(pluginToken(req));
      return { ok: true };
    });
  }

  // --- plugin bridge (WebSocket) ---
  app.get('/v1/bridge', { websocket: true }, (socket, req) => {
    if (!cfg.mcpEnabled) {
      socket.close(4404, 'MCP is disabled on this server');
      return;
    }
    // Browsers do not apply CORS to WebSockets – check the origin here.
    if (!originAllowed(req.headers.origin)) {
      req.log.warn({ origin: req.headers.origin }, 'bridge connection from a foreign origin refused');
      socket.close(4403, 'origin not allowed');
      return;
    }
    bridge.attach(socket);
  });

  // --- MCP ---
  if (cfg.mcpEnabled) {
    const endpoint = createMcpEndpoint({
      bridge,
      version: VERSION,
      onToolCall: (i) => app.log.info(i, 'mcp tool call'),
    });
    const nodeHandler = toNodeHandler(endpoint, { onerror: (err) => app.log.error({ err: err.message }, 'mcp handler error') });
    app.addHook('onClose', async () => endpoint.close());
    if (oauth) oauth.routes(app);

    // Local mode serves MCP without authentication: only native clients (no Origin) and pages on this computer.
    const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
    const mcpOriginAllowed = (origin: string | undefined) =>
      !origin || (cfg.authMode === 'local' ? LOOPBACK_ORIGIN.test(origin) : originAllowed(origin));

    const mcpRoute = async (req: FastifyRequest, reply: FastifyReply) => {
      if (!mcpOriginAllowed(req.headers.origin)) return reply.code(403).send({ error: 'forbidden', message: 'Origin not allowed' });
      // Failed app passwords are throttled inside authenticateMcp before they reach Nextcloud (brute-force
      // protection there would block the proxy's IP for everybody); valid credentials are never blocked.
      const identity = await auth.authenticateMcp(req.headers.authorization, req.ip).catch((err) => {
        req.log.warn({ err: (err as Error).message }, 'mcp authentication failed');
        return null;
      });
      if (!identity) {
        const challenge = oauth
          ? oauth.challenge(req.headers.authorization ? 'invalid_token' : undefined)
          : cfg.authMode === 'nextcloud'
            ? 'Basic realm="Nextcloud app password", charset="UTF-8"'
            : 'Bearer realm="worksheet-assistant"';
        return reply.code(401).header('www-authenticate', challenge).send({ error: 'unauthorized', message: 'Authentication required' });
      }
      (req.raw as unknown as { auth: unknown }).auth = {
        token: '',
        clientId: identity.clientId ?? identity.via,
        scopes: ['mcp'],
        extra: { identity },
      };
      // The SDK writes the response itself: keep the headers set so far (CORS) on the raw response.
      for (const [k, v] of Object.entries(reply.getHeaders())) if (v !== undefined) reply.raw.setHeader(k, v as string | string[]);
      reply.hijack();
      await nodeHandler(req.raw, reply.raw, req.body);
    };
    app.route({
      method: ['POST', 'GET', 'DELETE'],
      url: '/mcp',
      handler: mcpRoute,
      config: {
        // Hosted AI clients (claude.ai, chatgpt.com …) call from shared IPs: count per credential, not per IP.
        rateLimit: {
          max: Math.max(120, cfg.rateLimitMax * 4),
          keyGenerator: (req: FastifyRequest) =>
            req.headers.authorization ? 'mcp:' + crypto.createHash('sha256').update(req.headers.authorization).digest('hex') : req.ip,
        },
      },
    });
  }

  if (deps.extend) await deps.extend(app);
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
  app.log.info(
    { version: VERSION, provider: cfg.provider, model: cfg.model, auth: cfg.authMode, mcp: cfg.mcpEnabled, cors: cfg.corsOrigins },
    'starting worksheet assistant proxy',
  );
  const shutdown = () => {
    app.close().then(() => process.exit(0), () => process.exit(1));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  await app.listen({ host: cfg.host, port: cfg.port });
}

// Started directly (not imported, not bundled into the companion app).
const self = typeof import.meta.url === 'string' ? fileURLToPath(import.meta.url) : '';
if (self && process.argv[1] === self) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
