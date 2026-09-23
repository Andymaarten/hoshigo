"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FriendState } from "@/lib/friends";

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
