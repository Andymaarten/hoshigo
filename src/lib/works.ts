import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ResolvedWork, WorkSource } from "./resolve-work";
import { readPhotos } from "./read-link";

const SOURCES: WorkSource[] = ["tmdb", "tmdb_tv", "musicbrainz", "openlibrary", "itunes", "igdb", "youtube", "nominatim", "wikidata", "bgg"];

export function isWorkSource(s: unknown): s is WorkSource {
  return typeof s === "string" && (SOURCES as string[]).includes(s);
}

// Only the server writes `works` (docs/migrations/2026-09-24-kaito-works.sql removes the
// insert policy for logged in users): shared rows must hold catalog data, never whatever a
// visitor posts. The service role key bypasses RLS; without it we fall back to the user's
// own client, which works until that migration runs.
let admin: SupabaseClient | null | undefined;
let warned = false;
function worksWriter(fallback: SupabaseClient): SupabaseClient {
  if (admin === undefined) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    admin = key && url ? createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  }
  if (!admin && !warned) {
    warned = true;
    console.warn("SUPABASE_SERVICE_ROLE_KEY is not set: works are written with the user's session (fails once the works migration has run).");
  }
  return admin ?? fallback;
}

// A place from OSM with its own website but no photo: take the best photo from that site
// (same safe reader as "Use another photo"). Never blocks; returns the work unchanged when
// nothing usable comes back within a few seconds.
export async function withWebsitePhoto(w: ResolvedWork): Promise<ResolvedWork> {
  if (w.image_url || !w.website) return w;
  try {
    const found = await Promise.race([
      readPhotos(w.website),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ]);
    const image = found?.images?.[0];
    return image ? { ...w, image_url: image, work_image_url: w.work_image_url ?? image } : w;
  } catch {
    return w;
  }
}

// Reuses the existing canonical row for this source+id, otherwise registers it. `w` must
// come from a catalog lookup done on the server (resolveWork / verifyWork), never from the
// browser. The row always stores the work level title/cover; an edition the person picked
// (a translated book) only changes what their own item shows, not the shared work.
export async function upsertWork(userClient: SupabaseClient, categoryId: number, w: ResolvedWork) {
  const db = worksWriter(userClient);
  const existing = await db.from("works").select("*").eq("source", w.source).eq("source_id", w.source_id).maybeSingle();
  let row = existing.data;
  if (!row) {
    const inserted = await db
      .from("works")
      .insert({
        category_id: categoryId,
        source: w.source,
        source_id: w.source_id,
        title: w.work_title ?? w.title,
        by: w.by,
        year: w.year,
        image_url: w.work_image_url !== undefined ? w.work_image_url : w.image_url,
        match_confidence: w.match_confidence,
      })
      .select("*")
      .single();
    // Before docs/migrations/2026-09-24-kaito.sql the "wikidata" source isn't allowed yet;
    // the item then simply saves without a catalog link.
    if (inserted.error) return null;
    row = inserted.data;
  }
  if (!row) return null;

  // Fill fields the row is still missing with the fresh catalog data. Only empty fields:
  // an existing value is never overwritten. Separate updates because website and the
  // place columns only exist after the 2026-09-24 migrations.
  const fill: Record<string, unknown> = {};
  if (!row.image_url && (w.work_image_url ?? w.image_url)) fill.image_url = w.work_image_url ?? w.image_url;
  if (!row.by && w.by) fill.by = w.by;
  if (!row.year && w.year) fill.year = w.year;
  if (Object.keys(fill).length) {
    const { error } = await db.from("works").update(fill).eq("id", row.id);
    if (!error) row = { ...row, ...fill };
  }
  if (w.website && !row.website) {
    const { error } = await db.from("works").update({ website: w.website }).eq("id", row.id);
    if (!error) row = { ...row, website: w.website };
  }
  if ((w.place_type || w.city || w.country) && !row.place_type && !row.city) {
    const fields = { place_type: w.place_type ?? null, city: w.city ?? null, country: w.country ?? null };
    const { error } = await db.from("works").update(fields).eq("id", row.id);
    if (!error) row = { ...row, ...fields };
  }
  return row;
}
