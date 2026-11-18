/**
 * Small persistent JSON store for authentication state (plugin sign-ins, OAuth clients, grants and tokens).
 *
 * Secrets are stored as SHA-256 hashes where possible. Nextcloud app passwords and Nextcloud refresh tokens
 * must be kept in clear text (they are needed to re-check and refresh the user's access), so the file is
 * written with mode 0600 – keep DATA_DIR private.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Plugin sign-in via Nextcloud Login Flow v2. */
export interface StoredSession {
  tokenHash: string;
  userId: string;
  displayName: string;
  /** Nextcloud login name + app password from Login Flow v2 (used to re-check the account). */
  loginName: string;
  appPassword: string;
  createdAt: number;
  lastUsedAt: number;
  validatedAt: number;
}

/** OAuth client registered with dynamic client registration (RFC 7591). */
export interface StoredClient {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  client_uri?: string;
  createdAt: number;
  lastUsedAt: number;
}

/** One authorization of an MCP client by a user (refreshable). */
export interface StoredGrant {
  id: string;
  clientId: string;
  clientName: string;
  userId: string;
  displayName: string;
  scope: string;
  resource: string;
  /** Nextcloud refresh token: refreshing it on every token refresh checks that the access was not revoked. */
  ncRefreshToken: string;
  refreshHash: string;
  refreshExpiresAt: number;
  createdAt: number;
}

export interface StoredAccessToken {
  hash: string;
  grantId: string;
  userId: string;
  clientId: string;
  resource: string;
  expiresAt: number;
}

export interface AuthState {
  version: 1;
  sessions: StoredSession[];
  clients: StoredClient[];
  grants: StoredGrant[];
  accessTokens: StoredAccessToken[];
}

export function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export class AuthStore {
  readonly state: AuthState;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly file: string | null,
    private readonly onError: (err: unknown) => void = () => {},
  ) {
    this.state = { version: 1, sessions: [], clients: [], grants: [], accessTokens: [] };
    if (!file) return;
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<AuthState>;
      for (const key of ['sessions', 'clients', 'grants', 'accessTokens'] as const) {
        if (Array.isArray(raw[key])) (this.state[key] as unknown[]) = raw[key] as unknown[];
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`Cannot read ${file}: ${(err as Error).message}`);
    }
    this.prune();
  }

  /** Drop expired tokens and grants. */
  prune(now = Date.now()): void {
    const s = this.state;
    s.accessTokens = s.accessTokens.filter((t) => t.expiresAt > now);
    s.grants = s.grants.filter((g) => g.refreshExpiresAt > now);
    const live = new Set(s.grants.map((g) => g.id));
    s.accessTokens = s.accessTokens.filter((t) => live.has(t.grantId));
    // Registered clients that were never used for 90 days.
    s.clients = s.clients.filter((c) => now - c.lastUsedAt < 90 * 86400_000);
  }

  /** Schedule a write (debounced). */
  save(): void {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, 200);
    this.timer.unref?.();
  }

  flush(): void {
    if (!this.file) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      this.prune();
      fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
      const tmp = `${this.file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.state), { mode: 0o600 });
      fs.renameSync(tmp, this.file);
    } catch (err) {
      this.onError(err);
    }
  }
}
