import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import { ownerHandle } from "@/lib/owner";
import { resolveWork, verifyWork, type ResolvedWork } from "@/lib/resolve-work";
import { isWorkSource, upsertWork } from "@/lib/works";
import { CATEGORY_SOURCES, sourceFitsCategory } from "@/lib/category-display";
import { workPageUrl } from "@/lib/work-links";

// Owner only (OWNER_HANDLES, default "andymaarten"); everyone else gets 404.
// GET  ?limit&offset  review list: items in catalog categories without a work, with the
//                     suggested match (sure and unsure), minus suggestions rejected before;
//                     plus items linked to a work from the wrong catalog (report only).
// POST {action}       "link" one item to one (source, id) after looking that id up again at
//                     the catalog; "unlink" undoes a link made here; "reject" remembers "not
//                     this one"; "link_sure" links every sure match in a batch.
// Linking only ever sets items.work_id (and fills the shared work's empty fields); the
// item's own title, by, link, photo and note are never touched.

type Row = { id: string; title: string; by: string | null; year: number | null; url: string | null; category_id: number };

const SLOW = new Set(["albums", "songs", "places"]); // MusicBrainz and Nominatim: 1 request/s
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function guard(): Promise<{ admin: SupabaseClient } | NextResponse> {
  if (!(await ownerHandle())) return new NextResponse("Not found", { status: 404 });
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set on the server." }, { status: 500 });
  return { admin };
}

async function categorySlugs(admin: SupabaseClient) {
  const { data: cats } = await admin.from("categories").select("id, slug");
  const slugOf = new Map((cats ?? []).map((c: { id: number; slug: string }) => [c.id, c.slug]));
  const catalogIds = (cats ?? []).filter((c: { slug: string }) => CATEGORY_SOURCES[c.slug]).map((c: { id: number }) => c.id);
  return { slugOf, catalogIds };
}

function matchView(m: ResolvedWork, slug: string) {
  return {
    source: m.source,
    source_id: m.source_id,
    title: m.work_title ?? m.title,
    by: m.by,
    year: m.year,
    image_url: m.work_image_url ?? m.image_url,
    detail: m.detail ?? null,
    confidence: m.match_confidence,
    page_url: workPageUrl(m.source, m.source_id, slug),
  };
}

// Links one item to one catalog record. The id is looked up again at the catalog, so only
// catalog data goes into the shared works row.
async function linkItem(admin: SupabaseClient, itemId: string, source: string, sourceId: string) {
  const { data: item } = await admin.from("items").select("id, category_id, work_id").eq("id", itemId).maybeSingle();
  if (!item) return { ok: false, error: "Item not found." };
  if (item.work_id) return { ok: false, error: "This item already has a catalog link." };
  const { slugOf } = await categorySlugs(admin);
  const slug = slugOf.get(item.category_id) ?? "";
  if (!isWorkSource(source) || !sourceFitsCategory(source, slug)) return { ok: false, error: `A ${source} record can't be linked to ${slug}.` };
  const verified = await verifyWork(source, sourceId);
  if (!verified) {
    console.error(`[backfill] could not verify ${source}:${sourceId} for item ${itemId}`);
    return { ok: false, error: "That record couldn't be found at the catalog right now." };
  }
  const work = await upsertWork(admin, item.category_id, verified);
  if (!work) return { ok: false, error: "The catalog record couldn't be saved (see server logs)." };
  const { error } = await admin.from("items").update({ work_id: work.id }).eq("id", itemId).is("work_id", null);
  if (error) {
    console.error(`[backfill] linking item ${itemId} failed: ${error.message}`);
    return { ok: false, error: error.message };
  }
  console.log(`[backfill] linked item ${itemId} → ${source}:${sourceId} (work ${work.id})`);
  return { ok: true, work_id: work.id as string };
}

async function rejectedPairs(admin: SupabaseClient, itemIds: string[]) {
  if (!itemIds.length) return { set: new Set<string>(), available: true };
  const { data, error } = await admin.from("backfill_rejections").select("item_id, work_source, work_source_id").in("item_id", itemIds);
  // Before docs/migrations/2026-09-25-backfill-rejections.sql the table doesn't exist.
  if (error) return { set: new Set<string>(), available: false };
  return { set: new Set((data ?? []).map((r) => `${r.item_id}|${r.work_source}|${r.work_source_id}`)), available: true };
}

