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

  // Owner rule: a hoshigo without a catalog match must have a link, so visitors can find it.
  let linkedWork = false;
  if (workId) {
    const { data: work } = await supabase.from("works").select("id").eq("id", workId).maybeSingle();
    linkedWork = !!work;
  }
  if (!linkedWork && !url) return "Add a link so visitors can find it. Only things found in a catalog can go without one.";

  const { data: inserted, error } = await supabase.from("items").insert({
    profile_id: user.id,
    category_id: categoryId,
    work_id: linkedWork ? workId : null,
    title,
    by: by || null,
    year: /^\d{3,4}$/.test(yearRaw) ? Number(yearRaw) : null,
    url: url || null,
    // Confirmed-same-link identity for categories with no canonical database (essays,
    // things, etc.) — see docs/sources.md "Non-canonical categories: exact-link matching".
    // Deliberately not routed through work_id/match_confidence, which is for catalog identity.
    normalized_url: url ? normalizeUrl(url) : null,
    image_url: imageUrl || null,
    note: note || null,
    source_label: sourceLabel || null,
  }).select("id").single();

  if (error) return error.message;

  // The pin option is only shown once the pinning migration has run.
  if (formData.get("pin") === "on" && inserted?.id) {
    await supabase.rpc("pin_item", { p_item: inserted.id, p_pin: true });
  }

  await logClassificationFeedback(supabase, formData, url, categoryId);

  revalidatePath(`/${handle}`);
  return null;
}

// Learn from misclassified pasted links: one row when the person ended on another category
// than we detected, or pressed "change" at all. Never allowed to break saving, e.g. before
// the owner has created the table (docs/migrations/2026-09-23-classification-feedback.sql).
async function logClassificationFeedback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  url: string,
  categoryId: number
) {
  try {
    const path = String(formData.get("add_path") || "");
    const detectedSlug = String(formData.get("detected_slug") || "").slice(0, 40);
    const changedByUser = formData.get("changed_by_user") === "1";
    if (path !== "paste" || !url || !detectedSlug) return;
    const { data: cat } = await supabase.from("categories").select("slug").eq("id", categoryId).maybeSingle();
    const finalSlug = cat?.slug;
    if (!finalSlug || (finalSlug === detectedSlug && !changedByUser)) return;
    await supabase.from("classification_feedback").insert({
      url: url.slice(0, 2000),
      normalized_url: normalizeUrl(url),
      detected_slug: detectedSlug,
      detected_confidence: String(formData.get("detected_confidence") || "").slice(0, 10) || null,
      detected_reason: String(formData.get("detected_reason") || "").slice(0, 200) || null,
      final_slug: finalSlug,
      path: "paste",
      changed_by_user: changedByUser,
    });
  } catch {
    // logging only
  }
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
      // Unpinned first so moving a pinned listing into a category that has its own pin can't
      // collide; pin_item below puts the pin back (and moves it) in one step.
      ...(formData.get("pin_choice") === "1" ? { pinned: false } : {}),
    })
    .eq("id", itemId)
    .eq("profile_id", user.id);

  if (error) return error.message;

  if (formData.get("pin_choice") === "1") {
    await supabase.rpc("pin_item", { p_item: itemId, p_pin: formData.get("pin") === "on" });
  }

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
