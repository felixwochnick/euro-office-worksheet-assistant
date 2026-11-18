/**
 * OAuth 2.1 authorization server for MCP clients, with the login delegated to Nextcloud.
 *
 * MCP clients (Claude, ChatGPT, Le Chat, MCP Inspector …) expect an authorization server with metadata
 * discovery (RFC 8414), PKCE (S256) and client registration (Client ID Metadata Documents or dynamic client
 * registration, RFC 7591). Nextcloud's OAuth2 app offers none of these and only knows confidential clients
 * with one fixed redirect URI. So this proxy is the authorization server towards MCP clients and a normal
 * confidential client towards Nextcloud:
 *
 *   MCP client --/oauth/authorize--> proxy --redirect--> Nextcloud login + consent
 *   Nextcloud --/oauth/callback (code)--> proxy: exchanges the code (client secret), learns the user id
 *   proxy shows its own consent page naming the MCP client ("<client> wants to access …")
 *   proxy --redirect (own code)--> MCP client --/oauth/token (PKCE)--> proxy: own access + refresh token
 *
 * The Nextcloud refresh token is kept per grant and refreshed whenever the MCP client refreshes, so access
 * ends at the latest one hour after the user revokes it in Nextcloud (Settings → Security → Devices & sessions).
 */
import crypto from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AccessTokenVerifier, Identity } from './auth.js';
import { NextcloudClient, NextcloudError } from './nextcloud.js';
import { fetchSmallDocument } from './safe-fetch.js';
import { AuthStore, hashSecret, randomToken, type StoredClient, type StoredGrant } from './store.js';

const ACCESS_TOKEN_TTL_S = 3600;
const REFRESH_TOKEN_TTL_MS = 60 * 86400_000;
const PENDING_TTL_MS = 10 * 60_000;
const CODE_TTL_MS = 2 * 60_000;
const CIMD_CACHE_MS = 60 * 60_000;
const CIMD_FAIL_CACHE_MS = 60_000;
const MAX_CIMD_FETCHES = 10;
/** Registered clients are kept in memory until the first sign-in, then stored. */
const MAX_UNCONFIRMED_CLIENTS = 1000;
const MAX_CLIENTS = 5000;
const MAX_PENDING_PER_IP = 20;
const MAX_REDIRECT_URIS = 5;
const MAX_REDIRECT_URI_LENGTH = 512;

interface ClientInfo {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  client_uri?: string;
  /** Client ID Metadata Document (client_id is an https URL). */
  cimd: boolean;
}

interface Pending {
  id: string;
  nonce: string;
  csrf: string;
  client: ClientInfo;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  scope: string;
  resource: string;
  expires: number;
  ip: string;
  user?: { id: string; displayName: string };
  ncAccessToken?: string;
  ncRefreshToken?: string;
}

interface AuthCode {
  clientId: string;
  clientName: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  resource: string;
  userId: string;
  displayName: string;
  ncRefreshToken: string;
  expires: number;
  used: boolean;
  grantId?: string;
}

export interface OAuthOptions {
  /** External base URL of the proxy, e.g. https://cloud.example.org/worksheet-proxy (no trailing slash). */
  publicUrl: string;
  nextcloud: NextcloudClient;
  store: AuthStore;
  /** Fetch a client ID metadata document (default: https only, private addresses refused, 64 KB). Tests replace it. */
  fetchDocument?: (url: string) => Promise<string | null>;
}

// --- helpers --------------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function s256(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const x = crypto.createHash('sha256').update(a).digest();
  const y = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(x, y);
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', 'localhost']);
const FORBIDDEN_SCHEMES = new Set(['javascript:', 'data:', 'file:', 'vbscript:', 'about:', 'blob:', 'ws:', 'wss:', 'ftp:']);

/** Allowed redirect URIs: https, http on loopback (native apps, RFC 8252) and private-use schemes. */
export function validRedirectUri(uri: string): boolean {
  if (typeof uri !== 'string' || uri.length > MAX_REDIRECT_URI_LENGTH) return false;
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === 'https:') return !!u.hostname;
  if (u.protocol === 'http:') return LOOPBACK_HOSTS.has(u.hostname);
  return !FORBIDDEN_SCHEMES.has(u.protocol) && /^[a-z][a-z0-9+.-]*:$/.test(u.protocol);
}

