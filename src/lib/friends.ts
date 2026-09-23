import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// "unavailable" = the friends migration hasn't been run yet, so every friends feature hides itself
export type FriendState = "none" | "outgoing" | "incoming" | "friends" | "unavailable";

export const PUBLIC_WINDOW = 5;
export const INVITE_COOKIE = "hoshigo_invite";

interface FriendshipRow {
  requester: string;
  addressee: string;
  status: "pending" | "accepted";
  created_at: string;
  accepted_at: string | null;
}

export async function friendStateWith(supabase: Supabase, me: string, other: string): Promise<FriendState> {
  const { data, error } = await supabase
    .from("friendships")
    .select("requester, addressee, status")
    .or(`and(requester.eq.${me},addressee.eq.${other}),and(requester.eq.${other},addressee.eq.${me})`)
    .maybeSingle<Pick<FriendshipRow, "requester" | "addressee" | "status">>();
  if (error) return "unavailable";
  if (!data) return "none";
  if (data.status === "accepted") return "friends";
  return data.requester === me ? "outgoing" : "incoming";
}

/** All my friendship rows, or null when the table doesn't exist yet. */
export async function myFriendships(supabase: Supabase, me: string) {
  const { data, error } = await supabase
    .from("friendships")
    .select("requester, addressee, status, created_at, accepted_at")
    .or(`requester.eq.${me},addressee.eq.${me}`)
    .returns<FriendshipRow[]>();
  if (error) return null;
  const other = (f: FriendshipRow) => (f.requester === me ? f.addressee : f.requester);
  return {
    friendIds: data.filter((f) => f.status === "accepted").map(other),
    incomingIds: data.filter((f) => f.status === "pending" && f.addressee === me).map(other),
    outgoingIds: data.filter((f) => f.status === "pending" && f.requester === me).map(other),
  };
}

export async function myInviteToken(supabase: Supabase, me: string): Promise<string | null> {
  const existing = await supabase.from("friend_invites").select("token").eq("profile_id", me).maybeSingle();
  if (existing.error) return null;
  if (existing.data) return existing.data.token as string;
  const created = await supabase.from("friend_invites").insert({ profile_id: me }).select("token").single();
  return created.error ? null : (created.data.token as string);
}
