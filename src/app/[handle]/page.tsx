import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Category, Item, Profile } from "@/lib/supabase/types";
import Link from "next/link";
import CategorySection from "./CategorySection";
import AddStamp from "./AddStamp";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import ProfileSocialLinks from "@/components/ProfileSocialLinks";
import FriendButton from "@/components/FriendButton";
import {
  friendStateWith,
  PUBLIC_WINDOW,
  type FriendState,
} from "@/lib/friends";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const supabase = await createClient();

  const [{ data: profile }, { data: categories }, { data: user }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("handle", handle)
        .returns<Profile[]>()
        .single(),
      supabase
        .from("categories")
        .select("*")
        .order("sort_order")
        .returns<Category[]>(),
      supabase.auth.getUser(),
    ]);

  if (!profile) notFound();

  const isOwner = user?.user?.id === profile.id;

  let myHandle: string | undefined;
  if (user?.user) {
    myHandle = isOwner
      ? profile.handle
      : (
          await supabase
            .from("profiles")
            .select("handle")
            .eq("id", user.user.id)
            .single()
        ).data?.handle;
  }

  let friendState: FriendState = "unavailable";
  if (user?.user && !isOwner)
    friendState = await friendStateWith(supabase, user.user.id, profile.id);
  const canBrowseAll = isOwner || friendState === "friends";

  // A private profile shows non-friends only its name, bio and the friend button.
  const hideAll = profile.is_private && !canBrowseAll;

  const { data: items } = hideAll
    ? { data: [] as Item[] }
    : await supabase
        .from("items")
        .select("*")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .returns<Item[]>();

  const itemsByCategory = new Map<number, Item[]>();
  (items ?? []).forEach((item) => {
    const list = itemsByCategory.get(item.category_id) ?? [];
    list.push(item);
    itemsByCategory.set(item.category_id, list);
  });

  // Non-friends only ever receive the newest 5 per category. After the friends migration RLS
  // already guarantees this; the slice keeps it true before the migration too.
  const categoriesWithMore = new Set<number>();
  if (!canBrowseAll && !hideAll) {
    const { data: more, error } = await supabase.rpc("categories_with_more", {
      p_profile: profile.id,
    });
    if (!error)
      (more as number[] | null)?.forEach((id) => categoriesWithMore.add(id));
    for (const [categoryId, list] of itemsByCategory) {
      if (list.length > PUBLIC_WINDOW) {
        categoriesWithMore.add(categoryId);
        itemsByCategory.set(categoryId, list.slice(0, PUBLIC_WINDOW));
      }
    }
  }

  const lock = !user?.user
    ? ({ kind: "login" } as const)
    : { kind: friendState, otherId: profile.id };
  const displayName = profile.display_name || profile.handle;

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
                星五
              </span>
              <span>[ho.ɕi.ɡo]</span>
              <i>noun</i>
            </div>
            <hr />
            <div className="def">
              <i>Japanese.</i> five stars.
            </div>
          </div>
          <SiteNav loggedIn={!!user?.user} handle={myHandle} />
        </div>
        {isOwner && <AddStamp handle={handle} categories={categories ?? []} />}
        <h1>{displayName}.</h1>
        <div className="bio-row">
          {profile.bio && <p className="bio">{profile.bio}</p>}
          {isOwner && (
            <Link href="/settings" className="edit-profile-link">
              Edit profile
            </Link>
          )}
        </div>
        {hideAll && !user?.user && (
          <p className="friend-actions">
            <Link
              href={`/login?next=${encodeURIComponent(`/${profile.handle}`)}`}
              className="btn"
            >
              Log in to add friend
            </Link>
          </p>
        )}
        {user?.user && !isOwner && (
          <FriendButton
            otherId={profile.id}
            handle={profile.handle}
            state={friendState}
            name={displayName}
          />
        )}
        <ProfileSocialLinks links={profile.social_links ?? []} />
      </header>

      <main id="lists">
        {(categories ?? [])
          .filter(
            (category) => (itemsByCategory.get(category.id) ?? []).length > 0,
          )
          .map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              items={itemsByCategory.get(category.id) ?? []}
              handle={handle}
              isOwner={isOwner}
              canBrowseAll={canBrowseAll}
              hasMore={categoriesWithMore.has(category.id)}
              lock={lock}
              allCategories={categories ?? []}
              isPrivate={profile.is_private}
            />
          ))}
        {isOwner && (items ?? []).length === 0 && (
          <p className="bio" style={{ marginTop: 40 }}>
            Nothing yet — press the red stamp above to add your first hoshigo.
          </p>
        )}
      </main>

      <SiteFooter loggedIn={!!user?.user} />
    </div>
  );
}
