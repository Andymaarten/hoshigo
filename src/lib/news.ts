import type { SupabaseClient } from "@supabase/supabase-js";

// "news": what happened around one person, derived from existing tables. Server side only
// (the service role reads other people's someday rows that point at this person's listings).

export type NewsKind = "request" | "accepted" | "follower" | "saved" | "loved";
export type NewsPerson = { id: string; handle: string; name: string };
export type NewsEvent = { kind: NewsKind; at: string; who: NewsPerson; item?: { id: string; title: string } };

const DAY = 86400000;

export async function newsEvents(admin: SupabaseClient, me: string, sinceDays = 180): Promise<NewsEvent[]> {
  const since = new Date(Date.now() - sinceDays * DAY).toISOString();
  const [{ data: fr }, follows, { data: myItems }] = await Promise.all([
    admin.from("friendships").select("requester, addressee, status, created_at, accepted_at").or(`requester.eq.${me},addressee.eq.${me}`),
    admin.from("follows").select("follower, created_at").eq("followee", me).gte("created_at", since),
    admin.from("items").select("id, title").eq("profile_id", me).limit(5000),
  ]);
  const friendIds = new Set(
    (fr ?? []).filter((f) => f.status === "accepted").map((f) => (f.requester === me ? f.addressee : f.requester) as string)
  );
  const itemTitle = new Map((myItems ?? []).map((i) => [i.id as string, i.title as string]));

  type Raw = { kind: NewsKind; at: string; whoId: string; itemId?: string };
  const raw: Raw[] = [];
  for (const f of fr ?? []) {
    if (f.status === "pending" && f.addressee === me) raw.push({ kind: "request", at: f.created_at as string, whoId: f.requester as string });
    // "X and you are friends now": when someone accepted what I asked, or I opened their invite
    if (f.status === "accepted" && f.requester === me && f.accepted_at && (f.accepted_at as string) >= since)
      raw.push({ kind: "accepted", at: f.accepted_at as string, whoId: f.addressee as string });
  }
  // friends aren't listed as followers (an old follow row can linger)
  for (const f of follows.error ? [] : follows.data ?? [])
    if (!friendIds.has(f.follower as string)) raw.push({ kind: "follower", at: f.created_at as string, whoId: f.follower as string });

  if (itemTitle.size) {
    const ids = [...itemTitle.keys()];
    const withStatus = await admin
      .from("someday_items")
      .select("profile_id, source_item_id, created_at, status, resolved_at")
      .in("source_item_id", ids.slice(0, 1000))
      .gte("created_at", since);
    const rows = withStatus.error
      ? (await admin.from("someday_items").select("profile_id, source_item_id, created_at").in("source_item_id", ids.slice(0, 1000)).gte("created_at", since)).data ?? []
      : withStatus.data ?? [];
    for (const r of rows as { profile_id: string; source_item_id: string; created_at: string; status?: string; resolved_at?: string | null }[]) {
      if (r.profile_id === me) continue;
      raw.push({ kind: "saved", at: r.created_at, whoId: r.profile_id, itemId: r.source_item_id });
      if (r.status === "loved" && r.resolved_at) raw.push({ kind: "loved", at: r.resolved_at, whoId: r.profile_id, itemId: r.source_item_id });
    }
  }

  const whoIds = [...new Set(raw.map((r) => r.whoId))];
  const { data: people } = whoIds.length ? await admin.from("profiles").select("id, handle, display_name").in("id", whoIds) : { data: [] };
  const byId = new Map(
    (people ?? [])
      .filter((p) => typeof p.handle === "string" && !(p.handle as string).startsWith("user-"))
      .map((p) => [p.id as string, { id: p.id as string, handle: p.handle as string, name: (p.display_name as string) || (p.handle as string) }])
  );
  return raw
    .filter((r) => byId.has(r.whoId))
    .map((r) => ({ kind: r.kind, at: r.at, who: byId.get(r.whoId)!, item: r.itemId ? { id: r.itemId, title: itemTitle.get(r.itemId) ?? "" } : undefined }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** Monday (UTC) of the week an instant falls in. */
export function weekOf(at: string): string {
  const d = new Date(at);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)).toISOString().slice(0, 10);
}

type Hoshigo = { id: string; title: string };
type ItemKind = "saved" | "loved";

export type NewsLine =
  | { type: "one"; event: NewsEvent }
  /** one person, the hoshigo(s) they saved or loved that week */
  | { type: "person"; kind: ItemKind; at: string; who: NewsPerson; items: Hoshigo[] }
  /** many people: one line per hoshigo, naming who */
  | { type: "item"; kind: ItemKind; at: string; item: Hoshigo; people: NewsPerson[] }
  | { type: "bundle"; kind: "follower" | "accepted"; at: string; people: NewsPerson[] };

const lineAt = (l: NewsLine) => (l.type === "one" ? l.event.at : l.at);

/**
 * Lines per week, newest first. Saves and loves always name the hoshigo: per person ("Julia
 * saved Perfect Days and The Remains of the Day for someday."), and from `many` people in a
 * week per hoshigo instead ("Perfect Days was saved for someday by Mark, Julia and 4 others.").
 * Followers and new friends bundle from `many` too. Requests are never bundled.
 */
export function bundle(events: NewsEvent[], many = 5): { week: string; lines: NewsLine[] }[] {
  const weeks = new Map<string, NewsEvent[]>();
  events.forEach((e) => {
    const w = weekOf(e.at);
    weeks.set(w, [...(weeks.get(w) ?? []), e]);
  });
  return [...weeks.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([week, list]) => {
      const lines: NewsLine[] = [];
      const byKind = new Map<NewsKind, NewsEvent[]>();
      list.forEach((e) => byKind.set(e.kind, [...(byKind.get(e.kind) ?? []), e]));
      for (const [kind, evs] of byKind) {
        const people = [...new Map(evs.map((e) => [e.who.id, e.who])).values()];
        if (kind === "saved" || kind === "loved") {
          const withItem = evs.filter((e) => e.item);
          if (people.length >= many) {
            const byItem = new Map<string, NewsEvent[]>();
            withItem.forEach((e) => byItem.set(e.item!.id, [...(byItem.get(e.item!.id) ?? []), e]));
            byItem.forEach((es) =>
              lines.push({ type: "item", kind, at: es[0].at, item: es[0].item!, people: [...new Map(es.map((e) => [e.who.id, e.who])).values()] })
            );
          } else {
            const byWho = new Map<string, NewsEvent[]>();
            withItem.forEach((e) => byWho.set(e.who.id, [...(byWho.get(e.who.id) ?? []), e]));
            byWho.forEach((es) =>
              lines.push({ type: "person", kind, at: es[0].at, who: es[0].who, items: [...new Map(es.map((e) => [e.item!.id, e.item!])).values()] })
            );
          }
        } else if ((kind === "follower" || kind === "accepted") && people.length >= many) {
          lines.push({ type: "bundle", kind, at: evs[0].at, people });
        } else evs.forEach((event) => lines.push({ type: "one", event }));
      }
      lines.sort((a, b) => lineAt(b).localeCompare(lineAt(a)));
      return { week, lines };
    });
}

/** For the weekly email: how many people saved or loved your hoshigos in the last 7 days. */
export async function weekCounts(admin: SupabaseClient, me: string): Promise<{ saved: number; loved: number }> {
  const events = await newsEvents(admin, me, 7);
  const count = (k: NewsKind) => new Set(events.filter((e) => e.kind === k).map((e) => e.who.id)).size;
  return { saved: count("saved"), loved: count("loved") };
}
