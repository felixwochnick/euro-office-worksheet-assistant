/**
 * Who is calling? Identity of plugin requests (chat, bridge) and of MCP clients, depending on AUTH_MODE:
 *
 *   token      plugin + MCP: shared PROXY_TOKEN (Bearer)                 -> user "default"
 *   local      plugin: PROXY_TOKEN, MCP: no authentication (loopback)   -> user "default"
 *   nextcloud  plugin: session token from Nextcloud Login Flow v2       -> Nextcloud user id
 *              MCP: Nextcloud app password (Basic) or OAuth access token (Bearer, see oauth.ts)
 *
 * The user id decides which open editors (bridge sessions) an MCP client can reach.
 */
import crypto from 'node:crypto';
import type { Config } from './config.js';
import { NextcloudClient, NextcloudError } from './nextcloud.js';
import { AuthStore, hashSecret, randomToken, type StoredSession } from './store.js';

export interface Identity {
  userId: string;
  displayName: string;
  via: 'token' | 'local' | 'session' | 'app_password' | 'oauth';
  /** OAuth client id (via oauth). */
  clientId?: string;
}

export const DEFAULT_USER = 'default';
/** Re-check a plugin sign-in against Nextcloud at most this often (revoked app passwords stop working). */
const SESSION_REVALIDATE_MS = 10 * 60_000;
const SESSION_IDLE_MS = 90 * 86400_000;
const LOGIN_FLOW_TTL_MS = 20 * 60_000;

