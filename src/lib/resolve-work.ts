// Catalog lookups per category. Two entry points share the same provider code:
// - searchWorks(): several candidates for the "choose it yourself" search list
// - resolveWork(): the single best match for a title guessed from a pasted link
// Both return the same shape so a picked search result and an automatic match are
// registered in the `works` table identically (see src/lib/works.ts).

import { claimIds, claimString, claimYear, commonsImage, getEntities, itemByStatement, label, searchItems, type WdEntity } from "./wikidata";

export type WorkSource = "tmdb" | "tmdb_tv" | "musicbrainz" | "openlibrary" | "itunes" | "igdb" | "youtube" | "nominatim" | "wikidata";

export type ResolvedWork = {
  source: WorkSource;
  source_id: string;
  // What the listing shows. For books this is the edition the person picked (translated
  // title, that edition's cover), which can differ from the work row's own title/cover.
  title: string;
  by: string | null;
  year: number | null;
  image_url: string | null;
  // "high" only when the query and the catalog agree almost exactly (or a person picked it
  // from a list); "low" for ordinary fuzzy hits. See docs/sources.md "Match confidence".
  match_confidence: "high" | "low";
  work_title?: string;
  work_image_url?: string | null;
  // One short line that tells similar results apart: "Dutch edition", "TV series, 2004", ...
  detail?: string | null;
  // Set on list results that aren't catalog rows yet and must be resolved on pick.
  resolve_via?: "song";
  // The thing's own website, when the catalog knows it (places from OSM). Used as the
  // listing's link only when the person gave none.
  website?: string | null;
  // Places only, straight from OSM: the kind of place ("Bar") and where it is.
  place_type?: string | null;
  city?: string | null;
  country?: string | null;
};

const MB_HEADERS = { "User-Agent": "hoshigo/1.0 (https://hoshigo.cc)", Accept: "application/json" };
const TMDB_IMG = "https://image.tmdb.org/t/p/w342";

async function fetchJson(url: string, init?: RequestInit) {
  let res = await fetch(url, { ...init, signal: AbortSignal.timeout(6000) });
  // MusicBrainz allows one request per second per IP and answers 503 above that.
  if (res.status === 503 && url.includes("musicbrainz.org")) {
    await new Promise((r) => setTimeout(r, 1200));
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(6000) });
  }
  if (!res.ok) return null;
  return res.json();
}

function normalizeForMatch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
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

