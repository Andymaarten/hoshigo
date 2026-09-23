import type { createClient } from "@/lib/supabase/server";
import type { Item } from "@/lib/supabase/types";
import { PUBLIC_PER_CATEGORY } from "@/lib/share-rules";
import { compareForProfile } from "@/lib/item-order";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const FEED_PAGE_SIZE = 10;

export type FeedItem = Item & { shareable: boolean };
export type FeedPage = { items: FeedItem[]; hasOlder: boolean };

const UUID_RE = /^[0-9a-f-]{36}$/i;

/** One page of friends' items, newest first, keyset paged on (created_at, id). */
export async function feedRows(
  supabase: Supabase,
  friendIds: string[],
  categoryId: number | null,
  cursor?: { at: string; id: string }
): Promise<{ items: Item[]; hasOlder: boolean }> {
  if (!friendIds.length) return { items: [], hasOlder: false };
  let query = supabase
    .from("items")
    .select("*")
    .in("profile_id", friendIds)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(FEED_PAGE_SIZE + 1);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (cursor && !Number.isNaN(Date.parse(cursor.at)) && UUID_RE.test(cursor.id)) {
    query = query.or(`created_at.lt."${cursor.at}",and(created_at.eq."${cursor.at}",id.lt.${cursor.id})`);
  }
  const { data } = await query.returns<Item[]>();
  const rows = data ?? [];
  return { items: rows.slice(0, FEED_PAGE_SIZE), hasOlder: rows.length > FEED_PAGE_SIZE };
}

// Only a listing among its owner's first five in that category may be shared (same rule and
// order as the profile: pinned first, then newest). One light query over the friends' ids.
export async function shareableIds(supabase: Supabase, friendIds: string[]): Promise<Set<string>> {
  const ids = new Set<string>();
  if (!friendIds.length) return ids;
  const query = (cols: string) =>
    supabase
      .from("items")
      .select(cols)
      .in("profile_id", friendIds)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(5000)
      .returns<Item[]>();
  const first = await query("id, profile_id, category_id, created_at, pinned");
  // before the pinning migration there is no pinned column
  const data = first.error ? (await query("id, profile_id, category_id, created_at")).data : first.data;
  const groups = new Map<string, Item[]>();
  for (const r of data ?? []) {
    const key = `${r.profile_id}|${r.category_id}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  for (const list of groups.values()) list.sort(compareForProfile).slice(0, PUBLIC_PER_CATEGORY).forEach((r) => ids.add(r.id));
  return ids;
}

export function withShareable(items: Item[], ids: Set<string>): FeedItem[] {
  return items.map((i) => ({ ...i, shareable: ids.has(i.id) }));
}
