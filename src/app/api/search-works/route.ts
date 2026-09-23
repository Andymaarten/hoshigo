import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveSong, searchWorks, type ResolvedWork } from "@/lib/resolve-work";
import { isWorkSource, upsertWork } from "@/lib/works";

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
    const work = rec ? await upsertWork(supabase, categoryId, rec) : null;
    return NextResponse.json({ work_id: work?.id ?? null });
  }
  if (!categoryId || !c || !isWorkSource(c.source) || !c.source_id || !c.title) {
    return NextResponse.json({ error: "Bad candidate" }, { status: 400 });
  }
  const str = (v: unknown, max = 500) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const httpUrl = (v: unknown) => (typeof v === "string" && /^https:\/\//.test(v) ? v.slice(0, 1000) : null);
  const work = await upsertWork(supabase, categoryId, {
    source: c.source,
    source_id: String(c.source_id).slice(0, 200),
    title: str(c.title)!,
    by: str(c.by),
    year: Number.isInteger(c.year) ? (c.year as number) : null,
    image_url: httpUrl(c.image_url),
    work_title: str(c.work_title) ?? undefined,
    work_image_url: c.work_image_url === undefined ? undefined : httpUrl(c.work_image_url),
    // A person looked at the list and chose this exact entry.
    match_confidence: "high",
  });
  return NextResponse.json({ work_id: work?.id ?? null });
}
