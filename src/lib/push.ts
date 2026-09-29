import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

// Web push for the installed app. At most one bundled notification per person per day,
// only when friends or people they follow added something, or others saved or loved your
// hoshigos, since the last one. Never per item.

type Sub = { id: string; profile_id: string; endpoint: string; p256dh: string; auth: string; last_sent_at: string | null; created_at: string };
export type PushPayload = { title: string; body: string; url: string };

function configured() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || "mailto:hi@hoshigo.cc", pub, priv);
  return true;
}

/** Sends to one device. Returns "gone" when the device unsubscribed (404/410), so it can be removed. */
async function sendTo(sub: Sub, payload: PushPayload): Promise<"ok" | "gone" | "error"> {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
      TTL: 60 * 60 * 12,
      urgency: "low",
    });
    return "ok";
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    return code === 404 || code === 410 ? "gone" : "error";
  }
}

/** "Sara added a hoshigo", "Sara and Cas added 3 hoshigos", "Sara, Cas and 2 others added 5 hoshigos". */
export function bundleText(names: string[], count: number) {
  const unique = [...new Set(names)];
  const who =
    unique.length === 1
      ? unique[0]
      : unique.length === 2
        ? `${unique[0]} and ${unique[1]}`
        : `${unique[0]}, ${unique[1]} and ${unique.length - 2} ${unique.length - 2 === 1 ? "other" : "others"}`;
  return `${who} added ${count === 1 ? "a hoshigo" : `${count} hoshigos`}`;
}

async function sendToProfile(admin: SupabaseClient, subs: Sub[], payload: PushPayload) {
  let sent = 0;
  const gone: string[] = [];
  for (const s of subs) {
    const r = await sendTo(s, payload);
    if (r === "ok") sent++;
    if (r === "gone") gone.push(s.id);
  }
  if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
  return { sent, gone: gone.length };
}

/** The owner's test: one notification to each of this person's devices. */
export async function sendTestPush(admin: SupabaseClient, profileId: string) {
  if (!configured()) return "VAPID keys are not set (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY).";
  const { data, error } = await admin.from("push_subscriptions").select("*").eq("profile_id", profileId);
  if (error) return "The push_subscriptions table isn't there yet (docs/migrations/2026-09-29-push.sql).";
  if (!data?.length) return "No devices with notifications on. Turn them on in settings, in the installed app.";
  const r = await sendToProfile(admin, data as Sub[], { title: "hoshigo", body: "A test from hoshigo. Notifications work on this device.", url: "/friends" });
  return `Sent to ${r.sent} of ${data.length} devices${r.gone ? `, removed ${r.gone} that were gone` : ""}.`;
}

/**
 * The daily run (called from the 07:00 UTC cron). For everyone with a device: what did their
 * friends and the people they follow add since the last notification (or since they turned
 * notifications on)? One bundled notification if anything, nothing otherwise.
 */
