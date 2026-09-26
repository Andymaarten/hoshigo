import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item } from "@/lib/supabase/types";
import { compareForProfile } from "@/lib/item-order";
import { PUBLIC_PER_CATEGORY } from "@/lib/share-rules";

export type Pick = {
  itemId: string;
  handle: string;
  name: string;
  title: string;
  by: string | null;
  category: string | null;
  imageUrl: string | null;
  note: string;
  path: string;
};

type BlockRule = { kind: "work" | "title" | "by"; value: string };

const DAY = 86400000;
const MAX_AGE_DAYS = 183;

function likeToRegex(pattern: string): RegExp {
  const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${esc}$`, "i");
}

export async function loadBlocklist(admin: SupabaseClient): Promise<BlockRule[] | null> {
  const { data, error } = await admin.from("pick_blocklist").select("kind, value");
  return error ? null : ((data ?? []) as BlockRule[]);
}

function blocked(item: Item, rules: BlockRule[]): boolean {
  return rules.some((r) =>
    r.kind === "work" ? item.work_id === r.value : likeToRegex(r.value).test((r.kind === "title" ? item.title : item.by) ?? "")
  );
}

/**
 * 2 or 3 things kept by people at distance 2 and 3 in the recipient's friend network (not
 * their friends, not themselves). Only what a stranger may see: public profiles, and each
 * person's first five per category (pinned first), the same rule the database applies.
 * Prefers a note, a catalogue match with a cover, kept in the last six months, kept by more
 * people in the wider network; one pick per person, spread over categories. Falls back to the
 * homepage profiles when the network is small.
 */
export async function communityPicks(admin: SupabaseClient, recipientId: string, count = 3): Promise<Pick[]> {
  const [{ data: fr }, { data: cats }, rules] = await Promise.all([
    admin.from("friendships").select("requester, addressee").eq("status", "accepted").limit(50000),
    admin.from("categories").select("id, label"),
    loadBlocklist(admin),
  ]);
  const adj = new Map<string, string[]>();
  (fr ?? []).forEach((f) => {
    const a = f.requester as string;
    const b = f.addressee as string;
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  });

  // breadth first up to distance 3
  const dist = new Map<string, number>([[recipientId, 0]]);
  let frontier = [recipientId];
  for (let d = 1; d <= 3; d++) {
    const next: string[] = [];
    for (const id of frontier) for (const n of adj.get(id) ?? []) if (!dist.has(n)) {
      dist.set(n, d);
      next.push(n);
    }
    frontier = next;
  }
  const wider = [...dist.keys()].filter((id) => id !== recipientId);
  const candidates = wider.filter((id) => (dist.get(id) ?? 0) >= 2);

  const catLabel = new Map((cats ?? []).map((c) => [c.id as number, c.label as string]));
  const picked = await pickFrom(admin, candidates, wider, rules ?? [], catLabel, count, new Set());
  if (picked.length >= Math.min(2, count)) return picked;

  // small network: the people on the homepage, never the recipient or their own friends
  const { data: home } = await admin.from("profiles").select("id").not("homepage_order", "is", null);
  const friends = new Set(wider.filter((id) => dist.get(id) === 1));
  const homeIds = (home ?? []).map((p) => p.id as string).filter((id) => id !== recipientId && !friends.has(id));
  const more = await pickFrom(admin, homeIds, wider, rules ?? [], catLabel, count - picked.length, new Set(picked.map((p) => p.handle)), picked);
  return [...picked, ...more];
}

async function pickFrom(
  admin: SupabaseClient,
  profileIds: string[],
  wider: string[],
  rules: BlockRule[],
  catLabel: Map<number, string>,
  count: number,
  skipHandles: Set<string>,
  already: Pick[] = []
): Promise<Pick[]> {
  if (!profileIds.length || count <= 0) return [];
  const ids = profileIds.slice(0, 500);
  const [{ data: people }, { data: rows }, { data: wideRows }] = await Promise.all([
    admin.from("profiles").select("id, handle, display_name, is_private").in("id", ids),
    admin.from("items").select("*").in("profile_id", ids).limit(10000),
    wider.length ? admin.from("items").select("work_id").in("profile_id", wider.slice(0, 1000)).not("work_id", "is", null).limit(20000) : Promise.resolve({ data: [] }),
  ]);
  const publicPeople = new Map(
    (people ?? [])
      .filter((p) => !p.is_private && typeof p.handle === "string" && !(p.handle as string).startsWith("user-") && !skipHandles.has(p.handle as string))
      .map((p) => [p.id as string, p])
  );

  // the public window: first five per person per category, pinned first
  const groups = new Map<string, Item[]>();
  ((rows ?? []) as Item[]).forEach((i) => {
    if (!publicPeople.has(i.profile_id)) return;
    const k = `${i.profile_id}|${i.category_id}`;
    groups.set(k, [...(groups.get(k) ?? []), i]);
  });
  const visible: Item[] = [];
  groups.forEach((list) => visible.push(...list.sort(compareForProfile).slice(0, PUBLIC_PER_CATEGORY)));

  const keptBy = new Map<string, number>();
  (wideRows ?? []).forEach((r) => keptBy.set(r.work_id as string, (keptBy.get(r.work_id as string) ?? 0) + 1));

  const now = Date.now();
  const good = visible
    .filter((i) => i.note?.trim() && i.work_id && i.image_url && now - Date.parse(i.created_at) < MAX_AGE_DAYS * DAY && !blocked(i, rules))
    .sort((a, b) => (keptBy.get(b.work_id!) ?? 0) - (keptBy.get(a.work_id!) ?? 0) || b.created_at.localeCompare(a.created_at));

  // one per person, and a new category before a repeated one
  const out: Pick[] = [];
  const usedPeople = new Set(already.map((p) => p.handle));
  const usedCats = new Set(already.map((p) => p.category));
  for (const pass of [0, 1]) {
    for (const i of good) {
      if (out.length >= count) break;
      const p = publicPeople.get(i.profile_id)!;
      const cat = catLabel.get(i.category_id) ?? null;
      if (usedPeople.has(p.handle as string) || out.some((o) => o.itemId === i.id)) continue;
      if (pass === 0 && usedCats.has(cat)) continue;
      usedPeople.add(p.handle as string);
      usedCats.add(cat);
      out.push({
        itemId: i.id,
        handle: p.handle as string,
        name: (p.display_name as string) || (p.handle as string),
        title: i.title,
        by: i.by,
        category: cat,
        imageUrl: i.image_url,
        note: i.note!.trim(),
        path: `/${p.handle}/${i.id}`,
      });
    }
  }
  return out;
}
