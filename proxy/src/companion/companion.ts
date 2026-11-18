/**
 * The companion app: runs the server in AUTH_MODE=local on 127.0.0.1, keeps the plugin installed in the
 * desktop apps and serves a small settings page (http://127.0.0.1:8787/) for the AI provider, MCP and autostart.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { buildServer } from '../server.js';
import { VERSION } from '../version.js';
import { autostartEnabled, setAutostart, stdioCommand } from './autostart.js';
import { claudeAction, ClaudeError, claudeStatus, type ClaudeContext, type Probe, type Runner } from './claude.js';
import { installedInfo, installPlugin, loadPluginFiles, pluginDir, pluginVersion, type PluginFiles } from './install.js';
import { configDir as defaultConfigDir, desktopApps, detectedApps, type DesktopApp, type Env, currentEnv } from './paths.js';
import {
  loadSettings,
  localUrl,
  PROVIDERS,
  saveSettings,
  serverConfig,
  type CompanionProvider,
  type CompanionSettings,
} from './settings-store.js';
import { settingsPage } from './ui.js';

export interface CompanionOptions {
  configDir?: string;
  env?: Env;
  /** Plugin folder to install from when not running as a single executable. */
  pluginSourceDir?: string;
  logLevel?: string;
  /** Override the port from the settings (tests). */
  port?: number;
  onQuit?: () => void;
  /**
   * Secret of the settings API (at least 16 characters). Default: a random one per process, which only the
   * settings page knows; the desktop app chooses its own so that its window can call the API.
   */
  secret?: string;
  /** Running inside the desktop app (`--app`): reported in state(). */
  app?: boolean;
  /** Called whenever the server listens: after start() and after every restart with new settings. */
  onListening?: () => void;
  /** Restarting with new settings failed: the server is down. */
  onRestartError?: (err: Error) => void;
  /** Where the server log goes (default stdout). */
  logStream?: { write(msg: string): void };
  /** Claude Desktop / Claude Code integration: tests replace the file lookups and the `claude` command. */
  claude?: { probe?: Probe; run?: Runner };
}

const LOOPBACK_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;

