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
  const lookup = (onlySaved: boolean) => {
    let q = supabase.from("someday_items").select("id").eq("profile_id", user.id).limit(1);
    if (onlySaved) q = q.eq("status", "saved");
    return item.work_id ? q.eq("work_id", item.work_id) : q.eq("source_item_id", item.id);
  };
  let { data, error } = await lookup(true);
  // before the history migration there is no status column
  if (error) ({ data, error } = await lookup(false));
  if (error) return null;
  return { saved: (data ?? []).length > 0 };
}

/** Saves a snapshot of a listing you can see. Saving twice keeps one row. */
/** The new row's id when saved (so a note can follow), true when it was already saved, false on failure. */
export async function saveForSomeday(itemId: string): Promise<string | boolean> {
  const { supabase, user } = await session();
  if (!user || !UUID_RE.test(itemId)) return false;
  // Read with the visitor's own rights: you can only save what you're allowed to see.
  const { data: item } = await supabase.from("items").select("*").eq("id", itemId).returns<Item[]>().maybeSingle();
  if (!item || item.profile_id === user.id) return false;
  // Saving twice is caught by the unique indexes (23505), so no lookup first.
  const { data: inserted, error } = await supabase.from("someday_items").insert({
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
  }).select("id").single();
  // no revalidatePath: it would re-render the page you're on (the whole Friends feed)
  if (error) return error.code === "23505";
  return (inserted?.id as string | undefined) ?? true;
}

/**
 * "Loved it" (after the add went through) or "Not a hoshigo". The row stays, marked, so we
 * learn what turned out to be five stars. Before the history migration it is deleted instead.
 */
export async function resolveSomeday(id: string, outcome: "loved" | "not_for_me"): Promise<boolean> {
  const { supabase, user } = await session();
  if (!user || !UUID_RE.test(id)) return false;
  let lovedItemId: string | null = null;
  if (outcome === "loved") {
    const { data: row } = await supabase.from("someday_items").select("work_id, title, category_id").eq("id", id).eq("profile_id", user.id).maybeSingle();
    if (row) {
      // the listing just added from this row: newest of mine for the same work, else same title
      let q = supabase.from("items").select("id").eq("profile_id", user.id).order("created_at", { ascending: false }).limit(1);
      q = row.work_id ? q.eq("work_id", row.work_id) : q.eq("category_id", row.category_id).eq("title", row.title);
      lovedItemId = ((await q).data?.[0]?.id as string | undefined) ?? null;
    }
  }
  const { error } = await supabase
    .from("someday_items")
    .update({ status: outcome, resolved_at: new Date().toISOString(), loved_item_id: lovedItemId })
    .eq("id", id)
    .eq("profile_id", user.id);
  if (error) {
    const del = await supabase.from("someday_items").delete().eq("id", id).eq("profile_id", user.id);
    revalidatePath("/someday");
    return !del.error;
  }
  revalidatePath("/someday");
  return true;
}

function httpUrl(raw: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

/** The add dialog in "someday" mode: the same review step, saved here instead of your page. */
export async function addToSomeday(_prev: string | null, formData: FormData): Promise<string | null> {
  const { supabase, user } = await session();
  if (!user) return "You need to be logged in.";
  const categoryId = Number(formData.get("category_id"));
  const title = String(formData.get("title") || "").trim();
  const url = String(formData.get("url") || "").trim();
  const image = String(formData.get("image_url") || "").trim();
  const workId = String(formData.get("work_id") || "").trim();
  const yearRaw = String(formData.get("year") || "").trim();
  if (!title || !categoryId) return "Title and category are required.";
  if (url && !httpUrl(url)) return "That link doesn't look like a valid web address.";
  if (image && !httpUrl(image)) return "That image link doesn't look like a valid web address.";
  const note = String(formData.get("someday_note") || "").trim().slice(0, 500);
  const row: Record<string, unknown> = {
    profile_id: user.id,
    category_id: categoryId,
    work_id: UUID_RE.test(workId) ? workId : null,
    title,
    by: String(formData.get("by") || "").trim() || null,
    year: /^\d{3,4}$/.test(yearRaw) ? Number(yearRaw) : null,
    url: url || null,
    image_url: image || null,
  };
  let { error } = await supabase.from("someday_items").insert(note ? { ...row, note } : row);
  // before the note migration there is no note column: save without it
  if (error && note && error.code !== "23505") ({ error } = await supabase.from("someday_items").insert(row));
  if (error && error.code !== "23505") return error.message;
  revalidatePath("/someday");
  return null;
}

/** Your own line on a saved card; empty clears it. */
export async function setSomedayNote(id: string, note: string): Promise<boolean> {
  const { supabase, user } = await session();
  if (!user || !UUID_RE.test(id)) return false;
  const clean = String(note ?? "").trim().slice(0, 500);
  const { error } = await supabase.from("someday_items").update({ note: clean || null }).eq("id", id).eq("profile_id", user.id);
  return !error;
}
