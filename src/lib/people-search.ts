import type { createClient } from "@/lib/supabase/server";
import { myFriendships } from "@/lib/friends";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type FoundPerson = { id: string; handle: string; name: string; relation: string | null };

/** Find people by name or handle, ignoring accents and case; with how they relate to you. */
export async function searchPeople(supabase: Supabase, me: string, rawQ: string): Promise<FoundPerson[]> {
  const q = rawQ.trim().toLowerCase().slice(0, 30);
  if (q.length < 2) return [];
  type P = { id: string; handle: string; display_name: string | null };
  let results: P[];
  const { data: found, error } = await supabase.rpc("search_people", { q });
  if (!error) {
    results = (found ?? []) as P[];
  } else {
    // Before the unaccent migration: widen letters that often carry accents to a one
    // character wildcard, then keep only real matches after stripping accents here.
    const plain = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    const needle = plain(q).replace(/[^\p{L}\p{N} .-]/gu, "");
    const pattern = `%${needle.replace(/[aeiouycns]/g, "_")}%`;
    const { data } = await supabase
      .from("profiles")
      .select("id, handle, display_name")
      .or(`handle.ilike.${pattern},display_name.ilike.${pattern}`)
      .neq("id", me)
      .not("handle", "like", "user-%")
      .order("handle")
      .limit(50)
      .returns<P[]>();
    results = (data ?? []).filter((p) => plain(p.handle).includes(needle) || plain(p.display_name ?? "").includes(needle)).slice(0, 10);
  }
  const rel = await myFriendships(supabase, me);
  const relation = (id: string) =>
    !rel ? null : rel.friendIds.includes(id) ? "friends" : rel.outgoingIds.includes(id) ? "request sent" : rel.incomingIds.includes(id) ? "wants to be friends" : null;
  return results.map((p) => ({ id: p.id, handle: p.handle, name: p.display_name || p.handle, relation: relation(p.id) }));
}
