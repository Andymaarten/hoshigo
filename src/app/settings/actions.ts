"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseSocialLinksPayload } from "@/lib/social-links";

export async function saveProfile(_prev: string | null, formData: FormData) {
  const displayName = String(formData.get("display_name") || "").trim();
  const bio = String(formData.get("bio") || "").trim();
  const socialLinks = parseSocialLinksPayload(String(formData.get("social_links") || ""));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "You need to be logged in.";

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ display_name: displayName || null, bio: bio || null, social_links: socialLinks })
    .eq("id", user.id)
    .select("handle")
    .single();

  if (error) return error.message;

  revalidatePath(`/${profile.handle}`);
  redirect(`/${profile.handle}`);
}