/** Exact match; for http loopback redirect URIs the port may differ (RFC 8252 section 7.3). */
export function redirectUriMatches(registered: string, given: string): boolean {
  if (registered === given) return true;
  try {
    const r = new URL(registered);
    const g = new URL(given);
    return (
      r.protocol === 'http:' &&
      g.protocol === 'http:' &&
      LOOPBACK_HOSTS.has(r.hostname) &&
      r.hostname === g.hostname &&
      r.pathname === g.pathname &&
      r.search === g.search
    );
  } catch {
    return false;
  }
}

type Lang = 'de' | 'en';
function lang(req: FastifyRequest): Lang {
  return /^\s*de\b/i.test(String(req.headers['accept-language'] || 'de')) ? 'de' : 'en';
}

const TEXT = {
  de: {
    title: 'Zugriff erlauben?',
    intro: (who: string, user: string) =>
      `${who} möchte als <strong>${user}</strong> auf deine in Euro-Office geöffneten Dokumente zugreifen.`,
    app: (host: string) => `Die Anwendung von <strong>${host}</strong>`,
    local: 'Eine Anwendung auf deinem Computer',
    named: (name: string) => `Sie nennt sich „${name}“.`,
    unverified: 'Der Name wird von der Anwendung selbst angegeben und ist nicht geprüft. Erlaube den Zugriff nur, wenn du die Anmeldung gerade selbst in deinem KI-Assistenten gestartet hast.',
    detail:
      'Die Anwendung kann Dokumente lesen und ändern, solange du sie mit dem Arbeitsblatt-Assistenten geöffnet und „MCP-Zugriff erlauben“ eingeschaltet hast.',
    redirect: 'Weiterleitung nach der Anmeldung an:',
    allow: 'Erlauben',
    deny: 'Ablehnen',
    revoke: 'Du kannst den Zugriff jederzeit in Nextcloud widerrufen (Einstellungen → Sicherheit → Geräte & Sitzungen).',
    errorTitle: 'Anmeldung nicht möglich',
  },
  en: {
    title: 'Allow access?',
    intro: (who: string, user: string) =>
      `${who} wants to access the documents you have open in Euro-Office as <strong>${user}</strong>.`,
    app: (host: string) => `The application from <strong>${host}</strong>`,
    local: 'An application on your computer',
    named: (name: string) => `It calls itself "${name}".`,
    unverified: 'The name is given by the application itself and is not verified. Only allow the access if you just started the sign-in in your AI assistant yourself.',
    detail:
      'The application can read and change documents while they are open with the worksheet assistant and "MCP access" is switched on.',
    redirect: 'After signing in you will be sent to:',
    allow: 'Allow',
    deny: 'Deny',
    revoke: 'You can revoke the access at any time in Nextcloud (Settings → Security → Devices & sessions).',
    errorTitle: 'Sign-in not possible',
  },
};

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f4f5f9;color:#1f2330;margin:0;padding:24px}
main{max-width:460px;margin:8vh auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,.08)}
h1{font-size:1.3rem;margin:0 0 16px}p{line-height:1.5}small{color:#5b6070}code{word-break:break-all}
.buttons{display:flex;gap:12px;margin-top:24px}button{flex:1;font-size:1rem;padding:10px;border-radius:8px;border:1px solid #c8cbd6;background:#fff;cursor:pointer}
button.primary{background:#3949ab;border-color:#3949ab;color:#fff}
</style></head><body><main><h1>${esc(title)}</h1>${body}</main></body></html>`;
}

function sendPage(reply: FastifyReply, status: number, html: string): FastifyReply {
  return reply
    .code(status)
    .header('content-type', 'text/html; charset=utf-8')
    .header('cache-control', 'no-store')
    .header('x-frame-options', 'DENY')
    .header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'")
    .header('referrer-policy', 'no-referrer')
    .send(html);
}

function oauthError(reply: FastifyReply, status: number, error: string, description: string): FastifyReply {
  return reply.code(status).header('cache-control', 'no-store').send({ error, error_description: description });
}

function form(req: FastifyRequest): Record<string, string> {
  const b = req.body;
  if (!b || typeof b !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(b as Record<string, unknown>)) if (typeof v === 'string') out[k] = v;
  return out;
}

// --- the authorization server -------------------------------------------------------

export class OAuthServer implements AccessTokenVerifier {
  readonly issuer: string;
  readonly resource: string;
  readonly prmUrl: string;
  private readonly callbackUrl: string;
  private readonly cookiePath: string;
  private readonly secureCookie: boolean;
  private readonly pending = new Map<string, Pending>();
  private readonly codes = new Map<string, AuthCode>();
  private readonly cimdCache = new Map<string, { client: ClientInfo | null; expires: number }>();
  private cimdInFlight = 0;
  private readonly unconfirmed = new Map<string, StoredClient>();
  private readonly refreshing = new Map<string, { clientId: string; result: Promise<Record<string, unknown>> }>();
  private readonly fetchDocument: (url: string) => Promise<string | null>;
  private readonly timer: NodeJS.Timeout;

  constructor(private readonly opts: OAuthOptions) {
    this.issuer = opts.publicUrl;
    this.resource = `${opts.publicUrl}/mcp`;
    this.prmUrl = `${opts.publicUrl}/.well-known/oauth-protected-resource/mcp`;
    this.callbackUrl = `${opts.publicUrl}/oauth/callback`;
    const u = new URL(opts.publicUrl);
    this.cookiePath = `${u.pathname.replace(/\/+$/, '')}/oauth`;
    this.secureCookie = u.protocol === 'https:';
    this.fetchDocument = opts.fetchDocument ?? fetchSmallDocument;
    this.timer = setInterval(() => this.purge(), 60_000);
    this.timer.unref?.();
  }

  close(): void {
    clearInterval(this.timer);
  }

  /** Forget expired sign-ins and codes; revoke the Nextcloud tokens that were obtained for them. */
  purge(now = Date.now()): void {
    for (const [id, p] of this.pending) {
      if (p.expires >= now) continue;
      this.pending.delete(id);
      if (p.ncAccessToken) void this.opts.nextcloud.revokeAccessToken(p.ncAccessToken);
    }
    for (const [key, c] of this.codes) {
      if (c.expires >= now) continue;
      this.codes.delete(key);
      if (!c.used) void this.opts.nextcloud.revokeRefreshToken(c.ncRefreshToken);
    }
    for (const [id, c] of this.cimdCache) if (c.expires < now) this.cimdCache.delete(id);
  }

  /** The redirect URI to register in Nextcloud (Administration → Security → OAuth 2.0 clients). */
  get nextcloudRedirectUri(): string {
    return this.callbackUrl;
  }

  metadata(): Record<string, unknown> {
    return {
      issuer: this.issuer,
      authorization_endpoint: `${this.issuer}/oauth/authorize`,
      token_endpoint: `${this.issuer}/oauth/token`,
      registration_endpoint: `${this.issuer}/oauth/register`,
      revocation_endpoint: `${this.issuer}/oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      revocation_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['mcp'],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
      service_documentation: 'https://github.com/felixwochnick/euro-office-worksheet-assistant',
    };
  }

  protectedResourceMetadata(): Record<string, unknown> {
    return {
      resource: this.resource,
      authorization_servers: [this.issuer],
      bearer_methods_supported: ['header'],
      scopes_supported: ['mcp'],
      resource_name: 'Arbeitsblatt-Assistent (Euro-Office)',
    };
  }

  /** WWW-Authenticate value for 401 answers of the MCP endpoint. */
  challenge(error?: string): string {
    return `Bearer resource_metadata="${this.prmUrl}"${error ? `, error="${error}"` : ''}`;
  }

  // --- token verification (AccessTokenVerifier) ---

  verify(token: string): Identity | null {
    const hash = hashSecret(token);
    const now = Date.now();
    const t = this.opts.store.state.accessTokens.find((x) => x.hash === hash);
    if (!t || t.expiresAt <= now || t.resource !== this.resource) return null;
    const grant = this.opts.store.state.grants.find((g) => g.id === t.grantId);
    if (!grant) return null;
    return { userId: grant.userId, displayName: grant.displayName, via: 'oauth', clientId: grant.clientId };
  }

  // --- clients ---

  private async resolveClient(clientId: string): Promise<ClientInfo | null> {
    if (!clientId || clientId.length > 500) return null;
    if (clientId.startsWith('https://')) return this.fetchCimd(clientId);
    const c = this.opts.store.state.clients.find((x) => x.client_id === clientId) ?? this.unconfirmed.get(clientId);
    return c ? { client_id: c.client_id, client_name: c.client_name, redirect_uris: c.redirect_uris, client_uri: c.client_uri, cimd: false } : null;
  }

  /** A client signed in successfully: store a dynamically registered client permanently. */
  private confirmClient(clientId: string): void {
    const now = Date.now();
    const state = this.opts.store.state;
    const stored = state.clients.find((c) => c.client_id === clientId);
    if (stored) {
      stored.lastUsedAt = now;
    } else {
      const c = this.unconfirmed.get(clientId);
      if (!c) return;
      this.unconfirmed.delete(clientId);
      if (state.clients.length >= MAX_CLIENTS) state.clients.sort((a, b) => a.lastUsedAt - b.lastUsedAt).splice(0, Math.ceil(MAX_CLIENTS / 10));
      state.clients.push({ ...c, lastUsedAt: now });
    }
    this.opts.store.save();
  }

  /** Client ID Metadata Document: the client_id is an https URL that serves the client's metadata. */
  private async fetchCimd(clientId: string): Promise<ClientInfo | null> {
    const hit = this.cimdCache.get(clientId);
    if (hit && hit.expires > Date.now()) return hit.client;
    let u: URL;
    try {
      u = new URL(clientId);
    } catch {
      return null;
    }
    if (u.protocol !== 'https:' || u.username || u.password || u.hash || u.pathname === '/' || /\/\.\.?(\/|$)/.test(u.pathname)) return null;
    if (this.cimdInFlight >= MAX_CIMD_FETCHES) return null;
    this.cimdInFlight++;
    let client: ClientInfo | null = null;
    try {
      client = this.parseCimd(clientId, u, await this.fetchDocument(clientId));
    } finally {
      this.cimdInFlight--;
    }
    // Failures are cached briefly too, so a client_id cannot be used to make the server fetch over and over.
    this.cimdCache.set(clientId, { client, expires: Date.now() + (client ? CIMD_CACHE_MS : CIMD_FAIL_CACHE_MS) });
    if (this.cimdCache.size > 1000) this.cimdCache.delete(this.cimdCache.keys().next().value as string);
    return client;
  }

  private parseCimd(clientId: string, u: URL, text: string | null): ClientInfo | null {
    if (!text) return null;
    let doc: Record<string, unknown>;
    try {
      doc = JSON.parse(text);
    } catch {
      return null;
    }
    if (!doc || doc.client_id !== clientId || !Array.isArray(doc.redirect_uris)) return null;
    const uris = (doc.redirect_uris as unknown[]).filter((x): x is string => typeof x === 'string' && validRedirectUri(x)).slice(0, 10);
    if (!uris.length) return null;
    const auth = doc.token_endpoint_auth_method;
    if (auth !== undefined && auth !== 'none') return null; // only public clients (PKCE) are supported
    return {
      client_id: clientId,
      client_name: typeof doc.client_name === 'string' && doc.client_name.trim() ? doc.client_name.trim().slice(0, 100) : u.hostname,
      redirect_uris: uris,
      client_uri: typeof doc.client_uri === 'string' ? doc.client_uri.slice(0, 500) : undefined,
      cimd: true,
    };
  }

  register(body: Record<string, unknown>): { status: number; body: Record<string, unknown> } {
    const uris = body.redirect_uris;
    if (!Array.isArray(uris) || !uris.length || uris.length > MAX_REDIRECT_URIS || !uris.every((x) => typeof x === 'string' && validRedirectUri(x))) {
      return {
        status: 400,
        body: {
          error: 'invalid_redirect_uri',
          error_description: `redirect_uris: 1–${MAX_REDIRECT_URIS} https, http loopback or private-use scheme URIs (max. ${MAX_REDIRECT_URI_LENGTH} characters, no fragment)`,
        },
      };
    }
    const grantTypes = body.grant_types;
    if (Array.isArray(grantTypes) && !grantTypes.includes('authorization_code')) {
      return { status: 400, body: { error: 'invalid_client_metadata', error_description: 'grant_types must include authorization_code' } };
    }
    const name = typeof body.client_name === 'string' && body.client_name.trim() ? body.client_name.trim().slice(0, 100) : 'MCP-Client';
    const now = Date.now();
    const client = {
      client_id: `wac_${randomToken(16)}`,
      client_name: name,
      redirect_uris: uris as string[],
      client_uri: typeof body.client_uri === 'string' ? body.client_uri.slice(0, 500) : undefined,
      createdAt: now,
      lastUsedAt: now,
    };
    // Kept in memory until the first successful sign-in (registration needs no authentication).
    if (this.unconfirmed.size >= MAX_UNCONFIRMED_CLIENTS) this.unconfirmed.delete(this.unconfirmed.keys().next().value as string);
    this.unconfirmed.set(client.client_id, client);
    return {
      status: 201,
      body: {
        client_id: client.client_id,
        client_id_issued_at: Math.floor(now / 1000),
        client_name: client.client_name,
        redirect_uris: client.redirect_uris,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        ...(client.client_uri ? { client_uri: client.client_uri } : {}),
      },
    };
  }

  private resourceOk(resource: string | undefined): boolean {
    if (!resource) return true;
    const r = resource.replace(/#.*$/, '').replace(/\/+$/, '');
    return r === this.resource || r === this.issuer;
  }

  // --- authorization endpoint ---

  async authorize(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const q = req.query as Record<string, string | undefined>;
    const t = TEXT[lang(req)];
    const fail = (msg: string) => sendPage(reply, 400, page(t.errorTitle, `<p>${esc(msg)}</p>`));
    const client = await this.resolveClient(String(q.client_id || ''));
    if (!client) return fail('Unknown client_id (the application is not registered).');
    let redirectUri = q.redirect_uri;
    if (!redirectUri && client.redirect_uris.length === 1) redirectUri = client.redirect_uris[0];
    if (!redirectUri || !client.redirect_uris.some((r) => redirectUriMatches(r, redirectUri!))) {
      return fail('The redirect_uri is not registered for this application.');
    }
    // Errors before the user signed in are shown here and never redirected: anyone can register a client, so
    // redirecting would turn this endpoint into an open redirect (RFC 9700 section 4.11.2).
    if (q.response_type !== 'code') return fail('response_type must be "code".');
    if (!q.code_challenge || q.code_challenge_method !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(q.code_challenge)) {
      return fail('PKCE with code_challenge_method=S256 is required.');
    }
    if (!this.resourceOk(q.resource)) return fail(`The resource must be ${this.resource}.`);

    const now = Date.now();
    this.purge(now);
    let mine = 0;
    for (const p of this.pending.values()) if (p.ip === req.ip) mine++;
    if (mine >= MAX_PENDING_PER_IP || this.pending.size > 10000) return fail('Too many sign-ins in progress – please try again in a few minutes.');
    const pending: Pending = {
      id: randomToken(24),
      nonce: randomToken(24),
      csrf: randomToken(24),
      client,
      redirectUri,
      codeChallenge: q.code_challenge,
      state: q.state,
      scope: (q.scope || 'mcp').slice(0, 200),
      resource: this.resource,
      expires: now + PENDING_TTL_MS,
      ip: req.ip,
    };
    this.pending.set(pending.id, pending);
    return reply
      .code(302)
      .header('set-cookie', this.cookie(pending, pending.nonce, PENDING_TTL_MS / 1000))
      .header('cache-control', 'no-store')
      .header('location', this.opts.nextcloud.authorizeUrl(pending.id, this.callbackUrl))
      .send();
  }

  private cookieName(p: Pending): string {
    return `wa_oauth_${p.id.slice(0, 12)}`;
  }

  private cookie(p: Pending, value: string, maxAge: number): string {
    return `${this.cookieName(p)}=${value}; Path=${this.cookiePath}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${this.secureCookie ? '; Secure' : ''}`;
  }

  /** The pending sign-in, if this browser started it (cookie). */
  private pendingFor(req: FastifyRequest, id: string | undefined): Pending | null {
    if (!id) return null;
    const p = this.pending.get(id);
    if (!p || p.expires < Date.now()) return null;
    const cookies = String(req.headers.cookie || '');
    const m = new RegExp(`(?:^|;\\s*)${this.cookieName(p)}=([A-Za-z0-9_-]+)`).exec(cookies);
    return m && safeEqual(m[1], p.nonce) ? p : null;
  }

  private redirectToClient(reply: FastifyReply, p: Pending, params: Record<string, string>): FastifyReply {
    // Denied or failed: the Nextcloud token obtained for this sign-in is not needed any more.
    if (params.error && p.ncAccessToken) void this.opts.nextcloud.revokeAccessToken(p.ncAccessToken);
    const u = new URL(p.redirectUri);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    if (p.state) u.searchParams.set('state', p.state);
    u.searchParams.set('iss', this.issuer);
    this.pending.delete(p.id);
    return reply.code(303).header('set-cookie', this.cookie(p, '', 0)).header('location', u.toString()).send();
  }

  /** Nextcloud redirects here after the login. */
  async callback(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const q = req.query as Record<string, string | undefined>;
    const t = TEXT[lang(req)];
    const p = this.pendingFor(req, q.state);
    if (!p) return sendPage(reply, 400, page(t.errorTitle, '<p>The sign-in expired or was started in another browser. Please start again in your AI application.</p>'));
    if (q.error || !q.code) return this.redirectToClient(reply, p, { error: 'access_denied', error_description: 'The sign-in at Nextcloud was cancelled' });
    try {
      const tokens = await this.opts.nextcloud.exchangeCode(q.code, this.callbackUrl);
      const user = await this.opts.nextcloud.currentUser({ bearer: tokens.accessToken });
      if (!user || (tokens.userId && user.id !== tokens.userId)) throw new NextcloudError('Nextcloud did not confirm the user');
      p.user = user;
      p.ncAccessToken = tokens.accessToken;
      p.ncRefreshToken = tokens.refreshToken;
    } catch (err) {
      req.log.warn({ err: (err as Error).message }, 'nextcloud oauth callback failed');
      return this.redirectToClient(reply, p, { error: 'server_error', error_description: 'Sign-in at Nextcloud failed' });
    }
    // Name the application by something it cannot choose freely: the host of its client ID metadata document,
    // or the host of the redirect URI. Its self-chosen name is shown as secondary, unverified information.
    let who = t.local;
    let redirectShown = p.redirectUri;
    try {
      const r = new URL(p.redirectUri);
      const loopback = r.protocol === 'http:' || (r.protocol !== 'https:' && !r.host);
      redirectShown = r.protocol === 'https:' || r.protocol === 'http:' ? r.host : r.protocol + '//' + r.host;
      if (p.client.cimd) who = t.app(esc(new URL(p.client.client_id).host));
      else if (!loopback && r.protocol === 'https:') who = t.app(esc(r.host));
    } catch {
      /* keep defaults */
    }
    const body =
      `<p>${t.intro(who, esc(`${p.user.displayName} (${p.user.id})`))}</p>` +
      `<p>${esc(t.named(p.client.client_name))}${p.client.cimd ? '' : ` ${esc(t.unverified)}`}</p>` +
      `<p>${esc(t.detail)}</p>` +
      `<p><small>${esc(t.redirect)} <code>${esc(redirectShown)}</code>${p.client.cimd ? `<br><code>${esc(p.client.client_id)}</code>` : ''}</small></p>` +
      `<form method="post" action="${esc(this.cookiePath)}/consent">` +
      `<input type="hidden" name="id" value="${esc(p.id)}"><input type="hidden" name="csrf" value="${esc(p.csrf)}">` +
      `<div class="buttons"><button type="submit" name="decision" value="deny">${esc(t.deny)}</button>` +
      `<button class="primary" type="submit" name="decision" value="allow">${esc(t.allow)}</button></div></form>` +
      `<p><small>${esc(t.revoke)}</small></p>`;
    return sendPage(reply, 200, page(t.title, body));
  }

  /** The user's decision on the consent page. */
  async consent(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const f = form(req);
    const t = TEXT[lang(req)];
    const p = this.pendingFor(req, f.id);
    if (!p || !p.user || !p.ncRefreshToken || !f.csrf || !safeEqual(f.csrf, p.csrf)) {
      return sendPage(reply, 400, page(t.errorTitle, '<p>The sign-in expired. Please start again in your AI application.</p>'));
    }
    if (f.decision !== 'allow') return this.redirectToClient(reply, p, { error: 'access_denied', error_description: 'The user denied the access' });
    const code = randomToken(32);
    this.codes.set(hashSecret(code), {
      clientId: p.client.client_id,
      clientName: p.client.client_name,
      redirectUri: p.redirectUri,
      codeChallenge: p.codeChallenge,
      scope: p.scope,
      resource: p.resource,
      userId: p.user.id,
      displayName: p.user.displayName,
      ncRefreshToken: p.ncRefreshToken,
      expires: Date.now() + CODE_TTL_MS,
      used: false,
    });
    if (!p.client.cimd) this.confirmClient(p.client.client_id);
    return this.redirectToClient(reply, p, { code });
  }

  // --- token endpoint ---

  private issue(grant: StoredGrant): Record<string, unknown> {
    const access = `wat_${randomToken(32)}`;
    const refresh = `wrt_${randomToken(32)}`;
    const now = Date.now();
    grant.refreshHash = hashSecret(refresh);
    grant.refreshExpiresAt = now + REFRESH_TOKEN_TTL_MS;
    this.opts.store.state.accessTokens.push({
      hash: hashSecret(access),
      grantId: grant.id,
      userId: grant.userId,
      clientId: grant.clientId,
      resource: grant.resource,
      expiresAt: now + ACCESS_TOKEN_TTL_S * 1000,
    });
    this.opts.store.save();
    return { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TOKEN_TTL_S, refresh_token: refresh, scope: grant.scope };
  }

  private revokeGrant(id: string, revokeUpstream = true): void {
    const s = this.opts.store.state;
    const grant = s.grants.find((g) => g.id === id);
    if (grant && revokeUpstream) void this.opts.nextcloud.revokeRefreshToken(grant.ncRefreshToken);
    s.grants = s.grants.filter((g) => g.id !== id);
    s.accessTokens = s.accessTokens.filter((t) => t.grantId !== id);
    this.opts.store.save();
  }

  async token(req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    const f = form(req);
    reply.header('cache-control', 'no-store').header('pragma', 'no-cache');
    if (f.client_secret) return oauthError(reply, 401, 'invalid_client', 'This server only supports public clients (token_endpoint_auth_method none)');

    if (f.grant_type === 'authorization_code') {
      const key = hashSecret(f.code || '');
      const code = this.codes.get(key);
      if (!code || code.expires < Date.now()) return oauthError(reply, 400, 'invalid_grant', 'The authorization code is invalid or expired');
      if (code.used) {
        // Code replay: revoke what was issued with it (RFC 6749 section 4.1.2).
        this.codes.delete(key);
        if (code.grantId) this.revokeGrant(code.grantId);
        return oauthError(reply, 400, 'invalid_grant', 'The authorization code was already used');
      }
      if (f.client_id !== code.clientId) return oauthError(reply, 400, 'invalid_grant', 'client_id does not match the authorization code');
      // Must be identical to the redirect_uri of the authorization request.
      if (!f.redirect_uri || f.redirect_uri !== code.redirectUri) {
        return oauthError(reply, 400, 'invalid_grant', 'redirect_uri does not match the authorization request');
      }
      if (!f.code_verifier || !/^[A-Za-z0-9._~-]{43,128}$/.test(f.code_verifier) || !safeEqual(s256(f.code_verifier), code.codeChallenge)) {
        return oauthError(reply, 400, 'invalid_grant', 'PKCE verification failed');
      }
      if (!this.resourceOk(f.resource)) return oauthError(reply, 400, 'invalid_target', `resource must be ${this.resource}`);
      code.used = true;
      const grant: StoredGrant = {
        id: randomToken(16),
        clientId: code.clientId,
        clientName: code.clientName,
        userId: code.userId,
        displayName: code.displayName,
        scope: code.scope,
        resource: code.resource,
        ncRefreshToken: code.ncRefreshToken,
        refreshHash: '',
        refreshExpiresAt: 0,
        createdAt: Date.now(),
      };
      code.grantId = grant.id;
      this.opts.store.state.grants.push(grant);
      setTimeout(() => this.codes.delete(key), CODE_TTL_MS).unref?.();
      req.log.info({ user: grant.userId, client: grant.clientName }, 'mcp client authorized');
      return reply.send(this.issue(grant));
    }

    if (f.grant_type === 'refresh_token') {
      const hash = hashSecret(f.refresh_token || '');
      const inflight = this.refreshing.get(hash);
      if (inflight) {
        // A retried / parallel refresh with the same token gets the same new tokens.
        if (f.client_id && f.client_id !== inflight.clientId) return oauthError(reply, 400, 'invalid_grant', 'client_id does not match the refresh token');
        try {
          return reply.send(await inflight.result);
        } catch (err) {
          return this.refreshFailed(reply, err);
        }
      }
      const grant = this.opts.store.state.grants.find((g) => g.refreshHash === hash);
      if (!grant || grant.refreshExpiresAt < Date.now()) return oauthError(reply, 400, 'invalid_grant', 'The refresh token is invalid or expired');
      if (f.client_id && f.client_id !== grant.clientId) return oauthError(reply, 400, 'invalid_grant', 'client_id does not match the refresh token');
      const p = (async () => {
        let nc;
        try {
          nc = await this.opts.nextcloud.refresh(grant.ncRefreshToken);
        } catch (err) {
          if (err instanceof NextcloudError && err.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
            this.revokeGrant(grant.id, false);
            throw Object.assign(new Error('The access was revoked in Nextcloud – please sign in again'), { oauth: 'invalid_grant' });
          }
          throw Object.assign(new Error('Nextcloud is not reachable – try again later'), { oauth: 'temporarily_unavailable' });
        }
        // Only the refresh token is kept (the refresh proves that the access was not revoked in Nextcloud). The new
        // access token must not be revoked: that would end the whole Nextcloud grant, refresh token included.
        grant.ncRefreshToken = nc.refreshToken || grant.ncRefreshToken;
        this.confirmClient(grant.clientId);
        return this.issue(grant);
      })();
      this.refreshing.set(hash, { clientId: grant.clientId, result: p });
      try {
        const result = await p;
        // Keep the result for a short time for parallel retries, then forget it.
        setTimeout(() => this.refreshing.delete(hash), 30_000).unref?.();
        return reply.send(result);
      } catch (err) {
        this.refreshing.delete(hash);
        return this.refreshFailed(reply, err);
      }
    }

    return oauthError(reply, 400, 'unsupported_grant_type', 'grant_type must be authorization_code or refresh_token');
  }

  private refreshFailed(reply: FastifyReply, err: unknown): FastifyReply {
    const kind = (err as { oauth?: string }).oauth;
    if (kind === 'invalid_grant') return oauthError(reply, 400, 'invalid_grant', (err as Error).message);
    return oauthError(reply, 503, 'temporarily_unavailable', (err as Error).message);
  }

  revoke(req: FastifyRequest, reply: FastifyReply): FastifyReply {
    const f = form(req);
    const hash = hashSecret(f.token || '');
    const s = this.opts.store.state;
    const grant = s.grants.find((g) => g.refreshHash === hash);
    if (grant) this.revokeGrant(grant.id);
    else {
      const before = s.accessTokens.length;
      s.accessTokens = s.accessTokens.filter((t) => t.hash !== hash);
      if (s.accessTokens.length !== before) this.opts.store.save();
    }
    return reply.code(200).send();
  }

  /** Register all routes (call inside the main Fastify app). */
  routes(app: FastifyInstance): void {
    const prm = async () => this.protectedResourceMetadata();
    const asm = async () => this.metadata();
    app.get('/.well-known/oauth-protected-resource', prm);
    app.get('/.well-known/oauth-protected-resource/mcp', prm);
    app.get('/.well-known/oauth-authorization-server', asm);
    // Clients that discover an issuer with a path (PUBLIC_URL with a path prefix) also try this URL.
    app.get('/.well-known/openid-configuration', asm);
    app.get('/oauth/authorize', (req, reply) => this.authorize(req, reply));
    app.get('/oauth/callback', (req, reply) => this.callback(req, reply));
    app.post('/oauth/consent', (req, reply) => this.consent(req, reply));
    app.post('/oauth/token', (req, reply) => this.token(req, reply));
    app.post('/oauth/revoke', (req, reply) => this.revoke(req, reply));
    app.post('/oauth/register', async (req, reply) => {
      const r = this.register((req.body ?? {}) as Record<string, unknown>);
      return reply.code(r.status).header('cache-control', 'no-store').send(r.body);
    });
  }
}
