import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkLink } from "@/lib/platforms";

// Builds the "Open in …" links for catalogue works, server side, written with the service
// role. Step 1: films and series (TMDB), books (Open Library), places (OSM).
// Direct links are only stored after checking where they land.

type WorkRow = { id: string; source: string; source_id: string; title: string; by: string | null; city?: string | null; country?: string | null };
type Built = WorkLink & { source: string };

export const LINKABLE_SOURCES = ["tmdb", "tmdb_tv", "openlibrary", "nominatim"];
const UA = "hoshigo/1.0 (https://hoshigo.cc)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function json(url: string, headers: Record<string, string> = {}) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json", ...headers }, signal: AbortSignal.timeout(7000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// Where a redirecting link lands, without following it (so a wrong landing can be refused).
async function landing(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" },
      signal: AbortSignal.timeout(7000),
    });
    const to = res.headers.get("location");
    return res.status >= 300 && res.status < 400 && to ? new URL(to, url).toString() : null;
  } catch {
    return null;
  }
}

async function filmLinks(w: WorkRow): Promise<Built[]> {
  const tv = w.source === "tmdb_tv";
  const out: Built[] = [{ platform: "tmdb", url: `https://www.themoviedb.org/${tv ? "tv" : "movie"}/${w.source_id}`, kind: "direct", source: "tmdb" }];
  const key = process.env.TMDB_API_KEY;
  if (key) {
    const ext = await json(`https://api.themoviedb.org/3/${tv ? "tv" : "movie"}/${w.source_id}/external_ids`, { Authorization: `Bearer ${key}` });
    if (typeof ext?.imdb_id === "string" && /^tt\d+$/.test(ext.imdb_id))
      out.push({ platform: "imdb", url: `https://www.imdb.com/title/${ext.imdb_id}/`, kind: "direct", source: "tmdb" });
  }
  // letterboxd.com/tmdb/<id> knows TMDB film ids only (a TV id lands on an unrelated film).
  if (!tv) {
    const to = await landing(`https://letterboxd.com/tmdb/${w.source_id}/`);
    if (to && /^https:\/\/letterboxd\.com\/film\/[^/]+\/$/.test(to)) out.push({ platform: "letterboxd", url: to, kind: "direct", source: "tmdb" });
  }
  return out;
}

async function bookLinks(w: WorkRow): Promise<Built[]> {
  const q = encodeURIComponent([w.title, w.by].filter(Boolean).join(" ").replace(/\s+/g, " ").trim());
  const out: Built[] = [
    { platform: "storygraph", url: `https://app.thestorygraph.com/browse?search_term=${q}`, kind: "search", source: "pattern" },
  ];
  if (/^\/works\/OL\d+W$/.test(w.source_id)) out.push({ platform: "openlibrary", url: `https://openlibrary.org${w.source_id}`, kind: "direct", source: "openlibrary" });
  const eds = /^\/works\/OL\d+W$/.test(w.source_id) ? await json(`https://openlibrary.org${w.source_id}/editions.json?limit=40`) : null;
  // English editions first, so Goodreads opens on the edition most viewers can read.
  type Edition = { isbn_13?: string[]; isbn_10?: string[]; languages?: { key?: string }[] };
  const entries = ((eds?.entries ?? []) as Edition[]).filter((e) => e.isbn_13?.length || e.isbn_10?.length);
  const english = (e: Edition) => (e.languages ?? []).some((l) => l.key === "/languages/eng");
  const isbns: string[] = [];
  for (const e of [...entries.filter(english), ...entries.filter((e) => !english(e))]) isbns.push(...(e.isbn_13 ?? []), ...(e.isbn_10 ?? []));
  let goodreads: string | null = null;
  for (const isbn of isbns.slice(0, 3)) {
    const to = await landing(`https://www.goodreads.com/book/isbn/${encodeURIComponent(isbn)}`);
    if (to && /^https:\/\/www\.goodreads\.com\/book\/show\/\d+/.test(to)) {
      goodreads = to;
      break;
    }
  }
  out.push(
    goodreads
      ? { platform: "goodreads", url: goodreads, kind: "direct", source: "openlibrary" }
      : { platform: "goodreads", url: `https://www.goodreads.com/search?q=${q}`, kind: "search", source: "pattern" }
  );
  return out;
}

