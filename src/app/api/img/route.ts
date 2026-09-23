import { type NextRequest } from "next/server";
import { isProxiedImageHost } from "@/lib/image-src";

// Cover Art Archive and Open Library covers answer with a redirect chain into archive.org
// storage nodes that takes 0.7 to 2.4s per image (measured, see docs/sources.md "Images").
// Serving them through here lets the CDN cache the final bytes under a stable URL.
// Only allow listed hosts, so this can't be used as an open proxy.

const MAX_BYTES = 4 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("u") ?? "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (url.protocol !== "https:" || !isProxiedImageHost(url.hostname)) return new Response("host not allowed", { status: 400 });

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "hoshigo/1.0 (https://hoshigo.cc)" },
    });
    const type = res.headers.get("content-type") ?? "";
    const finalHost = new URL(res.url || url).hostname;
    if (!res.ok || !type.startsWith("image/") || !(isProxiedImageHost(finalHost) || /(^|\.)archive\.org$/.test(finalHost))) {
      return new Response("not found", { status: 404, headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } });
    }
    const body = await res.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return new Response("too large", { status: 413 });
    return new Response(body, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=604800, s-maxage=31536000, immutable",
      },
    });
  } catch {
    return new Response("upstream failed", { status: 502 });
  }
}
