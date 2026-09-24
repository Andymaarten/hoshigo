import { extractUrl, stripTracking } from "./link-input";
import { classify, jsonLdTypes, pageMarkers, type Classification } from "./classify";
import { extractYoutubeId, resolveBook, resolveFilm } from "./resolve-work";
import { assertPublicUrl, safeFetch } from "./safe-fetch";

// When nothing on the page says what it is, a near exact title hit in one of our own
// catalogs is evidence. Only high confidence hits count, and they only reorder the one tap
// choices (or preselect, when exactly one catalog agrees); the person still confirms.
async function probeCatalogs(title: string, by: string | undefined, base: Classification, slugs: string[]): Promise<Classification> {
  const [film, book] = await Promise.all([resolveFilm(title).catch(() => null), resolveBook(title, by).catch(() => null)]);
  const hits = [film?.match_confidence === "high" ? "films" : null, book?.match_confidence === "high" ? "books" : null].filter(
    (s): s is string => !!s && slugs.includes(s)
  );
  if (!hits.length) return base;
  const alternatives = [...new Set([...hits, ...base.alternatives])].slice(0, 3);
  if (hits.length === 1) return { slug: hits[0], confidence: "medium", reason: `catalog title match: ${hits[0]}`, alternatives };
  return { ...base, confidence: "low", reason: `catalog title match: ${hits.join(", ")}`, alternatives };
}

// Reads whatever was pasted into the add dialog and returns the best prefill we can get.
// It never throws: every path ends in a result the dialog can turn into manual fields.
// `link` is exactly what the listing will send visitors to (the pasted URL with only
// tracking params removed); `target` is where a short link actually lands, used
// for reading metadata only. See docs/sources.md and docs/input-test-matrix.md.

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const GOOGLEBOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const SHORT_LINK_HOSTS =
  /^(spotify\.link|spoti\.fi|maps\.app\.goo\.gl|goo\.gl|a\.co|amzn\.(eu|to|com|asia)|bit\.ly|t\.co|tinyurl\.com|lnkd\.in|apple\.co|ow\.ly|buff\.ly|is\.gd|rebrand\.ly|shorturl\.at|dzr\.page\.link|deezer\.page\.link|link\.deezer\.com|on\.soundcloud\.com|share\.google|g\.co|trib\.al)$/i;

type Meta = {
  title?: string;
  by?: string;
  year?: number;
  image_url?: string;
  image_urls?: string[];
  source_label?: string;
  category_hint?: string;
  hint_reason?: string;
};

type Status = "ok" | "blocked" | "timeout" | "error";

function metaTag(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1].trim()) return decodeHtmlEntities(m[1]);
  }
  return null;
}

const NAMED_ENTITIES: Record<string, string> = {
  quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", lt: "<", gt: ">", hellip: "…", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", laquo: "«", raquo: "»", middot: "·", eacute: "é", egrave: "è", euml: "ë", uuml: "ü", ouml: "ö",
  auml: "ä", iuml: "ï", ccedil: "ç", aacute: "á", oacute: "ó", iacute: "í", uacute: "ú", ntilde: "ñ", szlig: "ß", copy: "©",
  reg: "®", trade: "™", bull: "•",
};

function decodeHtmlEntities(s: string) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? (name.toLowerCase() === "amp" ? "&" : m))
    .replace(/&amp;/g, "&");
}

const JUNK_IMAGE_RE =
  /(sprite|[-_./]icons?[-_./]|favicon|logo|pixel|tracking|avatar|badge|placeholder|spacer|blank\.gif|1x1|emoji|gravatar|doubleclick|scorecardresearch|google-analytics|facebook\.com\/tr|\/anubis\/|\.within\.website|\/ads?\/|[-_]flag[-_.]|loading\.gif|transparent\.(gif|png)|apple-touch|social[-_](share|icon)|\/static\/images\/(ui|nav)\/)/i;
const LAZY_SRC_ATTRS = ["data-src", "data-lazy-src", "data-original"];

// The same picture often appears at several sizes: photo_300x200.jpg, /w500/…, ?width=400.
// Strip the size so they collapse into one candidate.
function imageKey(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname
      .replace(/\/thumb(\/.+?\/[^/]+)\/\d+px-[^/]+$/, "$1") // Wikimedia thumbs
      .replace(/([_\-/.@])(\d{2,4}x\d{0,4}|\d{0,4}x\d{2,4}|w\d{2,4}|h\d{2,4}|s\d{2,4}|\d{2,4}w|original|large|medium|small|thumb)(?=[._/\-@]|$)/gi, "$1")
      .replace(/\._[A-Z0-9_,]+_(?=\.)/g, ""); // Amazon ._AC_SX300_.
    return `${u.hostname}${path}`;
  } catch {
    return url;
  }
}

