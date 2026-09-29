// "Open in …" platforms: which ones exist per group, their names, and the default choice.
// The listing's own link is never replaced; these are an extra, viewer preferred way out.

export type LinkGroup = "music" | "films" | "books" | "podcasts" | "places";
export type WorkLink = { platform: string; url: string; kind: "direct" | "search" };
export type LinkPrefs = Partial<Record<LinkGroup, string>>;

export const PLATFORMS: Record<string, { name: string; group: LinkGroup; host: RegExp }> = {
  letterboxd: { name: "Letterboxd", group: "films", host: /(^|\.)letterboxd\.com$|(^|\.)boxd\.it$/ },
  imdb: { name: "IMDb", group: "films", host: /(^|\.)imdb\.[a-z.]+$/ },
  tmdb: { name: "TMDB", group: "films", host: /(^|\.)themoviedb\.org$/ },
  goodreads: { name: "Goodreads", group: "books", host: /(^|\.)goodreads\.com$/ },
  storygraph: { name: "StoryGraph", group: "books", host: /(^|\.)thestorygraph\.com$/ },
  openlibrary: { name: "Open Library", group: "books", host: /(^|\.)openlibrary\.org$/ },
  google_maps: { name: "Google Maps", group: "places", host: /(^|\.)google\.[a-z.]+$|(^|\.)goo\.gl$/ },
  apple_maps: { name: "Apple Maps", group: "places", host: /(^|\.)maps\.apple\.com$/ },
  // music and podcasts come in step 2 (MusicBrainz url relations, Odesli)
  spotify: { name: "Spotify", group: "music", host: /(^|\.)spotify\.com$|(^|\.)spotify\.link$/ },
  apple_music: { name: "Apple Music", group: "music", host: /(^|\.)music\.apple\.com$/ },
  apple_podcasts: { name: "Apple Podcasts", group: "podcasts", host: /(^|\.)podcasts\.apple\.com$/ },
};

export const GROUP_CHOICES: Record<LinkGroup, { label: string; platforms: string[] }> = {
  music: { label: "Music", platforms: ["spotify", "apple_music"] },
  films: { label: "Films and series", platforms: ["letterboxd", "imdb", "tmdb"] },
  books: { label: "Books", platforms: ["goodreads", "storygraph", "openlibrary"] },
  podcasts: { label: "Podcasts", platforms: ["spotify", "apple_podcasts"] },
  places: { label: "Places", platforms: ["google_maps", "apple_maps"] },
};

export const DEFAULT_PREFS: Record<LinkGroup, string> = {
  music: "spotify",
  films: "letterboxd",
  books: "goodreads",
  podcasts: "spotify",
  places: "google_maps",
};

export function groupForCategory(slug: string | undefined): LinkGroup | null {
  switch (slug) {
    case "films":
    case "tv":
      return "films";
    case "books":
      return "books";
    case "albums":
    case "songs":
      return "music";
    case "podcasts":
      return "podcasts";
    case "places":
      return "places";
    default:
      return null;
  }
}

export function cleanPrefs(raw: unknown): LinkPrefs {
  const out: LinkPrefs = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [g, p] of Object.entries(raw as Record<string, unknown>)) {
    const group = g as LinkGroup;
    if (GROUP_CHOICES[group] && typeof p === "string" && GROUP_CHOICES[group].platforms.includes(p)) out[group] = p;
  }
  return out;
}

export type OpenLink = WorkLink & { name: string };

// The viewer's platform for this group, else the first other platform of the group we have a
// direct link for. Nothing when the listing's own link already goes to that platform.
export function chooseOpenLink(links: WorkLink[], group: LinkGroup | null, prefs: LinkPrefs, ownUrl: string | null): OpenLink | null {
  if (!group || !links.length) return null;
  const wanted = prefs[group] ?? DEFAULT_PREFS[group];
  const byPlatform = new Map(links.map((l) => [l.platform, l]));
  const order = [wanted, ...GROUP_CHOICES[group].platforms.filter((p) => p !== wanted)];
  let pick = byPlatform.get(wanted);
  if (!pick) pick = order.map((p) => byPlatform.get(p)).find((l) => l?.kind === "direct");
  if (!pick || !PLATFORMS[pick.platform]) return null;
  let ownHost = "";
  try {
    ownHost = ownUrl ? new URL(ownUrl).hostname.toLowerCase() : "";
  } catch {
    // an odd stored link just doesn't count as the same platform
  }
  if (ownHost && PLATFORMS[pick.platform].host.test(ownHost)) return null;
  return { ...pick, name: PLATFORMS[pick.platform].name };
}

export function openLinkLabel(l: OpenLink) {
  return l.kind === "direct" ? `Open in ${l.name}` : `Search on ${l.name}`;
}
