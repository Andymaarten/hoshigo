const PROXIED_HOSTS = /^(coverartarchive\.org|covers\.openlibrary\.org)$/i;

export function isProxiedImageHost(hostname: string) {
  return PROXIED_HOSTS.test(hostname);
}

// Maps a stored image URL to what the browser should load. Stored rows keep the original
// URL so nothing in the database depends on this proxy.
// "small" is for 44px list thumbnails in the search results (88px at 2x).
export function imageSrc(url: string | null | undefined, size: "normal" | "small" | "large" = "normal"): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    let s = u.toString().replace(/^http:/, "https:");
    if (size === "small") {
      s = s
        .replace(/(coverartarchive\.org\/release-group\/[^/]+\/front)-\d+/, "$1-250")
        .replace(/\/\d+x\d+bb\.(jpg|png)$/, "/100x100bb.$1");
    }
    // Big single covers (listing page, detail sheet) show at ~360px, so ~720px on retina.
    if (size === "large") {
      s = s
        .replace(/(coverartarchive\.org\/release-group\/[^/]+\/front)(-\d+)?$/, "$1-1200")
        .replace(/\/\d+x\d+bb\.(jpg|png)$/, "/1000x1000bb.$1")
        .replace(/(covers\.openlibrary\.org\/b\/\w+\/[^/]+)-[SM]\.jpg$/, "$1-L.jpg");
    }
    if (isProxiedImageHost(u.hostname)) return `/api/img?u=${encodeURIComponent(s)}`;
    // TMDB originals are 1 to 2 MB; the grid never needs more than w342.
    if (u.hostname === "image.tmdb.org") return s.replace(/\/t\/p\/(original|w\d+)\//, size === "small" ? "/t/p/w154/" : size === "large" ? "/t/p/w780/" : "/t/p/w342/");
    return s;
  } catch {
    return null;
  }
}
