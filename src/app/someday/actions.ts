"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Item } from "@/lib/supabase/types";

const UUID_RE = /^[0-9a-f-]{36}$/i;

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Whether the someday table exists (the migration ran) for a logged in person. */
export async function somedayAvailable(): Promise<boolean> {
  const { supabase, user } = await session();
  if (!user) return false;
  const { error } = await supabase.from("someday_items").select("id", { head: true, count: "exact" }).eq("profile_id", user.id).limit(1);
  return !error;
}

/** For the save button: null = no button (logged out, your own, or before the migration). */
export async function somedayState(itemId: string): Promise<{ saved: boolean } | null> {
  const { supabase, user } = await session();
  if (!user || !UUID_RE.test(itemId)) return null;
  const { data: item } = await supabase.from("items").select("id, profile_id, work_id").eq("id", itemId).maybeSingle();
  if (!item || item.profile_id === user.id) return null;
  let q = supabase.from("someday_items").select("id").eq("profile_id", user.id).limit(1);
  q = item.work_id ? q.eq("work_id", item.work_id) : q.eq("source_item_id", item.id);
  const { data, error } = await q;
  if (error) return null;
  return { saved: (data ?? []).length > 0 };
}

/** Saves a snapshot of a listing you can see. Saving twice keeps one row. */
export async function saveForSomeday(itemId: string): Promise<boolean> {
  const { supabase, user } = await session();
  if (!user || !UUID_RE.test(itemId)) return false;
  // Read with the visitor's own rights: you can only save what you're allowed to see.
  const { data: item } = await supabase.from("items").select("*").eq("id", itemId).returns<Item[]>().maybeSingle();
  if (!item || item.profile_id === user.id) return false;
  const state = await somedayState(itemId);
  if (!state) return false;
  if (state.saved) return true;
  const { error } = await supabase.from("someday_items").insert({
    profile_id: user.id,
    from_profile_id: item.profile_id,
    source_item_id: item.id,
    work_id: item.work_id,
    category_id: item.category_id,
    title: item.title,
    by: item.by,
    year: item.year,
    image_url: item.image_url,
    url: item.url,
  });
  revalidatePath("/someday");
  return !error || error.code === "23505";
}

export async function removeSomeday(id: string): Promise<boolean> {
  const { supabase, user } = await session();
  if (!user || !UUID_RE.test(id)) return false;
  const { error } = await supabase.from("someday_items").delete().eq("id", id).eq("profile_id", user.id);
  revalidatePath("/someday");
  return !error;
}
