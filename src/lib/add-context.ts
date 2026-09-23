import type { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/supabase/types";
import { sortCategories } from "@/lib/category-display";
import type { PinMap } from "@/lib/item-order";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** My current pins per category, or null before the pinning migration (then no pin UI). */
export async function myPins(supabase: Supabase, me: string): Promise<PinMap | null> {
  const { data, error } = await supabase.from("items").select("id, title, category_id").eq("profile_id", me).eq("pinned", true);
  if (error) return null;
  const pins: PinMap = {};
  (data ?? []).forEach((r) => {
    pins[r.category_id as number] = { id: r.id as string, title: r.title as string };
  });
  return pins;
}

/** Everything the add stamp needs for the logged in person, or null when there's no stamp. */
export async function addContext(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: me }, { data: cats }, pins] = await Promise.all([
    supabase.from("profiles").select("handle").eq("id", user.id).maybeSingle(),
    supabase.from("categories").select("*").order("sort_order").returns<Category[]>(),
    myPins(supabase, user.id),
  ]);
  const handle = me?.handle as string | undefined;
  if (!handle || handle.startsWith("user-")) return null;
  return { handle, categories: sortCategories(cats), pins };
}
