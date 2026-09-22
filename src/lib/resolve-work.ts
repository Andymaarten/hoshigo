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
  // How much to trust that this row really is the work the user meant — see
  // docs/sources.md "Match confidence" for the full model. "high" only when the query and
  // the catalog result agree almost exactly on title (and artist/author, where relevant);
  // "low" for every ordinary fuzzy text-search hit, which is most of what this file does.
  // A future "match people by taste" feature should only ever read "high" rows.
  match_confidence: "high" | "low";
};

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  return res.json();
}

function normalizeForMatch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // parenthetical noise: "(Remastered 2011)", "(feat. X)", "(Live)"
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bigramMultiset(s: string): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.slice(i, i + 2);
    map.set(bg, (map.get(bg) ?? 0) + 1);
  }
  return map;
}

// Dice's coefficient over character bigrams — a cheap, dependency-free fuzzy string
// comparison that tolerates minor spelling/formatting differences (e.g. "Bohemian Rhapsody"
// vs. "Bohemian Rhapsody - Remastered 2011") without pulling in an NLP library. Returns 0..1,
// 1 being identical after normalization.
function similarity(a: string, b: string): number {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ba = bigramMultiset(na);
  const bb = bigramMultiset(nb);
  let overlap = 0;
  for (const [bg, count] of ba) {
    const other = bb.get(bg);
    if (other) overlap += Math.min(count, other);
  }
  let total = 0;
  for (const n of ba.values()) total += n;
  for (const n of bb.values()) total += n;
  return total === 0 ? 0 : (2 * overlap) / total;
}

// Below this title similarity the catalog hit is probably a different work altogether
// (wrong title, not just a formatting difference) — reject rather than confidently return
// the wrong thing. Below the "by" floor and it's likely a different artist/author/director
// with a similar-sounding title.
const MIN_TITLE_SIMILARITY = 0.55;
const MIN_BY_SIMILARITY = 0.35;
const HIGH_TITLE_SIMILARITY = 0.92;
const HIGH_BY_SIMILARITY = 0.8;

// Scores how well a catalog candidate matches the user's query. Returns null when the
// candidate shouldn't be treated as a match at all (title or, when we have one to compare
// against, artist/author is too far off) — the caller should then keep looking or give up
// rather than return a wrong canonical row.
function assessMatch(
  queryTitle: string,
  queryBy: string | null | undefined,
  resultTitle: string,
  resultBy: string | null | undefined
): { confidence: "high" | "low"; titleScore: number; byScore: number } | null {
  const titleScore = similarity(queryTitle, resultTitle);
  if (titleScore < MIN_TITLE_SIMILARITY) return null;

  const byScore = queryBy ? similarity(queryBy, resultBy ?? "") : 1;
  if (queryBy && byScore < MIN_BY_SIMILARITY) return null;

  const confidence: "high" | "low" =
    titleScore >= HIGH_TITLE_SIMILARITY && byScore >= HIGH_BY_SIMILARITY ? "high" : "low";
  return { confidence, titleScore, byScore };
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
    const quality = assessMatch(title, null, match.title, null);
    if (!quality) return null;

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
      match_confidence: quality.confidence,
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
    const quality = assessMatch(title, null, match.name, null);
    if (!quality) return null;

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
      match_confidence: quality.confidence,
    };
  } catch {
    return null;
  }
}

type MbReleaseGroup = {
  id: string;
  title: string;
  "primary-type"?: string | null;
  "secondary-types"?: string[];
  "first-release-date"?: string;
  "artist-credit"?: { name: string }[];
};

// MusicBrainz frequently returns several release-groups tied at the same search score for a
// popular album — the canonical studio album, plus singles/edits/deluxe-drumless-versions
// that also happen to carry the same (or a superset) title, e.g. searching "Random Access
// Memories" also surfaces "Random Access Memories (Vanderway Edit)" (a Single) and "Random
// Access Memories (drumless edition)" tied at the top score. Prefer an actual "Album" over a
// single/EP/compilation, and prefer whichever title is the closest literal match to the query
// (parenthetical-stripped comparison alone can't tell "Title" from "Title (Edit)" apart).
function looksExact(query: string, candidate: string): boolean {
  const strip = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
  return strip(query) === strip(candidate);
}