// Dice's coefficient over character bigrams, 0..1.
export function similarity(a: string, b: string): number {
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

const MIN_TITLE_SIMILARITY = 0.55;
const MIN_BY_SIMILARITY = 0.35;
const HIGH_TITLE_SIMILARITY = 0.92;
const HIGH_BY_SIMILARITY = 0.8;

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

function yearOf(date: string | null | undefined): number | null {
  const y = Number(date?.slice(0, 4));
  return y > 0 ? y : null;
}

// ---------- films and tv (TMDB) ----------

type TmdbMovie = { id: number; title: string; original_title?: string; release_date?: string; poster_path?: string | null };
type TmdbShow = { id: number; name: string; original_name?: string; first_air_date?: string; poster_path?: string | null };

async function tmdb(path: string) {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;
  return fetchJson(`https://api.themoviedb.org/3${path}`, { headers: { Authorization: `Bearer ${key}` } });
}

async function tmdbDirector(id: number): Promise<string | null> {
  try {
    const credits = await tmdb(`/movie/${id}/credits`);
    return credits?.crew?.find((c: { job: string; name: string }) => c.job === "Director")?.name ?? null;
  } catch {
    return null;
  }
}

async function tmdbCreator(id: number): Promise<string | null> {
  try {
    const details = await tmdb(`/tv/${id}`);
    return details?.created_by?.[0]?.name ?? details?.networks?.[0]?.name ?? null;
  } catch {
    return null;
  }
}

function movieToWork(m: TmdbMovie, by: string | null, confidence: "high" | "low"): ResolvedWork {
  const original = m.original_title && m.original_title !== m.title ? m.original_title : null;
  return {
    source: "tmdb",
    source_id: String(m.id),
    title: m.title,
    by,
    year: yearOf(m.release_date),
    image_url: m.poster_path ? `${TMDB_IMG}${m.poster_path}` : null,
    match_confidence: confidence,
    detail: original ? `Original title: ${original}` : null,
  };
}

function showToWork(s: TmdbShow, by: string | null, confidence: "high" | "low"): ResolvedWork {
  const original = s.original_name && s.original_name !== s.name ? s.original_name : null;
  return {
    source: "tmdb_tv",
    source_id: String(s.id),
    title: s.name,
    by,
    year: yearOf(s.first_air_date),
    image_url: s.poster_path ? `${TMDB_IMG}${s.poster_path}` : null,
    match_confidence: confidence,
    detail: original ? `Original title: ${original}` : null,
  };
}

// TMDB only matches the titles it has, and many translations are missing ("De reis van
// Chihiro" finds nothing). Wikidata has labels and aliases in many languages plus the TMDB
// id (P4947 film, P4983 series), so it bridges to the same TMDB work.
async function tmdbViaWikidata(title: string, kind: "movie" | "tv"): Promise<ResolvedWork | null> {
  try {
    const ids = (await searchItems(title, ["nl", "de", "fr", "es", "it", "en"], 5)).slice(0, 6);
    const entities = await getEntities(ids, "claims");
    for (const id of ids) {
      const tmdbId = claimString(entities[id], kind === "movie" ? "P4947" : "P4983");
      if (!tmdbId) continue;
      if (kind === "movie") {
        const m: TmdbMovie | null = await tmdb(`/movie/${tmdbId}`);
        if (m?.id) return movieToWork(m, await tmdbDirector(m.id), "low");
      } else {
        const s: TmdbShow | null = await tmdb(`/tv/${tmdbId}`);
        if (s?.id) return showToWork(s, await tmdbCreator(s.id), "low");
      }
    }
  } catch {
    // bridge is a bonus
  }
  return null;
}

export async function searchFilms(query: string): Promise<ResolvedWork[]> {
  const data = await tmdb(`/search/movie?${new URLSearchParams({ query, include_adult: "false" })}`);
  const results: TmdbMovie[] = (data?.results ?? []).slice(0, 10);
  if (!results.length) {
    const bridged = await tmdbViaWikidata(query, "movie");
    return bridged ? [bridged] : [];
  }
  const directors = await Promise.all(results.slice(0, 8).map((m) => tmdbDirector(m.id)));
  return results.map((m, i) => movieToWork(m, directors[i] ?? null, "low"));
}

export async function searchTv(query: string): Promise<ResolvedWork[]> {
  const data = await tmdb(`/search/tv?${new URLSearchParams({ query })}`);
  const results: TmdbShow[] = (data?.results ?? []).slice(0, 10);
  if (!results.length) {
    const bridged = await tmdbViaWikidata(query, "tv");
    return bridged ? [bridged] : [];
  }
  const creators = await Promise.all(results.slice(0, 8).map((s) => tmdbCreator(s.id)));
  return results.map((s, i) => showToWork(s, creators[i] ?? null, "low"));
}

export async function resolveFilm(title: string, year?: number | null): Promise<ResolvedWork | null> {
  try {
    const params = new URLSearchParams({ query: title, include_adult: "false" });
    if (year) params.set("year", String(year));
    const match: TmdbMovie | undefined = (await tmdb(`/search/movie?${params}`))?.results?.[0];
    if (!match) return await tmdbViaWikidata(title, "movie");
    const quality = assessMatch(title, null, match.title, null) ?? assessMatch(title, null, match.original_title ?? "", null);
    if (!quality) return await tmdbViaWikidata(title, "movie");
    return movieToWork(match, await tmdbDirector(match.id), quality.confidence);
  } catch {
    return null;
  }
}

export async function resolveTv(title: string, year?: number | null): Promise<ResolvedWork | null> {
  try {
    const params = new URLSearchParams({ query: title });
    if (year) params.set("first_air_date_year", String(year));
    const match: TmdbShow | undefined = (await tmdb(`/search/tv?${params}`))?.results?.[0];
    if (!match) return await tmdbViaWikidata(title, "tv");
    const quality = assessMatch(title, null, match.name, null) ?? assessMatch(title, null, match.original_name ?? "", null);
    if (!quality) return await tmdbViaWikidata(title, "tv");
    return showToWork(match, await tmdbCreator(match.id), quality.confidence);
  } catch {
    return null;
  }
}

// ---------- albums and songs (MusicBrainz + Cover Art Archive) ----------

type MbReleaseGroup = {
  id: string;
  title: string;
  disambiguation?: string;
  "primary-type"?: string | null;
  "secondary-types"?: string[];
  "first-release-date"?: string;
  "artist-credit"?: { name: string }[];
};

type MbRecording = {
  id: string;
  title: string;
  disambiguation?: string;
  video?: boolean;
  length?: number;
  "first-release-date"?: string;
  "artist-credit"?: { name: string }[];
  releases?: { title?: string; "release-group"?: { id: string; "primary-type"?: string } }[];
};

const caaThumb = (releaseGroupId: string) => `https://coverartarchive.org/release-group/${releaseGroupId}/front-250`;

async function caaExists(releaseGroupId: string): Promise<boolean> {
  try {
    const art = await fetch(caaThumb(releaseGroupId), { method: "HEAD", signal: AbortSignal.timeout(4000) });
    return art.ok;
  } catch {
    return false;
  }
}

function looksExact(query: string, candidate: string): boolean {
  const strip = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
  return strip(query) === strip(candidate);
}

function artistOf(credit?: { name: string }[]): string | null {
  return credit?.length ? credit.map((c) => c.name).join(", ") : null;
}

function releaseGroupDetail(rg: MbReleaseGroup): string | null {
  const kind = [rg["primary-type"], ...(rg["secondary-types"] ?? [])].filter(Boolean).join(", ");
  return [kind, rg.disambiguation].filter(Boolean).join(" · ") || null;
}

// Free text search for the list: MusicBrainz's plain query also matches the artist name,
// so "radiohead ok computer" and "ok computer" both work.
export async function searchAlbums(query: string): Promise<ResolvedWork[]> {
  const data = await fetchJson(
    `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=12`,
    { headers: MB_HEADERS }
  );
  const groups: (MbReleaseGroup & { score?: number; count?: number })[] = data?.["release-groups"] ?? [];
  // MusicBrainz ties many entries at score 100; the number of releases is a decent
  // popularity signal to put the album people mean first.
  const rank = (g: { score?: number; count?: number }) => (g.score ?? 0) / 100 + Math.log10(1 + (g.count ?? 0)) * 0.4;
  groups.sort((a, b) => rank(b) - rank(a));
  return groups.map((rg) => ({
    source: "musicbrainz" as const,
    source_id: rg.id,
    title: rg.title,
    by: artistOf(rg["artist-credit"]),
    year: yearOf(rg["first-release-date"]),
    image_url: caaThumb(rg.id),
    match_confidence: "low" as const,
    detail: releaseGroupDetail(rg),
  }));
}

type ItunesSong = {
  trackId: number;
  trackName: string;
  artistName?: string;
  collectionName?: string;
  releaseDate?: string;
  artworkUrl100?: string;
};

// MusicBrainz holds thousands of same-titled recordings (covers, tributes, karaoke) with
// no popularity signal, so the list comes from iTunes, which ranks by popularity. The
// pick is resolved to the MusicBrainz recording on the server (resolve_via "song"), so
// songs added from a list and from a pasted link end up on the same works row.
export async function searchSongs(query: string): Promise<ResolvedWork[]> {
  const data = await fetchJson(
    `https://itunes.apple.com/search?${new URLSearchParams({ term: query, media: "music", entity: "song", limit: "25" })}`
  );
  const songs: ItunesSong[] = data?.results ?? [];
  const seen = new Set<string>();
  const out: ResolvedWork[] = [];
  for (const s of songs) {
    const key = `${normalizeForMatch(s.trackName)}|${normalizeForMatch(s.artistName ?? "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      source: "musicbrainz",
      source_id: `itunes:${s.trackId}`,
      resolve_via: "song",
      title: s.trackName,
      by: s.artistName ?? null,
      year: yearOf(s.releaseDate),
      image_url: s.artworkUrl100?.replace(/100x100bb/, "300x300bb") ?? null,
      match_confidence: "low",
      detail: s.collectionName ? `on ${s.collectionName}` : null,
    });
    if (out.length >= 10) break;
  }
  return out;
}

// "Get Lucky (Radio Edit) [feat. X]" → "Get Lucky"; "Daft Punk, Pharrell Williams" → "Daft Punk".
// Store pages list every credited artist and edit, MusicBrainz phrase search wants the core.
function coreTitle(title: string) {
  return title.replace(/\s*[([][^)\]]*[)\]]/g, "").replace(/\s+[-–]\s+(Remaster(ed)?|Radio Edit|Single Version).*$/i, "").trim() || title;
}
function primaryArtist(artist?: string | null) {
  return artist?.split(/,|&|\s+feat\.?\s+|\s+ft\.?\s+|\s+x\s+|\s+and\s+/i)[0].trim() || null;
}

export async function resolveAlbum(rawTitle: string, rawArtist?: string | null): Promise<ResolvedWork | null> {
  const title = coreTitle(rawTitle);
  const artist = primaryArtist(rawArtist);
  try {
    const query = artist ? `release:"${title}" AND artist:"${artist}"` : `release:"${title}"`;
    const data = await fetchJson(
      `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=6`,
      { headers: MB_HEADERS }
    );
    const candidates: MbReleaseGroup[] = data?.["release-groups"] ?? [];
    let best: { rg: MbReleaseGroup; confidence: "high" | "low"; score: number } | null = null;
    for (const rg of candidates) {
      const quality = assessMatch(title, artist, rg.title, rg["artist-credit"]?.[0]?.name ?? null);
      if (!quality) continue;
      const isAlbum = (rg["primary-type"] ?? null) === "Album" && !rg["secondary-types"]?.length;
      const score =
        quality.titleScore * 0.55 + quality.byScore * 0.3 + (looksExact(title, rg.title) ? 0.25 : 0) + (isAlbum ? 0.1 : -0.05);
      if (!best || score > best.score) best = { rg, confidence: quality.confidence, score };
    }
    if (!best) return null;
    const match = best.rg;
    return {
      source: "musicbrainz",
      source_id: match.id,
      title: match.title,
      by: match["artist-credit"]?.[0]?.name ?? artist ?? null,
      year: yearOf(match["first-release-date"]),
      image_url: (await caaExists(match.id)) ? caaThumb(match.id) : null,
      match_confidence: best.confidence,
    };
  } catch {
    return null;
  }
}

const LOW_QUALITY_HINTS = /\b(live|remix|karaoke|cover version|tribute|demo|rehearsal|acoustic version|medley)\b/i;

export async function resolveSong(rawTitle: string, rawArtist?: string | null): Promise<ResolvedWork | null> {
  const title = coreTitle(rawTitle);
  const artist = primaryArtist(rawArtist);
  try {
    const query = artist ? `recording:"${title}" AND artist:"${artist}"` : `recording:"${title}"`;
    const data = await fetchJson(
      `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=8`,
      { headers: MB_HEADERS }
    );
    const candidates: MbRecording[] = data?.recordings ?? [];
    let best: { rec: MbRecording; confidence: "high" | "low"; score: number } | null = null;
    for (const rec of candidates) {
      const quality = assessMatch(title, artist, rec.title, rec["artist-credit"]?.[0]?.name ?? null);
      if (!quality) continue;
      const dubious =
        rec.video === true || LOW_QUALITY_HINTS.test(rec.title) || LOW_QUALITY_HINTS.test(rec.disambiguation ?? "");
      const score =
        quality.titleScore * 0.55 + quality.byScore * 0.35 + (dubious ? -0.2 : 0) + (rec["first-release-date"] ? 0.05 : 0);
      if (!best || score > best.score) best = { rec, confidence: quality.confidence, score };
    }
    if (!best) return null;
    const match = best.rec;
    const rgId = match.releases?.[0]?.["release-group"]?.id;
    return {
      source: "musicbrainz",
      source_id: match.id,
      title: match.title,
      by: match["artist-credit"]?.[0]?.name ?? artist ?? null,
      year: yearOf(match["first-release-date"]),
      image_url: rgId && (await caaExists(rgId)) ? caaThumb(rgId) : null,
      match_confidence: best.confidence,
    };
  } catch {
    return null;
  }
}

// ---------- podcasts (iTunes) ----------

type ItunesPodcast = { collectionId: number; collectionName: string; artistName?: string; artworkUrl600?: string; artworkUrl100?: string; primaryGenreName?: string };

function podcastToWork(p: ItunesPodcast, confidence: "high" | "low"): ResolvedWork {
  return {
    source: "itunes",
    source_id: String(p.collectionId),
    title: p.collectionName,
    by: p.artistName ?? null,
    // iTunes' releaseDate is the latest episode, not when the show started, so no year.
    year: null,
    image_url: p.artworkUrl600?.replace(/600x600bb/, "300x300bb") ?? p.artworkUrl100 ?? null,
    match_confidence: confidence,
    detail: p.primaryGenreName ?? null,
  };
}

export async function searchPodcasts(query: string): Promise<ResolvedWork[]> {
  const data = await fetchJson(`https://itunes.apple.com/search?${new URLSearchParams({ term: query, media: "podcast", limit: "10" })}`);
  return ((data?.results ?? []) as ItunesPodcast[]).map((p) => podcastToWork(p, "low"));
}

export async function resolvePodcast(title: string): Promise<ResolvedWork | null> {
  try {
    const data = await fetchJson(`https://itunes.apple.com/search?${new URLSearchParams({ term: title, media: "podcast", limit: "1" })}`);
    const match: ItunesPodcast | undefined = data?.results?.[0];
    if (!match) return null;
    const quality = assessMatch(title, null, match.collectionName, null);
    if (!quality) return null;
    return podcastToWork(match, quality.confidence);
  } catch {
    return null;
  }
}

// ---------- books (Open Library, edition aware) ----------

type OlEdition = { key?: string; title?: string; language?: string[]; cover_i?: number; publish_date?: string[]; publisher?: string[] };
type OlDoc = {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  language?: string[];
  editions?: { docs?: OlEdition[] };
};

const OL_FIELDS =
  "key,title,author_name,first_publish_year,cover_i,language,editions,editions.key,editions.title,editions.language,editions.cover_i,editions.publish_date,editions.publisher";

const LANGUAGE_NAMES: Record<string, string> = {
  eng: "English", dut: "Dutch", ger: "German", fre: "French", spa: "Spanish", ita: "Italian", por: "Portuguese",
  swe: "Swedish", nor: "Norwegian", dan: "Danish", fin: "Finnish", pol: "Polish", rus: "Russian", jpn: "Japanese",
  chi: "Chinese", kor: "Korean", tur: "Turkish", gre: "Greek", cze: "Czech", hun: "Hungarian", ara: "Arabic", heb: "Hebrew",
};

const olCover = (id: number) => `https://covers.openlibrary.org/b/id/${id}-M.jpg`;

type BookRow = {
  work: ResolvedWork;
  lang: string | null;
  edYear: number | null;
  publisher: string | null;
  originalTitle: string | null;
  hasOwnAuthor: boolean;
};

function bookRow(doc: OlDoc, confidence: "high" | "low", query?: string): BookRow {
  // Open Library puts the edition that best matches the query first, which is what
  // makes a Dutch or German title search land on that translation. When the work's own
  // title is closer to what was typed ("Der Steppenwolf"), show that instead.
  const ed = doc.editions?.docs?.[0];
  const editionTitle = ed?.title?.trim();
  const preferWork = !!query && !!editionTitle && similarity(query, doc.title) > similarity(query, editionTitle) + 0.1;
  const isOtherEdition =
    !preferWork && !!editionTitle && normalizeForMatch(editionTitle) !== normalizeForMatch(doc.title);
  const workCover = doc.cover_i ? olCover(doc.cover_i) : null;
  const edCover = !preferWork && ed?.cover_i ? olCover(ed.cover_i) : null;
  return {
    work: {
      source: "openlibrary",
      source_id: doc.key,
      title: isOtherEdition ? editionTitle! : doc.title,
      by: doc.author_name?.[0] ?? null,
      year: doc.first_publish_year ?? null,
      image_url: edCover ?? workCover,
      match_confidence: confidence,
      work_title: doc.title,
      work_image_url: workCover,
    },
    lang: !preferWork && ed?.language?.[0] ? LANGUAGE_NAMES[ed.language[0]] ?? ed.language[0] : null,
    edYear: preferWork ? null : Number(ed?.publish_date?.[0]?.match(/\d{4}/)?.[0]) || null,
    publisher: preferWork ? null : ed?.publisher?.[0] ?? null,
    originalTitle: isOtherEdition ? doc.title : null,
    hasOwnAuthor: !!doc.author_name?.length,
  };
}

// "Dutch edition · 1972 · Meulenhoff · original: Cien años de soledad"
function bookDetail(r: BookRow): string | null {
  const parts = [
    r.lang ? `${r.lang} edition` : null,
    r.edYear && r.edYear !== r.work.year ? String(r.edYear) : null,
    r.publisher,
    r.originalTitle ? `original: ${r.originalTitle}` : null,
  ].filter(Boolean);
  return parts.join(" · ") || null;
}

function bookToWork(doc: OlDoc, confidence: "high" | "low", query?: string): ResolvedWork {
  const r = bookRow(doc, confidence, query);
  return { ...r.work, detail: bookDetail(r) };
}

export async function searchBooks(query: string): Promise<ResolvedWork[]> {
  const params = new URLSearchParams({ q: query, fields: OL_FIELDS, limit: "20" });
  const data = await fetchJson(`https://openlibrary.org/search.json?${params}`);
  const rows = ((data?.docs ?? []) as OlDoc[]).map((d) => bookRow(d, "low", query));

  // Open Library has many author-less stub works for the same translation. Give them the
  // author and year of a matching authored work from the same results.
  for (const r of rows) {
    if (r.hasOwnAuthor) continue;
    const parent = rows.find(
      (p) =>
        p.hasOwnAuthor &&
        (similarity(p.work.title, r.work.title) >= 0.85 || similarity(p.work.work_title ?? "", r.work.title) >= 0.85)
    );
    if (parent) {
      r.work.by = parent.work.by;
      r.work.year ??= parent.work.year;
    }
  }

  // Collapse duplicates: same title + author + language (an unknown language joins any
  // group). The authored work keeps its id; the newest edition with a cover wins the cover.
  const kept: BookRow[] = [];
  for (const r of rows) {
    const twin = kept.find(
      (k) =>
        similarity(k.work.title, r.work.title) >= 0.9 &&
        normalizeForMatch(k.work.by ?? "") === normalizeForMatch(r.work.by ?? "") &&
        (!k.lang || !r.lang || k.lang === r.lang)
    );
    if (!twin) {
      kept.push(r);
      continue;
    }
    const base = twin.hasOwnAuthor || !r.hasOwnAuthor ? twin : r;
    const other = base === twin ? r : twin;
    const newerCover = other.work.image_url && (!base.work.image_url || (other.edYear ?? 0) > (base.edYear ?? 0));
    if (newerCover) {
      base.work.image_url = other.work.image_url;
      base.edYear = other.edYear ?? base.edYear;
      base.publisher = other.publisher ?? base.publisher;
    }
    base.lang ??= other.lang;
    base.publisher ??= other.publisher;
    base.edYear ??= other.edYear;
    if (base !== twin) kept[kept.indexOf(twin)] = base;
  }
  return kept.slice(0, 10).map((r) => ({ ...r.work, detail: bookDetail(r) }));
}

export async function resolveBook(title: string, author?: string | null): Promise<ResolvedWork | null> {
  const found = await resolveBookOnce(title, author);
  if (found || !/[:(]/.test(title)) return found;
  return resolveBookOnce(title.split(/[:(]/)[0].trim(), author);
}

async function resolveBookOnce(title: string, author?: string | null): Promise<ResolvedWork | null> {
  try {
    const q = author ? `${title} ${author}` : title;
    const params = new URLSearchParams({ q, fields: OL_FIELDS, limit: "5" });
    const data = await fetchJson(`https://openlibrary.org/search.json?${params}`);
    const docs: OlDoc[] = data?.docs ?? [];
    for (const doc of docs) {
      const work = bookToWork(doc, "low");
      const quality =
        assessMatch(title, author, work.title, work.by) ?? assessMatch(title, author, doc.title, work.by);
      if (quality) return { ...work, match_confidence: quality.confidence };
    }
    return null;
  } catch {
    return null;
  }
}

// ---------- places (Nominatim) ----------

type NominatimResult = {
  place_id: number;
  osm_type?: string;
  osm_id?: number;
  display_name: string;
  name?: string;
  type?: string;
  category?: string;
  class?: string;
  importance?: number;
  address?: Record<string, string>;
  extratags?: Record<string, string> | null;
  namedetails?: Record<string, string> | null;
};

// OSM tag value → a short word people use. Anything not listed falls back to the tag value
// itself ("ice_cream" → "Ice cream").
const PLACE_KIND: Record<string, string> = {
  restaurant: "Restaurant", cafe: "Café", bar: "Bar", pub: "Pub", biergarten: "Beer garden", fast_food: "Fast food",
  food_court: "Food court", ice_cream: "Ice cream", nightclub: "Club", cinema: "Cinema", theatre: "Theatre",
  arts_centre: "Arts centre", concert_hall: "Concert hall", library: "Library", marketplace: "Market",
  museum: "Museum", gallery: "Gallery", attraction: "Attraction", viewpoint: "Viewpoint", zoo: "Zoo", aquarium: "Aquarium",
  theme_park: "Theme park", artwork: "Artwork", hotel: "Hotel", hostel: "Hostel", guest_house: "Guest house",
  camp_site: "Campsite", picnic_site: "Picnic spot", park: "Park", garden: "Garden", nature_reserve: "Nature reserve",
  beach_resort: "Beach", beach: "Beach", peak: "Mountain", volcano: "Volcano", waterfall: "Waterfall", lake: "Lake",
  water: "Water", sports_centre: "Sports centre", stadium: "Stadium", swimming_pool: "Swimming pool",
  books: "Bookshop", bakery: "Bakery", coffee: "Coffee shop", deli: "Deli", wine: "Wine shop", music: "Record shop",
  clothes: "Clothes shop", supermarket: "Supermarket", department_store: "Department store", mall: "Mall",
  place_of_worship: "Place of worship", castle: "Castle", monument: "Monument", memorial: "Memorial", ruins: "Ruins",
  archaeological_site: "Archaeological site", university: "University", city: "City", town: "Town", village: "Village",
  island: "Island", neighbourhood: "Neighbourhood", suburb: "Neighbourhood", country: "Country", building: "Building",
};

function placeKind(r: NominatimResult): string | null {
  const t = r.type && r.type !== "yes" ? r.type : null;
  const tags = r.extratags ?? {};
  const cuisine = tags.cuisine?.split(";")[0]?.replace(/_/g, " ");
  const base = t ? PLACE_KIND[t] ?? t.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : null;
  // "Restaurant" alone says little; "Japanese restaurant" tells branches and places apart.
  if (base && cuisine && /^(Restaurant|Café|Fast food)$/.test(base)) return `${cuisine.replace(/^./, (c) => c.toUpperCase())} ${base.toLowerCase()}`;
  return base;
}

function placeWebsite(r: NominatimResult): string | null {
  const tags = r.extratags ?? {};
  const raw = tags.website || tags["contact:website"] || tags.url || null;
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme.split(";")[0].trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

// The city people would name. OSM's "city" is sometimes an administrative piece of it:
// London boroughs ("City of Westminster", "Greater London") and Japanese wards ("Chuo",
// with the city in "state": Tokyo).
function cityOf(a: Record<string, string>): string | null {
  const raw = a.city || a.town || a.village || a.municipality || a.county || null;
  const london = /^(Greater London|City of Westminster|City of London|(London|Royal) Borough of .+)$/;
  if ((raw && london.test(raw)) || a.state_district === "Greater London" || a.county === "Greater London") return "London";
  if (a["ISO3166-2-lvl4"] === "JP-13" && raw && TOKYO_WARDS.has(raw.replace(/\s*(City|Ward)$/i, ""))) return "Tokyo";
  return raw;
}

const TOKYO_WARDS = new Set([
  "Chiyoda", "Chuo", "Minato", "Shinjuku", "Bunkyo", "Taito", "Sumida", "Koto", "Shinagawa", "Meguro", "Ota", "Setagaya",
  "Shibuya", "Nakano", "Suginami", "Toshima", "Kita", "Arakawa", "Itabashi", "Nerima", "Adachi", "Katsushika", "Edogawa",
]);

function placeToWork(r: NominatimResult, confidence: "high" | "low"): ResolvedWork {
  const parts = r.display_name.split(",").map((s) => s.trim());
  const name = r.namedetails?.name || r.name || parts[0];
  const a = r.address ?? {};
  const locality = cityOf(a);
  const kind = placeKind(r);
  const street = [a.road, a.house_number].filter(Boolean).join(" ") || null;
  return {
    source: "nominatim",
    // OSM ids are stable (N/W/R + number); Nominatim's own place_id changes on reimport.
    source_id: r.osm_type && r.osm_id ? `${r.osm_type[0].toUpperCase()}${r.osm_id}` : String(r.place_id),
    title: name,
    // "Restaurant · Amsterdam": what it is and where, which is what tells places apart.
    by: [kind, locality ?? a.state ?? a.country].filter(Boolean).join(" · ") || parts.slice(1, 3).join(", ") || null,
    year: null,
    image_url: null,
    match_confidence: confidence,
    detail: [street, a.suburb ?? a.neighbourhood, locality, a.country].filter(Boolean).join(", ") || parts.slice(1, 4).join(", ") || null,
    website: placeWebsite(r),
    place_type: kind,
    city: locality ?? a.state ?? null,
    country: a.country ?? null,
  };
}

async function nominatim(q: string, limit: number): Promise<NominatimResult[]> {
  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    limit: String(limit),
    addressdetails: "1",
    extratags: "1",
    namedetails: "1",
    "accept-language": "en",
  });
  return (await fetchJson(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { "User-Agent": MB_HEADERS["User-Agent"] } })) ?? [];
}

export async function searchPlaces(query: string): Promise<ResolvedWork[]> {
  return (await nominatim(query, 10)).map((r) => placeToWork(r, "low"));
}

export async function resolvePlace(name: string, context?: string | null): Promise<ResolvedWork | null> {
  try {
    const data = await nominatim(context ? `${name} ${context}` : name, 5);
    let best: { r: NominatimResult; confidence: "high" | "low"; score: number } | null = null;
    for (const r of data) {
      // "Dishoom Covent Garden": people often add the area to the name, so also compare
      // with the name plus its neighbourhood/city.
      const own = r.name || r.display_name.split(",")[0];
      const a = r.address ?? {};
      const withArea = [own, a.suburb ?? a.neighbourhood ?? a.quarter, a.city ?? a.town].filter(Boolean).join(" ");
      const q1 = assessMatch(name, null, own, null);
      const q2 = assessMatch(name, null, withArea, null);
      const quality = q1 && q2 ? (q1.titleScore >= q2.titleScore ? q1 : q2) : q1 ?? q2;
      if (!quality) continue;
      const score = quality.titleScore * 0.7 + (r.importance ?? 0) * 0.3;
      if (!best || score > best.score) best = { r, confidence: quality.confidence, score };
    }
    return best ? placeToWork(best.r, best.confidence) : null;
  } catch {
    return null;
  }
}

// ---------- games (Wikidata: video games and board games) ----------
//
// Keyless and covers both kinds. An item counts as a game when one of its "instance of"
// (P31) classes is labelled like "video game", "board game", "card game" etc. IGDB and RAWG
// need keys; BoardGameGeek's XML API now answers 401 without a registered application token
// (see docs/sources.md), so Wikidata is the default. BGG and Steam ids on the Wikidata item
// (P2339, P1733) let pasted store and BGG links resolve exactly.

const GAME_CLASS_RE = /\b(video game|board game|card game|tabletop game|tabletop role-playing game|role-playing game|party game|dice game|puzzle game|wargame|game)\b/i;
const BOARDISH_RE = /\b(board game|card game|tabletop|dice game|wargame|party game)\b/i;

async function gameClassLabels(entities: Record<string, WdEntity>): Promise<Record<string, string>> {
  const classIds = [...new Set(Object.values(entities).flatMap((e) => claimIds(e, "P31")))];
  const classes = await getEntities(classIds, "labels");
  return Object.fromEntries(classIds.map((id) => [id, label(classes[id], ["en", "mul"]) ?? ""]));
}

async function peopleLabels(entities: WdEntity[], props: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(entities.flatMap((e) => props.flatMap((p) => claimIds(e, p).slice(0, 3))))];
  const people = await getEntities(ids, "labels");
  return Object.fromEntries(ids.map((id) => [id, label(people[id]) ?? ""]));
}

function gameToWork(e: WdEntity, classText: string, names: Record<string, string>, confidence: "high" | "low"): ResolvedWork {
  const board = BOARDISH_RE.test(classText) && !/video game/i.test(classText);
  const platforms = claimIds(e, "P400").map((id) => names[id]).filter(Boolean).slice(0, 3);
  const makers = (board ? [...claimIds(e, "P287"), ...claimIds(e, "P123")] : [...claimIds(e, "P178"), ...claimIds(e, "P123")])
    .map((id) => names[id])
    .filter(Boolean);
  const year = claimYear(e);
  return {
    source: "wikidata",
    source_id: e.id,
    title: label(e) ?? e.id,
    by: makers[0] ?? null,
    year,
    image_url: commonsImage(claimString(e, "P18") ?? claimString(e, "P154")),
    match_confidence: confidence,
    // "Board game" or the platforms, which is what tells same-named games apart.
    detail: board ? ["Board game", year ? String(year) : null].filter(Boolean).join(" · ") : platforms.length ? platforms.join(", ") : "Video game",
  };
}

async function gamesFromIds(ids: string[], confidence: "high" | "low"): Promise<ResolvedWork[]> {
  if (!ids.length) return [];
  const entities = await getEntities(ids);
  const classLabels = await gameClassLabels(entities);
  const games = ids
    .map((id) => entities[id])
    .filter((e): e is WdEntity => !!e)
    .map((e) => ({ e, classText: claimIds(e, "P31").map((c) => classLabels[c]).join(" | ") }))
    .filter(({ classText }) => GAME_CLASS_RE.test(classText) && !/\b(series|franchise|genre|video game character)\b/i.test(classText));
  const names = await peopleLabels(games.map((g) => g.e), ["P400", "P178", "P123", "P287"]);
  return games.map(({ e, classText }) => gameToWork(e, classText, names, confidence));
}

export async function searchGames(query: string): Promise<ResolvedWork[]> {
  const ids = await searchItems(query, ["en", "nl", "de", "fr"], 15);
  return (await gamesFromIds(ids.slice(0, 25), "low")).slice(0, 10);
}

// Store and catalog titles carry platform noise: "ASTRO BOT - PS5 Games", "Portal 2 on Steam".
function cleanGameTitle(title: string) {
  return title
    .replace(/[™®©]/g, "")
    .replace(/\s+for\s+(Nintendo Switch\s*\d?|PS[45]|PlayStation\s*\d?|Xbox.*|PC|Mac)$/i, "")
    .replace(/\s*[-–|:]\s*(PS[45]|PlayStation\s*\d?|Xbox[^|–-]*|Nintendo Switch[^|–-]*|PC|Steam|Games?|Board ?Game(Geek)?)\b.*$/i, "")
    .replace(/\s+on\s+Steam$/i, "")
    .trim() || title;
}

export async function resolveGame(title: string, sourceUrl?: string | null): Promise<ResolvedWork | null> {
  try {
    // Exact ids first: Steam app id (P1733) and BoardGameGeek id (P2339) are on the item.
    const steam = sourceUrl?.match(/store\.steampowered\.com\/app\/(\d+)/)?.[1];
    const bgg = sourceUrl?.match(/boardgamegeek\.com\/boardgame(?:expansion)?\/(\d+)/)?.[1];
    const exactId = steam ? await itemByStatement("P1733", steam) : bgg ? await itemByStatement("P2339", bgg) : null;
    if (exactId) {
      const [exact] = await gamesFromIds([exactId], "high");
      if (exact) return exact;
    }
    if (!title) return null;
    const clean = cleanGameTitle(title);
    const candidates = await gamesFromIds((await searchItems(clean, ["en", "nl", "de"], 8)).slice(0, 12), "low");
    for (const c of candidates) {
      const quality = assessMatch(clean, null, c.title, null);
      if (quality) return { ...c, match_confidence: quality.confidence };
    }
    return null;
  } catch {
    return null;
  }
}

// ---------- videos (YouTube, id based) ----------

export function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (/(^|\.)youtu\.be$/.test(u.hostname)) return u.pathname.split("/").filter(Boolean)[0] || null;
    if (/(^|\.)youtube\.com$/.test(u.hostname)) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/);
      if (m) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}

