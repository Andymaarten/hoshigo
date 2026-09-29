import { redirect } from "next/navigation";
import Link from "next/link";
import { Fragment } from "react";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import Wordmark from "@/components/Wordmark";
import FriendButton from "@/components/FriendButton";
import { bundle, newsEvents, weekOf, type NewsLine, type NewsPerson } from "@/lib/news";
import { NEWS } from "@/lib/news-copy";
import NewsSeen from "./NewsSeen";

const WEEKS_PER_PAGE = 6;

function Person({ p }: { p: NewsPerson }) {
  return (
    <Link href={`/${p.handle}`} className="feed-friend">
      {p.name}
    </Link>
  );
}

function names(people: NewsPerson[], count: number) {
  const shown = people.slice(0, 2);
  const rest = count - shown.length;
  return (
    <>
      {shown.map((p, i) => (
        <Fragment key={p.id}>
          {i > 0 && (i === shown.length - 1 && rest <= 0 ? " and " : ", ")}
          <Person p={p} />
        </Fragment>
      ))}
      {rest > 0 && ` and ${NEWS.others(rest)}`}
    </>
  );
}

function Line({ line, myHandle, thisWeek }: { line: NewsLine; myHandle: string; thisWeek: boolean }) {
  const item = (id: string, title: string) => <Link href={`/${myHandle}/${id}`}>{title}</Link>;
  if (line.type === "one") {
    const { event: e } = line;
    if (e.kind === "request")
      return <FriendButton otherId={e.who.id} handle={e.who.handle} state="incoming" name={e.who.name} />;
    return (
      <p className="news-line">
        <Person p={e.who} />{" "}
        {e.kind === "accepted" && NEWS.accepted}
        {e.kind === "follower" && NEWS.follower}
        {e.kind === "saved" && e.item && (
          <>
            {NEWS.saved} {item(e.item.id, e.item.title)} {NEWS.savedTail}
          </>
        )}
        {e.kind === "loved" && e.item && (
          <>
            {NEWS.loved} {item(e.item.id, e.item.title)} {NEWS.lovedTail}
          </>
        )}
      </p>
    );
  }
  const titles = (items: { id: string; title: string }[]) =>
    items.map((it, i) => (
      <Fragment key={it.id}>
        {i > 0 && (i === items.length - 1 ? " and " : ", ")}
        {item(it.id, it.title)}
      </Fragment>
    ));
  if (line.type === "person") {
    return (
      <p className="news-line">
        <Person p={line.who} /> {line.kind === "saved" ? NEWS.saved : NEWS.loved} {titles(line.items)}{" "}
        {line.kind === "saved" ? NEWS.savedTail : NEWS.lovedThem(line.items.length)}
      </p>
    );
  }
  if (line.type === "item") {
    return (
      <p className="news-line">
        {item(line.item.id, line.item.title)} {line.kind === "saved" ? NEWS.wasSaved : NEWS.wasLoved} {names(line.people, line.people.length)}.
      </p>
    );
  }
  const tail = NEWS.weekTail(thisWeek);
  return (
    <p className="news-line">
      {line.kind === "follower" && (
        <>
          {NEWS.bundleFollowers(line.people.length)}
          {tail}
        </>
      )}
      {line.kind === "accepted" && (
        <>
          {names(line.people, line.people.length)} {NEWS.bundleAccepted}
          {tail}
        </>
      )}
    </p>
  );
}

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageRaw } = await searchParams;
  const page = Math.max(0, Math.floor(Number(pageRaw) || 0));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/news");
  const myHandle = ((await supabase.from("profiles").select("handle").eq("id", user.id).maybeSingle()).data?.handle as string | undefined) ?? "";

  const admin = adminClient();
  const weeks = admin ? bundle(await newsEvents(admin, user.id)) : null;
  const thisWeek = weekOf(new Date().toISOString());
  const lastWeek = weekOf(new Date(Date.parse(`${thisWeek}T12:00:00Z`) - 7 * 86400000).toISOString());
  const shown = weeks?.slice(page * WEEKS_PER_PAGE, (page + 1) * WEEKS_PER_PAGE) ?? [];
  const label = (w: string) =>
    w === thisWeek ? NEWS.thisWeek : w === lastWeek ? NEWS.lastWeek : NEWS.weekOf(new Date(`${w}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long" }));
  const firstEarlier = shown.findIndex((w) => w.week !== thisWeek && w.week !== lastWeek);

  return (
    <div className="page">
      <header className="hero">
        <div className="masthead">
          <Wordmark handle={myHandle} />
          <SiteNav loggedIn handle={myHandle} />
        </div>
        <h1 style={{ fontSize: "clamp(40px,10vw,72px)" }}>{NEWS.heading}</h1>
        <p className="bio">{NEWS.onlyYou}</p>
      </header>
      <main className="friends-main someday-main">
        {!weeks ? (
          <p className="bio">{NEWS.missing}</p>
        ) : weeks.length === 0 ? (
          <p className="bio">{NEWS.empty}</p>
        ) : (
          <div>
            {shown.map((w, i) => (
              <section key={w.week} className="news-week">
                {i === firstEarlier && page === 0 && <h2 className="news-earlier">{NEWS.earlier}</h2>}
                <h3 className="block-label">{label(w.week)}</h3>
                <ul className="news-list">
                  {w.lines.map((line, j) => (
                    <li key={j}>
                      <Line line={line} myHandle={myHandle} thisWeek={w.week === thisWeek} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <div className="sheet-row" style={{ marginTop: 20 }}>
              {page > 0 && (
                <Link href={page === 1 ? "/news" : `/news?page=${page - 1}`} className="btn btn-small">
                  {NEWS.newer}
                </Link>
              )}
              {weeks.length > (page + 1) * WEEKS_PER_PAGE && (
                <Link href={`/news?page=${page + 1}`} className="btn btn-small">
                  {NEWS.older}
                </Link>
              )}
            </div>
            <NewsSeen />
          </div>
        )}
      </main>
      <SiteFooter loggedIn handle={myHandle} />
    </div>
  );
}
