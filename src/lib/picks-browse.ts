import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item } from "@/lib/supabase/types";
import { compareForProfile } from "@/lib/item-order";
import { PUBLIC_PER_CATEGORY } from "@/lib/share-rules";

export type BrowseQuery = {
  q: string;
  category: number | null;
  withNote: boolean;
  withCover: boolean;
  sort: "newest" | "kept";
  page: number;
};

export type BrowseRow = {
  id: string;
  title: string;
  by: string | null;
  imageUrl: string | null;
  note: string | null;
  handle: string;
  createdAt: string;
  categoryId: number;
  matched: boolean;
  kept: number;
  approved: boolean;
};

export const BROWSE_PAGE = 30;
const plain = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

async function all<T>(admin: SupabaseClient, table: string, cols: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 100000; from += 1000) {
    const { data, error } = await admin.from(table).select(cols).range(from, from + 999);
    if (error) break;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/**
 * Every listing a stranger may see (public pages, first five per category, pinned first),
 * searchable and filterable for choosing tips. Small site: read once per call and filter here.
 */
export async function browseListings(admin: SupabaseClient, query: BrowseQuery): Promise<{ rows: BrowseRow[]; hasMore: boolean; total: number }> {
  const [items, people, approved] = await Promise.all([
    all<Item>(admin, "items", "id, profile_id, category_id, work_id, title, by, image_url, note, created_at, pinned"),
    all<{ id: string; handle: string; display_name: string | null; is_private: boolean }>(admin, "profiles", "id, handle, display_name, is_private"),
    all<{ work_id: string | null; item_id: string | null }>(admin, "pick_approved", "work_id, item_id"),
  ]);
  const pub = new Map(people.filter((p) => !p.is_private && p.handle && !p.handle.startsWith("user-")).map((p) => [p.id, p]));
  const approvedWorks = new Set(approved.filter((a) => a.work_id && !a.item_id).map((a) => a.work_id as string));
  const approvedItems = new Set(approved.filter((a) => a.item_id).map((a) => a.item_id as string));

  const kept = new Map<string, number>();
  items.forEach((i) => i.work_id && kept.set(i.work_id, (kept.get(i.work_id) ?? 0) + 1));

  const groups = new Map<string, Item[]>();
  items.forEach((i) => {
    if (!pub.has(i.profile_id)) return;
    const k = `${i.profile_id}|${i.category_id}`;
    groups.set(k, [...(groups.get(k) ?? []), i]);
  });
  const visible: Item[] = [];
  groups.forEach((list) => visible.push(...list.sort(compareForProfile).slice(0, PUBLIC_PER_CATEGORY)));

  const needle = plain(query.q.trim());
  const rows = visible.filter((i) => {
    if (query.category && i.category_id !== query.category) return false;
    if (query.withNote && !i.note?.trim()) return false;
    if (query.withCover && !i.image_url) return false;
    if (!needle) return true;
    const p = pub.get(i.profile_id)!;
    return [i.title, i.by ?? "", p.handle, p.display_name ?? ""].some((s) => plain(s).includes(needle));
  });
  rows.sort((a, b) =>
    query.sort === "kept"
      ? (kept.get(b.work_id ?? "") ?? 1) - (kept.get(a.work_id ?? "") ?? 1) || b.created_at.localeCompare(a.created_at)
      : b.created_at.localeCompare(a.created_at)
  );

  const start = Math.max(0, query.page) * BROWSE_PAGE;
  return {
    total: rows.length,
    hasMore: rows.length > start + BROWSE_PAGE,
    rows: rows.slice(start, start + BROWSE_PAGE).map((i) => ({
      id: i.id,
      title: i.title,
      by: i.by,
      imageUrl: i.image_url,
      note: i.note?.trim() || null,
      handle: pub.get(i.profile_id)!.handle,
      createdAt: i.created_at,
      categoryId: i.category_id,
      matched: !!i.work_id,
      kept: i.work_id ? kept.get(i.work_id) ?? 1 : 1,
      approved: approvedItems.has(i.id) || (!!i.work_id && approvedWorks.has(i.work_id)),
    })),
  };
}
