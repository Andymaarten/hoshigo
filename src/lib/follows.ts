import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// "unavailable" = the follows migration hasn't been run yet: no follow UI at all
export type FollowState = "following" | "none" | "unavailable";
export type PersonName = { handle: string; display_name: string | null };

export async function followStateWith(supabase: Supabase, me: string, other: string): Promise<FollowState> {
  const { data, error } = await supabase.from("follows").select("followee").eq("follower", me).eq("followee", other).maybeSingle();
  if (error) return "unavailable";
  return data ? "following" : "none";
}

/** Everyone I follow, or [] before the migration. */
export async function myFolloweeIds(supabase: Supabase, me: string): Promise<string[]> {
  const { data, error } = await supabase.from("follows").select("followee").eq("follower", me);
  return error ? [] : (data ?? []).map((r) => r.followee as string);
}

/** Only ever for the profile owner: who follows me. null before the migration. */
export async function myFollowers(supabase: Supabase, me: string): Promise<PersonName[] | null> {
  const { data, error } = await supabase.from("follows").select("follower").eq("followee", me);
  if (error) return null;
  // Friends are never listed as followers, even if an old follow row is still there.
  const { data: fr } = await supabase
    .from("friendships")
    .select("requester, addressee")
    .eq("status", "accepted")
    .or(`requester.eq.${me},addressee.eq.${me}`);
  const friendIds = new Set((fr ?? []).map((f) => (f.requester === me ? f.addressee : f.requester) as string));
  const ids = (data ?? []).map((r) => r.follower as string).filter((id) => !friendIds.has(id));
  if (!ids.length) return [];
  const { data: people } = await supabase.from("profiles").select("handle, display_name").in("id", ids);
  return ((people ?? []) as PersonName[]).sort((a, b) => (a.display_name || a.handle).localeCompare(b.display_name || b.handle));
}

/** A profile's friends as the database lets this viewer see them; null = not available. */
export async function friendsOf(supabase: Supabase, profileId: string): Promise<PersonName[] | null> {
  const { data, error } = await supabase.rpc("friends_of", { p_profile: profileId });
  return error ? null : ((data ?? []) as PersonName[]);
}

export type FriendsPage = { people: PersonName[]; total: number };

/**
 * One page of a profile's friends as this viewer may see them: mutual friends first, then by
 * name. null = not available (logged out, a private profile you're not friends with, or before
 * the migrations). Falls back to the older all at once friends_of() when the paged one is missing.
 */
export async function friendsPage(supabase: Supabase, profileId: string, limit: number, offset: number): Promise<FriendsPage | null> {
  const { data, error } = await supabase.rpc("friends_of_page", { p_profile: profileId, p_limit: limit, p_offset: offset });
  if (!error) {
    const rows = (data ?? []) as (PersonName & { total: number })[];
    return { people: rows.map(({ handle, display_name }) => ({ handle, display_name })), total: rows.length ? Number(rows[0].total) : offset };
  }
  const everyone = await friendsOf(supabase, profileId);
  return everyone ? { people: everyone.slice(offset, offset + limit), total: everyone.length } : null;
}
