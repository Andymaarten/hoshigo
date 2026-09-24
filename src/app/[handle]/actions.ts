"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeUrl } from "@/lib/normalize-url";
import { placeLine } from "@/lib/place-fields";

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

// Place forms send Type and Location as their own fields. The combined line is still
// written to `by` so everything that reads it keeps working, also before the migration.
function placeFieldsFrom(formData: FormData) {
  if (!formData.has("place_type") && !formData.has("city")) return null;
  const clip = (k: string, max: number) => String(formData.get(k) || "").trim().slice(0, max) || null;
  return { place_type: clip("place_type", 60), city: clip("city", 120), country: clip("country", 80) };
}

// Own update: the columns only exist after docs/migrations/2026-09-24-kaito-places.sql.
async function savePlaceFields(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string,
  fields: ReturnType<typeof placeFieldsFrom>
) {
  if (!fields) return;
  await supabase.from("items").update(fields).eq("id", itemId);
}

export async function addItem(handle: string, _prev: string | null, formData: FormData) {
  const { supabase, user } = await requireUser();

  const categoryId = Number(formData.get("category_id"));
  const title = String(formData.get("title") || "").trim();
  const place = placeFieldsFrom(formData);
  const by = place ? placeLine(place.place_type, place.city) : String(formData.get("by") || "").trim();
  const yearRaw = String(formData.get("year") || "").trim();
  const rawUrl = String(formData.get("url") || "").trim();
  const imageUrl = String(formData.get("image_url") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const rawSourceLabel = String(formData.get("source_label") || "").trim();
  const workId = String(formData.get("work_id") || "").trim();

  if (!title || !categoryId) return "Title and category are required.";
  if (rawUrl && !safeHttpUrl(rawUrl)) return "That link doesn't look like a valid web address.";
  if (imageUrl && !safeHttpUrl(imageUrl)) return "That image URL doesn't look like a valid web address.";

  // Owner rule: a hoshigo without a catalog match must have a link, so visitors can find it.
  let linkedWork = false;
  if (workId) {
    const { data: work } = await supabase.from("works").select("id").eq("id", workId).maybeSingle();
    linkedWork = !!work;
  }
  if (!linkedWork && !rawUrl) return "Add a link so visitors can find it. Only things found in a catalog can go without one.";

  // No link of their own, but the catalog knows the thing's website (a place from OSM):
  // use that. A link the person gave always wins. The website column only exists after
  // docs/migrations/2026-09-24-kaito.sql; before that this finds nothing.
  let url = rawUrl;
  let sourceLabel = rawSourceLabel;
  if (!url && linkedWork) {
    const { data: w } = await supabase.from("works").select("website").eq("id", workId).maybeSingle();
    const website = (w as { website?: string | null } | null)?.website;
    if (website && safeHttpUrl(website)) {
      url = website;
      sourceLabel = new URL(website).hostname.replace(/^www\./, "");
    }
  }

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

  if (inserted?.id) await savePlaceFields(supabase, inserted.id, place);

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
  const place = placeFieldsFrom(formData);
  const by = place ? placeLine(place.place_type, place.city) : String(formData.get("by") || "").trim();
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

  // Only the places form sends these fields. Without them the item is (now) in another
  // category, so the old type and location must go.
  await savePlaceFields(supabase, itemId, place ?? { place_type: null, city: null, country: null });

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
