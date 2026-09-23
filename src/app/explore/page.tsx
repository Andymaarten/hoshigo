import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/supabase/types";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import MatchSection from "@/components/MatchSection";
import { sortCategories } from "@/lib/category-display";

const FAKE_PEOPLE = [
  { handle: "user2", displayName: "Mei Sato", bio: "Letterboxd completionist. I will talk about Bong Joon Ho unprompted." },
  { handle: "user3", displayName: "Jonas Bergström", bio: "Reads one more chapter than I should every night." },
  { handle: "user4", displayName: "Priya Nair", bio: "Podcasts on 2x, vinyl at 33⅓. Contradictions welcome." },
  { handle: "user5", displayName: "Tomás Rivera", bio: "Collector of things nobody else notices are beautiful." },
  { handle: "user6", displayName: "Anna Kowalski", bio: "Will fight you about the best Kieślowski film." },
  { handle: "user7", displayName: "Sam Okafor", bio: "Essays over novels, always. Newsletter addict." },
  { handle: "user8", displayName: "Lena Fischer", bio: "Album of the year lists start in January for me." },
  { handle: "user9", displayName: "Diego Fuentes", bio: "If it's not five stars it's not on the list." },
];

function placeholderMatches(categoryId: number) {
  return FAKE_PEOPLE.map((person, i) => {
    const seed = categoryId * 7 + i * 13;
    const pct = 62 + (seed % 35);
    return { ...person, matchPercent: pct };
  }).sort((a, b) => b.matchPercent - a.matchPercent);
}

export default async function ExplorePage() {
  const supabase = await createClient();
  const [{ data: user }, { data: rawCategories }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("categories").select("*").order("sort_order").returns<Category[]>(),
  ]);

  if (!user.user) redirect("/login");
  const categories = sortCategories(rawCategories);

  const myHandle = (await supabase.from("profiles").select("handle").eq("id", user.user.id).single()).data?.handle;

  return (
    <div className="page">
      <header className="hero">
        <div className="masthead">
          <div className="word" aria-label="hoshigo">
            hosh<span className="tittle">ı</span>go
          </div>
          <SiteNav loggedIn handle={myHandle} />
        </div>
        <div className="kicker">explore</div>
        <h1 style={{ fontSize: "clamp(40px,10vw,72px)" }}>find your taste twins.</h1>
        <p className="bio">
          People whose five stars line up with yours, by category. Matching isn&apos;t live yet — these are placeholder
          results.
        </p>
      </header>

      <main>
        {(categories ?? []).map((category) => (
          <MatchSection
            key={category.id}
            categorySlug={category.slug}
            categoryLabel={category.label}
            matches={placeholderMatches(category.id)}
          />
        ))}
      </main>

      <SiteFooter loggedIn />
    </div>
  );
}
