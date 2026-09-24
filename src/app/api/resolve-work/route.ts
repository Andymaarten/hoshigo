import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWork } from "@/lib/resolve-work";
import { upsertWork, withWebsitePhoto } from "@/lib/works";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { category_id, title, by, year, url } = await request.json();
  // The category's slug comes from the database, not from the client, so a work is always
  // resolved in the catalog of the category the item will be saved in.
  const { data: cat } = await supabase.from("categories").select("slug").eq("id", Number(category_id)).maybeSingle();
  const category_slug = cat?.slug as string | undefined;
  if (!category_id || !category_slug || (!title && category_slug !== "videos")) {
    return NextResponse.json({ error: "Missing category or title" }, { status: 400 });
  }

  let resolved = await resolveWork(category_slug, title, by, year, url);
  if (!resolved) {
    console.error(`[works] no ${category_slug} match for "${title}"${by ? ` by ${by}` : ""}${url ? ` (${url})` : ""}`);
    return NextResponse.json({ work: null });
  }
  // Only sure place matches get linked by the dialog, so only those are worth a photo fetch.
  if (resolved.source === "nominatim" && resolved.match_confidence === "high") resolved = await withWebsitePhoto(resolved);
  const work = await upsertWork(supabase, Number(category_id), resolved);
  if (!work) return NextResponse.json({ work: null });
  // The item shows what was matched (e.g. the translated edition), the id links the work.
  return NextResponse.json({
    work: {
      ...work,
      title: resolved.title,
      image_url: resolved.image_url ?? work.image_url,
      by: resolved.by ?? work.by,
      place_type: resolved.place_type ?? work.place_type ?? null,
      city: resolved.city ?? work.city ?? null,
      country: resolved.country ?? work.country ?? null,
    },
  });
}
