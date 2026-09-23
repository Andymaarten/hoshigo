const PROXIED_HOSTS = /^(coverartarchive\.org|covers\.openlibrary\.org)$/i;

export function isProxiedImageHost(hostname: string) {
  return PROXIED_HOSTS.test(hostname);
}

// Maps a stored image URL to what the browser should load. Stored rows keep the original
// URL so nothing in the database depends on this proxy.
export function imageSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (isProxiedImageHost(u.hostname)) return `/api/img?u=${encodeURIComponent(u.toString().replace(/^http:/, "https:"))}`;
    // TMDB originals are 1 to 2 MB; the list never needs more than w342.
    if (u.hostname === "image.tmdb.org") return u.toString().replace(/\/t\/p\/(original|w500|w780)\//, "/t/p/w342/");
    return u.toString();
  } catch {
    return null;
  }
}
