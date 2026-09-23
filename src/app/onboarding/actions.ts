"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseSocialLinksPayload } from "@/lib/social-links";
import { pendingAddPath, pendingInvitePath } from "@/lib/post-login";
import { notifyNewSignup } from "@/lib/notify-signup";

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

  const { data: before } = await supabase.from("profiles").select("handle").eq("id", user.id).maybeSingle();
  const isFirstOnboarding = !before?.handle || before.handle.startsWith("user-");

  const { error } = await supabase
    .from("profiles")
    .update({ handle, display_name: displayName || null, bio: bio || null, social_links: socialLinks, is_private: formData.get("is_private") === "on" })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") return "That page address is already taken. Try another one.";
    return error.message;
  }

  // separate update so saving still works before the friends migration adds this column
  await supabase
    .from("profiles")
    .update({ auto_accept_friends: formData.get("auto_accept_friends") === "on" })
    .eq("id", user.id);

  // own update: the column only exists after docs/migrations/2026-09-24-friend-request-email.sql
  await supabase
    .from("profiles")
    .update({ email_friend_requests: formData.get("email_friend_requests") === "on" })
    .eq("id", user.id);

  if (isFirstOnboarding) await notifyNewSignup({ handle, displayName, email: user.email });

  redirect((await pendingInvitePath()) ?? (await pendingAddPath()) ?? `/${handle}`);
}
