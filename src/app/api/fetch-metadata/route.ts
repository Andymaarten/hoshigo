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

async function fetchWithTimeout(url: string, ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
  } finally {
    clearTimeout(timeout);
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
  };
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

    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) return NextResponse.json({});
    const html = await res.text();

    const title = metaTag(html, "og:title") || html.match(/<title>([^<]+)<\/title>/i)?.[1] || null;
    const image_url = metaTag(html, "og:image");
    const source_label = metaTag(html, "og:site_name") || parsed.hostname.replace(/^www\./, "");
    const yearMatch = title?.match(/\b(19|20)\d{2}\b/);

    return NextResponse.json({
      title: title ? decodeHtmlEntities(title).trim() : undefined,
      image_url: image_url || undefined,
      source_label,
      year: yearMatch ? Number(yearMatch[0]) : undefined,
    });
  } catch {
    // network error, timeout, blocked, etc. — fail soft, the client falls back to manual entry
    return NextResponse.json({});
  }
}
