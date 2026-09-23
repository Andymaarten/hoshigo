import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import CoverImage from "@/components/CoverImage";
import FriendButton from "@/components/FriendButton";
import InviteLink from "@/components/InviteLink";
import { SHAPE } from "@/lib/category-display";
import { myFriendships, myInviteToken } from "@/lib/friends";
import type { Category, Item, Profile } from "@/lib/supabase/types";
import { sortCategories } from "@/lib/category-display";

const PAGE_SIZE = 30;

type Person = Pick<Profile, "id" | "handle" | "display_name">;

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

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
  const before = one(sp.before);

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
        <div className="word" aria-label="hoshigo">
          hosh<span className="tittle">ı</span>go
        </div>
        <SiteNav loggedIn handle={myHandle} />
      </div>
      <div className="kicker">
        <span className="dot" aria-hidden="true" />
        friends
      </div>
      <h1 style={{ fontSize: "clamp(40px,10vw,72px)" }}>friends.</h1>
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

  const peopleIds = [...new Set([...rel.friendIds, ...rel.incomingIds])];
  const [{ data: people }, inviteToken] = await Promise.all([
    peopleIds.length
      ? supabase.from("profiles").select("id, handle, display_name").in("id", peopleIds).returns<Person[]>()
      : Promise.resolve({ data: [] as Person[] }),
    myInviteToken(supabase, user.id),
  ]);
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  const incoming = rel.incomingIds.map((id) => byId.get(id)).filter((p): p is Person => !!p);
  const friends = rel.friendIds
    .map((id) => byId.get(id))
    .filter((p): p is Person => !!p)
    .sort((a, b) => name(a).localeCompare(name(b)));

  let results: Person[] = [];
  if (q.length >= 2) {
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const { data } = await supabase
      .from("profiles")
      .select("id, handle, display_name")
      .ilike("handle", pattern)
      .neq("id", user.id)
      .not("handle", "like", "user-%")
      .order("handle")
      .limit(10)
      .returns<Person[]>();
    results = data ?? [];
  }
  const relation = (id: string) =>
    rel.friendIds.includes(id) ? "friends" : rel.outgoingIds.includes(id) ? "request sent" : rel.incomingIds.includes(id) ? "wants to be friends" : null;

  const activeCat = (categories ?? []).find((c) => c.slug === catSlug);
  let feed: Item[] = [];
  let hasOlder = false;
  if (rel.friendIds.length) {
    let query = supabase
      .from("items")
      .select("*")
      .in("profile_id", rel.friendIds)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE + 1);
    if (activeCat) query = query.eq("category_id", activeCat.id);
    const [beforeAt, beforeId] = before.split("_");
    if (beforeAt && !Number.isNaN(Date.parse(beforeAt)) && /^[0-9a-f-]{36}$/i.test(beforeId ?? "")) {
      query = query.or(`created_at.lt."${beforeAt}",and(created_at.eq."${beforeAt}",id.lt.${beforeId})`);
    }
    const { data } = await query.returns<Item[]>();
    feed = (data ?? []).slice(0, PAGE_SIZE);
    hasOlder = (data ?? []).length > PAGE_SIZE;
  }
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const catById = new Map((categories ?? []).map((c) => [c.id, c]));
  const filterHref = (slug?: string) => (slug ? `/friends?cat=${slug}` : "/friends");
  const olderHref =
    hasOlder && feed.length
      ? `/friends?${new URLSearchParams({ ...(activeCat ? { cat: activeCat.slug } : {}), before: `${feed[feed.length - 1].created_at}_${feed[feed.length - 1].id}` })}`
      : null;

  return (
    <div className="page">
      {header}

      <main className="friends-main">
        {incoming.length > 0 && (
          <section aria-labelledby="h-requests" className="friends-block">
            <h2 id="h-requests">requests</h2>
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

        <section aria-labelledby="h-latest" className="friends-block">
          <h2 id="h-latest">latest from friends</h2>
          <nav className="chip-row" aria-label="Filter by category" style={{ marginBottom: 18 }}>
            <Link href={filterHref()} className={`chip${!activeCat ? " active" : ""}`} aria-current={!activeCat ? "page" : undefined}>
              all
            </Link>
            {(categories ?? []).map((c) => (
              <Link
                key={c.id}
                href={filterHref(c.slug)}
                className={`chip${activeCat?.id === c.id ? " active" : ""}`}
                aria-current={activeCat?.id === c.id ? "page" : undefined}
              >
                {c.label}
              </Link>
            ))}
          </nav>

          {friends.length === 0 ? (
            <p className="bio">Once you have friends, what they add shows up here, newest first.</p>
          ) : feed.length === 0 ? (
            <p className="bio">{before ? "Nothing older." : `No ${activeCat ? activeCat.label : "additions"} from friends yet.`}</p>
          ) : (
            <ul className="feed-list">
              {feed.map((item) => {
                const friend = byId.get(item.profile_id);
                const cat = catById.get(item.category_id);
                const shape = cat ? SHAPE[cat.slug] : undefined;
                return (
                  <li key={item.id} className="feed-row">
                    <div className={`thumb${shape === "tall" ? " tall" : ""}`} aria-hidden="true">
                      <CoverImage src={item.image_url} small />
                    </div>
                    <div className="feed-txt">
                      <span className="title">{item.title}</span>
                      {item.by && <span className="by">{item.by}</span>}
                      <span className="feed-meta">
                        {friend && (
                          <Link href={`/${friend.handle}`} className="feed-friend">
                            {name(friend)}
                          </Link>
                        )}
                        {cat && <span>{cat.label}</span>}
                        <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {olderHref && (
            <Link href={olderHref} className="btn load-more">
              Older
            </Link>
          )}
        </section>

        <section aria-labelledby="h-find" className="friends-block">
          <h2 id="h-find">find people</h2>
          <form action="/friends" className="friend-search">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="q">Search by page name</label>
              <input id="q" name="q" type="search" defaultValue={q} placeholder="their page name, like hoshigo.cc/name" autoCapitalize="off" spellCheck={false} />
            </div>
            <button type="submit" className="btn">
              Search
            </button>
          </form>
          {q.length >= 2 &&
            (results.length === 0 ? (
              <p className="bio">Nobody found for &ldquo;{q}&rdquo;.</p>
            ) : (
              <ul className="friend-list">
                {results.map((p) => (
                  <li key={p.id}>
                    <Link href={`/${p.handle}`} className="friend-row">
                      <span className="friend-name">{name(p)}</span>
                      <span className="friend-handle">@{p.handle}</span>
                      {relation(p.id) && <span className="friend-tagline">{relation(p.id)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            ))}

          {inviteToken && <InviteLink url={`${origin}/invite/${inviteToken}`} />}
        </section>

        {friends.length > 0 && (
          <section aria-labelledby="h-friends" className="friends-block">
            <h2 id="h-friends">your friends</h2>
            <ul className="friend-list">
              {friends.map((p) => (
                <li key={p.id}>
                  <Link href={`/${p.handle}`} className="friend-row">
                    <span className="friend-name">{name(p)}</span>
                    <span className="friend-handle">@{p.handle}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <SiteFooter loggedIn />
    </div>
  );
}
