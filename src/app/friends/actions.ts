"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { after } from "next/server";
import { myFriendships, type FriendState } from "@/lib/friends";
import { friendsPage, myFolloweeIds, type FollowState, type FriendsPage } from "@/lib/follows";
import { feedRows, shareableIds, withShareable, type FeedPage } from "@/lib/friends-feed";
import { notifyFriendRequest } from "@/lib/notify-friend-request";

const UUID_RE = /^[0-9a-f-]{36}$/i;

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function refresh(handle?: string) {
  revalidatePath("/friends");
  if (handle) revalidatePath(`/${handle}`);
}

export async function addFriend(otherId: string, handle?: string): Promise<FriendState> {
  const { supabase, user } = await session();
  if (!user || !UUID_RE.test(otherId)) return "none";
  const { data, error } = await supabase.rpc("request_friend", { target: otherId });
  refresh(handle);
  if (error) return "none";
  if (data === "pending") {
    // A waiting request also follows them (public profiles only; the database refuses the rest).
    // Before the follows migration this insert just fails quietly.
    await supabase.from("follows").insert({ follower: user.id, followee: otherId });
    const { data: me } = await supabase.from("profiles").select("handle, display_name").eq("id", user.id).single();
    if (me) after(() => notifyFriendRequest({ toId: otherId, fromName: me.display_name || me.handle, fromHandle: me.handle }));
  }
  return data === "friends" ? "friends" : data === "pending" ? "outgoing" : "none";
}

export async function acceptFriend(otherId: string, handle?: string): Promise<FriendState> {
  const { supabase, user } = await session();
  if (!user || !UUID_RE.test(otherId)) return "none";
  const { data } = await supabase.rpc("accept_friend", { other: otherId });
  refresh(handle);
  return data === "friends" ? "friends" : "none";
}

/** Decline a request, cancel my own request, or unfriend: all the same delete. */
export async function removeFriend(otherId: string, handle?: string): Promise<FriendState> {
  const { supabase, user } = await session();
  if (!user || !UUID_RE.test(otherId)) return "none";
  await supabase
    .from("friendships")
    .delete()
    .or(`and(requester.eq.${user.id},addressee.eq.${otherId}),and(requester.eq.${otherId},addressee.eq.${user.id})`);
  refresh(handle);
  return "none";
}

/** Pending incoming requests, for the badge in the nav. 0 on any error. */
export async function pendingRequestCount(): Promise<number> {
  const { supabase, user } = await session();
  if (!user) return 0;
  const { count, error } = await supabase
    .from("friendships")
    .select("requester", { count: "exact", head: true })
    .eq("addressee", user.id)
    .eq("status", "pending");
  return error ? 0 : count ?? 0;
}

export async function loadOlderFeed(categoryId: number | null, cursorAt: string, cursorId: string): Promise<FeedPage> {
  const { supabase, user } = await session();
  if (!user) return { items: [], hasOlder: false };
  const rel = await myFriendships(supabase, user.id);
  if (!rel) return { items: [], hasOlder: false };
  const people = [...new Set([...rel.friendIds, ...(await myFolloweeIds(supabase, user.id))])];
  const [page, ids] = await Promise.all([
    feedRows(supabase, people, categoryId, { at: cursorAt, id: cursorId }),
    shareableIds(supabase, people),
  ]);
  return { items: withShareable(page.items, ids), hasOlder: page.hasOlder };
}

export async function follow(otherId: string, handle?: string): Promise<FollowState> {
  const { supabase, user } = await session();
  if (!user || !UUID_RE.test(otherId)) return "none";
  const { error } = await supabase.from("follows").insert({ follower: user.id, followee: otherId });
  refresh(handle);
  return error && error.code !== "23505" ? "none" : "following";
}

export async function unfollow(otherId: string, handle?: string): Promise<FollowState> {
  const { supabase, user } = await session();
  if (!user || !UUID_RE.test(otherId)) return "none";
  await supabase.from("follows").delete().eq("follower", user.id).eq("followee", otherId);
  refresh(handle);
  return "none";
}

/** The next 20 names for a profile's friends line; the database decides what you may see. */
export async function moreFriends(profileId: string, offset: number): Promise<FriendsPage | null> {
  const { supabase, user } = await session();
  if (!user || !UUID_RE.test(profileId) || !Number.isInteger(offset) || offset < 0) return null;
  return friendsPage(supabase, profileId, 20, offset);
}
