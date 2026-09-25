import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import HeaderStamp from "@/components/HeaderStamp";
import Wordmark from "@/components/Wordmark";
import { sortCategories } from "@/lib/category-display";
import { myFriendships } from "@/lib/friends";
import { SOMEDAY } from "@/lib/someday";
import type { Category, Item } from "@/lib/supabase/types";
import SomedayList, { type SomedayRow } from "./SomedayList";
import AddStamp from "@/app/[handle]/AddStamp";

type Raw = {
  id: string;
  profile_id: string;
  from_profile_id: string | null;
  source_item_id: string | null;
  work_id: string | null;
  category_id: number;
  title: string;
  by: string | null;
  year: number | null;
  image_url: string | null;
  url: string | null;
  created_at: string;
};

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

export default async function SomedayPage({ searchParams }: { searchParams: Promise<{ of?: string }> }) {
  const { of } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = user ? await supabase.from("profiles").select("id, handle").eq("id", user.id).maybeSingle() : { data: null };
  const myHandle = (me?.handle as string | undefined) ?? undefined;

  // someone else's list (?of=handle), only when they made it visible; the database decides
  const other = of && of !== myHandle ? of : null;
  if (!other && !user) redirect(`/login?next=${encodeURIComponent(SOMEDAY.page)}`);
  let owner = { id: user?.id ?? "", handle: myHandle ?? "", name: myHandle ?? "" };
  if (other) {
    const { data: p } = await supabase.from("profiles").select("id, handle, display_name, someday_public").eq("handle", other).maybeSingle();
    if (!p || !p.someday_public) notFound();
    owner = { id: p.id as string, handle: p.handle as string, name: (p.display_name as string) || (p.handle as string) };
  }
  const mine = !other;

  const listQuery = (onlySaved: boolean) => {
    const q = supabase.from("someday_items").select("*").eq("profile_id", owner.id);
    return (onlySaved ? q.eq("status", "saved") : q).order("created_at", { ascending: false }).limit(500).returns<Raw[]>();
  };
  const [firstTry, { data: rawCats }] = await Promise.all([
    // only what's still saved; before the history migration every row is
    listQuery(true),
    supabase.from("categories").select("*").order("sort_order").returns<Category[]>(),
  ]);
  const { data: rows, error } = firstTry.error ? await listQuery(false) : firstTry;
  if (error && !mine) notFound();
  const categories = sortCategories(rawCats);
  const list = rows ?? [];

  // who each thing came from, and whether their listing is still there for you to open
  const fromIds = [...new Set(list.map((r) => r.from_profile_id).filter(Boolean) as string[])];
  const sourceIds = [...new Set(list.map((r) => r.source_item_id).filter(Boolean) as string[])];
  const [{ data: fromPeople }, { data: stillThere }, rel] = await Promise.all([
    fromIds.length ? supabase.from("profiles").select("id, handle, display_name").in("id", fromIds) : Promise.resolve({ data: [] }),
    // full rows: the card opens the original listing (with its note) while you may still see it
    sourceIds.length ? supabase.from("items").select("*").in("id", sourceIds).returns<Item[]>() : Promise.resolve({ data: [] as Item[] }),
    mine && user ? myFriendships(supabase, user.id) : Promise.resolve(null),
  ]);
  const personById = new Map((fromPeople ?? []).map((p) => [p.id as string, p]));
  const sourceById = new Map((stillThere ?? []).map((i) => [i.id, i]));

  // "Also a hoshigo for": your friends who keep the same thing (by catalog work, else by title)
  const alsoFor = new Map<string, { handle: string; name: string }[]>();
  if (rel?.friendIds.length && list.length) {
    const [{ data: friendItems }, { data: friendPeople }] = await Promise.all([
      supabase.from("items").select("profile_id, work_id, title, category_id").in("profile_id", rel.friendIds).limit(5000),
      supabase.from("profiles").select("id, handle, display_name").in("id", rel.friendIds),
    ]);
    const friendName = new Map((friendPeople ?? []).map((p) => [p.id as string, { handle: p.handle as string, name: (p.display_name as string) || (p.handle as string) }]));
    for (const r of list) {
      const who = new Map<string, { handle: string; name: string }>();
      for (const fi of friendItems ?? []) {
        const same = r.work_id ? fi.work_id === r.work_id : fi.category_id === r.category_id && norm(fi.title as string) === norm(r.title);
        const f = friendName.get(fi.profile_id as string);
        if (same && f) who.set(f.handle, f);
      }
      if (who.size) alsoFor.set(r.id, [...who.values()]);
    }
  }

  const items: SomedayRow[] = list.map((r) => {
    const from = r.from_profile_id ? personById.get(r.from_profile_id) : undefined;
    return {
      ...r,
      from: from
        ? {
            name: (from.display_name as string) || (from.handle as string),
            handle: from.handle as string,
            href: r.source_item_id && sourceById.has(r.source_item_id) ? `/${from.handle}/${r.source_item_id}` : `/${from.handle}`,
          }
        : null,
      // the person you saved it from is already named; only others here
      source: (r.source_item_id && sourceById.get(r.source_item_id)) || null,
      alsoFor: (alsoFor.get(r.id) ?? []).filter((f) => f.handle !== from?.handle),
    };
  });

  return (
    <div className="page">
      <header className="hero">
        <div className="masthead">
          <Wordmark handle={myHandle} />
          <SiteNav loggedIn={!!user} handle={myHandle} />
        </div>
        {user && <HeaderStamp />}
        <h1 style={{ fontSize: "clamp(40px,10vw,72px)" }}>{mine ? SOMEDAY.heading : SOMEDAY.othersHeading(owner.name)}</h1>
        {mine && !error && (
          <>
            <p className="bio">{SOMEDAY.intro}</p>
            {myHandle && (
              <div style={{ marginTop: 16 }}>
                <AddStamp handle={myHandle} categories={categories} destination="someday" />
              </div>
            )}
          </>
        )}
      </header>
      <main className="friends-main">
        {error ? (
          <p className="bio">This list is almost here. Check back soon.</p>
        ) : (
          // remounts when the server sends a new list (after saving through the dialog)
          <SomedayList key={items.map((i) => i.id).join()} rows={items} categories={categories} mine={mine} />
        )}
      </main>
      <SiteFooter loggedIn={!!user} handle={myHandle} />
    </div>
  );
}
