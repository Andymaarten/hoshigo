import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResolvedWork, WorkSource } from "./resolve-work";

const SOURCES: WorkSource[] = ["tmdb", "tmdb_tv", "musicbrainz", "openlibrary", "itunes", "igdb", "youtube", "nominatim"];

export function isWorkSource(s: unknown): s is WorkSource {
  return typeof s === "string" && (SOURCES as string[]).includes(s);
}

// Reuses the existing canonical row for this source+id, otherwise registers it. The row
// always stores the work level title/cover; an edition the person picked (a translated
// book) only changes what their own item shows, not the shared work.
export async function upsertWork(supabase: SupabaseClient, categoryId: number, w: ResolvedWork) {
  const existing = await supabase.from("works").select("*").eq("source", w.source).eq("source_id", w.source_id).maybeSingle();
  if (existing.data) return existing.data;
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
  return inserted.error ? null : inserted.data;
}
