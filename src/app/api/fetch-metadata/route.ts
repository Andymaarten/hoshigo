import { NextResponse, type NextRequest } from "next/server";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function metaTag(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeHtmlEntities(m[1]);
  }
  return null;
}

function decodeHtmlEntities(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // numeric entities (decimal and hex) — many CMSes (WordPress, Substack, NPR) encode
    // apostrophes/dashes/quotes this way instead of the named forms above
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&");
}

async function fetchWithTimeout(url: string, ms: number, extraHeaders?: Record<string, string>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "text/html", ...extraHeaders },
    });
  } finally {
    clearTimeout(timeout);
  }
}

// IMDb actively blocks server-side scraping (returns an empty 202 "please wait" response to
// non-browser requests) — so instead of fighting that, use the tt-id already in the URL to
// ask TMDB directly, which resolves it to the same canonical film/show our own catalog uses.
// An IMDb tt-id can be either a film or a TV series, so we check both result buckets.
async function fromImdbId(url: string) {
  const key = process.env.TMDB_API_KEY;
  const idMatch = url.match(/\/title\/(tt\d+)/);
  if (!key || !idMatch) return null;
  try {
    const res = await fetchWithTimeout(
      `https://api.themoviedb.org/3/find/${idMatch[1]}?external_source=imdb_id`,
      6000,
      { Authorization: `Bearer ${key}` }
    );
    if (!res.ok) return null;
    const data = await res.json();

    const movie = data?.movie_results?.[0];
    if (movie) {
      return {
        title: movie.title as string,
        image_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : undefined,
        year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : undefined,
        source_label: "IMDb",
        category_slug: "films",
      };
    }

    const show = data?.tv_results?.[0];
    if (show) {
      return {
        title: show.name as string,
        image_url: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : undefined,
        year: show.first_air_date ? Number(show.first_air_date.slice(0, 4)) : undefined,
        source_label: "IMDb",
        category_slug: "tv",
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Discogs sits behind a Cloudflare bot challenge (403 "Just a moment..." to any non-browser
// fetch) — same story as IMDb. Its release/master APIs are public and need no key, so use those
// instead. Discogs URLs come in two flavors: /release/<id> (a specific pressing) and
// /master/<id> (the release-group page people usually share/link to) — same fix, different id
// and endpoint.
async function fromDiscogsId(url: string) {
  const releaseMatch = url.match(/\/release\/(\d+)/);
  const masterMatch = !releaseMatch && url.match(/\/master\/(\d+)/);
  const idMatch = releaseMatch || masterMatch;
  if (!idMatch) return null;
  const endpoint = releaseMatch ? "releases" : "masters";
  try {
    const res = await fetchWithTimeout(`https://api.discogs.com/${endpoint}/${idMatch[1]}`, 6000, {
      "User-Agent": "hoshigo/1.0 (https://hoshigo.cc)",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.title) return null;
    // releases have `artists_sort` as a ready-made string; masters only have an `artists` array
    const by = (data.artists_sort as string | undefined) ?? data.artists?.[0]?.name;
    return {
      title: data.title as string,
      by: by as string | undefined,
      image_url: data.images?.[0]?.uri as string | undefined,
      year: data.year || undefined,
      source_label: "Discogs",
      category_slug: "albums",
    };
  } catch {
    return null;
  }
}

// Spotify's oEmbed works for tracks, episodes and shows too, not just albums — the URL
// path tells us which, since oEmbed itself doesn't distinguish.
function spotifyCategoryFromPath(url: string): string {
  if (/\/track\//.test(url)) return "songs";
  if (/\/(episode|show)\//.test(url)) return "podcasts";
  return "albums";
}

async function fromSpotifyOEmbed(url: string) {
  const res = await fetchWithTimeout(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, 6000);
  if (!res.ok) return null;
  const data = await res.json();
  return {
    title: data.title as string | undefined,
    image_url: data.thumbnail_url as string | undefined,
    source_label: "Spotify",
    category_slug: spotifyCategoryFromPath(url),
  };
}

// Spotify's own oEmbed endpoint is unusable for podcasts: for a /show/ link it returns the
// title of the show's most recent (or pinned "Trailer") episode, not the show name itself —
// feeding that into resolvePodcast()'s iTunes search produces wrong or no canonical matches.
// Spotify's normal open.spotify.com pages are a client-rendered SPA shell with no usable
// og-tags for a plain fetch — but they serve a fully server-rendered page (real og:title/
// og:description) to search-engine crawlers. A Googlebot user-agent gets us that SSR page:
// - /show/<id>  → og:title IS the show name directly
// - /episode/<id> → og:title is still the episode title, but og:description is formatted
//   "<Show Name> · Episode" — parse the show name out of that instead
async function fromSpotifyPodcast(url: string) {
  try {
    const res = await fetchWithTimeout(url, 6000, {
      "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const ogTitle = metaTag(html, "og:title");
    const ogDescription = metaTag(html, "og:description");
    const ogImage = metaTag(html, "og:image");
    if (!ogTitle) return null;

    let title = ogTitle;
    if (/\/episode\//.test(url)) {
      const showMatch = ogDescription?.match(/^(.*?)\s*·\s*Episode\s*$/);
      if (showMatch) title = showMatch[1];
    }

    return {
      title,
      image_url: ogImage || undefined,
      source_label: "Spotify",
      category_slug: "podcasts",
    };
  } catch {
    return null;
  }
}

// known providers first (most reliable), then a generic og:type fallback
const HOSTNAME_CATEGORY: [RegExp, string][] = [
  [/letterboxd\.com$/, "films"],
  [/imdb\.com$/, "films"], // fromImdbId() overrides this with "tv" when it's actually a series
  [/rottentomatoes\.com$/, "films"],
  [/metacritic\.com$/, "films"], // og:type/og:site_name are both missing on Metacritic pages
  [/open\.spotify\.com$/, "albums"], // fromSpotifyOEmbed() overrides with songs/podcasts by path
  [/music\.apple\.com$/, "albums"],
  [/bandcamp\.com$/, "albums"],
  [/discogs\.com$/, "albums"],
  [/musicbrainz\.org$/, "albums"],
  [/allmusic\.com$/, "albums"],
  [/(www\.)?last\.fm$/, "albums"],
  [/rateyourmusic\.com$/, "albums"],
  [/tidal\.com$/, "albums"],
  [/goodreads\.com$/, "books"],
  [/openlibrary\.org$/, "books"],
  [/books\.google\.com$/, "books"], // safety net; og:type "book" already covers most Google Books pages
  [/podcasts\.apple\.com$/, "podcasts"],
  [/pocketcasts\.com$/, "podcasts"], // og:type is generic "website" here, no signal to fall back on
];

const OG_TYPE_CATEGORY: [RegExp, string][] = [
  [/^video\.tv_show/, "tv"],
  [/^video\.episode/, "tv"],
  [/^video\./, "films"],
  [/^music\.song/, "songs"],
  [/^music\./, "albums"],
  [/^book/, "books"],
  [/^article/, "essays"],
  [/^product/, "things"],
];

function guessCategorySlug(
  hostname: string,
  path: string,
  ogType: string | null,
  generator: string | null
): string | undefined {
  if (/themoviedb\.org$/.test(hostname)) return path.startsWith("/tv/") ? "tv" : "films";
  // JustWatch paths are "/<locale>/tv-show/<slug>" or "/<locale>/movie/<slug>"
  if (/justwatch\.com$/.test(hostname)) return /\/tv-show\//.test(path) ? "tv" : "films";
  for (const [re, slug] of HOSTNAME_CATEGORY) if (re.test(hostname)) return slug;
  if (ogType) for (const [re, slug] of OG_TYPE_CATEGORY) if (re.test(ogType)) return slug;
  if (generator && /^bandcamp$/i.test(generator)) return "albums";
  // Nothing recognized this link with any confidence — "things" is the catch-all
  // category rather than leaving it unset (which left the client defaulting to
  // whatever category happens to sort first, e.g. "films", which is misleading).
  return "things";
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("bad protocol");
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  try {
    if (parsed.hostname.includes("open.spotify.com")) {
      if (/\/(episode|show)\//.test(url)) {
        const podcast = await fromSpotifyPodcast(url);
        if (podcast?.title) return NextResponse.json(podcast);
        // fall through to oEmbed if the Googlebot-UA SSR fetch failed for some reason
      }
      const oembed = await fromSpotifyOEmbed(url);
      if (oembed?.title) return NextResponse.json(oembed);
    }

    if (parsed.hostname.includes("imdb.com")) {
      const imdb = await fromImdbId(url);
      if (imdb?.title) return NextResponse.json(imdb);
      // fall through to generic scraping if TMDB doesn't have this id either
    }

    if (parsed.hostname.includes("discogs.com")) {
      const discogs = await fromDiscogsId(url);
      if (discogs?.title) return NextResponse.json(discogs);
    }

    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) return NextResponse.json({});
    const html = await res.text();

    let title = metaTag(html, "og:title") || html.match(/<title>([^<]+)<\/title>/i)?.[1] || null;
    const image_url = metaTag(html, "og:image");
    const ogSiteName = metaTag(html, "og:site_name");
    const source_label = ogSiteName || parsed.hostname.replace(/^www\./, "");
    const ogType = metaTag(html, "og:type");
    // Bandcamp lets artists serve their store on a custom domain (e.g. musique.coeurdepirate.com),
    // so the `bandcamp.com` hostname rule above misses those — but Bandcamp always stamps
    // its own generator meta tag regardless of domain, so use that as a fallback signal.
    const generator = metaTag(html, "generator");

    // Several sites append their own name to <title>/og:title (e.g. Rotten Tomatoes: "Parasite
    // (2019) | Rotten Tomatoes", Apple Music: "Album by Artist on Apple Music", Metacritic:
    // "Parasite Reviews - Metacritic") — strip that before any of the year/by parsing below, or
    // it corrupts the canonical-catalog search. Metacritic has no og:site_name, so its suffix is
    // hardcoded rather than derived from source_label like the others.
    if (title) {
      const escapedSite = (ogSiteName || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      title = title.trim();
      if (escapedSite) title = title.replace(new RegExp(`\\s*[|\\-–]\\s*${escapedSite}\\s*$`, "i"), "").trim();
      title = title
        .replace(/\s+on\s+Apple Music\s*$/i, "")
        .replace(/\s+Reviews\s*[-–]\s*Metacritic\s*$/i, "")
        // JustWatch's suffix doesn't repeat its og:site_name literally, so the generic strip
        // above misses it — TV pages use "<title> - watch tv show streaming online", movie
        // pages just append "<title> streaming online" with no dash/prefix
        .replace(/\s*(?:[-–]\s*)?(?:watch\s+(?:tv show|movie)\s+)?streaming online\s*$/i, "")
        // Wikipedia never sets og:site_name, and its category is never recognized (see
        // docs/sources.md), but the raw title still prefills the manual-entry form — worth
        // cleaning even without a canonical match.
        .replace(/\s*[-–]\s*Wikipedia\s*$/i, "")
        .trim();
    }

    const yearMatch = title?.match(/\b(19|20)\d{2}\b/);

    // Bandcamp (and Apple Music, after its " on Apple Music" suffix above is stripped) format
    // og:title as "Album, by Artist" — split it out. Scoped to known music sites only: an
    // unscoped "by" match is a false-positive magnet on essays/articles, where "by" shows up
    // constantly in ordinary prose (e.g. a Guardian review title "Swan Song by Charles Spencer
    // review – ..." was getting mangled into title "Swan Song" / by "Charles Spencer review – ...").
    const isKnownAlbumByFormat =
      /bandcamp\.com$/.test(parsed.hostname) ||
      /music\.apple\.com$/.test(parsed.hostname) ||
      /^bandcamp$/i.test(generator || "");
    let by: string | undefined;
    if (title && isKnownAlbumByFormat) {
      const byMatch = title.match(/^(.*?),?\s+by\s+(.+)$/i);
      if (byMatch) {
        title = byMatch[1];
        by = byMatch[2];
      }
    }
    // Tidal formats og:title as "Artist - Album" (e.g. "Daft Punk - Random Access Memories") —
    // opposite order from Bandcamp's "Album, by Artist", and specific to Tidal's og:site_name
    // ("Music on TIDAL") since a generic "X - Y" split would misfire on plenty of other sites'
    // titles that legitimately contain a dash.
    if (title && !by && ogSiteName === "Music on TIDAL") {
      const tidalMatch = title.match(/^(.+?)\s+-\s+(.+)$/);
      if (tidalMatch) {
        by = tidalMatch[1];
        title = tidalMatch[2];
      }
    }
    // Letterboxd (and others) format og:title as "Title (2019)" — the year belongs in its
    // own field, and leaving it in the search string throws off canonical-catalog lookups
    if (title) title = title.replace(/\s*\((?:19|20)\d{2}\)\s*$/, "").trim();

    return NextResponse.json({
      title: title ? decodeHtmlEntities(title).trim() : undefined,
      by: by ? decodeHtmlEntities(by).trim() : undefined,
      image_url: image_url || undefined,
      source_label,
      year: yearMatch ? Number(yearMatch[0]) : undefined,
      category_slug: guessCategorySlug(parsed.hostname, parsed.pathname, ogType, generator),
    });
  } catch {
    // network error, timeout, blocked, etc. — fail soft, the client falls back to manual entry
    return NextResponse.json({});
  }
}