export class Companion {
  readonly configDir: string;
  readonly env: Env;
  settings: CompanionSettings;
  readonly firstRun: boolean;
  /** Problem with the AI settings (the server then runs without chat). */
  chatError = '';
  private app: FastifyInstance | null = null;
  private files: PluginFiles | null = null;
  private readonly secret: string;
  private restarting: Promise<void> | null = null;
  /** Claude actions run one after another (they rewrite the same files). */
  private claudeQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly opts: CompanionOptions = {}) {
    this.secret = opts.secret && opts.secret.length >= 16 ? opts.secret : crypto.randomBytes(24).toString('base64url');
    this.env = opts.env ?? currentEnv();
    this.configDir = opts.configDir ?? defaultConfigDir(this.env);
    const { settings, created } = loadSettings(this.configDir);
    // A port given on the command line is remembered (autostart and mcp-stdio use the stored one).
    if (opts.port && opts.port !== settings.port) {
      settings.port = opts.port;
      saveSettings(this.configDir, settings);
    }
    this.settings = settings;
    this.firstRun = created;
  }

  get url(): string {
    return localUrl(this.settings);
  }

  pluginFiles(): PluginFiles {
    if (!this.files) this.files = loadPluginFiles(this.opts.pluginSourceDir);
    return this.files;
  }

  local() {
    return { proxyUrl: this.url, token: this.settings.token };
  }

  appsStatus() {
    const detected = new Set(detectedApps(this.env).map((a) => a.id));
    return desktopApps(this.env).map((a) => ({
      id: a.id,
      name: a.name,
      detected: detected.has(a.id),
      plugin_dir: pluginDir(a),
      ...installedInfo(a, this.local()),
    }));
  }

  /** Install or update the plugin in every detected app (or in all known locations with force). */
  install(force = false): Array<{ app: string; dir: string }> {
    const apps: DesktopApp[] = force ? desktopApps(this.env) : detectedApps(this.env);
    return apps.map((a) => ({ app: a.name, dir: installPlugin(a, this.pluginFiles(), this.local()) }));
  }

  /**
   * Install where the plugin is missing, outdated or points to another port/token. Without any detected app the
   * plugin is installed into all known locations: the apps also load it when they are started for the first time
   * afterwards.
   */
  ensureInstalled(): Array<{ app: string; dir: string }> {
    const version = pluginVersion(this.pluginFiles());
    const done: Array<{ app: string; dir: string }> = [];
    const detected = detectedApps(this.env);
    for (const a of detected.length ? detected : desktopApps(this.env)) {
      const info = installedInfo(a, this.local());
      if (!info.installed || !info.configured || info.version !== version) {
        done.push({ app: a.name, dir: installPlugin(a, this.pluginFiles(), this.local()) });
      }
    }
    return done;
  }

  async start(): Promise<void> {
    let cfg;
    try {
      cfg = serverConfig(this.settings, this.opts.logLevel);
      this.chatError = '';
    } catch (err) {
      // e.g. a provider without API key: run without chat, show the problem on the settings page.
      this.chatError = (err as Error).message;
      cfg = serverConfig({ ...this.settings, provider: 'none' }, this.opts.logLevel);
    }
    this.app = await buildServer(cfg, {
      settingsUrl: `${this.url}/`,
      settingsInApp: !!this.opts.app,
      extend: (app) => this.routes(app),
      logStream: this.opts.logStream,
    });
    try {
      await this.app.listen({ host: '127.0.0.1', port: this.settings.port });
    } catch (err) {
      await this.app.close().catch(() => {});
      this.app = null;
      throw err;
    }
    this.opts.onListening?.();
  }

  async stop(): Promise<void> {
    if (this.app) await this.app.close();
    this.app = null;
  }

  /** Apply new settings: restart the server (open editors reconnect automatically). */
  restart(): Promise<void> {
    if (!this.restarting) {
      this.restarting = (async () => {
        await this.stop();
        await this.start();
      })().finally(() => {
        this.restarting = null;
      });
    }
    return this.restarting;
  }

  state() {
    const s = this.settings;
    return {
      version: VERSION,
      url: this.url,
      mcp_url: `${this.url}/mcp`,
      config_dir: this.configDir,
      apps: this.appsStatus(),
      plugin_version: (() => {
        try {
          return pluginVersion(this.pluginFiles());
        } catch {
          return '';
        }
      })(),
      settings: { provider: s.provider, model: s.model, base_url: s.baseUrl, has_key: !!s.apiKey, extra_origins: s.extraOrigins },
      providers: Object.entries(PROVIDERS).map(([id, p]) => ({ id, label: p.label, model: p.model, needs_key: p.needsKey, base_url: p.baseUrl })),
      chat_error: this.chatError,
      autostart: autostartEnabled(this.configDir, this.env),
      stdio_command: stdioCommand(this.env),
      platform: this.env.platform,
      app: !!this.opts.app,
    };
  }

  claudeContext(): ClaudeContext {
    return { stdio: stdioCommand(this.env), mcpUrl: `${this.url}/mcp`, env: this.env, ...this.opts.claude };
  }

  /** Validate and store new AI settings; returns an error message or null. */
  updateSettings(body: Record<string, unknown>): string | null {
    const provider = String(body.provider ?? this.settings.provider) as CompanionProvider;
    if (!(provider in PROVIDERS)) return 'Unbekannter Anbieter.';
    const next: CompanionSettings = {
      ...this.settings,
      provider,
      model: String(body.model ?? '').trim().slice(0, 200),
      baseUrl: String(body.base_url ?? '').trim().slice(0, 500),
      apiKey: typeof body.api_key === 'string' && body.api_key.trim() ? body.api_key.trim() : body.clear_key ? '' : this.settings.apiKey,
      extraOrigins: Array.isArray(body.extra_origins)
        ? (body.extra_origins as unknown[]).map((o) => String(o).trim().replace(/\/+$/, '')).filter((o) => /^https?:\/\/[^\s/]+$/.test(o)).slice(0, 10)
        : this.settings.extraOrigins,
    };
    try {
      serverConfig(next);
    } catch (err) {
      return (err as Error).message;
    }
    this.settings = next;
    saveSettings(this.configDir, next);
    return null;
  }

  private routes(app: FastifyInstance): void {
    const guard = async (req: FastifyRequest, reply: FastifyReply) => {
      // Only this page may call the API: secret from the page (other websites cannot read it) + same origin.
      const origin = req.headers.origin;
      if ((origin && !LOOPBACK_ORIGIN.test(origin)) || req.headers['x-companion-secret'] !== this.secret) {
        return reply.code(403).send({ error: 'forbidden' });
      }
    };
    app.get('/', async (_req, reply) =>
      reply
        .header('content-type', 'text/html; charset=utf-8')
        .header('cache-control', 'no-store')
        .header('x-frame-options', 'DENY')
        .header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'")
        .send(settingsPage(this.secret)),
    );
    app.get('/companion/api/state', { preHandler: guard }, async () => this.state());
    app.post('/companion/api/settings', { preHandler: guard }, async (req, reply) => {
      const error = this.updateSettings((req.body ?? {}) as Record<string, unknown>);
      if (error) return reply.code(400).send({ ok: false, error });
      // Answer first, then restart the server with the new settings.
      setTimeout(
        () =>
          void this.restart().catch((err: Error) => {
            if (this.opts.onRestartError) this.opts.onRestartError(err);
            else process.stderr.write(`Neustart fehlgeschlagen: ${err.message}\n`);
          }),
        50,
      );
      return { ok: true };
    });
    app.post('/companion/api/install', { preHandler: guard }, async (req, reply) => {
      try {
        const force = !!(req.body as { force?: boolean } | undefined)?.force;
        return { ok: true, installed: this.install(force) };
      } catch (err) {
        return reply.code(500).send({ ok: false, error: (err as Error).message });
      }
    });
    app.post('/companion/api/autostart', { preHandler: guard }, async (req, reply) => {
      try {
        setAutostart(!!(req.body as { enabled?: boolean } | undefined)?.enabled, this.configDir, this.env);
        return { ok: true, autostart: autostartEnabled(this.configDir, this.env) };
      } catch (err) {
        return reply.code(500).send({ ok: false, error: (err as Error).message });
      }
    });
    app.post('/companion/api/quit', { preHandler: guard }, async () => {
      setTimeout(() => this.opts.onQuit?.(), 100);
      return { ok: true };
    });
    app.get('/companion/api/claude', { preHandler: guard }, async () => claudeStatus(this.claudeContext()));
    app.post('/companion/api/claude', { preHandler: guard }, async (req, reply) => {
      const { client, action } = (req.body ?? {}) as { client?: unknown; action?: unknown };
      if ((client !== 'desktop' && client !== 'code') || (action !== 'add' && action !== 'remove')) {
        return reply.code(400).send({ ok: false, error: 'Ungültige Anfrage (client: desktop|code, action: add|remove).' });
      }
      const run = this.claudeQueue.then(() => claudeAction(this.claudeContext(), client, action));
      this.claudeQueue = run.catch(() => {});
      try {
        return { ok: true, status: await run };
      } catch (err) {
        const known = err instanceof ClaudeError;
        return reply.code(known ? err.statusCode : 500).send({ ok: false, error: known ? err.message : `Unerwarteter Fehler: ${(err as Error).message}` });
      }
    });
  }

  logFile(): string {
    return path.join(this.configDir, 'companion.log');
  }
}
