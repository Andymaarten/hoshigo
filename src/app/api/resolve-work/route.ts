import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWork } from "@/lib/resolve-work";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { category_id, category_slug, title, by, year } = await request.json();
  if (!category_id || !category_slug || !title) {
    return NextResponse.json({ error: "Missing category or title" }, { status: 400 });
  }

  const resolved = await resolveWork(category_slug, title, by, year);
  if (!resolved) return NextResponse.json({ work: null });

  // reuse an existing canonical row for this source+id if we've seen it before,
  // otherwise register it — this is what makes "same album via Bandcamp vs Discogs" converge
  const existing = await supabase
    .from("works")
    .select("*")
    .eq("source", resolved.source)
    .eq("source_id", resolved.source_id)
    .maybeSingle();

  if (existing.data) return NextResponse.json({ work: existing.data });

  const inserted = await supabase
    .from("works")
    .insert({
      category_id,
      source: resolved.source,
      source_id: resolved.source_id,
      title: resolved.title,
      by: resolved.by,
      year: resolved.year,
      image_url: resolved.image_url,
    })
    .select("*")
    .single();

  if (inserted.error) return NextResponse.json({ work: null });
  return NextResponse.json({ work: inserted.data });
}
