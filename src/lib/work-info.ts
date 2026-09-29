import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item } from "@/lib/supabase/types";
import { chooseOpenLink, cleanPrefs, groupForCategory, type LinkPrefs, type WorkLink } from "@/lib/platforms";

// What listing views need from each item's catalogue work: its source (for the "Powered by
// BGG" credit) and the viewer's "Open in …" link. A few queries for the whole list; items
// without a work are untouched. Missing tables or columns (before a migration) just give less.
export async function withWorkInfo<T extends Item>(supabase: SupabaseClient, items: T[], prefs: LinkPrefs = {}): Promise<T[]> {
  const ids = [...new Set(items.map((i) => i.work_id).filter((x): x is string => !!x))].slice(0, 1000);
  if (!ids.length) return items;
  const [works, links, cats] = await Promise.all([
    supabase.from("works").select("id, source, category_id").in("id", ids),
    supabase.from("work_links").select("work_id, platform, url, kind").in("work_id", ids),
    supabase.from("categories").select("id, slug"),
  ]);
  if (works.error || !works.data) return items;
  const slugById = new Map((cats.data ?? []).map((c: { id: number; slug: string }) => [c.id, c.slug]));
  const work = new Map(works.data.map((w: { id: string; source: string; category_id: number }) => [w.id, w]));
  const linksBy = new Map<string, WorkLink[]>();
  for (const l of (links.error ? [] : links.data ?? []) as (WorkLink & { work_id: string })[]) {
    linksBy.set(l.work_id, [...(linksBy.get(l.work_id) ?? []), { platform: l.platform, url: l.url, kind: l.kind }]);
  }
  return items.map((i) => {
    const w = i.work_id ? work.get(i.work_id) : undefined;
    if (!w) return i;
    const group = groupForCategory(slugById.get(i.category_id) ?? slugById.get(w.category_id));
    return { ...i, work_source: w.source, open_link: chooseOpenLink(linksBy.get(w.id) ?? [], group, prefs, i.url) };
  });
}

// The logged in viewer's "Open links in" choices; logged out viewers get the defaults.
export async function viewerLinkPrefs(supabase: SupabaseClient): Promise<LinkPrefs> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return {};
  const { data: row, error } = await supabase.from("profiles").select("link_prefs").eq("id", data.user.id).maybeSingle();
  return error ? {} : cleanPrefs(row?.link_prefs);
}
