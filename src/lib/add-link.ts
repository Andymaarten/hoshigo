// /add?url=… deep link (docs/add-link.md). Shared by the client page that reads the raw
// address and by the server code that carries the link through login.

export const ADD_COOKIE = "hoshigo_add";
export const ADD_MAX_LENGTH = 2000;

// Browsers show and hand us non ASCII characters percent encoded ("星五" as
// %E6%98%9F%E4%BA%94). Turn only those runs back into text; ASCII escapes like %20 or
// %2F stay exactly as they were, since they can be a real part of the link.
function decodeNonAsciiRuns(s: string): string {
  return s.replace(/(?:%[0-9A-F]{2})+/gi, (run) => {
    try {
      const decoded = decodeURIComponent(run);
      return /^[^\x00-\x7F]+$/.test(decoded) ? decoded : run;
    } catch {
      return run;
    }
  });
}

/**
 * Where an /add visit came from, for stats: an explicit via= before url= (the iPhone
 * Shortcut sends via=shortcut), otherwise "share" for Android share sheet visits (they
 * carry title or text) and "direct" for everything else. Only letters, digits and _ are kept.
 */
export function viaFromAddHref(href: string): string {
  const q = href.indexOf("?");
  if (q < 0) return "direct";
  let query = href.slice(q + 1).split("#")[0];
  const u = query.search(/(^|&)url=/);
  if (u >= 0) query = query.slice(0, u);
  const params = new URLSearchParams(query);
  const via = (params.get("via") ?? "").replace(/[^a-z0-9_]/gi, "").slice(0, 32);
  if (via) return via;
  return params.has("title") || params.has("text") ? "share" : "direct";
}

/**
 * Owner rule: everything after the first "url=" is the link, verbatim, including later
 * "?", "&" and "#". Read from the raw address, never from parsed search params.
 * - A link encoded as a whole (url=https%3A%2F%2F…) is decoded exactly once. That's
 *   recognisable because its scheme is followed by an encoded colon; a normal link with
 *   %xx inside (a%20b) starts with a real "https://" and is left alone.
 * - Returns null when there is no "url=" at all, so the caller can fall back to a link
 *   carried through login. Share targets that leave url empty put the link in text or
 *   title, so those are used next.
 */
export function linkFromAddHref(href: string): string | null {
  const q = href.indexOf("?");
  if (q < 0) return null;
  const query = href.slice(q + 1);
  const i = query.search(/(^|[&?])url=/);
  let raw = i < 0 ? null : query.slice(query.indexOf("url=", i) + 4);

  if (!raw) {
    try {
      const params = new URLSearchParams(query.split("#")[0]);
      const fallback = params.get("text") || params.get("title");
      if (fallback) return fallback.slice(0, ADD_MAX_LENGTH);
    } catch {
      // not a parsable query; fall through
    }
    return raw === null ? null : "";
  }

  if (/^[a-z][a-z0-9+.-]*%3A/i.test(raw)) {
    try {
      // form encoded (share targets) also turn spaces into "+"
      raw = decodeURIComponent(raw.replace(/\+/g, " "));
    } catch {
      // keep it raw
    }
  } else if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    // Not a link at all (a title typed after url=): it only goes into the text box, so
    // turn "Spirited%20Away" back into words.
    try {
      raw = decodeURIComponent(raw);
    } catch {
      raw = decodeNonAsciiRuns(raw);
    }
  } else {
    raw = decodeNonAsciiRuns(raw);
  }
  return raw.slice(0, ADD_MAX_LENGTH);
}
