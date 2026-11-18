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
/** lastUsedAt is only written to disk when it is older than this (avoids a write per request). */
const SESSION_TOUCH_MS = 60 * 60_000;
const LOGIN_FLOW_TTL_MS = 20 * 60_000;
const MAX_FLOWS_PER_IP = 10;
/**
 * Failed app-password sign-ins. Every check of an unknown app password is a login attempt at Nextcloud, and
 * Nextcloud's brute-force protection blocks ALL logins from the proxy's IP after 10 failures in 30 minutes.
 * So unknown credentials are throttled here before they reach Nextcloud: per client IP and login, and per IP.
 */
const FAIL_WINDOW_MS = 15 * 60_000;
const MAX_FAILS_PER_LOGIN = 5;
const MAX_FAILS_PER_IP = 10;

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

class FailureCounter {
  private readonly map = new Map<string, { count: number; reset: number }>();
  blocked(key: string, max: number): boolean {
    const e = this.map.get(key);
    if (!e) return false;
    if (e.reset < Date.now()) {
      this.map.delete(key);
      return false;
    }
    return e.count >= max;
  }
  add(key: string): void {
    const now = Date.now();
    const e = this.map.get(key);
    if (e && e.reset >= now) e.count++;
    else this.map.set(key, { count: 1, reset: now + FAIL_WINDOW_MS });
    if (this.map.size > 20000) this.map.delete(this.map.keys().next().value as string);
  }
  prune(): void {
    const now = Date.now();
    for (const [k, e] of this.map) if (e.reset < now) this.map.delete(k);
  }
}

export class AuthService {
  readonly nextcloud: NextcloudClient | null;
  private readonly flows = new Map<string, { pollToken: string; expires: number; ip: string }>();
  private readonly revalidating = new Map<string, Promise<boolean>>();
  private readonly failures = new FailureCounter();
  private readonly timer: NodeJS.Timeout;
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
    this.timer = setInterval(() => this.housekeeping(), 10 * 60_000);
    this.timer.unref?.();
  }

  close(): void {
    clearInterval(this.timer);
  }

  /** Forget expired flows and failures; remove plugin sign-ins unused for 90 days (and their app passwords). */
  housekeeping(now = Date.now()): void {
    for (const [id, f] of this.flows) if (f.expires < now) this.flows.delete(id);
    this.failures.prune();
    const idle = this.store.state.sessions.filter((x) => now - x.lastUsedAt > SESSION_IDLE_MS);
    if (!idle.length) return;
    this.store.state.sessions = this.store.state.sessions.filter((x) => !idle.includes(x));
    this.store.save();
    for (const x of idle) void this.nextcloud?.revokeAppPassword(x.loginName, x.appPassword);
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
    if (Date.now() - session.lastUsedAt > SESSION_TOUCH_MS) {
      session.lastUsedAt = Date.now();
      this.store.save();
    }
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
        this.store.save();
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
  async authenticateMcp(authorization: string | undefined, ip = ''): Promise<Identity | null> {
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
          // Known (cached) credentials are answered without asking Nextcloud and are never throttled.
          const cached = this.nextcloud!.cachedUser(b);
          if (cached !== undefined) return cached ? { userId: cached.id, displayName: cached.displayName, via: 'app_password' } : null;
          const loginKey = `${ip}|${b.login.toLowerCase()}`;
          if (this.failures.blocked(loginKey, MAX_FAILS_PER_LOGIN) || this.failures.blocked(ip, MAX_FAILS_PER_IP)) return null;
          const user = await this.nextcloud!.currentUser(b);
          if (!user) {
            this.failures.add(loginKey);
            this.failures.add(ip);
            return null;
          }
          return { userId: user.id, displayName: user.displayName, via: 'app_password' };
        }
        const t = bearer(authorization);
        if (t && this.oauth) return this.oauth.verify(t);
        return null;
      }
    }
  }

  // --- plugin sign-in with Nextcloud Login Flow v2 ------------------------------

  async loginStart(ip = ''): Promise<{ flowId: string; loginUrl: string }> {
    if (!this.nextcloud) throw new AuthError('Sign-in with Nextcloud is not enabled (AUTH_MODE)', 400);
    const now = Date.now();
    for (const [id, f] of this.flows) if (f.expires < now) this.flows.delete(id);
    let mine = 0;
    for (const f of this.flows.values()) if (f.ip === ip) mine++;
    if (mine >= MAX_FLOWS_PER_IP || this.flows.size > 5000) throw new AuthError('Too many sign-ins in progress, try again later', 429);
    const { loginUrl, pollToken } = await this.nextcloud.startLoginFlow();
    const flowId = randomToken(24);
    this.flows.set(flowId, { pollToken, expires: now + LOGIN_FLOW_TTL_MS, ip });
    return { flowId, loginUrl };
  }

  /** null = still waiting for the user. */
  async loginPoll(flowId: string): Promise<{ token: string; userId: string; displayName: string } | null> {
    const flow = this.flows.get(flowId);
    if (!flow || flow.expires < Date.now()) throw new AuthError('Sign-in expired – start again', 404);
    const result = await this.nextcloud!.pollLoginFlow(flow.pollToken);
    if (!result) return null;
    this.flows.delete(flowId);
    let user;
    try {
      user = await this.nextcloud!.currentUser({ login: result.loginName, password: result.appPassword });
    } catch (err) {
      await this.nextcloud!.revokeAppPassword(result.loginName, result.appPassword);
      throw err;
    }
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