export async function resolveAlbum(title: string, artist?: string | null): Promise<ResolvedWork | null> {
  try {
    const query = artist ? `release:"${title}" AND artist:"${artist}"` : `release:"${title}"`;
    const data = await fetchJson(
      `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=6`,
      { headers: { "User-Agent": "hoshigo/1.0 (https://hoshigo.cc)", Accept: "application/json" } }
    );
    const candidates: MbReleaseGroup[] = data?.["release-groups"] ?? [];
    if (!candidates.length) return null;

    let best: { rg: MbReleaseGroup; confidence: "high" | "low"; score: number } | null = null;
    for (const rg of candidates) {
      const rgArtist = rg["artist-credit"]?.[0]?.name ?? null;
      const quality = assessMatch(title, artist, rg.title, rgArtist);
      if (!quality) continue;
      const isAlbum = (rg["primary-type"] ?? null) === "Album" && !(rg["secondary-types"]?.length);
      const score =
        quality.titleScore * 0.55 +
        quality.byScore * 0.3 +
        (looksExact(title, rg.title) ? 0.25 : 0) +
        (isAlbum ? 0.1 : -0.05);
      if (!best || score > best.score) best = { rg, confidence: quality.confidence, score };
    }
    if (!best) return null;

    const match = best.rg;
    const matchArtist = match["artist-credit"]?.[0]?.name ?? null;

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
      by: matchArtist ?? artist ?? null,
      year: match["first-release-date"] ? Number(match["first-release-date"].slice(0, 4)) : null,
      image_url,
      match_confidence: best.confidence,
    };
  } catch {
    return null;
  }
}

type MbRecording = {
  id: string;
  title: string;
  disambiguation?: string;
  video?: boolean;
  "first-release-date"?: string;
  "artist-credit"?: { name: string }[];
  releases?: { "release-group"?: { id: string } }[];
};

// Signals that a recording is a cover, live take, remix or otherwise not the "main" studio
// recording most people mean when they say a song title — used to break ties between
// several title/artist matches, not as a hard filter (a live version can still be the only
// recording MusicBrainz has for some songs).
const LOW_QUALITY_HINTS = /\b(live|remix|karaoke|cover version|tribute|demo|rehearsal|acoustic version|medley)\b/i;

export async function resolveSong(title: string, artist?: string | null): Promise<ResolvedWork | null> {
  try {
    const query = artist ? `recording:"${title}" AND artist:"${artist}"` : `recording:"${title}"`;
    const data = await fetchJson(
      `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=8`,
      { headers: { "User-Agent": "hoshigo/1.0 (https://hoshigo.cc)", Accept: "application/json" } }
    );
    const candidates: MbRecording[] = data?.recordings ?? [];
    if (!candidates.length) return null;

    // MusicBrainz's recording search is especially prone to returning a cover, a live take,
    // or a different artist with a similarly-titled song as result[0] — so instead of taking
    // the top hit blindly, score every candidate on title/artist similarity and prefer the
    // one that looks like the real studio recording.
    let best: { rec: MbRecording; confidence: "high" | "low"; score: number } | null = null;
    for (const rec of candidates) {
      const recArtist = rec["artist-credit"]?.[0]?.name ?? null;
      const quality = assessMatch(title, artist, rec.title, recArtist);
      if (!quality) continue;
      const dubious =
        rec.video === true || LOW_QUALITY_HINTS.test(rec.title) || LOW_QUALITY_HINTS.test(rec.disambiguation ?? "");
      const score =
        quality.titleScore * 0.55 +
        quality.byScore * 0.35 +
        (dubious ? -0.2 : 0) +
        (rec["first-release-date"] ? 0.05 : 0);
      if (!best || score > best.score) best = { rec, confidence: quality.confidence, score };
    }
    // Nothing scored as a plausible match at all — better to surface no canonical match
    // than to confidently attach the wrong recording.
    if (!best) return null;

    const match = best.rec;
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
      match_confidence: best.confidence,
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
    const quality = assessMatch(title, null, match.collectionName, null);
    if (!quality) return null;

    return {
      source: "itunes",
      source_id: String(match.collectionId),
      title: match.collectionName,
      by: match.artistName ?? null,
      // iTunes' "releaseDate" for a podcast is its most recent episode, not when the show
      // started — showing that as "year" would be actively misleading, so leave it blank.
      year: null,
      image_url: match.artworkUrl600 ?? match.artworkUrl100 ?? null,
      match_confidence: quality.confidence,
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
    const matchAuthor = match.author_name?.[0] ?? null;
    const quality = assessMatch(title, author, match.title, matchAuthor);
    if (!quality) return null;

    return {
      source: "openlibrary",
      source_id: match.key,
      title: match.title,
      by: matchAuthor ?? author ?? null,
      year: match.first_publish_year ?? null,
      image_url: match.cover_i ? `https://covers.openlibrary.org/b/id/${match.cover_i}-L.jpg` : null,
      match_confidence: quality.confidence,
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
