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
  const ids = (data ?? []).map((r) => r.follower as string);
  if (!ids.length) return [];
  const { data: people } = await supabase.from("profiles").select("handle, display_name").in("id", ids);
  return ((people ?? []) as PersonName[]).sort((a, b) => (a.display_name || a.handle).localeCompare(b.display_name || b.handle));
}

/** A profile's friends as the database lets this viewer see them; null = not available. */
export async function friendsOf(supabase: Supabase, profileId: string): Promise<PersonName[] | null> {
  const { data, error } = await supabase.rpc("friends_of", { p_profile: profileId });
  return error ? null : ((data ?? []) as PersonName[]);
}