// Picks the widest entry of a srcset ("a.jpg 320w, b.jpg 1024w").
function largestFromSrcset(srcset: string): { url: string; width: number } | null {
  let best: { url: string; width: number } | null = null;
  // Entries are separated by ", "; commas without a space belong to the URL (Amazon's
  // "_SR116,116_.jpg", Cloudinary's "w_400,c_fill").
  for (const part of srcset.split(/,\s+(?=\S)|,(?=https?:\/\/)/)) {
    const [url, size] = part.trim().split(/\s+/);
    if (!url) continue;
    const width = Number(size?.match(/^(\d+)w$/)?.[1]) || (Number(size?.match(/^([\d.]+)x$/)?.[1]) || 1) * 400;
    if (!best || width > best.width) best = { url, width };
  }
  return best;
}

function absolutize(src: string | null | undefined, base: string): string | null {
  if (!src) return null;
  try {
    const u = new URL(decodeHtmlEntities(src.trim()), base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

// Photo candidates for the picker: og:image/twitter:image (the page's own choice), then
// <picture> sources and real <img> tags (lazy loaded ones too), each at its largest listed
// size. Junk filtered, same image at different sizes collapsed (keeping the larger one),
// then ordered so the page's own choice and large images come first.
export function collectImageCandidates(html: string, base: string, primary: string | null, max = 8): string[] {
  type C = { url: string; score: number; width: number; order: number };
  const byKey = new Map<string, C>();
  let order = 0;
  const add = (raw: string | null | undefined, width: number, bonus: number) => {
    const url = absolutize(raw, base);
    // "{{…}}" and "${…}" are unrendered template placeholders, not images.
    if (!url || url.startsWith("data:") || JUNK_IMAGE_RE.test(url) || /\.(svg|ico)(\?|$)/i.test(url) || /%7B%7B|\{\{|\$%7B|\$\{/i.test(url)) return;
    const hint = /(large|original|full|hires|1200|1600|2000)/i.test(url) ? 1 : /(thumb|small|mini|tiny|_s\.|-s\.)/i.test(url) ? -1 : 0;
    const score = bonus + hint + (width >= 800 ? 2 : width >= 400 ? 1 : width && width < 150 ? -2 : 0);
    const key = imageKey(url);
    const prev = byKey.get(key);
    if (!prev) byKey.set(key, { url, score, width, order: order++ });
    else if (width > prev.width || score > prev.score) byKey.set(key, { url: width > prev.width ? url : prev.url, score: Math.max(score, prev.score), width: Math.max(width, prev.width), order: prev.order });
  };
  add(primary, 1200, 5);
  for (const m of html.matchAll(/<meta[^>]+property=["']og:image(?::url|:secure_url)?["'][^>]+content=["']([^"']+)["']/gi)) add(m[1], 1200, 4);
  add(metaTag(html, "twitter:image") || metaTag(html, "twitter:image:src"), 1000, 3);
  for (const m of html.matchAll(/<source[^>]+(?:data-)?srcset=["']([^"']+)["']/gi)) {
    const best = largestFromSrcset(decodeHtmlEntities(m[1]));
    if (best) add(best.url, best.width, 0);
  }
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const width = Number(tag.match(/\bwidth=["']?(\d+)/)?.[1]) || 0;
    const height = Number(tag.match(/\bheight=["']?(\d+)/)?.[1]) || 0;
    if ((width && width <= 64) || (height && height <= 64)) continue;
    const srcset = tag.match(/\b(?:data-)?srcset=["']([^"']+)["']/)?.[1];
    const fromSet = srcset ? largestFromSrcset(decodeHtmlEntities(srcset)) : null;
    let src = tag.match(/\bsrc=["']([^"']+)["']/)?.[1];
    if (!src || src.startsWith("data:")) {
      src = undefined;
      for (const attr of LAZY_SRC_ATTRS) {
        src = tag.match(new RegExp(`${attr}=["']([^"']+)["']`))?.[1];
        if (src) break;
      }
    }
    if (fromSet) add(fromSet.url, Math.max(fromSet.width, width), 0);
    else add(src, width, 0);
  }
  return [...byKey.values()]
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, max)
    .map((c) => c.url);
}

async function fetchWithTimeout(url: string, ms: number, headers?: Record<string, string>, init?: RequestInit) {
  return safeFetch(url, {
    signal: AbortSignal.timeout(ms),
    ...init,
    headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en,nl;q=0.8", ...headers },
  });
}

function isTimeout(err: unknown) {
  return err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
}

// ---------- short links ----------

// Follows a short/share link to the page it points at. Most shorteners answer with a plain
// HTTP redirect; a few (spotify.link, maps.app.goo.gl) return an HTML page that redirects in
// script, so the destination is looked up in the body as a second step.
async function expandShortLink(url: string): Promise<string> {
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (!SHORT_LINK_HOSTS.test(host)) return url;
  for (const ua of ["curl/8.4.0", BROWSER_UA]) {
    try {
      const res = await fetchWithTimeout(url, 6000, { "User-Agent": ua });
      const landed = res.url || url;
      if (new URL(landed).hostname.replace(/^www\./, "") !== host) return landed;
      const html = await res.text();
      const inBody =
        html.match(/https:\/\/open\.spotify\.com\/[a-z]+\/[A-Za-z0-9]+[^"'\s<\\]*/)?.[0] ||
        html.match(/https:\/\/(?:www\.)?google\.[a-z.]+\/maps\/[^"'\s<\\]+/)?.[0] ||
        metaTag(html, "og:url") ||
        html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
        html.match(/http-equiv=["']refresh["'][^>]+url=([^"'>]+)/i)?.[1];
      if (inBody && !inBody.includes(host)) return decodeHtmlEntities(inBody.replace(/\\u0026/g, "&").replace(/\\\//g, "/"));
    } catch {
      // try the next user agent, then give up and read the short link itself
    }
  }
  return url;
}

// ---------- ID based providers ----------

async function fromImdbId(url: string): Promise<Meta | null> {
  const key = process.env.TMDB_API_KEY;
  const id = url.match(/\/title\/(tt\d+)/)?.[1];
  if (!key || !id) return null;
  try {
    const res = await fetchWithTimeout(`https://api.themoviedb.org/3/find/${id}?external_source=imdb_id`, 6000, {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const movie = data?.movie_results?.[0];
    if (movie)
      return {
        title: movie.title,
        image_url: movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : undefined,
        year: Number(movie.release_date?.slice(0, 4)) || undefined,
        source_label: "IMDb",
        category_hint: "films",
      };
    const show = data?.tv_results?.[0];
    if (show)
      return {
        title: show.name,
        image_url: show.poster_path ? `https://image.tmdb.org/t/p/w342${show.poster_path}` : undefined,
        year: Number(show.first_air_date?.slice(0, 4)) || undefined,
        source_label: "IMDb",
        category_hint: "tv",
      };
    return null;
  } catch {
    return null;
  }
}

async function fromTmdbPage(url: string): Promise<Meta | null> {
  const key = process.env.TMDB_API_KEY;
  const m = new URL(url).pathname.match(/^\/(movie|tv)\/(\d+)/);
  if (!key || !m) return null;
  try {
    const res = await fetchWithTimeout(`https://api.themoviedb.org/3/${m[1]}/${m[2]}`, 6000, {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    });
    if (!res.ok) return null;
    const d = await res.json();
    return {
      title: d.title ?? d.name,
      image_url: d.poster_path ? `https://image.tmdb.org/t/p/w342${d.poster_path}` : undefined,
      year: Number((d.release_date ?? d.first_air_date)?.slice(0, 4)) || undefined,
      source_label: "TMDB",
      category_hint: m[1] === "tv" ? "tv" : "films",
    };
  } catch {
    return null;
  }
}

async function fromDiscogsId(url: string): Promise<Meta | null> {
  const releaseMatch = url.match(/\/release\/(\d+)/);
  const masterMatch = !releaseMatch && url.match(/\/master\/(\d+)/);
  const idMatch = releaseMatch || masterMatch;
  if (!idMatch) return null;
  try {
    const res = await fetchWithTimeout(`https://api.discogs.com/${releaseMatch ? "releases" : "masters"}/${idMatch[1]}`, 6000, {
      "User-Agent": "hoshigo/1.0 (https://hoshigo.cc)",
      Accept: "application/json",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.title) return null;
    return {
      title: data.title,
      by: data.artists_sort ?? data.artists?.[0]?.name,
      image_url: data.images?.[0]?.uri,
      year: data.year || undefined,
      source_label: "Discogs",
      category_hint: "albums",
    };
  } catch {
    return null;
  }
}

// Open Library pages have a JSON twin at the same path.
async function fromOpenLibrary(url: string): Promise<Meta | null> {
  const m = new URL(url).pathname.match(/^\/(works|books)\/(OL\d+[WM])/);
  if (!m) return null;
  try {
    const res = await fetchWithTimeout(`https://openlibrary.org/${m[1]}/${m[2]}.json`, 6000, { Accept: "application/json" });
    if (!res.ok) return null;
    const d = await res.json();
    const cover = d.covers?.find((c: number) => c > 0);
    return {
      title: d.title,
      image_url: cover ? `https://covers.openlibrary.org/b/id/${cover}-M.jpg` : undefined,
      source_label: "Open Library",
      category_hint: "books",
    };
  } catch {
    return null;
  }
}

async function fromSpotify(url: string): Promise<Meta | null> {
  const path = new URL(url).pathname;
  const hint = /\/track\//.test(path) ? "songs" : /\/(episode|show)\//.test(path) ? "podcasts" : /\/album\//.test(path) ? "albums" : undefined;
  // Spotify serves real og tags to crawlers; for shows the og:title is the show name and
  // for episodes the show name sits in og:description as "<Show> · Episode". Albums and
  // tracks carry the artist in og:description ("Artist · album · 2013 · 13 songs").
  try {
    const res = await fetchWithTimeout(url, 6000, { "User-Agent": GOOGLEBOT_UA });
    if (res.ok) {
      const html = await res.text();
      const ogTitle = metaTag(html, "og:title");
      const desc = metaTag(html, "og:description") ?? "";
      if (ogTitle) {
        // Crawler og:title reads "Random Access Memories - Album by Daft Punk"
        const suffix = ogTitle.match(/^(.*?)\s+[-–]\s+(?:Album|Single|EP|Compilation|song(?: and lyrics)?|Song)\s+by\s+(.+?)(?:\s*\|\s*Spotify)?$/i);
        let title = (suffix?.[1] ?? ogTitle).replace(/\s*\|\s*(Podcast on )?Spotify\s*$/i, "").trim();
        let by: string | undefined = suffix?.[2];
        let year: number | undefined;
        if (hint === "podcasts" && /\/episode\//.test(path)) {
          const show = desc.match(/^(.*?)\s*·\s*Episode\s*$/)?.[1];
          if (show) title = show;
        }
        if (hint !== "podcasts") {
          const parts = desc.split(" · ").map((s) => s.trim());
          if (parts.length >= 2 && !by) by = parts[0];
          year = Number(parts.find((p) => /^(19|20)\d{2}$/.test(p))) || undefined;
        }
        return { title, by, year, image_url: metaTag(html, "og:image") ?? undefined, source_label: "Spotify", category_hint: hint };
      }
    }
  } catch {
    // fall back to oEmbed below
  }
  try {
    const res = await fetchWithTimeout(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, 6000, { Accept: "application/json" });
    if (!res.ok) return null;
    const data = await res.json();
    return { title: data.title, image_url: data.thumbnail_url, source_label: "Spotify", category_hint: hint };
  } catch {
    return null;
  }
}

async function fromYoutube(url: string): Promise<Meta | null> {
  const id = extractYoutubeId(url);
  if (!id) return null;
  try {
    const res = await fetchWithTimeout(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
      6000,
      { Accept: "application/json" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title,
      by: data.author_name,
      image_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      source_label: "YouTube",
      category_hint: "videos",
    };
  } catch {
    return null;
  }
}

// Wikipedia pages are all "Article" in JSON-LD, whatever they describe. Wikidata knows what
// the subject is: "instance of" (P31) labels like "anime film" or "studio album", and
// coordinates (P625) for places.
const WIKIDATA_LABEL_CATEGORY: [RegExp, string][] = [
  [/television series|tv series|web series|miniseries|television program/i, "tv"],
  [/\bfilm\b/i, "films"],
  [/\balbum\b|\bep\b/i, "albums"],
  [/\bsingle\b|\bsong\b/i, "songs"],
  [/video game/i, "games"],
  [/podcast/i, "podcasts"],
  [/novel|book|literary work|written work|poem|short story|novella|comic|manga/i, "books"],
  [/essay|article/i, "essays"],
];

async function fromWikipedia(url: string): Promise<Meta | null> {
  const u = new URL(url);
  const lang = u.hostname.split(".")[0].replace(/^(m|www)$/, "en");
  const title = decodeURIComponent(u.pathname.replace(/^\/wiki\//, ""));
  if (!title || /^(Special|File|Category|Help|Wikipedia|Portal):/i.test(title)) return null;
  try {
    const api = `https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({
      action: "query", prop: "pageprops|pageimages", ppprop: "wikibase_item", piprop: "thumbnail", pithumbsize: "400", pilicense: "any",
      redirects: "1", format: "json", titles: title,
    })}`;
    const q = await (await fetchWithTimeout(api, 6000, { Accept: "application/json", "User-Agent": "hoshigo/1.0 (https://hoshigo.cc)" })).json();
    const page = Object.values(q?.query?.pages ?? {})[0] as { title?: string; pageprops?: { wikibase_item?: string }; thumbnail?: { source?: string } } | undefined;
    if (!page?.title) return null;
    const meta: Meta = { title: page.title.replace(/\s*\((film|novel|album|book|band|TV series|video game)[^)]*\)$/i, ""), image_url: page.thumbnail?.source, source_label: "Wikipedia" };
    const qid = page.pageprops?.wikibase_item;
    if (!qid) return meta;
    // Wikimedia asks for an identifying user agent and throttles generic ones.
    const wm = { Accept: "application/json", "User-Agent": "hoshigo/1.0 (https://hoshigo.cc)" };
    const claimsOf = async (prop: string) =>
      (await (await fetchWithTimeout(`https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${qid}&property=${prop}&format=json`, 6000, wm)).json())?.claims?.[prop] ?? [];
    const [p31, p625] = await Promise.all([claimsOf("P31"), claimsOf("P625")]);
    const claims = { P31: p31, P625: p625.length ? p625 : undefined };
    const classIds: string[] = (claims.P31 ?? []).map((c: { mainsnak?: { datavalue?: { value?: { id?: string } } } }) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
    if (classIds.length) {
      const labels = await (await fetchWithTimeout(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${classIds.slice(0, 10).join("|")}&props=labels&languages=en&format=json`, 6000, wm)).json();
      const text = Object.values(labels?.entities ?? {}).map((e) => (e as { labels?: { en?: { value?: string } } }).labels?.en?.value ?? "").join(" | ");
      for (const [re, slug] of WIKIDATA_LABEL_CATEGORY) if (re.test(text)) return { ...meta, category_hint: slug, hint_reason: `wikidata: ${text.slice(0, 60)}` };
    }
    if (claims.P625) return { ...meta, category_hint: "places", hint_reason: "wikidata: has coordinates" };
    return meta;
  } catch {
    return null;
  }
}

// Google Maps og tags only ever say "Google Maps"; the place name lives in the path.
function fromGoogleMapsPath(url: string): Meta | null {
  const u = new URL(url);
  const m = u.pathname.match(/\/maps\/place\/([^/@]+)/);
  const q =
    u.pathname.startsWith("/maps") || /^maps\./.test(u.hostname) ? u.searchParams.get("q") ?? u.searchParams.get("query") : null;
  const raw = m?.[1] ?? q;
  if (!raw) return null;
  const name = decodeURIComponent(raw.replace(/\+/g, " ")).split(",")[0].trim();
  if (!name || /^-?\d+(\.\d+)?$/.test(name)) return null;
  return { title: name, source_label: "Google Maps", category_hint: "places" };
}

// ---------- titles ----------

function hostLabel(hostname: string) {
  const parts = hostname.replace(/^www\./, "").split(".");
  return parts.length > 2 && parts[parts.length - 2].length <= 3 ? parts[parts.length - 3] : parts[parts.length - 2] ?? hostname;
}

function looksLikeSiteName(segment: string, siteName: string | null, hostname: string) {
  const s = segment.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  if (!s) return true;
  const site = (siteName ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const label = hostLabel(hostname).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  return (site && (s === site || s.includes(site) || site.includes(s))) || s.includes(label) || label.includes(s);
}

function cleanTitle(raw: string, siteName: string | null, hostname: string): string {
  let t = decodeHtmlEntities(raw).replace(/\s+/g, " ").trim();
  t = t
    .replace(/^Amazon\.[a-z.]+\s*:\s*/i, "")
    .replace(/\s*:\s*Amazon\.[a-z.]+\s*:.*$/i, "")
    .replace(/\s*:\s*(Books|Boeken|Bücher|Livres|Kindle Store|Music|Movies & TV)\s*$/i, "")
    .replace(/\s+on\s+Apple\s+(Music|Podcasts|Books|TV)\s*$/i, "")
    .replace(/\s+Reviews\s*[-–]\s*Metacritic\s*$/i, "")
    .replace(/\s*(?:[-–]\s*)?(?:watch\s+(?:tv show|movie)\s+)?streaming online\s*$/i, "")
    .replace(/\s*\|\s*(bol\.com|bol)\s*$/i, "")
    .replace(/\s*[-–]\s*Wikipedia\s*$/i, "")
    .replace(/\s*[-–|]\s*YouTube\s*$/i, "");
  const site = (siteName ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (site) t = t.replace(new RegExp(`\\s+on\\s+${site}\\s*$`, "i"), "");
  t = t.replace(/\s+on\s+Steam\s*$/i, "");

  // Drop a leading or trailing "| Site name" style segment when it is the site's own name.
  const SEP = /\s+[|–—\-·•:]\s+|\s*[|•]\s*/;
  for (let i = 0; i < 2; i++) {
    const parts = t.split(SEP);
    if (parts.length < 2) break;
    const last = parts[parts.length - 1];
    const first = parts[0];
    if (looksLikeSiteName(last, siteName, hostname) && last.split(" ").length <= 5) {
      t = t.slice(0, t.lastIndexOf(last)).replace(/[\s|–—\-·•:]+$/, "");
    } else if (looksLikeSiteName(first, siteName, hostname) && first.split(" ").length <= 4) {
      t = t.slice(first.length).replace(/^[\s|–—\-·•:]+/, "");
    } else break;
  }
  return t.trim();
}

// When a page can't be read, the URL itself is often readable enough:
// /book/show/123.De_naam_van_de_roos or /p/de-ontdekking-van-de-hemel/9200000/
function titleFromPath(url: string): string | null {
  try {
    const u = new URL(url);
    const ta = u.pathname.match(/Reviews-([^-]+)-/);
    if (/tripadvisor\./.test(u.hostname) && ta) return ta[1].replace(/_/g, " ");
    // BoardGameGeek blocks our fetches; its slug is the game's name:
    // /boardgame/378524/monsters-of-loch-lomond → "Monsters of Loch Lomond"
    const bggSlug = /(^|\.)boardgamegeek\.com$/.test(u.hostname) && u.pathname.match(/^\/boardgame(?:expansion)?\/\d+\/([^/]+)/)?.[1];
    if (bggSlug) {
      const small = /^(a|an|and|at|by|for|in|of|on|or|the|to|vs)$/i;
      return decodeURIComponent(bggSlug)
        .split("-")
        .filter(Boolean)
        .map((w, i) => (i > 0 && small.test(w) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(" ");
    }
    const segments = u.pathname.split("/").filter(Boolean).map((s) => decodeURIComponent(s));
    const words = (s: string) =>
      s
        .replace(/^\d+[.-]?/, "")
        .replace(/\.[a-z]{2,4}$/i, "")
        .replace(/[-_+.]+/g, " ")
        .split(" ")
        .filter((w) => w && !/^[a-z]?\d+$/i.test(w))
        .join(" ")
        .trim();
    const scored = segments
      .map((s) => words(s))
      .filter((s) => /[a-zA-Z]{3,}/.test(s) && s.split(" ").length >= 2 && !/^(dp|p|product|products|book|show|title|item|en|nl|de)$/i.test(s));
    let best = scored.sort((a, b) => b.length - a.length)[0];
    // "/boardgame/13/catan": a one word slug right after a numeric id is the name.
    if (!best) {
      const i = segments.length - 1;
      if (i > 0 && /^\d+$/.test(segments[i - 1]) && /^[a-z][a-z0-9]{2,}$/i.test(segments[i])) best = segments[i];
    }
    if (!best) return null;
    return best.charAt(0).toUpperCase() + best.slice(1);
  } catch {
    return null;
  }
}

function visibleText(html: string) {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  return decodeHtmlEntities(
    body
      .replace(/<(script|style|noscript|svg|nav|header|footer)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

function ldString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return ldString(v[0]);
  if (v && typeof v === "object" && "name" in v) return ldString((v as { name: unknown }).name);
  return undefined;
}

// ---------- entry point ----------

export type ReadLinkResult = {
  status: Status | "not_a_link";
  query?: string;
  link?: string;
  target?: string;
  title?: string;
  title_from_url?: boolean;
  by?: string;
  year?: number;
  image_url?: string;
  image_urls?: string[];
  source_label?: string;
  category_slug?: string;
  confidence?: Classification["confidence"];
  reason?: string;
  alternatives?: string[];
};

export async function readLink(raw: string, slugs: string[], opts: { useLlm?: boolean } = {}): Promise<ReadLinkResult> {
  const useLlm = opts.useLlm !== false;
  const extracted = extractUrl(raw);
  if (!extracted) return { status: "not_a_link", query: raw.trim().slice(0, 200) };

  // A pasted Google search is a search for its query, not a page to read.
  const g = new URL(extracted);
  if (/(^|\.)google\.[a-z.]+$/.test(g.hostname) && g.pathname === "/search" && g.searchParams.get("q"))
    return { status: "not_a_link", query: g.searchParams.get("q")!.slice(0, 200) };

  const link = stripTracking(extracted);
  try {
    await assertPublicUrl(link);
  } catch (err) {
    const unreachable = err instanceof Error && err.message === "dns";
    return {
      status: "error",
      link,
      source_label: new URL(link).hostname.replace(/^www\./, ""),
      category_slug: "things",
      confidence: "low",
      reason: unreachable ? "unreachable: domain not found" : "blocked address",
      alternatives: ["things", "places", "essays"],
    };
  }
  let target = link;
  let status: Status = "ok";
  let meta: Meta = {};
  let html = "";
  let finalUrl = link;

  try {
    target = stripTracking(await expandShortLink(link));
    const host = new URL(target).hostname.toLowerCase();

    if (/(^|\.)open\.spotify\.com$/.test(host)) meta = (await fromSpotify(target)) ?? {};
    else if (/(^|\.)imdb\.com$/.test(host)) meta = (await fromImdbId(target)) ?? {};
    else if (/(^|\.)themoviedb\.org$/.test(host)) meta = (await fromTmdbPage(target)) ?? {};
    else if (/(^|\.)discogs\.com$/.test(host)) meta = (await fromDiscogsId(target)) ?? {};
    else if (/(^|\.)openlibrary\.org$/.test(host)) meta = (await fromOpenLibrary(target)) ?? {};
    else if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) meta = (await fromYoutube(target)) ?? {};
    else if (/(^|\.)wikipedia\.org$/.test(host) && /^\/wiki\//.test(new URL(target).pathname)) meta = (await fromWikipedia(target)) ?? {};
    else if (/(^|\.)google\.[a-z.]+$/.test(host) || /goo\.gl$/.test(host)) meta = fromGoogleMapsPath(target) ?? {};

    if (!meta.title) {
      try {
        const res = await fetchWithTimeout(target, 8000);
        finalUrl = res.url || target;
        const text = await res.text();
        const challenged = /<title>\s*(Just a moment|Attention Required|Access denied|Robot Check|Are you a robot|Making sure you)/i.test(text) ||
          /cf-browser-verification|captcha-delivery|px-captcha|_Incapsula_/i.test(text);
        // A missing or broken page says nothing about the thing; its "404 Not Found" title
        // must not become the listing title.
        const gone = res.status === 404 || res.status === 410 || res.status >= 500;
        if (gone) status = "error";
        else if (!res.ok || challenged) status = "blocked";
        if (!challenged && !gone) html = text;
      } catch (err) {
        status = isTimeout(err) ? "timeout" : "error";
      }
    }
  } catch {
    status = "error";
  }

  const parsed = new URL(finalUrl);
  const siteName = html ? metaTag(html, "og:site_name") : null;
  const ogType = html ? metaTag(html, "og:type") : null;
  const generator = html ? metaTag(html, "generator") : null;
  const ld = html ? jsonLdTypes(html) : { types: [], nodes: [] };
  const description = html ? metaTag(html, "og:description") || metaTag(html, "description") : null;

  if (html && !meta.title) {
    const ldNode = ld.nodes.find((n) => typeof n.name === "string" && !/^(WebSite|Organization|BreadcrumbList|WebPage|SearchAction|ImageObject|Person)$/.test(String(n["@type"])));
    const rawTitle =
      metaTag(html, "og:title") ||
      metaTag(html, "twitter:title") ||
      ldString(ldNode?.name) ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
      null;
    const ogImage = absolutize(metaTag(html, "og:image") || ldString(ldNode?.image) || null, finalUrl);
    const images = collectImageCandidates(html, finalUrl, ogImage);
    const author =
      ldString(ldNode?.author) || metaTag(html, "author") || metaTag(html, "article:author") || metaTag(html, "book:author") || undefined;
    meta = {
      title: rawTitle ? cleanTitle(rawTitle, siteName, parsed.hostname) : undefined,
      by: author && !/^https?:/.test(author) && !/wikimedia|wikipedia/i.test(author) ? author : undefined,
      image_url: images[0],
      image_urls: images,
      source_label: siteName || parsed.hostname.replace(/^www\./, ""),
    };
    const ldYear = Number(String(ldNode?.datePublished ?? ldNode?.dateCreated ?? "").slice(0, 4)) || undefined;
    if (ldYear && /Movie|TVSeries|MusicAlbum|Book/.test(String(ldNode?.["@type"]))) meta.year = ldYear;
  }

  if (meta.title && /^(Google Maps|Spotify|(Spotify [–-] )?Web Player|YouTube|Amazon\.[a-z.]+|Instagram|TikTok|Make Your Day|X|Netflix|404|404 Not Found|Page not found|Not found|Error|Just a moment\.*)$/i.test(meta.title.trim())) meta.title = undefined;
  if (meta.title) {
    meta.title = cleanTitle(meta.title, siteName, parsed.hostname);
    const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    const t = norm(meta.title);
    if (!t || t === norm(siteName ?? "") || t === norm(hostLabel(parsed.hostname)) || t === norm(parsed.hostname)) meta.title = undefined;
  }
  // Amazon: "War Remains eBook : Miller, Jeffrey" or "Title: Author: 9781234567890"
  if (meta.title && /(^|\.)amazon\.[a-z.]+$/.test(parsed.hostname)) {
    const m = meta.title.match(/^(.*?)\s*(?:eBook|Kindle Edition|Paperback|Hardcover|Taschenbuch|Gebundene Ausgabe)?\s*:\s*([^:]+?)(?:\s*:\s*[\dX]{10,13})?$/i);
    if (m && m[2] && !/\d{6,}/.test(m[2]) && m[2].split(" ").length <= 5) {
      meta.title = m[1].trim();
      meta.by ??= m[2].includes(",") ? m[2].split(",").map((s) => s.trim()).reverse().join(" ") : m[2].trim();
    }
  }
  if (meta.title) {
    // Letterboxd and friends put the year in the title: "Parasite (2019)"
    const y = meta.title.match(/\s*\(((?:19|20)\d{2})\)\s*$/);
    if (y) {
      meta.year ??= Number(y[1]);
      meta.title = meta.title.slice(0, y.index).trim();
    }
    const isAlbumBy = /(bandcamp\.com|music\.apple\.com)$/.test(parsed.hostname) || /^bandcamp$/i.test(generator || "");
    if (isAlbumBy && !meta.by) {
      const m = meta.title.match(/^(.*?),?\s+by\s+(.+)$/i);
      if (m) {
        meta.title = m[1];
        meta.by = m[2];
      }
    }
    if (siteName === "Music on TIDAL" && !meta.by) {
      const m = meta.title.match(/^(.+?)\s+-\s+(.+)$/);
      if (m) {
        meta.by = m[1];
        meta.title = m[2];
      }
    }
  }

  let usedPathTitle = false;
  if (!meta.title) {
    const fromPath = titleFromPath(target);
    if (fromPath) {
      meta.title = fromPath;
      usedPathTitle = true;
    }
  }
  if (!meta.source_label) meta.source_label = new URL(target).hostname.replace(/^www\./, "");

  let classification: Classification;
  if (meta.category_hint && (slugs.length === 0 || slugs.includes(meta.category_hint))) {
    classification = { slug: meta.category_hint, confidence: "high", reason: meta.hint_reason ?? `provider: ${meta.source_label}`, alternatives: [meta.category_hint] };
  } else {
    const t = new URL(target);
    classification = await classify(
      {
        url: target,
        hostname: t.hostname,
        path: t.pathname,
        siteName,
        title: meta.title,
        description,
        ogType,
        generator,
        jsonLdTypes: ld.types,
        visibleText: html ? visibleText(html) : null,
        markers: html ? pageMarkers(html) : undefined,
      },
      slugs,
      { useLlm }
    );
    const weakGuess = classification.confidence === "low" || /^path word/.test(classification.reason);
    if (weakGuess && meta.title && usedPathTitle) classification = await probeCatalogs(meta.title, meta.by, classification, slugs);
  }

  return {
    status: meta.title && status !== "ok" && !usedPathTitle ? "ok" : status,
    link,
    target: target !== link ? target : undefined,
    title: meta.title,
    title_from_url: usedPathTitle || undefined,
    by: meta.by,
    year: meta.year,
    image_url: meta.image_url,
    image_urls: meta.image_urls && meta.image_urls.length > 1 ? meta.image_urls : undefined,
    source_label: meta.source_label,
    category_slug: classification.slug,
    confidence: classification.confidence,
    reason: classification.reason,
    alternatives: classification.alternatives,
  };
}

// ---------- photos from any link ----------

export type PhotoResult = {
  status: "ok" | "image" | "none" | "blocked" | "error" | "not_a_link";
  images: string[];
};

// For "use another photo": the person pastes a page (shop, Wikipedia, review…) or an image.
// A direct image (by content type) is used as is; a page is read with the same safe
// pipeline and all its usable images come back, best first. Never touches anything else.
export async function readPhotos(raw: string): Promise<PhotoResult> {
  const extracted = extractUrl(raw);
  if (!extracted) return { status: "not_a_link", images: [] };
  let url = extracted;
  try {
    await assertPublicUrl(url);
    url = await expandShortLink(url);
  } catch {
    return { status: "error", images: [] };
  }

  // Unsplash photo pages sit behind a bot check, but every photo has a public download
  // URL that redirects to the image itself.
  const unsplash = new URL(url);
  const unsplashId = /(^|\.)unsplash\.com$/.test(unsplash.hostname) && unsplash.pathname.match(/^\/photos\/(?:[a-z0-9-]*-)?([A-Za-z0-9_]{11})\/?$/)?.[1];
  if (unsplashId) url = `https://unsplash.com/photos/${unsplashId}/download?force=true&w=1080`;

  let html = "";
  let blocked = false;
  let finalUrl = url;
  try {
    const res = await fetchWithTimeout(url, 8000, { Accept: "text/html,image/*;q=0.9,*/*;q=0.8" });
    finalUrl = res.url || url;
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && type.startsWith("image/") && !type.includes("svg")) {
      await res.body?.cancel().catch(() => {});
      return { status: "image", images: [finalUrl] };
    }
    if (!type.includes("html")) {
      await res.body?.cancel().catch(() => {});
    } else {
      const text = await res.text();
      const challenged = /<title>\s*(Just a moment|Attention Required|Access denied|Robot Check|Are you a robot|Making sure you)/i.test(text) ||
        /cf-browser-verification|captcha-delivery|px-captcha|_Incapsula_/i.test(text);
      if (!res.ok || challenged) blocked = true;
      if (res.ok && !challenged) html = text;
    }
  } catch {
    blocked = true;
  }

  let images = html ? collectImageCandidates(html, finalUrl, null, 16) : [];
  // Pages that render in script or block us (IMDb, Spotify, Instagram…) still have an image
  // through the provider route readLink uses; take whatever that finds.
  if (images.length < 2) {
    const viaLink = await readLink(url, [], { useLlm: false }).catch(() => null);
    const extra = [viaLink?.image_url, ...(viaLink?.image_urls ?? [])].filter((s): s is string => !!s);
    const seen = new Set(images.map(imageKey));
    for (const e of extra) if (!seen.has(imageKey(e))) images.push(e);
  }
  images = images.slice(0, 16);
  if (images.length) return { status: "ok", images };
  return { status: blocked ? "blocked" : "none", images: [] };
}