function tokenMatches(given: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function bearer(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return m ? m[1] : undefined;
}

export function basic(header: string | undefined): { login: string; password: string } | undefined {
  if (!header) return undefined;
  const m = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/i.exec(header);
  if (!m) return undefined;
  const decoded = Buffer.from(m[1], 'base64').toString('utf8');
  const i = decoded.indexOf(':');
  if (i <= 0) return undefined;
  return { login: decoded.slice(0, i), password: decoded.slice(i + 1) };
}

export class AuthError extends Error {
  constructor(message: string, readonly status = 401) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface AccessTokenVerifier {
  /** Identity for an OAuth access token issued by this proxy, or null. */
  verify(token: string): Identity | null;
}

export class AuthService {
  readonly nextcloud: NextcloudClient | null;
  private readonly flows = new Map<string, { pollToken: string; expires: number }>();
  private readonly revalidating = new Map<string, Promise<boolean>>();
  oauth: AccessTokenVerifier | null = null;

  constructor(
    private readonly cfg: Config,
    readonly store: AuthStore,
    nextcloud?: NextcloudClient,
  ) {
    this.nextcloud =
      nextcloud ??
      (cfg.authMode === 'nextcloud'
        ? new NextcloudClient({
            url: cfg.nextcloudUrl,
            internalUrl: cfg.nextcloudInternalUrl,
            clientId: cfg.nextcloudOAuthClientId,
            clientSecret: cfg.nextcloudOAuthClientSecret,
          })
        : null);
  }

  get mode() {
    return this.cfg.authMode;
  }

  /** Plugin requests (/v1/chat, /v1/info, bridge hello). */
  async authenticatePlugin(token: string | undefined): Promise<Identity> {
    if (this.cfg.authMode !== 'nextcloud') {
      if (!this.cfg.proxyToken) return { userId: DEFAULT_USER, displayName: '', via: 'token' };
      if (token && tokenMatches(token, this.cfg.proxyToken)) return { userId: DEFAULT_USER, displayName: '', via: 'token' };
      throw new AuthError('Invalid or missing proxy token');
    }
    if (!token) throw new AuthError('Not signed in');
    const hash = hashSecret(token);
    const session = this.store.state.sessions.find((s) => s.tokenHash === hash);
    if (!session || Date.now() - session.lastUsedAt > SESSION_IDLE_MS) throw new AuthError('Sign-in expired – please sign in again');
    if (Date.now() - session.validatedAt > SESSION_REVALIDATE_MS) {
      const ok = await this.revalidate(session);
      if (!ok) throw new AuthError('The Nextcloud access was revoked – please sign in again');
    }
    session.lastUsedAt = Date.now();
    this.store.save();
    return { userId: session.userId, displayName: session.displayName, via: 'session' };
  }

  private revalidate(session: StoredSession): Promise<boolean> {
    const running = this.revalidating.get(session.tokenHash);
    if (running) return running;
    const p = (async () => {
      try {
        const user = await this.nextcloud!.currentUser({ login: session.loginName, password: session.appPassword });
        if (!user || user.id !== session.userId) {
          this.store.state.sessions = this.store.state.sessions.filter((s) => s !== session);
          this.store.save();
          return false;
        }
        session.validatedAt = Date.now();
        session.displayName = user.displayName;
        return true;
      } catch (err) {
        // Nextcloud temporarily unreachable: keep the session working (it was valid before).
        if (err instanceof NextcloudError) return true;
        throw err;
      } finally {
        this.revalidating.delete(session.tokenHash);
      }
    })();
    this.revalidating.set(session.tokenHash, p);
    return p;
  }

  /** MCP requests. Returns null when credentials are missing or wrong (-> 401 with a challenge). */
  async authenticateMcp(authorization: string | undefined): Promise<Identity | null> {
    switch (this.cfg.authMode) {
      case 'local':
        return { userId: DEFAULT_USER, displayName: '', via: 'local' };
      case 'token': {
        const t = bearer(authorization);
        if (!this.cfg.proxyToken) return { userId: DEFAULT_USER, displayName: '', via: 'token' };
        return t && tokenMatches(t, this.cfg.proxyToken) ? { userId: DEFAULT_USER, displayName: '', via: 'token' } : null;
      }
      case 'nextcloud': {
        const b = basic(authorization);
        if (b) {
          const user = await this.nextcloud!.currentUser(b);
          return user ? { userId: user.id, displayName: user.displayName, via: 'app_password' } : null;
        }
        const t = bearer(authorization);
        if (t && this.oauth) return this.oauth.verify(t);
        return null;
      }
    }
  }

  // --- plugin sign-in with Nextcloud Login Flow v2 ------------------------------

  async loginStart(): Promise<{ flowId: string; loginUrl: string }> {
    if (!this.nextcloud) throw new AuthError('Sign-in with Nextcloud is not enabled (AUTH_MODE)', 400);
    const now = Date.now();
    for (const [id, f] of this.flows) if (f.expires < now) this.flows.delete(id);
    if (this.flows.size > 1000) throw new AuthError('Too many sign-ins in progress, try again later', 429);
    const { loginUrl, pollToken } = await this.nextcloud.startLoginFlow();
    const flowId = randomToken(24);
    this.flows.set(flowId, { pollToken, expires: now + LOGIN_FLOW_TTL_MS });
    return { flowId, loginUrl };
  }

  /** null = still waiting for the user. */
  async loginPoll(flowId: string): Promise<{ token: string; userId: string; displayName: string } | null> {
    const flow = this.flows.get(flowId);
    if (!flow || flow.expires < Date.now()) throw new AuthError('Sign-in expired – start again', 404);
    const result = await this.nextcloud!.pollLoginFlow(flow.pollToken);
    if (!result) return null;
    this.flows.delete(flowId);
    const user = await this.nextcloud!.currentUser({ login: result.loginName, password: result.appPassword });
    if (!user) throw new AuthError('Nextcloud did not accept the new app password');
    const token = randomToken(32);
    const now = Date.now();
    this.store.state.sessions.push({
      tokenHash: hashSecret(token),
      userId: user.id,
      displayName: user.displayName,
      loginName: result.loginName,
      appPassword: result.appPassword,
      createdAt: now,
      lastUsedAt: now,
      validatedAt: now,
    });
    this.store.save();
    return { token, userId: user.id, displayName: user.displayName };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    const hash = hashSecret(token);
    const session = this.store.state.sessions.find((s) => s.tokenHash === hash);
    if (!session) return;
    this.store.state.sessions = this.store.state.sessions.filter((s) => s !== session);
    this.store.save();
    await this.nextcloud?.revokeAppPassword(session.loginName, session.appPassword);
  }
}