export async function resolveVideo(sourceUrl: string | null | undefined): Promise<ResolvedWork | null> {
  if (!sourceUrl) return null;
  const videoId = extractYoutubeId(sourceUrl);
  if (!videoId) return null;
  try {
    const data = await fetchJson(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`
    );
    if (!data?.title) return null;
    return {
      source: "youtube",
      source_id: videoId,
      title: data.title,
      by: data.author_name ?? null,
      year: null,
      image_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      match_confidence: "high",
    };
  } catch {
    return null;
  }
}

// ---------- dispatch ----------

export const SEARCHABLE_CATEGORIES = ["films", "tv", "albums", "songs", "books", "podcasts", "places", "games"] as const;

export async function searchWorks(categorySlug: string, query: string): Promise<ResolvedWork[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    switch (categorySlug) {
      case "films":
        return await searchFilms(q);
      case "tv":
        return await searchTv(q);
      case "albums":
        return await searchAlbums(q);
      case "songs":
        return await searchSongs(q);
      case "books":
        return await searchBooks(q);
      case "podcasts":
        return await searchPodcasts(q);
      case "places":
        return await searchPlaces(q);
      case "games":
        return await searchGames(q);
      default:
        return [];
    }
  } catch {
    return [];
  }
}

export async function resolveWork(
  categorySlug: string,
  title: string,
  by?: string | null,
  year?: number | null,
  sourceUrl?: string | null
): Promise<ResolvedWork | null> {
  if (categorySlug === "videos") return resolveVideo(sourceUrl);
  if (categorySlug === "games") return resolveGame(title, sourceUrl);
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
    case "places":
      return resolvePlace(title, by);
    default:
      return null;
  }
}

// ---------- verify a picked result ----------

type MbArtistCredit = { name: string }[];

// The search list is sent to the browser and the pick comes back from it, so nothing in that
// candidate can be trusted for the shared `works` row. This looks the id up again in the
// catalog itself and builds the row from that answer only. Returns null when the id doesn't
// exist (or the catalog is unreachable): the item then saves without a catalog link.
export async function verifyWork(source: WorkSource, sourceId: string): Promise<ResolvedWork | null> {
  const id = sourceId.trim();
  try {
    switch (source) {
      case "tmdb": {
        if (!/^\d+$/.test(id)) return null;
        const m: TmdbMovie | null = await tmdb(`/movie/${id}`);
        return m?.id ? movieToWork(m, await tmdbDirector(m.id), "high") : null;
      }
      case "tmdb_tv": {
        if (!/^\d+$/.test(id)) return null;
        const s: TmdbShow | null = await tmdb(`/tv/${id}`);
        return s?.id ? showToWork(s, await tmdbCreator(s.id), "high") : null;
      }
      case "openlibrary": {
        if (!/^\/works\/OL\d+W$/.test(id)) return null;
        const w = await fetchJson(`https://openlibrary.org${id}.json`);
        if (!w?.title) return null;
        const authorKey: string | undefined = w.authors?.[0]?.author?.key;
        const author = authorKey && /^\/authors\/OL\d+A$/.test(authorKey) ? (await fetchJson(`https://openlibrary.org${authorKey}.json`))?.name : null;
        const cover = (w.covers as number[] | undefined)?.find((c) => c > 0);
        return {
          source: "openlibrary",
          source_id: id,
          title: w.title,
          by: author ?? null,
          year: Number(String(w.first_publish_date ?? "").match(/\d{4}/)?.[0]) || null,
          image_url: cover ? olCover(cover) : null,
          match_confidence: "high",
        };
      }
      case "musicbrainz": {
        if (!/^[0-9a-f-]{36}$/.test(id)) return null;
        const rg = await fetchJson(`https://musicbrainz.org/ws/2/release-group/${id}?inc=artist-credits&fmt=json`, { headers: MB_HEADERS });
        if (rg?.id) {
          return {
            source: "musicbrainz",
            source_id: id,
            title: rg.title,
            by: (rg["artist-credit"] as MbArtistCredit | undefined)?.[0]?.name ?? null,
            year: yearOf(rg["first-release-date"]),
            image_url: (await caaExists(id)) ? caaThumb(id) : null,
            match_confidence: "high",
          };
        }
        const rec = await fetchJson(`https://musicbrainz.org/ws/2/recording/${id}?inc=artist-credits+releases+release-groups&fmt=json`, { headers: MB_HEADERS });
        if (!rec?.id) return null;
        const rgId: string | undefined = rec.releases?.[0]?.["release-group"]?.id;
        return {
          source: "musicbrainz",
          source_id: id,
          title: rec.title,
          by: (rec["artist-credit"] as MbArtistCredit | undefined)?.[0]?.name ?? null,
          year: yearOf(rec["first-release-date"]),
          image_url: rgId && (await caaExists(rgId)) ? caaThumb(rgId) : null,
          match_confidence: "high",
        };
      }
      case "itunes": {
        if (!/^\d+$/.test(id)) return null;
        const d = await fetchJson(`https://itunes.apple.com/lookup?id=${id}`);
        const p: ItunesPodcast | undefined = d?.results?.find((r: { collectionId?: number }) => String(r.collectionId) === id);
        return p ? podcastToWork(p, "high") : null;
      }
      case "nominatim": {
        // Only the stable OSM ids (N/W/R + number) can be looked up again.
        if (!/^[NWR]\d+$/.test(id)) return null;
        const params = new URLSearchParams({ osm_ids: id, format: "jsonv2", addressdetails: "1", extratags: "1", namedetails: "1", "accept-language": "en" });
        const found: NominatimResult[] | null = await fetchJson(`https://nominatim.openstreetmap.org/lookup?${params}`, {
          headers: { "User-Agent": MB_HEADERS["User-Agent"] },
        });
        return found?.[0] ? placeToWork(found[0], "high") : null;
      }
      case "wikidata": {
        if (!/^Q\d+$/.test(id)) return null;
        return (await gamesFromIds([id], "high"))[0] ?? null;
      }
      case "youtube":
        return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? resolveVideo(`https://www.youtube.com/watch?v=${id}`) : null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}
