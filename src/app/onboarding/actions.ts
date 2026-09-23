"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseSocialLinksPayload } from "@/lib/social-links";

const HANDLE_RE = /^[a-z0-9_-]{2,30}$/;

export async function saveHandle(_prev: string | null, formData: FormData) {
  const handle = String(formData.get("handle") || "").trim().toLowerCase();
  const displayName = String(formData.get("display_name") || "").trim();
  const bio = String(formData.get("bio") || "").trim();
  const socialLinks = parseSocialLinksPayload(String(formData.get("social_links") || ""));

  if (!HANDLE_RE.test(handle)) {
    return "Your page address needs 2 to 30 characters: lowercase letters, numbers, underscores or minus signs.";
  }
  if (displayName.length > 15) return "Name needs to be 15 characters or fewer.";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "You need to be logged in.";

  const { error } = await supabase
    .from("profiles")
    .update({ handle, display_name: displayName || null, bio: bio || null, social_links: socialLinks })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") return "That page address is already taken. Try another one.";
    return error.message;
  }

  redirect(`/${handle}`);
}
