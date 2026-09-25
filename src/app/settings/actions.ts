"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseSocialLinksPayload } from "@/lib/social-links";

export async function saveProfile(_prev: string | null, formData: FormData) {
  const displayName = String(formData.get("display_name") || "").trim();
  const bio = String(formData.get("bio") || "").trim();
  const socialLinks = parseSocialLinksPayload(String(formData.get("social_links") || ""));
  const isPrivate = formData.get("is_private") === "on";

  if (displayName.length > 15) return "Name needs to be 15 characters or fewer.";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "You need to be logged in.";

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ display_name: displayName || null, bio: bio || null, social_links: socialLinks, is_private: isPrivate })
    .eq("id", user.id)
    .select("handle")
    .single();

  if (error) return error.message;

  if (formData.get("friend_choice") === "1") {
    await supabase
      .from("profiles")
      .update({ auto_accept_friends: formData.get("auto_accept_friends") === "on" })
      .eq("id", user.id);

    // own update: the column only exists after docs/migrations/2026-09-24-friend-request-email.sql
    await supabase
      .from("profiles")
      .update({ email_friend_requests: formData.get("email_friend_requests") === "on" })
      .eq("id", user.id);
  }

  if (formData.get("someday_choice") === "1") {
    await supabase.from("profiles").update({ someday_public: formData.get("someday_public") === "on" }).eq("id", user.id);
  }

  revalidatePath(`/${profile.handle}`);
  redirect(`/${profile.handle}`);
}
