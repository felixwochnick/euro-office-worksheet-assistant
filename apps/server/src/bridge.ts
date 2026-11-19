/**
 * Plugin bridge: open editors connect to the proxy with a WebSocket (GET /v1/bridge) so that MCP clients can
 * work on the document that is open in the user's browser. The proxy itself never sees the document; it
 * forwards tool calls to the plugin, which executes them with the editor API exactly like chat tool calls.
 *
 * Protocol (JSON text frames):
 *   plugin -> proxy  {type:"hello", token, document:{title}, client:{version}}   first message, within 10 s
 *   proxy -> plugin  {type:"welcome", session_id, user:{id, display_name}}
 *   proxy -> plugin  {type:"call", id, name, arguments}
 *   plugin -> proxy  {type:"result", id, ok:true, result} | {type:"result", id, ok:false, error}
 *   plugin -> proxy  {type:"active"}                     the user works in this editor (used to pick the default)
 *   plugin -> proxy  {type:"info", document:{title}}
 *   proxy -> plugin  {type:"error", message} and close (4400 bad request, 4401 auth, 4403 origin, 4408 timeout)
 */
import type { WebSocket } from 'ws';
import type { Identity } from './auth.js';
import { randomToken } from './store.js';

const HELLO_TIMEOUT_MS = 10_000;
const PING_INTERVAL_MS = 30_000;
const DEFAULT_CALL_TIMEOUT_MS = 90_000;
const MAX_SESSIONS_PER_USER = 20;
const MAX_PENDING_PER_SESSION = 20;

export class BridgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BridgeError';
  }
}

export class EditorSession {
  readonly id = randomToken(9);
  readonly connectedAt = Date.now();
  lastActiveAt = Date.now();
  title: string;
  private seq = 0;
  private readonly pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();

  constructor(
    readonly socket: WebSocket,
    readonly identity: Identity,
    title: string,
    readonly clientVersion: string,
  ) {
    this.title = title;
  }

  get userId() {
    return this.identity.userId;
  }