async function placeLinks(w: WorkRow): Promise<Built[]> {
  let lat: string | null = null;
  let lon: string | null = null;
  let address = [w.city, w.country].filter(Boolean).join(", ");
  if (/^[NWR]\d+$/.test(w.source_id)) {
    const hit = (await json(`https://nominatim.openstreetmap.org/lookup?osm_ids=${w.source_id}&format=json`))?.[0];
    if (hit?.lat && hit?.lon) {
      lat = String(hit.lat);
      lon = String(hit.lon);
    }
    if (!address && typeof hit?.display_name === "string") address = hit.display_name.split(", ").slice(1, 4).join(", ");
  }
  const query = [w.title, address].filter(Boolean).join(", ");
  const google = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  const apple = `https://maps.apple.com/?q=${encodeURIComponent(w.title)}${lat && lon ? `&ll=${lat},${lon}` : address ? `&address=${encodeURIComponent(address)}` : ""}`;
  return [
    { platform: "google_maps", url: google, kind: "direct", source: "osm" },
    { platform: "apple_maps", url: apple, kind: "direct", source: "osm" },
  ];
}

export async function buildWorkLinks(w: WorkRow): Promise<Built[]> {
  if (w.source === "tmdb" || w.source === "tmdb_tv") return filmLinks(w);
  if (w.source === "openlibrary") return bookLinks(w);
  if (w.source === "nominatim") return placeLinks(w);
  return [];
}

async function saveLinks(admin: SupabaseClient, workId: string, links: Built[]) {
  if (!links.length) return;
  const now = new Date().toISOString();
  const { error } = await admin
    .from("work_links")
    .upsert(links.map((l) => ({ work_id: workId, platform: l.platform, url: l.url, kind: l.kind, source: l.source, checked_at: now })));
  if (error) console.error(`[work_links] saving ${links.length} links for ${workId} failed: ${error.message}`);
}

const WORK_COLS = "id, source, source_id, title, by";

async function loadWorks(admin: SupabaseClient, ids: string[]): Promise<WorkRow[]> {
  const withPlace = await admin.from("works").select(`${WORK_COLS}, city, country`).in("id", ids);
  if (!withPlace.error) return (withPlace.data ?? []) as WorkRow[];
  return ((await admin.from("works").select(WORK_COLS).in("id", ids)).data ?? []) as WorkRow[];
}

// On add: links for one work, when it has none yet.
export async function ensureWorkLinks(admin: SupabaseClient, workId: string) {
  const { data: have, error } = await admin.from("work_links").select("platform").eq("work_id", workId).limit(1);
  if (error || have?.length) return;
  const [w] = await loadWorks(admin, [workId]);
  if (!w || !LINKABLE_SOURCES.includes(w.source)) return;
  await saveLinks(admin, w.id, await buildWorkLinks(w));
}

// The daily cron: works without links, oldest first, until the deadline. Gentle: one work at a
// time with a pause (Nominatim and Goodreads are shared services).
export async function backfillWorkLinks(admin: SupabaseClient, deadline: number) {
  const result = { checked: 0, linked: 0, error: "" as string };
  const probe = await admin.from("work_links").select("work_id").limit(1);
  if (probe.error) return { ...result, error: "work_links table missing (run docs/migrations/2026-09-29-work-links.sql)" };
  let after = "1970-01-01T00:00:00Z";
  while (Date.now() < deadline - 20_000) {
    const { data: page } = await admin
      .from("works")
      .select("id, created_at")
      .in("source", LINKABLE_SOURCES)
      .gt("created_at", after)
      .order("created_at")
      .limit(200);
    if (!page?.length) break;
    after = page[page.length - 1].created_at;
    const { data: done } = await admin.from("work_links").select("work_id").in("work_id", page.map((p) => p.id));
    const have = new Set((done ?? []).map((d) => d.work_id));
    const todo = page.filter((p) => !have.has(p.id)).map((p) => p.id);
    for (let i = 0; i < todo.length && Date.now() < deadline - 20_000; i += 10) {
      for (const w of await loadWorks(admin, todo.slice(i, i + 10))) {
        if (Date.now() >= deadline - 20_000) break;
        const links = await buildWorkLinks(w);
        await saveLinks(admin, w.id, links);
        result.checked++;
        if (links.length) result.linked++;
        await sleep(1100);
      }
    }
  }
  return result;
}