export async function sendDailyPush(admin: SupabaseClient): Promise<{ people: number; sent: number; gone: number; error: string | null }> {
  if (!configured()) return { people: 0, sent: 0, gone: 0, error: "VAPID keys not set" };
  const { data: subsData, error } = await admin.from("push_subscriptions").select("*").limit(10000);
  if (error) return { people: 0, sent: 0, gone: 0, error: "no push_subscriptions table" };
  const subs = (subsData ?? []) as Sub[];
  const byProfile = new Map<string, Sub[]>();
  subs.forEach((s) => byProfile.set(s.profile_id, [...(byProfile.get(s.profile_id) ?? []), s]));
  if (!byProfile.size) return { people: 0, sent: 0, gone: 0, error: null };
  const ids = [...byProfile.keys()];

  const [{ data: friendships }, follows] = await Promise.all([
    admin.from("friendships").select("requester, addressee").eq("status", "accepted").or(`requester.in.(${ids.join(",")}),addressee.in.(${ids.join(",")})`),
    admin.from("follows").select("follower, followee").in("follower", ids),
  ]);
  const circle = new Map<string, Set<string>>(ids.map((id) => [id, new Set<string>()]));
  const friends = new Set<string>();
  for (const f of friendships ?? []) {
    circle.get(f.requester as string)?.add(f.addressee as string);
    circle.get(f.addressee as string)?.add(f.requester as string);
    friends.add(`${f.requester}|${f.addressee}`).add(`${f.addressee}|${f.requester}`);
  }
  for (const f of follows.error ? [] : (follows.data ?? [])) circle.get(f.follower as string)?.add(f.followee as string);

  const everyone = [...new Set([...circle.values()].flatMap((s) => [...s]))];
  const since = new Date(Date.now() - 3 * 86400000).toISOString();
  const [{ data: items }, { data: people }, { data: ownItems }] = await Promise.all([
    everyone.length
      ? admin.from("items").select("profile_id, created_at").in("profile_id", everyone.slice(0, 1000)).gte("created_at", since).limit(20000)
      : Promise.resolve({ data: [] as { profile_id: string; created_at: string }[] }),
    everyone.length
      ? admin.from("profiles").select("id, handle, display_name, is_private").in("id", everyone.slice(0, 1000))
      : Promise.resolve({ data: [] as { id: string; handle: string; display_name: string | null; is_private: boolean }[] }),
    admin.from("items").select("id, profile_id").in("profile_id", ids).limit(20000),
  ]);

  // the same someday signals as the news page (src/lib/news.ts): others saving your hoshigos,
  // and later marking them loved; before the status migration only saves exist
  const ownerOfItem = new Map((ownItems ?? []).map((i) => [i.id as string, i.profile_id as string]));
  const itemIds = [...ownerOfItem.keys()].slice(0, 1000);
  type SomedayRow = { profile_id: string; source_item_id: string; created_at: string; status?: string; resolved_at?: string | null };
  let someday: SomedayRow[] = [];
  if (itemIds.length) {
    const withStatus = await admin.from("someday_items").select("profile_id, source_item_id, created_at, status, resolved_at").in("source_item_id", itemIds).gte("created_at", new Date(Date.now() - 60 * 86400000).toISOString());
    someday = (withStatus.error
      ? (await admin.from("someday_items").select("profile_id, source_item_id, created_at").in("source_item_id", itemIds).gte("created_at", since)).data ?? []
      : withStatus.data ?? []) as SomedayRow[];
  }
  // a private page's additions only count for its friends, not for followers
  const isPrivate = new Set((people ?? []).filter((p) => p.is_private).map((p) => p.id as string));
  const nameOf = new Map((people ?? []).map((p) => [p.id as string, ((p.display_name as string) || (p.handle as string)).split(" ")[0]]));

  let sent = 0;
  let gone = 0;
  let notified = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const [profileId, devices] of byProfile) {
    // once a day per person, whatever the number of devices
    if (devices.some((d) => d.last_sent_at?.slice(0, 10) === today)) continue;
    const from = devices.reduce((t, d) => Math.max(t, Date.parse(d.last_sent_at ?? d.created_at)), 0);
    const mine = circle.get(profileId) ?? new Set();
    const fresh = (items ?? []).filter((i) => {
      const owner = i.profile_id as string;
      if (!mine.has(owner) || Date.parse(i.created_at as string) <= from) return false;
      return !isPrivate.has(owner) || friends.has(`${profileId}|${owner}`);
    });
    const names = fresh.map((i) => nameOf.get(i.profile_id as string)).filter((n): n is string => !!n);
    const aboutMe = someday.filter((s) => ownerOfItem.get(s.source_item_id) === profileId && s.profile_id !== profileId);
    const savers = new Set(aboutMe.filter((s) => Date.parse(s.created_at) > from).map((s) => s.profile_id)).size;
    const lovers = new Set(aboutMe.filter((s) => s.status === "loved" && s.resolved_at && Date.parse(s.resolved_at) > from).map((s) => s.profile_id)).size;
    const parts = [
      names.length ? bundleText(names, fresh.length) : "",
      savers ? `${savers} ${savers === 1 ? "person" : "people"} saved yours for someday` : "",
      lovers ? `${lovers} ${lovers === 1 ? "person" : "people"} loved yours` : "",
    ].filter(Boolean);
    if (!parts.length) continue;
    // tapping goes where most of the news is
    const url = savers + lovers > names.length ? "/news" : "/friends";
    const r = await sendToProfile(admin, devices, { title: "hoshigo", body: parts.join(" \u00b7 "), url });
    sent += r.sent;
    gone += r.gone;
    if (r.sent) {
      notified++;
      await admin.from("push_subscriptions").update({ last_sent_at: new Date().toISOString() }).eq("profile_id", profileId);
    }
  }
  return { people: notified, sent, gone, error: null };
}
