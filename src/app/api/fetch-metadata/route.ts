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
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
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
// ask TMDB directly, which resolves it to the same canonical film our own catalog uses anyway.
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
    if (!movie) return null;
    return {
      title: movie.title as string,
      image_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : undefined,
      year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : undefined,
      source_label: "IMDb",
      category_slug: "films",
    };
  } catch {
    return null;
  }
}

async function fromSpotifyOEmbed(url: string) {
  const res = await fetchWithTimeout(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, 6000);
  if (!res.ok) return null;
  const data = await res.json();
  return {
    title: data.title as string | undefined,
    image_url: data.thumbnail_url as string | undefined,
    source_label: "Spotify",
    category_slug: "albums",
  };
}

// known providers first (most reliable), then a generic og:type fallback
const HOSTNAME_CATEGORY: [RegExp, string][] = [
  [/letterboxd\.com$/, "films"],
  [/(imdb\.com|themoviedb\.org)$/, "films"],
  [/open\.spotify\.com$/, "albums"],
  [/music\.apple\.com$/, "albums"],
  [/bandcamp\.com$/, "albums"],
  [/discogs\.com$/, "albums"],
  [/musicbrainz\.org$/, "albums"],
  [/allmusic\.com$/, "albums"],
  [/goodreads\.com$/, "books"],
  [/openlibrary\.org$/, "books"],
];

const OG_TYPE_CATEGORY: [RegExp, string][] = [
  [/^video\./, "films"],
  [/^music\./, "albums"],
  [/^book/, "books"],
  [/^article/, "essays"],
  [/^product/, "things"],
];

function guessCategorySlug(hostname: string, ogType: string | null): string | undefined {
  for (const [re, slug] of HOSTNAME_CATEGORY) if (re.test(hostname)) return slug;
  if (ogType) for (const [re, slug] of OG_TYPE_CATEGORY) if (re.test(ogType)) return slug;
  return undefined;
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
      const oembed = await fromSpotifyOEmbed(url);
      if (oembed?.title) return NextResponse.json(oembed);
    }

    if (parsed.hostname.includes("imdb.com")) {
      const imdb = await fromImdbId(url);
      if (imdb?.title) return NextResponse.json(imdb);
      // fall through to generic scraping if TMDB doesn't have this id either
    }

    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) return NextResponse.json({});
    const html = await res.text();

    let title = metaTag(html, "og:title") || html.match(/<title>([^<]+)<\/title>/i)?.[1] || null;
    const image_url = metaTag(html, "og:image");
    const source_label = metaTag(html, "og:site_name") || parsed.hostname.replace(/^www\./, "");
    const ogType = metaTag(html, "og:type");
    const yearMatch = title?.match(/\b(19|20)\d{2}\b/);

    // Bandcamp (and a few others) format og:title as "Album, by Artist" — split it out
    let by: string | undefined;
    if (title) {
      const byMatch = title.match(/^(.*?),?\s+by\s+(.+)$/i);
      if (byMatch) {
        title = byMatch[1];
        by = byMatch[2];
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
      category_slug: guessCategorySlug(parsed.hostname, ogType),
    });
  } catch {
    // network error, timeout, blocked, etc. — fail soft, the client falls back to manual entry
    return NextResponse.json({});
  }
}
