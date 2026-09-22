"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in.");
  return { supabase, user };
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

  if (!title || !categoryId) return "Title and category are required.";

  const { error } = await supabase.from("items").insert({
    profile_id: user.id,
    category_id: categoryId,
    title,
    by: by || null,
    year: yearRaw ? Number(yearRaw) : null,
    url: url || null,
    image_url: imageUrl || null,
    note: note || null,
  });

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
