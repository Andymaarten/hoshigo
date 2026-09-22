import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Category, Item, Profile } from "@/lib/supabase/types";
import CategorySection from "./CategorySection";
import AddStamp from "./AddStamp";
import { signOut } from "./actions";

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const supabase = await createClient();

  const [{ data: profile }, { data: categories }, { data: user }] = await Promise.all([
    supabase.from("profiles").select("*").eq("handle", handle).returns<Profile[]>().single(),
    supabase.from("categories").select("*").order("sort_order").returns<Category[]>(),
    supabase.auth.getUser(),
  ]);

  if (!profile) notFound();

  const isOwner = user?.user?.id === profile.id;

  const { data: items } = await supabase
    .from("items")
    .select("*")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .returns<Item[]>();

  const itemsByCategory = new Map<number, Item[]>();
  (items ?? []).forEach((item) => {
    const list = itemsByCategory.get(item.category_id) ?? [];
    list.push(item);
    itemsByCategory.set(item.category_id, list);
  });

  return (
    <div className="page">
      <header className="hero">
        <div className="masthead">
          <div className="entry">
            <div className="word" aria-label="hoshigo">
              hosh<span className="tittle">ı</span>go
            </div>
            <div className="gloss">
              <span className="ja" lang="ja">
                星5
              </span>
              <span>[ho.ɕi.ɡo]</span>
              <i>noun</i>
            </div>
            <hr />
            <div className="def">
              <i>Japanese.</i> five stars.
            </div>
          </div>
          <nav className="menu" aria-label="Main">
            <Link href="/about">
              <span>About</span>
            </Link>
            {isOwner ? (
              <form action={signOut}>
                <button type="submit" className="btn">
                  Log out
                </button>
              </form>
            ) : (
              <Link href="/login" className="btn">
                Start your hoshigo
              </Link>
            )}
          </nav>
        </div>
        {isOwner && <AddStamp handle={handle} categories={categories ?? []} />}
        <h1>{profile.display_name || profile.handle}.</h1>
        <p className="lede">Five five-stars per list.</p>
        {profile.bio && <p className="bio">{profile.bio}</p>}
      </header>

      <main>
        {(categories ?? [])
          .filter((category) => (itemsByCategory.get(category.id) ?? []).length > 0)
          .map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              items={itemsByCategory.get(category.id) ?? []}
              handle={handle}
              isOwner={isOwner}
            />
          ))}
        {isOwner && (items ?? []).length === 0 && (
          <p className="bio" style={{ marginTop: 40 }}>
            Nothing yet — press the red stamp above to add your first hoshigo.
          </p>
        )}
      </main>

      <footer>
        <div className="inner">
          <p>Keep your own five-star page.</p>
          <Link href="/login" className="cta">
            Start your hoshigo
          </Link>
        </div>
      </footer>
    </div>
  );
}
