import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Server side fetch for URLs that come from users (pasted links and wherever they redirect).
// Refuses anything that isn't http(s) or that resolves to loopback, private, link local,
// CGNAT or cloud metadata addresses, and re-checks every redirect hop.
// Residual risk: DNS can change between our lookup and fetch's own lookup (rebinding).

export class BlockedUrlError extends Error {}

function ipv4ToInt(ip: string) {
  return ip.split(".").reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;
}

function inV4(ip: string, cidr: string) {
  const [base, bits] = cidr.split("/");
  const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const V4_BLOCKED = [
  "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12",
  "192.0.0.0/24", "192.168.0.0/16", "198.18.0.0/15", "224.0.0.0/4", "240.0.0.0/4",
];

export function isBlockedIp(ip: string): boolean {
  if (isIP(ip) === 4) return V4_BLOCKED.some((c) => inV4(ip, c));
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIp(mapped[1]);
  return (
    // "::" prefixed covers ::, ::1 and IPv4 mapped/compatible forms like ::ffff:7f00:1
    v6.startsWith("::") ||
    v6.startsWith("64:ff9b:") || // NAT64 can reach internal IPv4
    v6 === "::1" ||
    /^f[cd][0-9a-f]{2}:/.test(v6) || // fc00::/7 unique local
    /^fe[89ab][0-9a-f]:/.test(v6) || // fe80::/10 link local
    /^ff/.test(v6) // multicast
  );
}

export async function assertPublicUrl(raw: string | URL): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new BlockedUrlError("scheme");
  if (u.username || u.password) throw new BlockedUrlError("credentials");
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host === "metadata.google.internal")
    throw new BlockedUrlError("host");
  if (isIP(host)) {
    if (isBlockedIp(host)) throw new BlockedUrlError("ip");
    return u;
  }
  const addrs = await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new BlockedUrlError("dns");
  if (addrs.some((a) => isBlockedIp(a.address))) throw new BlockedUrlError("ip");
  return u;
}

// fetch() with redirect: "manual", following at most `maxHops` redirects and checking each.
// The returned Response's `url` is the final URL.
export async function safeFetch(url: string, init: RequestInit = {}, maxHops = 5): Promise<Response> {
  let current = await assertPublicUrl(url);
  for (let hop = 0; ; hop++) {
    const res = await fetch(current, { ...init, redirect: "manual" });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      if (hop >= maxHops) throw new BlockedUrlError("too many redirects");
      await res.body?.cancel().catch(() => {});
      current = await assertPublicUrl(new URL(location, current));
      continue;
    }
    Object.defineProperty(res, "url", { value: current.toString() });
    return res;
  }
}
