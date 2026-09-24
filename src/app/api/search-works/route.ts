import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveSong, searchWorks, verifyWork, type ResolvedWork } from "@/lib/resolve-work";
import { isWorkSource, upsertWork, withWebsitePhoto } from "@/lib/works";

// GET: a list of catalog candidates for one category, for the "choose it yourself" search.
export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category") ?? "";
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
  if (!category || !q) return NextResponse.json({ results: [] });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const results = await searchWorks(category, q);
  return NextResponse.json({ results });
}

// POST: the person picked one result; register it in `works` and return its id.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const c = body?.candidate as Partial<ResolvedWork> | undefined;
  const categoryId = Number(body?.category_id);
  if (categoryId && c?.resolve_via === "song" && typeof c.title === "string") {
    const rec = await resolveSong(c.title, typeof c.by === "string" ? c.by : null);
    if (!rec) console.error(`[works] no MusicBrainz recording for picked song "${c.title}" by ${c.by ?? "?"}`);
    const work = rec ? await upsertWork(supabase, categoryId, rec) : null;
    return NextResponse.json({ work_id: work?.id ?? null });
  }
  if (!categoryId || !c || !isWorkSource(c.source) || !c.source_id) {
    return NextResponse.json({ error: "Bad candidate" }, { status: 400 });
  }
  // Only the source and id are taken from the browser; everything stored on the shared work
  // comes from looking that id up in the catalog again (verifyWork).
  const id = String(c.source_id).slice(0, 200);
  let verified = await verifyWork(c.source, id);
  if (!verified) {
    // A busy catalog (MusicBrainz 503 right after the search) is the usual cause: one more try.
    await new Promise((r) => setTimeout(r, 1500));
    verified = await verifyWork(c.source, id);
  }
  if (!verified) {
    console.error(`[works] could not verify picked ${c.source}:${id.slice(0, 80)} at the catalog (twice)`);
    return NextResponse.json({ work_id: null, link_failed: true });
  }
  const picked = await withWebsitePhoto(verified);
  const work = await upsertWork(supabase, categoryId, picked);
  // image_url: the catalog cover, or a photo from the place's own website, for the dialog.
  // link_failed: the dialog must say it couldn't link, instead of showing a match.
  return NextResponse.json({
    work_id: work?.id ?? null,
    link_failed: !work,
    image_url: picked.image_url,
    website: work?.website ?? picked.website ?? null,
  });
}
