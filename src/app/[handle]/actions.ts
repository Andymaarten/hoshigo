"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeUrl } from "@/lib/normalize-url";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in.");
  return { supabase, user };
}

// Only allow http(s) links — anything typed into these fields is later rendered as an
// <a href> / <img src>, so a "javascript:" or "data:" scheme here would run for every
// visitor who opens the link, not just the person who typed it.
function safeHttpUrl(raw: string): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

export async function addItem(handle: string, _prev: string | null, formData: FormData) {
  const { supabase, user } = await requireUser();

  const categoryId = Number(formData.get("category_id"));
  const title = String(formData.get("title") || "").trim();
  const by = String(formData.get("by") || "").trim();
  const yearRaw = String(formData.get("year") || "").trim();
  const url = String(formData.get("url") || "").trim();
  const imageUrl = String(formData.get("image_url") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const sourceLabel = String(formData.get("source_label") || "").trim();
  const workId = String(formData.get("work_id") || "").trim();

  if (!title || !categoryId) return "Title and category are required.";
  if (url && !safeHttpUrl(url)) return "That link doesn't look like a valid web address.";
  if (imageUrl && !safeHttpUrl(imageUrl)) return "That image URL doesn't look like a valid web address.";

  const { error } = await supabase.from("items").insert({
    profile_id: user.id,
    category_id: categoryId,
    work_id: workId || null,
    title,
    by: by || null,
    year: yearRaw ? Number(yearRaw) : null,
    url: url || null,
    // Confirmed-same-link identity for categories with no canonical database (essays,
    // things, etc.) — see docs/sources.md "Non-canonical categories: exact-link matching".
    // Deliberately not routed through work_id/match_confidence, which is for catalog identity.
    normalized_url: url ? normalizeUrl(url) : null,
    image_url: imageUrl || null,
    note: note || null,
    source_label: sourceLabel || null,
  });

  if (error) return error.message;

  revalidatePath(`/${handle}`);
  return null;
}

export async function updateItem(handle: string, _prev: string | null, formData: FormData) {
  const { supabase, user } = await requireUser();

  const itemId = String(formData.get("item_id") || "").trim();
  const categoryId = Number(formData.get("category_id"));
  const title = String(formData.get("title") || "").trim();
  const by = String(formData.get("by") || "").trim();
  const yearRaw = String(formData.get("year") || "").trim();
  const imageUrl = String(formData.get("image_url") || "").trim();
  const note = String(formData.get("note") || "").trim();

  if (!itemId) return "Missing item.";
  if (!title || !categoryId) return "Title and category are required.";
  if (imageUrl && !safeHttpUrl(imageUrl)) return "That image URL doesn't look like a valid web address.";

  const { error } = await supabase
    .from("items")
    .update({
      category_id: categoryId,
      title,
      by: by || null,
      year: yearRaw ? Number(yearRaw) : null,
      image_url: imageUrl || null,
      note: note || null,
    })
    .eq("id", itemId)
    .eq("profile_id", user.id);

  if (error) return error.message;

  revalidatePath(`/${handle}`);
  return null;
}

export async function deleteItem(handle: string, itemId: string) {
  const { supabase } = await requireUser();
  await supabase.from("items").delete().eq("id", itemId);
  revalidatePath(`/${handle}`);
}

export async function updateNote(handle: string, itemId: string, note: string) {
  const { supabase } = await requireUser();
  await supabase.from("items").update({ note: note || null }).eq("id", itemId);
  revalidatePath(`/${handle}`);
}

export async function setFeatured(handle: string, itemId: string, categoryId: number, profileId: string) {
  const { supabase } = await requireUser();
  await supabase.from("items").update({ featured: false }).eq("profile_id", profileId).eq("category_id", categoryId);
  await supabase.from("items").update({ featured: true }).eq("id", itemId);
  revalidatePath(`/${handle}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
