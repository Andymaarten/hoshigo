import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/supabase/types";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import MatchRow from "@/components/MatchRow";

const FAKE_PEOPLE = [
  { handle: "user2", displayName: "Mei Sato" },
  { handle: "user3", displayName: "Jonas Bergström" },
  { handle: "user4", displayName: "Priya Nair" },
  { handle: "user5", displayName: "Tomás Rivera" },
];

function placeholderMatches(categoryId: number) {
  return FAKE_PEOPLE.map((person, i) => {
    const seed = categoryId * 7 + i * 13;
    const pct = 62 + (seed % 35);
    return { ...person, matchPercent: pct };
  })
    .sort((a, b) => b.matchPercent - a.matchPercent)
    .slice(0, 3);
}

export default async function ExplorePage() {
  const supabase = await createClient();
  const [{ data: user }, { data: categories }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("categories").select("*").order("sort_order").returns<Category[]>(),
  ]);

  const myHandle = user?.user
    ? (await supabase.from("profiles").select("handle").eq("id", user.user.id).single()).data?.handle
    : undefined;

  return (
    <div className="page">
      <header className="hero">
        <div className="masthead">
          <div className="word" aria-label="hoshigo">
            hosh<span className="tittle">ı</span>go
          </div>
          <SiteNav loggedIn={!!user?.user} handle={myHandle} />
        </div>
        <div className="kicker">
          <span className="dot" aria-hidden="true" />
          explore
        </div>
        <h1 style={{ fontSize: "clamp(40px,10vw,72px)" }}>find your taste twins.</h1>
        <p className="bio">
          People whose five stars line up with yours, by category. Matching isn&apos;t live yet — these are placeholder
          results.
        </p>
      </header>

      <main>
        {(categories ?? []).map((category) => (
          <section key={category.id} aria-labelledby={`explore-${category.slug}`}>
            <h2 id={`explore-${category.slug}`}>{category.label}</h2>
            <ul className="match-list">
              {placeholderMatches(category.id).map((m) => (
                <MatchRow key={m.handle} handle={m.handle} displayName={m.displayName} matchPercent={m.matchPercent} />
              ))}
            </ul>
          </section>
        ))}
      </main>

      <SiteFooter loggedIn={!!user?.user} />
    </div>
  );
}
