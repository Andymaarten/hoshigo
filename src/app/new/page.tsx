import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import Wordmark from "@/components/Wordmark";
import { formatDay, type ChangelogEntry } from "@/lib/changelog";

export const metadata: Metadata = { title: "What's new on hoshigo" };

export default async function NewPage() {
  const supabase = await createClient();
  const [{ data: auth }, { data, error }] = await Promise.all([
    supabase.auth.getUser(),
    // the database only returns public, visible entries
    supabase.from("changelog_entries").select("*").order("shipped_on", { ascending: false }).order("created_at", { ascending: false }).limit(300),
  ]);
  const user = auth.user;
  const myHandle = user ? ((await supabase.from("profiles").select("handle").eq("id", user.id).maybeSingle()).data?.handle as string | undefined) : undefined;

  const byDay = new Map<string, ChangelogEntry[]>();
  ((error ? [] : data ?? []) as ChangelogEntry[]).forEach((e) => byDay.set(e.shipped_on, [...(byDay.get(e.shipped_on) ?? []), e]));

  return (
    <div className="page">
      <header className="hero">
        <div className="masthead">
          <Wordmark handle={myHandle} />
          <SiteNav loggedIn={!!user} handle={myHandle} />
        </div>
        <div className="kicker">
          <span className="dot" aria-hidden="true" />
          what&apos;s new
        </div>
        <h1 style={{ fontSize: "clamp(40px,10vw,72px)" }}>what&apos;s new on hoshigo.</h1>
      </header>
      <main className="stats-main">
        {byDay.size === 0 ? (
          <p className="bio">Nothing written down here yet.</p>
        ) : (
          [...byDay.entries()].map(([d, list]) => (
            <section key={d} className="changelog-day">
              <h2 className="block-label">{formatDay(d)}</h2>
              <ul className="changelog-list">
                {list.map((e) => (
                  <li key={e.id}>
                    <p className="changelog-title">{e.title}</p>
                    {e.body && <p className="changelog-body">{e.body}</p>}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
      <SiteFooter loggedIn={!!user} handle={myHandle} />
    </div>
  );
}
