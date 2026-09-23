// Shared by the add dialog (client) and fetch-metadata (server): turns whatever someone
// pasted into the link box into one clean http(s) URL, or tells us it isn't a link at all.

const TRACKING_PARAM_RE =
  /^(utm_.+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|igsh|si|ref_|ref_src|ref_url|_hsenc|_hsmkt|mkt_tok|yclid|spm|share_id|feature)$/i;

const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"'«»“”‘’]+/i;
const BARE_DOMAIN_RE = /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:[/?#]\S*)?$/i;

function stripTrailingPunctuation(s: string) {
  let out = s.replace(/[.,;:!?]+$/, "");
  // A closing paren belongs to the URL only when it has a matching opener inside it
  // (Wikipedia style), otherwise it's the end of the sentence around the link.
  while (out.endsWith(")") && (out.match(/\(/g)?.length ?? 0) < (out.match(/\)/g)?.length ?? 0)) {
    out = out.slice(0, -1);
  }
  return out;
}

export function extractUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  let candidate: string | null = null;
  const inText = text.match(URL_IN_TEXT_RE);
  if (inText) candidate = stripTrailingPunctuation(inText[0]);
  else {
    const firstToken = text.split(/\s+/).find((t) => BARE_DOMAIN_RE.test(stripTrailingPunctuation(t)));
    if (firstToken && (text.split(/\s+/).length === 1 || /[/]/.test(firstToken)))
      candidate = `https://${stripTrailingPunctuation(firstToken)}`;
  }
  if (!candidate) return null;
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function stripTracking(url: string): string {
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) if (TRACKING_PARAM_RE.test(key)) u.searchParams.delete(key);
    let out = u.toString();
    if (!u.search) out = out.replace(/\?$/, "");
    return out;
  } catch {
    return url;
  }
}

// What we show under "Visitors will go to": host plus path, no scheme, no www.
export function displayUrl(url: string, max = 60): string {
  try {
    const u = new URL(url);
    const s = `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}${u.search}`;
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  } catch {
    return url;
  }
}
