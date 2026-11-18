/**
 * Calls to Nextcloud used for authentication:
 *  - OCS "current user" to validate app passwords and OAuth access tokens
 *  - Login Flow v2 (the plugin signs in without typing a password into the plugin)
 *  - the built-in OAuth2 app as a confidential client (sign-in of MCP clients)
 *
 * Nextcloud's OAuth2 app has no PKCE, no dynamic client registration and no metadata discovery, so this
 * proxy runs its own small authorization server for MCP clients and uses Nextcloud only for the login
 * (see oauth.ts).
 */
import crypto from 'node:crypto';

export interface NextcloudUser {
  id: string;
  displayName: string;
}

export interface NextcloudTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
}

export class NextcloudError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'NextcloudError';
  }
}

export interface NextcloudOptions {
  /** Base URL used in the browser (login pages). */
  url: string;
  /** Base URL used by this server (defaults to url). */
  internalUrl?: string;
  clientId?: string;
  clientSecret?: string;
  timeoutMs?: number;
  /** Shown by Nextcloud as the app name in Login Flow v2 and in "Devices & sessions". */
  userAgent?: string;
  fetchImpl?: typeof fetch;
}

const POSITIVE_TTL_MS = 5 * 60_000;
const NEGATIVE_TTL_MS = 30_000;

export class NextcloudClient {
  readonly url: string;
  private readonly internalUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly cache = new Map<string, { user: NextcloudUser | null; expires: number }>();

  constructor(private readonly opts: NextcloudOptions) {
    this.url = opts.url.replace(/\/+$/, '');
    this.internalUrl = (opts.internalUrl || opts.url).replace(/\/+$/, '');
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  get oauthConfigured(): boolean {
    return !!(this.opts.clientId && this.opts.clientSecret);
  }

  private async call(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('user-agent', this.opts.userAgent || 'Arbeitsblatt-Assistent');
    try {
      return await this.fetchImpl(this.internalUrl + path, {
        ...init,
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 15_000),
      });
    } catch (err) {
      throw new NextcloudError(`Nextcloud not reachable: ${(err as Error).message}`);
    }
  }

  /**
   * The current user for an app password (Basic) or an OAuth access token (Bearer).
   * Returns null when Nextcloud rejects the credentials.
   */
  async currentUser(auth: { login: string; password: string } | { bearer: string }): Promise<NextcloudUser | null> {
    const authorization =
      'bearer' in auth
        ? `Bearer ${auth.bearer}`
        : `Basic ${Buffer.from(`${auth.login}:${auth.password}`).toString('base64')}`;
    const key = crypto.createHash('sha256').update(authorization).digest('hex');
    const hit = this.cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.user;

    const res = await this.call('/ocs/v2.php/cloud/user?format=json', {
      headers: { authorization, 'ocs-apirequest': 'true', accept: 'application/json' },
    });
    let user: NextcloudUser | null = null;
    if (res.status === 200) {
      const body = (await res.json().catch(() => null)) as { ocs?: { data?: Record<string, unknown> } } | null;
      const data = body?.ocs?.data;
      if (!data || typeof data.id !== 'string') throw new NextcloudError('Unexpected answer from Nextcloud (cloud/user)');
      const name = data['display-name'] ?? data.displayname ?? data.id;
      user = { id: data.id, displayName: String(name) };
    } else if (res.status !== 401 && res.status !== 403) {
      throw new NextcloudError(`Nextcloud answered HTTP ${res.status} (cloud/user)`, res.status);
    }
    this.cache.set(key, { user, expires: Date.now() + (user ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS) });
    if (this.cache.size > 5000) this.cache.delete(this.cache.keys().next().value as string);
    return user;
  }

  forget(auth: { login: string; password: string }): void {
    const authorization = `Basic ${Buffer.from(`${auth.login}:${auth.password}`).toString('base64')}`;
    this.cache.delete(crypto.createHash('sha256').update(authorization).digest('hex'));
  }

  /** Start Login Flow v2. Returns the URL to open in the browser and the secret poll token. */
  async startLoginFlow(): Promise<{ loginUrl: string; pollToken: string }> {
    const res = await this.call('/index.php/login/v2', { method: 'POST' });
    if (res.status !== 200) throw new NextcloudError(`Login Flow could not be started (HTTP ${res.status})`, res.status);
    const body = (await res.json().catch(() => null)) as { login?: string; poll?: { token?: string } } | null;
    if (!body?.login || !body.poll?.token) throw new NextcloudError('Unexpected answer from Nextcloud (login/v2)');
    // Nextcloud builds the login URL from the request it received; behind an internal URL, show the public one.
    let loginUrl = body.login;
    if (this.internalUrl !== this.url && loginUrl.startsWith(this.internalUrl)) {
      loginUrl = this.url + loginUrl.slice(this.internalUrl.length);
    }
    return { loginUrl, pollToken: body.poll.token };
  }

  /** Poll Login Flow v2: null while the user has not granted access yet. */
  async pollLoginFlow(pollToken: string): Promise<{ loginName: string; appPassword: string } | null> {
    const res = await this.call('/index.php/login/v2/poll', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: pollToken }).toString(),
    });
    if (res.status === 404) return null;
    if (res.status !== 200) throw new NextcloudError(`Login Flow poll failed (HTTP ${res.status})`, res.status);
    const body = (await res.json().catch(() => null)) as { loginName?: string; appPassword?: string } | null;
    if (!body?.loginName || !body.appPassword) throw new NextcloudError('Unexpected answer from Nextcloud (login/v2/poll)');
    return { loginName: body.loginName, appPassword: body.appPassword };
  }

  /** Delete an app password (sign-out). Errors are ignored. */
  async revokeAppPassword(login: string, password: string): Promise<void> {
    this.forget({ login, password });
    try {
      await this.call('/ocs/v2.php/core/apppassword', {
        method: 'DELETE',
        headers: {
          authorization: `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
          'ocs-apirequest': 'true',
        },
      });
    } catch {
      /* best effort */
    }
  }

  /** URL of Nextcloud's OAuth2 consent page (opened in the user's browser). */
  authorizeUrl(state: string, redirectUri: string): string {
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: this.opts.clientId || '',
      redirect_uri: redirectUri,
      state,
    });
    return `${this.url}/index.php/apps/oauth2/authorize?${q.toString()}`;
  }

  private async tokenRequest(params: Record<string, string>): Promise<NextcloudTokens> {
    const res = await this.call('/index.php/apps/oauth2/api/v1/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        ...params,
        client_id: this.opts.clientId || '',
        client_secret: this.opts.clientSecret || '',
      }).toString(),
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (res.status !== 200 || !body || typeof body.access_token !== 'string') {
      throw new NextcloudError(`Nextcloud token request failed (HTTP ${res.status}${body?.error ? `, ${String(body.error)}` : ''})`, res.status);
    }
    return {
      accessToken: body.access_token,
      refreshToken: String(body.refresh_token ?? ''),
      expiresIn: Number(body.expires_in ?? 3600),
      userId: String(body.user_id ?? ''),
    };
  }

  exchangeCode(code: string, redirectUri: string): Promise<NextcloudTokens> {
    return this.tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  }

  refresh(refreshToken: string): Promise<NextcloudTokens> {
    return this.tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }
}
