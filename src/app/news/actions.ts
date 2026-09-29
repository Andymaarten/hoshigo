"use server";

import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { newsEvents } from "@/lib/news";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Called by /news after it showed what's new. */
export async function markNewsSeen(): Promise<void> {
  const { supabase, user } = await me();
  if (!user) return;
  await supabase.from("news_seen").upsert({ profile_id: user.id, seen_at: new Date().toISOString() });
}

/** For the nav dot: anything in news since the last visit? */
export async function newsFresh(): Promise<boolean> {
  const { supabase, user } = await me();
  const admin = adminClient();
  if (!user || !admin) return false;
  const { data, error } = await supabase.from("news_seen").select("seen_at").eq("profile_id", user.id).maybeSingle();
  if (error) return false;
  const events = await newsEvents(admin, user.id, 30);
  if (!events.length) return false;
  // never visited: anything recent counts as new
  return !data?.seen_at || events[0].at > (data.seen_at as string);
}
