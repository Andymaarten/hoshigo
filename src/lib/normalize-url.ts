// Normalizes a URL for exact-link matching in categories with no canonical database
// (essays, things, and any future category without a resolver) — see docs/sources.md
// "Non-canonical categories: exact-link matching". This is deliberately conservative:
// it strips only scheme/www/trailing-slash/tracking-param noise, never anything that
// could change which resource the link actually points at.

const TRACKING_PARAM_RE = /^(utm_|ref$|fbclid$|gclid$|mc_cid$|mc_eid$|igshid$)/i;

export function normalizeUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();

  for (const key of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAM_RE.test(key)) parsed.searchParams.delete(key);
  }
  parsed.searchParams.sort();
  const search = parsed.searchParams.toString();

  let path = parsed.pathname.replace(/\/+$/, "");
  if (path === "") path = "/";

  return `${host}${path}${search ? `?${search}` : ""}`;
}
