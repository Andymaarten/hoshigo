import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { ownerHandle } from "@/lib/owner";
import { resolveWork } from "@/lib/resolve-work";
import { upsertWork } from "@/lib/works";
import { CATEGORY_SOURCES, sourceFitsCategory } from "@/lib/category-display";

// Owner only (OWNER_HANDLES, default "andymaarten"); everyone else gets 404.
// GET  = dry run: items in catalog categories without a work, and what each would match;
//        plus items linked to a work from the wrong catalog (report only).
// POST = the same, and links the high confidence matches (items.work_id only; the item's
//        own title, by, link, photo and note are never touched).
// Works in batches (?limit, ?offset) so one call stays well inside the function time limit.

type Row = { id: string; title: string; by: string | null; year: number | null; url: string | null; category_id: number };

const SLOW = new Set(["albums", "songs", "places"]); // MusicBrainz and Nominatim: 1 request/s
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run(request: NextRequest, apply: boolean) {
  if (!(await ownerHandle())) return new NextResponse("Not found", { status: 404 });
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set on the server." }, { status: 500 });

  const limit = Math.min(40, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 20));
  const offset = Math.max(0, Number(request.nextUrl.searchParams.get("offset")) || 0);

  const { data: cats } = await admin.from("categories").select("id, slug");
  const slugOf = new Map((cats ?? []).map((c: { id: number; slug: string }) => [c.id, c.slug]));
  const catalogIds = (cats ?? []).filter((c: { slug: string }) => CATEGORY_SOURCES[c.slug]).map((c: { id: number }) => c.id);

  const { data: rows, count, error } = await admin
    .from("items")
    .select("id, title, by, year, url, category_id", { count: "exact" })
    .is("work_id", null)
    .in("category_id", catalogIds)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) {
    console.error(`[backfill] reading items failed: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];
  let linked = 0;
  for (const item of (rows ?? []) as Row[]) {
    const slug = slugOf.get(item.category_id) ?? "";
    const started = Date.now();
    const match = await resolveWork(slug, item.title, item.by, item.year, item.url).catch((e) => {
      console.error(`[backfill] ${slug} lookup failed for "${item.title}": ${e instanceof Error ? e.message : e}`);
      return null;
    });
    let action = match ? (match.match_confidence === "high" ? "would link" : "low confidence, skipped") : "no match";
    if (apply && match?.match_confidence === "high") {
      const work = await upsertWork(admin, item.category_id, match);
      if (!work) action = "work could not be written (see logs)";
      else {
        const { error: upErr } = await admin.from("items").update({ work_id: work.id }).eq("id", item.id).is("work_id", null);
        if (upErr) {
          action = `linking failed: ${upErr.message}`;
          console.error(`[backfill] linking item ${item.id} failed: ${upErr.message}`);
        } else {
          action = "linked";
          linked++;
        }
      }
    }
    console.log(`[backfill] ${slug} "${item.title}" → ${match ? `${match.source}:${match.source_id} "${match.title}" (${match.match_confidence})` : "no match"}: ${action}`);
    results.push({
      item_id: item.id,
      category: slug,
      title: item.title,
      by: item.by,
      match: match ? { source: match.source, source_id: match.source_id, title: match.title, by: match.by, confidence: match.match_confidence } : null,
      action,
    });
    if (SLOW.has(slug)) await sleep(Math.max(0, 1100 - (Date.now() - started)));
  }

  // Items linked to a work from another catalog (e.g. a book linked to a café). Report only.
  const mismatches = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data: linkedRows, error: lErr } = await admin
      .from("items")
      .select("id, title, category_id, work_id, works(source, source_id, title)")
      .not("work_id", "is", null)
      .range(from, from + 999);
    if (lErr) {
      console.error(`[backfill] reading linked items failed: ${lErr.message}`);
      break;
    }
    for (const r of linkedRows ?? []) {
      const w = (Array.isArray(r.works) ? r.works[0] : r.works) as { source: string; source_id: string; title: string } | null;
      const slug = slugOf.get(r.category_id) ?? "";
      if (w && !sourceFitsCategory(w.source, slug))
        mismatches.push({ item_id: r.id, item_title: r.title, category: slug, work_id: r.work_id, work: `${w.source}:${w.source_id} "${w.title}"` });
    }
    if (!linkedRows || linkedRows.length < 1000) break;
  }

  const summary = {
    mode: apply ? "apply" : "dry run",
    batch: { offset, limit, returned: results.length },
    items_without_work_total: count ?? null,
    would_link: results.filter((r) => r.match?.confidence === "high").length,
    linked,
    low_confidence: results.filter((r) => r.match?.confidence === "low").length,
    no_match: results.filter((r) => !r.match).length,
    // linked items leave the "without work" set, so the next batch starts earlier
    next_offset: offset + results.length - linked,
  };
  console.log(`[backfill] ${JSON.stringify(summary)}; ${mismatches.length} category mismatches`);
  return NextResponse.json({ summary, results, mismatches });
}

export async function GET(request: NextRequest) {
  return run(request, false);
}

export async function POST(request: NextRequest) {
  return run(request, true);
}
