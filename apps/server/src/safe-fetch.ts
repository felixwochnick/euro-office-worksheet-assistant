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
export function fetchSmallDocument(url: string): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return Promise.resolve(null);
  }
  if (u.protocol !== 'https:') return Promise.resolve(null);
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isBlockedAddress(host)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = https.get(
      u,
      { lookup: safeLookup as unknown as typeof dns.lookup, timeout: TIMEOUT_MS, headers: { accept: 'application/json', 'user-agent': 'Arbeitsblatt-Assistent' } },
      (res) => {
        if (res.statusCode !== 200 || Number(res.headers['content-length'] || 0) > MAX_BYTES) {
          res.destroy();
          return resolve(null);
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            res.destroy();
            resolve(null);
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => resolve(size <= MAX_BYTES ? Buffer.concat(chunks).toString('utf8') : null));
        res.on('error', () => resolve(null));
      },
    );
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
    setTimeout(() => req.destroy(), TIMEOUT_MS + 1000).unref?.();
  });
}
