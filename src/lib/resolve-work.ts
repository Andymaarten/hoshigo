// Resolves a free-text title (guessed from whatever link the user pasted) against an
// authoritative catalog per category, so "the same album" added via Bandcamp, Discogs or
// Apple Music all resolve to one canonical work instead of three disconnected items.

export type ResolvedWork = {
  source: "tmdb" | "tmdb_tv" | "musicbrainz" | "openlibrary" | "itunes" | "igdb";
  source_id: string;
  title: string;
  by: string | null;
  year: number | null;
  image_url: string | null;
};

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  return res.json();
}

export async function resolveFilm(title: string, year?: number | null): Promise<ResolvedWork | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  try {
    const params = new URLSearchParams({ query: title, include_adult: "false" });
    if (year) params.set("year", String(year));
    const data = await fetchJson(`https://api.themoviedb.org/3/search/movie?${params}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const match = data?.results?.[0];
    if (!match) return null;

    let director: string | null = null;
    try {
      const credits = await fetchJson(`https://api.themoviedb.org/3/movie/${match.id}/credits`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      director = credits?.crew?.find((c: { job: string; name: string }) => c.job === "Director")?.name ?? null;
    } catch {
      // director lookup is a nice-to-have; a missing one shouldn't block the match
    }

    return {
      source: "tmdb",
      source_id: String(match.id),
      title: match.title,
      by: director,
      year: match.release_date ? Number(match.release_date.slice(0, 4)) : null,
      image_url: match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : null,
    };
  } catch {
    return null;
  }
}

export async function resolveTv(title: string, year?: number | null): Promise<ResolvedWork | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  try {
    const params = new URLSearchParams({ query: title });
    if (year) params.set("first_air_date_year", String(year));
    const data = await fetchJson(`https://api.themoviedb.org/3/search/tv?${params}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const match = data?.results?.[0];
    if (!match) return null;

    let creator: string | null = null;
    try {
      const details = await fetchJson(`https://api.themoviedb.org/3/tv/${match.id}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      creator = details?.created_by?.[0]?.name ?? null;
    } catch {
      // creator lookup is a nice-to-have; a missing one shouldn't block the match
    }

    return {
      source: "tmdb_tv",
      source_id: String(match.id),
      title: match.name,
      by: creator,
      year: match.first_air_date ? Number(match.first_air_date.slice(0, 4)) : null,
      image_url: match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : null,
    };
  } catch {
    return null;
  }
}

export async function resolveAlbum(title: string, artist?: string | null): Promise<ResolvedWork | null> {
  try {
    const query = artist ? `release:"${title}" AND artist:"${artist}"` : `release:"${title}"`;
    const data = await fetchJson(
      `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=1`,
      { headers: { "User-Agent": "hoshigo/1.0 (https://hoshigo.cc)", Accept: "application/json" } }
    );
    const match = data?.["release-groups"]?.[0];
    if (!match) return null;

    const mbid = match.id;
    let image_url: string | null = null;
    try {
      const art = await fetch(`https://coverartarchive.org/release-group/${mbid}/front-250`, {
        method: "HEAD",
        signal: AbortSignal.timeout(4000),
      });
      if (art.ok) image_url = `https://coverartarchive.org/release-group/${mbid}/front-250`;
    } catch {
      // no cover art available — fine, image stays empty
    }

    return {
      source: "musicbrainz",
      source_id: mbid,
      title: match.title,
      by: match["artist-credit"]?.[0]?.name ?? artist ?? null,
      year: match["first-release-date"] ? Number(match["first-release-date"].slice(0, 4)) : null,
      image_url,
    };
  } catch {
    return null;
  }
}

export async function resolveSong(title: string, artist?: string | null): Promise<ResolvedWork | null> {
  try {
    const query = artist ? `recording:"${title}" AND artist:"${artist}"` : `recording:"${title}"`;
    const data = await fetchJson(
      `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=1`,
      { headers: { "User-Agent": "hoshigo/1.0 (https://hoshigo.cc)", Accept: "application/json" } }
    );
    const match = data?.recordings?.[0];
    if (!match) return null;

    // recordings don't carry cover art themselves — borrow it from the first release they appear on
    const releaseGroupId = match.releases?.[0]?.["release-group"]?.id;
    let image_url: string | null = null;
    if (releaseGroupId) {
      try {
        const art = await fetch(`https://coverartarchive.org/release-group/${releaseGroupId}/front-250`, {
          method: "HEAD",
          signal: AbortSignal.timeout(4000),
        });
        if (art.ok) image_url = `https://coverartarchive.org/release-group/${releaseGroupId}/front-250`;
      } catch {
        // no cover art available — fine, image stays empty
      }
    }

    return {
      source: "musicbrainz",
      source_id: match.id,
      title: match.title,
      by: match["artist-credit"]?.[0]?.name ?? artist ?? null,
      year: match["first-release-date"] ? Number(match["first-release-date"].slice(0, 4)) : null,
      image_url,
    };
  } catch {
    return null;
  }
}

export async function resolvePodcast(title: string): Promise<ResolvedWork | null> {
  try {
    const params = new URLSearchParams({ term: title, media: "podcast", limit: "1" });
    const data = await fetchJson(`https://itunes.apple.com/search?${params}`);
    const match = data?.results?.[0];
    if (!match) return null;

    return {
      source: "itunes",
      source_id: String(match.collectionId),
      title: match.collectionName,
      by: match.artistName ?? null,
      // iTunes' "releaseDate" for a podcast is its most recent episode, not when the show
      // started — showing that as "year" would be actively misleading, so leave it blank.
      year: null,
      image_url: match.artworkUrl600 ?? match.artworkUrl100 ?? null,
    };
  } catch {
    return null;
  }
}

export async function resolveBook(title: string, author?: string | null): Promise<ResolvedWork | null> {
  try {
    const params = new URLSearchParams({ title });
    if (author) params.set("author", author);
    const data = await fetchJson(`https://openlibrary.org/search.json?${params}&limit=1`);
    const match = data?.docs?.[0];
    if (!match) return null;

    return {
      source: "openlibrary",
      source_id: match.key,
      title: match.title,
      by: match.author_name?.[0] ?? author ?? null,
      year: match.first_publish_year ?? null,
      image_url: match.cover_i ? `https://covers.openlibrary.org/b/id/${match.cover_i}-L.jpg` : null,
    };
  } catch {
    return null;
  }
}

export async function resolveWork(
  categorySlug: string,
  title: string,
  by?: string | null,
  year?: number | null
): Promise<ResolvedWork | null> {
  if (!title) return null;
  switch (categorySlug) {
    case "films":
      return resolveFilm(title, year);
    case "tv":
      return resolveTv(title, year);
    case "albums":
      return resolveAlbum(title, by);
    case "songs":
      return resolveSong(title, by);
    case "books":
      return resolveBook(title, by);
    case "podcasts":
      return resolvePodcast(title);
    default:
      return null;
  }
}
