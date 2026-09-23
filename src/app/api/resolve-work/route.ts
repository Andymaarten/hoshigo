import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWork } from "@/lib/resolve-work";
import { upsertWork } from "@/lib/works";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { category_id, category_slug, title, by, year, url } = await request.json();
  if (!category_id || !category_slug || (!title && category_slug !== "videos")) {
    return NextResponse.json({ error: "Missing category or title" }, { status: 400 });
  }

  const resolved = await resolveWork(category_slug, title, by, year, url);
  if (!resolved) return NextResponse.json({ work: null });
  const work = await upsertWork(supabase, Number(category_id), resolved);
  if (!work) return NextResponse.json({ work: null });
  // The item shows what was matched (e.g. the translated edition), the id links the work.
  return NextResponse.json({
    work: { ...work, title: resolved.title, image_url: resolved.image_url ?? work.image_url, by: resolved.by ?? work.by },
  });
}
