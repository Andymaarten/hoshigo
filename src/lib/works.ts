import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResolvedWork, WorkSource } from "./resolve-work";
import { readPhotos } from "./read-link";

const SOURCES: WorkSource[] = ["tmdb", "tmdb_tv", "musicbrainz", "openlibrary", "itunes", "igdb", "youtube", "nominatim", "wikidata"];

export function isWorkSource(s: unknown): s is WorkSource {
  return typeof s === "string" && (SOURCES as string[]).includes(s);
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

// Reuses the existing canonical row for this source+id, otherwise registers it. The row
// always stores the work level title/cover; an edition the person picked (a translated
// book) only changes what their own item shows, not the shared work.
export async function upsertWork(supabase: SupabaseClient, categoryId: number, w: ResolvedWork) {
  const existing = await supabase.from("works").select("*").eq("source", w.source).eq("source_id", w.source_id).maybeSingle();
  let row = existing.data;
  if (!row) {
    const inserted = await supabase
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
  // Separate update: the website column only exists after the 2026-09-24 migration.
  if (w.website && row && !row.website) {
    const { error } = await supabase.from("works").update({ website: w.website }).eq("id", row.id);
    if (!error) row = { ...row, website: w.website };
  }
  // Same for the structured place fields (docs/migrations/2026-09-24-kaito-places.sql).
  if (row && (w.place_type || w.city || w.country) && !row.place_type && !row.city) {
    const fields = { place_type: w.place_type ?? null, city: w.city ?? null, country: w.country ?? null };
    const { error } = await supabase.from("works").update(fields).eq("id", row.id);
    if (!error) row = { ...row, ...fields };
  }
  return row;
}
