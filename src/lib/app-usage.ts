"use server";

import { createClient } from "@/lib/supabase/server";

// Records that the logged in person opened hoshigo as an installed app. The client calls
// this at most once a day. Does nothing for visitors, and quietly nothing before the
// app_usage table exists (docs/migrations/2026-09-27-app-usage.sql).
export async function recordAppOpen() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const now = new Date().toISOString();
  const { data: existing, error } = await supabase.from("app_usage").select("profile_id").eq("profile_id", user.id).maybeSingle();
  if (error) return false;
  const { error: writeError } = existing
    ? await supabase.from("app_usage").update({ app_last_opened_at: now }).eq("profile_id", user.id)
    : await supabase.from("app_usage").insert({ profile_id: user.id, app_first_opened_at: now, app_last_opened_at: now });
  return !writeError;
}