export async function GET(request: NextRequest) {
  const g = await guard();
  if (g instanceof NextResponse) return g;
  const { admin } = g;

  const limit = Math.min(40, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 20));
  const offset = Math.max(0, Number(request.nextUrl.searchParams.get("offset")) || 0);
  const { slugOf, catalogIds } = await categorySlugs(admin);

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

  const items = (rows ?? []) as Row[];
  const rejected = await rejectedPairs(admin, items.map((i) => i.id));
  const results = [];
  let hidden = 0;
  for (const item of items) {
    const slug = slugOf.get(item.category_id) ?? "";
    const started = Date.now();
    const match = await resolveWork(slug, item.title, item.by, item.year, item.url).catch((e) => {
      console.error(`[backfill] ${slug} lookup failed for "${item.title}": ${e instanceof Error ? e.message : e}`);
      return null;
    });
    if (SLOW.has(slug)) await sleep(Math.max(0, 1100 - (Date.now() - started)));
    if (match && rejected.set.has(`${item.id}|${match.source}|${match.source_id}`)) {
      hidden++;
      continue;
    }
    results.push({
      item: { id: item.id, title: item.title, by: item.by, category: slug, url: item.url },
      match: match ? matchView(match, slug) : null,
    });
  }

  // Items linked to a work from another catalog (e.g. a book linked to a café). Report only.
  const mismatches = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data: linkedRows, error: lErr } = await admin
      .from("items")
      .select("id, title, category_id, work_id, works(source, source_id, title)")
      .not("work_id", "is", null)
      .range(from, from + 999);
    if (lErr) break;
    for (const r of linkedRows ?? []) {
      const w = (Array.isArray(r.works) ? r.works[0] : r.works) as { source: string; source_id: string; title: string } | null;
      const slug = slugOf.get(r.category_id) ?? "";
      if (w && !sourceFitsCategory(w.source, slug))
        mismatches.push({ item_id: r.id, item_title: r.title, category: slug, work: `${w.source}:${w.source_id} "${w.title}"` });
    }
    if (!linkedRows || linkedRows.length < 1000) break;
  }

  return NextResponse.json({
    summary: { offset, limit, returned: results.length, hidden_rejected: hidden, items_without_work_total: count ?? null, next_offset: offset + items.length },
    rejections_saved: rejected.available,
    results,
    mismatches,
  });
}

export async function POST(request: NextRequest) {
  const g = await guard();
  if (g instanceof NextResponse) return g;
  const { admin } = g;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? "");
  const itemId = typeof body?.item_id === "string" ? body.item_id : "";
  const source = typeof body?.source === "string" ? body.source : "";
  const sourceId = typeof body?.source_id === "string" ? body.source_id.slice(0, 200) : "";

  if (action === "link") return NextResponse.json(await linkItem(admin, itemId, source, sourceId));

  if (action === "unlink") {
    // Undo only exactly the link made from this page.
    const workId = typeof body?.work_id === "string" ? body.work_id : "";
    const { error } = await admin.from("items").update({ work_id: null }).eq("id", itemId).eq("work_id", workId);
    if (error) console.error(`[backfill] undo for item ${itemId} failed: ${error.message}`);
    else console.log(`[backfill] undid link of item ${itemId} (work ${workId})`);
    return NextResponse.json({ ok: !error, error: error?.message });
  }

  if (action === "reject") {
    const { error } = await admin
      .from("backfill_rejections")
      .upsert({ item_id: itemId, work_source: source, work_source_id: sourceId }, { onConflict: "item_id,work_source,work_source_id" });
    if (error) console.error(`[backfill] saving rejection failed (migration run?): ${error.message}`);
    return NextResponse.json({ ok: !error, saved: !error });
  }

  if (action === "link_sure") {
    const picks = Array.isArray(body?.items) ? (body.items as { item_id: string; source: string; source_id: string }[]).slice(0, 40) : [];
    const linked: { item_id: string; work_id: string }[] = [];
    const failed: { item_id: string; error: string }[] = [];
    for (const p of picks) {
      const r = await linkItem(admin, String(p.item_id), String(p.source), String(p.source_id));
      if (r.ok && r.work_id) linked.push({ item_id: p.item_id, work_id: r.work_id });
      else failed.push({ item_id: p.item_id, error: r.error ?? "failed" });
      if (p.source === "musicbrainz" || p.source === "nominatim") await sleep(1100);
    }
    return NextResponse.json({ ok: true, linked, failed });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
