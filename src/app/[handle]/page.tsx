import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ADD_COOKIE } from "@/lib/add-link";
import { createClient } from "@/lib/supabase/server";
import type { Category, Item, Profile } from "@/lib/supabase/types";
import Link from "next/link";
import CategorySection from "./CategorySection";
import AddStamp from "./AddStamp";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import ProfileSocialLinks from "@/components/ProfileSocialLinks";
import FriendButton from "@/components/FriendButton";
import FollowButton from "@/components/FollowButton";
import PeopleLine from "@/components/PeopleLine";
import FollowersLine from "@/components/FollowersLine";
import { followStateWith, friendsPage, myFollowers, type FollowState } from "@/lib/follows";
import {
  friendStateWith,
  PUBLIC_WINDOW,
  type FriendState,
} from "@/lib/friends";
import { sortCategories } from "@/lib/category-display";
import { compareForProfile } from "@/lib/item-order";
import { myPins } from "@/lib/add-context";
import HeaderStamp from "@/components/HeaderStamp";
import Wordmark from "@/components/Wordmark";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ adding?: string }>;
}) {
  const { handle } = await params;
  const { adding } = await searchParams;
  const supabase = await createClient();

  const [{ data: profile }, { data: rawCategories }, { data: user }] =
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
  const categories = sortCategories(rawCategories);

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

  // Follow: public profiles only, and pointless once you're friends. Friends list: logged in
  // visitors only (the database also hides a private profile's list from non friends).
  // Followers: only ever on your own page.
  const [followState, friendList, followers] = await Promise.all([
    user?.user && !isOwner && !profile.is_private && friendState !== "friends" && friendState !== "unavailable"
      ? followStateWith(supabase, user.user.id, profile.id)
      : Promise.resolve<FollowState>("unavailable"),
    user?.user ? friendsPage(supabase, profile.id, 3, 0) : Promise.resolve(null),
    isOwner ? myFollowers(supabase, profile.id) : Promise.resolve(null),
  ]);

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
  // pinned first, then newest; before the pinning migration nothing is pinned
  for (const list of itemsByCategory.values()) list.sort(compareForProfile);
  const pins = isOwner ? await myPins(supabase, profile.id) : null;

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
            <Wordmark handle={myHandle} />
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
        {isOwner && (
          <AddStamp
            handle={handle}
            categories={categories ?? []}
            // Arriving from /add?url=: open the dialog with that link (docs/add-link.md).
            initialAddLink={adding === "1" ? (await cookies()).get(ADD_COOKIE)?.value ?? "" : undefined}
            pins={pins}
          />
        )}
        {!isOwner && user?.user && <HeaderStamp />}
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
        <div className="profile-relation">
          {user?.user && !isOwner && (
            <div className="profile-actions">
              <FriendButton
                otherId={profile.id}
                handle={profile.handle}
                state={friendState}
                name={displayName}
              />
              <FollowButton otherId={profile.id} handle={profile.handle} state={followState} />
            </div>
          )}
          {friendList && <PeopleLine label="Friends" people={friendList.people} total={friendList.total} profileId={profile.id} />}
          {followers && <FollowersLine people={followers} />}
        </div>
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
              pins={pins}
            />
          ))}
        {isOwner && (items ?? []).length === 0 && (
          <p className="bio" style={{ marginTop: 40 }}>
            You haven&apos;t added any hoshigos yet. Press the red button to add your first!
          </p>
        )}
      </main>

      <SiteFooter loggedIn={!!user?.user} />
    </div>
  );
}
