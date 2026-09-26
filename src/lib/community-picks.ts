import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item } from "@/lib/supabase/types";
import { compareForProfile } from "@/lib/item-order";
import { PUBLIC_PER_CATEGORY } from "@/lib/share-rules";

export type Pick = {
  itemId: string;
  workId: string | null;
  handle: string;
  name: string;
  title: string;
  by: string | null;
  category: string | null;
  imageUrl: string | null;
  /** the listing's own note, only when short enough to quote */
  note: string | null;
  path: string;
};

const SHORT_NOTE = 120;
const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Everything a stranger may see of these people: public profiles, first five per category. */
async function visibleItems(admin: SupabaseClient, filter: { profileIds?: string[]; workIds?: string[]; itemIds?: string[] }) {
  let q = admin.from("items").select("*").limit(10000);
  if (filter.profileIds) q = q.in("profile_id", filter.profileIds.slice(0, 1000));
  if (filter.workIds) q = q.in("work_id", filter.workIds.slice(0, 1000));
  if (filter.itemIds) q = q.in("id", filter.itemIds.slice(0, 1000));
  const { data: hits } = await q;
  const found = (hits ?? []) as Item[];
  if (!found.length) return { items: [] as Item[], people: new Map<string, { handle: string; name: string }>() };

  const owners = [...new Set(found.map((i) => i.profile_id))];
  const pairs = new Set(found.map((i) => `${i.profile_id}|${i.category_id}`));
  const [{ data: people }, { data: all }] = await Promise.all([
    admin.from("profiles").select("id, handle, display_name, is_private").in("id", owners),
    // their full lists in those categories, to know each one's public window
    admin.from("items").select("id, profile_id, category_id, created_at, pinned").in("profile_id", owners).limit(20000),
  ]);
  const pub = new Map(
    (people ?? [])
      .filter((p) => !p.is_private && typeof p.handle === "string" && !(p.handle as string).startsWith("user-"))
      .map((p) => [p.id as string, { handle: p.handle as string, name: (p.display_name as string) || (p.handle as string) }])
  );
  const groups = new Map<string, Item[]>();
  ((all ?? []) as Item[]).forEach((i) => {
    const k = `${i.profile_id}|${i.category_id}`;
    if (pairs.has(k)) groups.set(k, [...(groups.get(k) ?? []), i]);
  });
  const inWindow = new Set<string>();
  groups.forEach((list) => list.sort(compareForProfile).slice(0, PUBLIC_PER_CATEGORY).forEach((i) => inWindow.add(i.id)));
  return { items: found.filter((i) => pub.has(i.profile_id) && inWindow.has(i.id)), people: pub };
}

/**
 * 2 or 3 tips for a welcome email, only from what the owner approved (pick_approved).
 * First: approved works kept by someone at distance 2 or 3 in the recipient's friend network
 * (credited to them). Then: approved listings, or any public listing of an approved work.
 * Never something the recipient already keeps, has in their someday list, or got before.
 * Fewer than 2 left: no tips at all rather than padding.
 */
export async function communityPicks(admin: SupabaseClient, recipientId: string, count = 3): Promise<Pick[]> {
  const [approvedRes, { data: fr }, { data: cats }, { data: own }, someday, sentRes] = await Promise.all([
    admin.from("pick_approved").select("work_id, item_id"),
    admin.from("friendships").select("requester, addressee").eq("status", "accepted").limit(50000),
    admin.from("categories").select("id, label"),
    admin.from("items").select("work_id, title, category_id").eq("profile_id", recipientId),
    admin.from("someday_items").select("work_id, title, category_id").eq("profile_id", recipientId),
    admin.from("welcome_email_picks").select("work_id, item_id").eq("profile_id", recipientId),
  ]);
  if (approvedRes.error) return [];
  const approved = approvedRes.data ?? [];
  const approvedWorks = new Set(approved.filter((a) => a.work_id && !a.item_id).map((a) => a.work_id as string));
  const approvedItems = new Set(approved.filter((a) => a.item_id).map((a) => a.item_id as string));
  if (!approvedWorks.size && !approvedItems.size) return [];

  // what the recipient already has, or already got from us
  const haveWorks = new Set<string>();
  const haveTitles = new Set<string>();
  [...(own ?? []), ...(someday.error ? [] : someday.data ?? [])].forEach((r) => {
    if (r.work_id) haveWorks.add(r.work_id as string);
    haveTitles.add(`${r.category_id}|${norm(r.title as string)}`);
  });
  const sent = sentRes.error ? [] : sentRes.data ?? [];
  const sentWorks = new Set(sent.map((s) => s.work_id).filter(Boolean) as string[]);
  const sentItems = new Set(sent.map((s) => s.item_id).filter(Boolean) as string[]);
  const fresh = (i: Item) =>
    i.profile_id !== recipientId &&
    !(i.work_id && (haveWorks.has(i.work_id) || sentWorks.has(i.work_id))) &&
    !sentItems.has(i.id) &&
    !haveTitles.has(`${i.category_id}|${norm(i.title)}`);

  // the recipient's network at distance 2 and 3
  const adj = new Map<string, string[]>();
  (fr ?? []).forEach((f) => {
    const a = f.requester as string;
    const b = f.addressee as string;
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  });
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
  const near = new Set([...dist.entries()].filter(([, d]) => d >= 2).map(([id]) => id));

  const catLabel = new Map((cats ?? []).map((c) => [c.id as number, c.label as string]));
  const [byWork, byItem] = await Promise.all([
    approvedWorks.size ? visibleItems(admin, { workIds: [...approvedWorks] }) : Promise.resolve(null),
    approvedItems.size ? visibleItems(admin, { itemIds: [...approvedItems] }) : Promise.resolve(null),
  ]);
  const people = new Map([...(byWork?.people ?? []), ...(byItem?.people ?? [])]);
  const workItems = (byWork?.items ?? []).filter(fresh);
  const itemItems = (byItem?.items ?? []).filter(fresh);

  // network first, then approved listings, then any public listing of an approved work
  const ordered = [
    ...workItems.filter((i) => near.has(i.profile_id)),
    ...itemItems,
    ...workItems.filter((i) => !near.has(i.profile_id)),
  ];

  const out: Pick[] = [];
  const usedPeople = new Set<string>();
  const usedThings = new Set<string>();
  const usedCats = new Set<string | null>();
  for (const pass of [0, 1]) {
    for (const i of ordered) {
      if (out.length >= count) break;
      const p = people.get(i.profile_id);
      const thing = i.work_id ?? `${i.category_id}|${norm(i.title)}`;
      const cat = catLabel.get(i.category_id) ?? null;
      if (!p || usedPeople.has(i.profile_id) || usedThings.has(thing)) continue;
      if (pass === 0 && usedCats.has(cat)) continue;
      usedPeople.add(i.profile_id);
      usedThings.add(thing);
      usedCats.add(cat);
      const note = i.note?.trim() ?? "";
      out.push({
        itemId: i.id,
        workId: i.work_id,
        handle: p.handle,
        name: p.name,
        title: i.title,
        by: i.by,
        category: cat,
        imageUrl: i.image_url,
        note: note && note.length < SHORT_NOTE ? note : null,
        path: `/${p.handle}/${i.id}`,
      });
    }
  }
  return out.length >= 2 ? out : [];
}

/** Remember what someone got, so a later email never repeats it. */
export async function recordPicks(admin: SupabaseClient, profileId: string, picks: Pick[]) {
  if (!picks.length) return;
  await admin.from("welcome_email_picks").insert(picks.map((p) => ({ profile_id: profileId, work_id: p.workId, item_id: p.itemId })));
}
