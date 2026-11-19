/**
 * Fetch a small JSON document from a URL given by an untrusted party (OAuth client ID metadata documents)
 * without letting it reach internal services (SSRF):
 *  - https only, no redirects, 5 s timeout, at most 64 KB
 *  - the address is checked at connection time (custom DNS lookup), so DNS rebinding between a check and the
 *    request is not possible; private, loopback, link-local, multicast and IPv4-in-IPv6 forms are refused
 */
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';

const MAX_BYTES = 65536;
const TIMEOUT_MS = 5000;

const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3],
] as const) {
  blocked.addSubnet(addr, prefix, 'ipv4');
}
for (const [addr, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96], // NAT64
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 32], // Teredo
  ['2001:db8::', 32],
  ['2002::', 16], // 6to4
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blocked.addSubnet(addr, prefix, 'ipv6');
}

/** True for addresses this server must not connect to on behalf of others. */
export function isBlockedAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return blocked.check(address, 'ipv4');
  if (family !== 6) return true;
  // IPv4-mapped (::ffff:127.0.0.1 = ::ffff:7f00:1) and IPv4-compatible forms: never needed for a metadata
  // document, so refuse them all instead of decoding.
  const normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1).toLowerCase();
  if (/^::(ffff:)?[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(normalized) || /^::ffff:/.test(normalized)) return true;
  return blocked.check(address, 'ipv6');
}

function safeLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void,
): void {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '');
    const list = (addresses as dns.LookupAddress[]).filter((a) => !isBlockedAddress(a.address));
    if (!list.length) return callback(Object.assign(new Error(`${hostname} resolves to a blocked address`), { code: 'EBLOCKED' }), '');
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

/** GET an https URL and return its body as text, or null on any problem. */
export async function fetchSmallDocument(url: string): Promise<string | null> {
  const r = await fetchSafe(url, { maxBytes: MAX_BYTES, timeoutMs: TIMEOUT_MS, accept: 'application/json' });
  return r && r.status === 200 ? r.body.toString('utf8') : null;
}

export interface SafeResponse {
  status: number;
  contentType: string;
  body: Buffer;
}

export interface SafeFetchOptions {
  maxBytes: number;
  timeoutMs: number;
  accept?: string;
  /** If set, only these host names are contacted. */
  allowedHosts?: ReadonlySet<string>;
  userAgent?: string;
}

/**
 * GET an https URL with the protections above (no redirects, blocked internal addresses, size and time limits).
 * Resolves null when the URL is refused, the server is unreachable or the body is too large; otherwise the
 * status, content type and body (also for non-200 answers).
 */
export function fetchSafe(url: string, opts: SafeFetchOptions): Promise<SafeResponse | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return Promise.resolve(null);
  }
  if (u.protocol !== 'https:' || u.username || u.password) return Promise.resolve(null);
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (opts.allowedHosts && !opts.allowedHosts.has(host)) return Promise.resolve(null);
  if (net.isIP(host) && isBlockedAddress(host)) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: SafeResponse | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const req = https.get(
      u,
      {
        lookup: safeLookup as unknown as typeof dns.lookup,
        timeout: opts.timeoutMs,
        headers: { accept: opts.accept ?? '*/*', 'user-agent': opts.userAgent ?? 'Arbeitsblatt-Assistent' },
      },
      (res) => {
        if (Number(res.headers['content-length'] || 0) > opts.maxBytes) {
          res.destroy();
          return done(null);
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size > opts.maxBytes) {
            res.destroy();
            done(null);
            return;
          }
          chunks.push(c);
        });
        res.on('end', () =>
          done(size <= opts.maxBytes ? { status: res.statusCode ?? 0, contentType: String(res.headers['content-type'] || ''), body: Buffer.concat(chunks) } : null),
        );
        res.on('error', () => done(null));
      },
    );
    req.on('timeout', () => req.destroy());
    req.on('error', () => done(null));
    setTimeout(() => {
      req.destroy();
      done(null);
    }, opts.timeoutMs + 1000).unref?.();
  });
}
