"use server";

import { createClient } from "@/lib/supabase/server";

type Keys = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Saves this device for the logged in person (the same device again just refreshes its keys). */
export async function savePushSubscription(sub: Keys): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "You need to be logged in.";
  if (typeof sub?.endpoint !== "string" || !sub.endpoint.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) {
    return "That device didn't give a usable subscription.";
  }
  // a device that moved to another account first leaves the old one (RLS only shows our own rows)
  const { data: existing } = await supabase.from("push_subscriptions").select("id").eq("endpoint", sub.endpoint).maybeSingle();
  const { error } = existing
    ? await supabase.from("push_subscriptions").update({ p256dh: sub.keys.p256dh, auth: sub.keys.auth }).eq("id", existing.id)
    : await supabase.from("push_subscriptions").insert({ profile_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth });
  if (error) return error.code === "23505" ? "This device is linked to another hoshigo account." : "Couldn't save notifications for this device.";
  return null;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", String(endpoint));
}
