import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import SiteNav from "@/components/SiteNav";
import HeaderStamp from "@/components/HeaderStamp";
import SiteFooter from "@/components/SiteFooter";
import FriendButton from "@/components/FriendButton";
import InviteLink from "@/components/InviteLink";
import FriendRows from "./FriendRows";
import PeopleSearch from "./PeopleSearch";
import { searchPeople } from "@/lib/people-search";
import FriendsFeed, { type FeedFriend } from "./FriendsFeed";
import { feedRows, shareableIds, withShareable, type FeedPage } from "@/lib/friends-feed";
import { myFolloweeIds } from "@/lib/follows";
import { myFriendships, myInviteToken } from "@/lib/friends";
import type { Category, Profile } from "@/lib/supabase/types";
import { sortCategories } from "@/lib/category-display";
import Wordmark from "@/components/Wordmark";

type Person = Pick<Profile, "id" | "handle" | "display_name" | "is_private">;

function name(p: Person) {
  return p.display_name || p.handle;
}

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(sp.q).trim().toLowerCase().slice(0, 30);
  const catSlug = one(sp.cat);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/friends");

  const [{ data: me }, { data: rawCategories }, rel] = await Promise.all([
    supabase.from("profiles").select("handle").eq("id", user.id).single(),
    supabase.from("categories").select("*").order("sort_order").returns<Category[]>(),
    myFriendships(supabase, user.id),
  ]);
  const myHandle = me?.handle as string | undefined;
  const categories = sortCategories(rawCategories);

  const header = (
    <header className="hero">
      <div className="masthead">
        <Wordmark handle={myHandle} />
        <SiteNav loggedIn handle={myHandle} />
      </div>
      <HeaderStamp />
      <h1 style={{ fontSize: "clamp(40px,10vw,72px)" }}>your friends.</h1>
    </header>
  );

  if (!rel) {
    return (
      <div className="page">
        {header}
        <main>
          <p className="bio">Friends are almost here. Check back soon.</p>
      </main>
        <SiteFooter loggedIn />
      </div>
    );
  }

  const followeeIds = (await myFolloweeIds(supabase, user.id)).filter((id) => !rel.friendIds.includes(id));
  // whose keeps show in the feed: friends, and people you follow (public window only, by RLS)
  const feedIds = [...rel.friendIds, ...followeeIds];
  const peopleIds = [...new Set([...rel.friendIds, ...rel.incomingIds, ...followeeIds])];
  const [{ data: people }, inviteToken] = await Promise.all([
    peopleIds.length
      ? supabase.from("profiles").select("id, handle, display_name, is_private").in("id", peopleIds).returns<Person[]>()
      : Promise.resolve({ data: [] as Person[] }),
    myInviteToken(supabase, user.id),
  ]);
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  const incoming = rel.incomingIds.map((id) => byId.get(id)).filter((p): p is Person => !!p);
  const friends = rel.friendIds
    .map((id) => byId.get(id))
    .filter((p): p is Person => !!p)
    .sort((a, b) => name(a).localeCompare(name(b)));

  const results = await searchPeople(supabase, user.id, q);

  const feedFriends: Record<string, FeedFriend> = {};
  feedIds.forEach((id) => {
    const p = byId.get(id);
    if (p) feedFriends[p.id] = { handle: p.handle, name: name(p), isPrivate: p.is_private };
  });
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  return (
    <div className="page">
      {header}

      <main className="friends-main">

        <section aria-labelledby="h-friends" className="friends-block">
          <h2 id="h-friends" className="sr-only">your friends</h2>
          {friends.length === 0 ? (
            <p className="bio">No friends yet. Find people below, or send them your invite link.</p>
          ) : (
            <FriendRows people={friends.map((p) => ({ id: p.id, handle: p.handle, name: name(p) }))} />
          )}
        </section>

        {incoming.length > 0 && (
          <section aria-labelledby="h-requests" className="friends-block">
            <h2 id="h-requests" className="block-label">
              {incoming.length === 1 ? "friend request" : "friend requests"}
            </h2>
            <ul className="friend-list">
              {incoming.map((p) => (
                <li key={p.id} className="friend-row">
                  <Link href={`/${p.handle}`} className="friend-name">
                    {name(p)}
                  </Link>
                  <span className="friend-handle">@{p.handle}</span>
                  <FriendButton otherId={p.id} handle={p.handle} state="incoming" name={name(p)} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="h-find" className="friends-block">
          <h2 id="h-find">find people</h2>
          <PeopleSearch initialQ={q} initialResults={results} />

          {inviteToken && <InviteLink url={`${origin}/invite/${inviteToken}`} />}
        </section>

        <section aria-labelledby="h-latest" className="friends-block">
          <h2 id="h-latest">latest from your friends and people you follow</h2>
          {feedIds.length === 0 ? (
            <p className="bio">When your friends or people you follow keep something, it appears here, newest first. That&apos;s all.</p>
          ) : (
            <Suspense fallback={<p className="bio">Gathering what your friends kept…</p>}>
              <FeedSection supabase={supabase} friendIds={feedIds} categories={categories} friends={feedFriends} initialSlug={catSlug} />
            </Suspense>
          )}
        </section>
      </main>

      <SiteFooter loggedIn />
    </div>
  );
}

// Streamed separately so your friends, requests and search show before the feed queries finish.
async function FeedSection({
  supabase,
  friendIds,
  categories,
  friends,
  initialSlug,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  friendIds: string[];
  categories: Category[];
  friends: Record<string, FeedFriend>;
  initialSlug: string;
}) {
  // Every filter's first page is loaded up front so the chips switch without a round trip.
  const filters: { key: string; id: number | null }[] = [{ key: "all", id: null }, ...categories.map((c) => ({ key: c.slug, id: c.id }))];
  const [firstPages, shareIds] = await Promise.all([
    Promise.all(filters.map((f) => feedRows(supabase, friendIds, f.id))),
    shareableIds(supabase, friendIds),
  ]);
  const initialFeed: Record<string, FeedPage> = {};
  filters.forEach((f, i) => {
    initialFeed[f.key] = { items: withShareable(firstPages[i].items, shareIds), hasOlder: firstPages[i].hasOlder };
  });
  return <FriendsFeed categories={categories} initial={initialFeed} friends={friends} initialSlug={initialSlug} />;
}
