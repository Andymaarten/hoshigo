// Places keep OpenStreetMap's structure: a type ("Bar", "Museum") and a location (city).
// Items and works store them in place_type / city / country (docs/migrations/
// 2026-09-24-kaito-places.sql). The old combined "by" line ("Bar · Amsterdam") is still
// written alongside, so anything that reads `by`, and databases before the migration,
// keep working.

export type PlaceFields = { placeType: string; city: string; country: string };

export function placeLine(placeType?: string | null, city?: string | null): string {
  return [placeType?.trim(), city?.trim()].filter(Boolean).join(" · ");
}

// "Bar · Amsterdam" → type Bar, city Amsterdam. Anything else is treated as a location.
export function splitPlaceLine(by?: string | null): { placeType: string; city: string } {
  const parts = (by ?? "").split(" · ").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 2) return { placeType: parts[0], city: parts[1] };
  return { placeType: "", city: (by ?? "").trim() };
}

// What to show for a place item: its own columns, else the old combined line split up.
export function placeDisplay(item: { by: string | null; place_type?: string | null; city?: string | null; country?: string | null }) {
  if (item.place_type || item.city) return { placeType: item.place_type ?? "", city: item.city ?? "", country: item.country ?? "" };
  return { ...splitPlaceLine(item.by), country: "" };
}