  /** Execute a tool in the editor. Resolves with the plugin's result object. */
  call(name: string, args: Record<string, unknown>, timeoutMs = DEFAULT_CALL_TIMEOUT_MS): Promise<unknown> {
    if (this.socket.readyState !== this.socket.OPEN) return Promise.reject(new BridgeError('The editor has disconnected.'));
    if (this.pending.size >= MAX_PENDING_PER_SESSION) return Promise.reject(new BridgeError('Too many calls in progress for this editor.'));
    const id = `c${++this.seq}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new BridgeError(`The editor did not answer within ${Math.round(timeoutMs / 1000)} s.`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ type: 'call', id, name, arguments: args }));
    });
  }

  /** @internal */
  handle(msg: Record<string, unknown>): void {
    if (msg.type === 'result' && typeof msg.id === 'string') {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.ok === false) p.reject(new BridgeError(String(msg.error || 'The editor reported an error.')));
      else p.resolve(msg.result);
      this.lastActiveAt = Math.max(this.lastActiveAt, Date.now() - 1);
    } else if (msg.type === 'active') {
      this.lastActiveAt = Date.now();
    } else if (msg.type === 'info') {
      const doc = msg.document as { title?: unknown } | undefined;
      if (doc && typeof doc.title === 'string') this.title = doc.title.slice(0, 300);
    }
  }

  /** @internal */
  closed(): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new BridgeError('The editor was closed or lost its connection.'));
    }
    this.pending.clear();
  }

  close(code = 1001, reason = 'closing'): void {
    try {
      this.socket.close(code, reason);
    } catch {
      /* already closed */
    }
  }
}

export interface BridgeOptions {
  authenticate: (token: string | undefined) => Promise<Identity>;
  log?: { info: (obj: object, msg: string) => void; warn: (obj: object, msg: string) => void };
}

export class Bridge {
  private readonly sessions = new Map<string, EditorSession>();
  private readonly pingTimer: NodeJS.Timeout;

  constructor(private readonly opts: BridgeOptions) {
    this.pingTimer = setInterval(() => this.ping(), PING_INTERVAL_MS);
    this.pingTimer.unref?.();
  }

  private readonly alive = new WeakMap<WebSocket, boolean>();

  private ping(): void {
    for (const s of this.sessions.values()) {
      const ws = s.socket;
      if (this.alive.get(ws) === false) {
        ws.terminate();
        continue;
      }
      this.alive.set(ws, false);
      try {
        ws.ping();
      } catch {
        /* ignore */
      }
    }
  }

  /** Handle a new WebSocket connection (after the origin check). */
  attach(socket: WebSocket): void {
    let session: EditorSession | null = null;
    let helloSeen = false;
    const helloTimer = setTimeout(() => fail(4408, 'hello timeout'), HELLO_TIMEOUT_MS);
    const fail = (code: number, message: string) => {
      clearTimeout(helloTimer);
      try {
        socket.send(JSON.stringify({ type: 'error', message }));
      } catch {
        /* ignore */
      }
      socket.close(code, message.slice(0, 120));
    };
    this.alive.set(socket, true);
    socket.on('pong', () => this.alive.set(socket, true));
    socket.on('message', async (data, isBinary) => {
      if (isBinary) return fail(4400, 'binary frames are not supported');
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return fail(4400, 'invalid JSON');
      }
      if (!msg || typeof msg !== 'object') return fail(4400, 'invalid message');
      if (session) {
        session.handle(msg);
        return;
      }
      if (msg.type !== 'hello') return fail(4400, 'expected hello');
      // Only one hello per connection (a second one during authentication would create a second session).
      if (helloSeen) return fail(4400, 'duplicate hello');
      helloSeen = true;
      clearTimeout(helloTimer);
      let identity: Identity;
      try {
        identity = await this.opts.authenticate(typeof msg.token === 'string' ? msg.token : undefined);
      } catch (err) {
        return fail(4401, (err as Error).message || 'unauthorized');
      }
      if (socket.readyState !== socket.OPEN) return;
      // Refuse instead of evicting an older editor (evicted editors would reconnect and evict each other).
      // Dead connections disappear within a minute (ping/pong).
      const own = [...this.sessions.values()].filter((s) => s.userId === identity.userId);
      if (own.length >= MAX_SESSIONS_PER_USER) return fail(4429, `too many open editors (max. ${MAX_SESSIONS_PER_USER})`);
      const doc = (msg.document ?? {}) as { title?: unknown };
      const client = (msg.client ?? {}) as { version?: unknown };
      session = new EditorSession(
        socket,
        identity,
        typeof doc.title === 'string' && doc.title.trim() ? doc.title.slice(0, 300) : 'Dokument',
        typeof client.version === 'string' ? client.version.slice(0, 40) : '',
      );
      this.sessions.set(session.id, session);
      this.opts.log?.info({ session: session.id, user: identity.userId }, 'editor connected');
      socket.send(
        JSON.stringify({ type: 'welcome', session_id: session.id, user: { id: identity.userId, display_name: identity.displayName } }),
      );
    });
    socket.on('close', () => {
      clearTimeout(helloTimer);
      if (!session) return;
      this.sessions.delete(session.id);
      session.closed();
      this.opts.log?.info({ session: session.id, user: session.userId }, 'editor disconnected');
    });
    socket.on('error', () => {
      /* 'close' follows */
    });
  }

  /** Open editors of a user, most recently active first. */
  list(userId: string): EditorSession[] {
    return [...this.sessions.values()].filter((s) => s.userId === userId).sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  }

  /** The editor to work on: the given document id or the most recently active one. */
  pick(userId: string, documentId?: string): EditorSession {
    const own = this.list(userId);
    if (documentId) {
      const s = own.find((x) => x.id === documentId);
      if (!s) throw new BridgeError(`No open document with id "${documentId}". Call list_open_documents.`);
      return s;
    }
    if (!own.length) {
      throw new BridgeError(
        'No document is connected. Ask the user to open the document in Euro-Office, open the panel ' +
          '"Arbeitsblatt-Assistent" (Plugins) and switch on "MCP-Zugriff erlauben" in its settings (Einstellungen).',
      );
    }
    return own[0];
  }

  get size(): number {
    return this.sessions.size;
  }

  close(): void {
    clearInterval(this.pingTimer);
    for (const s of this.sessions.values()) s.close(1001, 'server shutdown');
  }
}
