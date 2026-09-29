import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item } from "@/lib/supabase/types";
import { renderEmail, type EmailPick } from "@/lib/email-layout";
import { SITE, sendOne, unsubscribeToken } from "@/lib/changelog";
import { compareForProfile } from "@/lib/item-order";
import { PUBLIC_PER_CATEGORY } from "@/lib/share-rules";
import { WEEKLY } from "@/lib/weekly-copy";
import { weekCounts } from "@/lib/news";
import { NEWS } from "@/lib/news-copy";

const DAY = 86400000;
const FRIENDS_MAX = 6;
const TRENDING_MAX = 4;
const PER_PERSON = 2;

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/** The Monday (UTC) of the week `now` falls in, as YYYY-MM-DD: one weekly email per person per week. */
export function weekStart(now = Date.now()): string {
  const d = new Date(now);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)).toISOString().slice(0, 10);
}

type Person = { id: string; handle: string; name: string; isPrivate: boolean };

/** Everything the week's emails need, read once per run. */
export async function loadWeek(admin: SupabaseClient, now = Date.now()) {
  const since = new Date(now - 7 * DAY).toISOString();
  const [{ data: fr }, follows, { data: recent }, { data: people }, approved] = await Promise.all([
    admin.from("friendships").select("requester, addressee").eq("status", "accepted").limit(50000),
    admin.from("follows").select("follower, followee").limit(50000),
    admin.from("items").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(5000),
    admin.from("profiles").select("id, handle, display_name, is_private").limit(50000),
    admin.from("pick_approved").select("work_id, item_id"),
  ]);
  const byId = new Map<string, Person>(
    (people ?? [])
      .filter((p) => typeof p.handle === "string" && !(p.handle as string).startsWith("user-"))
      .map((p) => [p.id as string, { id: p.id as string, handle: p.handle as string, name: (p.display_name as string) || (p.handle as string), isPrivate: !!p.is_private }])
  );
  const friends = new Map<string, Set<string>>();
  const add = (a: string, b: string) => friends.set(a, (friends.get(a) ?? new Set()).add(b));
  (fr ?? []).forEach((f) => {
    add(f.requester as string, f.addressee as string);
    add(f.addressee as string, f.requester as string);
  });
  const following = new Map<string, Set<string>>();
  (follows.error ? [] : follows.data ?? []).forEach((f) => following.set(f.follower as string, (following.get(f.follower as string) ?? new Set()).add(f.followee as string)));

  const items = ((recent ?? []) as Item[]).filter((i) => byId.has(i.profile_id));
  // which recent items a stranger may see: public page, within the first five per category
  const owners = [...new Set(items.map((i) => i.profile_id))];
  const { data: full } = owners.length
    ? await admin.from("items").select("id, profile_id, category_id, created_at, pinned").in("profile_id", owners).limit(50000)
    : { data: [] };
  const groups = new Map<string, Item[]>();
  ((full ?? []) as Item[]).forEach((i) => {
    const k = `${i.profile_id}|${i.category_id}`;
    groups.set(k, [...(groups.get(k) ?? []), i]);
  });
  const window = new Set<string>();
  groups.forEach((list) => list.sort(compareForProfile).slice(0, PUBLIC_PER_CATEGORY).forEach((i) => window.add(i.id)));
  const publicVisible = (i: Item) => !byId.get(i.profile_id)?.isPrivate && window.has(i.id);

  const keptBy = new Map<string, number>();
  items.forEach((i) => i.work_id && keptBy.set(i.work_id, (keptBy.get(i.work_id) ?? 0) + 1));
  const ap = approved.error ? [] : approved.data ?? [];
  const approvedWorks = new Set(ap.filter((a) => a.work_id).map((a) => a.work_id as string));
  const approvedItems = new Set(ap.filter((a) => a.item_id).map((a) => a.item_id as string));

  return { byId, friends, following, items, publicVisible, keptBy, approvedWorks, approvedItems };
}

export type Week = Awaited<ReturnType<typeof loadWeek>>;

function toPick(i: Item, p: Person): EmailPick {
  return { title: i.title, by: i.by ?? undefined, owner: p.name, href: `${SITE()}/${p.handle}/${i.id}`, image: i.image_url ?? undefined };
}

/** The two sections for one person; both empty means no email this week. */
export async function composeWeekly(admin: SupabaseClient, week: Week, profileId: string) {
  const myFriends = week.friends.get(profileId) ?? new Set<string>();
  const myFollows = week.following.get(profileId) ?? new Set<string>();

  // From your friends (everything) and people you follow (what a stranger may see)
  const perPerson = new Map<string, number>();
  const fromFriends: EmailPick[] = [];
  for (const i of week.items) {
    if (fromFriends.length >= FRIENDS_MAX) break;
    const isFriend = myFriends.has(i.profile_id);
    if (!isFriend && !(myFollows.has(i.profile_id) && week.publicVisible(i))) continue;
    if ((perPerson.get(i.profile_id) ?? 0) >= PER_PERSON) continue;
    perPerson.set(i.profile_id, (perPerson.get(i.profile_id) ?? 0) + 1);
    fromFriends.push(toPick(i, week.byId.get(i.profile_id)!));
  }

  // Trending: public pages outside your network; never something you keep or saved already
  const [{ data: own }, someday] = await Promise.all([
    admin.from("items").select("work_id, title, category_id").eq("profile_id", profileId),
    admin.from("someday_items").select("work_id, title, category_id").eq("profile_id", profileId),
  ]);
  const haveWorks = new Set<string>();
  const haveTitles = new Set<string>();
  [...(own ?? []), ...(someday.error ? [] : someday.data ?? [])].forEach((r) => {
    if (r.work_id) haveWorks.add(r.work_id as string);
    haveTitles.add(`${r.category_id}|${norm(r.title as string)}`);
  });
  const score = (i: Item) =>
    (week.approvedItems.has(i.id) || (i.work_id && week.approvedWorks.has(i.work_id)) ? 100 : 0) +
    (i.work_id ? (week.keptBy.get(i.work_id) ?? 1) * 10 : 0) +
    (i.note?.trim() ? 3 : 0) +
    (i.image_url ? 2 : 0);
  const candidates = week.items
    .filter(
      (i) =>
        i.profile_id !== profileId &&
        !myFriends.has(i.profile_id) &&
        !myFollows.has(i.profile_id) &&
        week.publicVisible(i) &&
        !(i.work_id && haveWorks.has(i.work_id)) &&
        !haveTitles.has(`${i.category_id}|${norm(i.title)}`) &&
        // trending means kept by several people, unless the owner approved it as a tip
        ((i.work_id && (week.keptBy.get(i.work_id) ?? 0) >= 2) || week.approvedItems.has(i.id) || (!!i.work_id && week.approvedWorks.has(i.work_id)))
    )
    .sort((a, b) => score(b) - score(a) || b.created_at.localeCompare(a.created_at));
  const trending: EmailPick[] = [];
  const usedThings = new Set<string>();
  const usedPeople = new Set<string>();
  for (const i of candidates) {
    if (trending.length >= TRENDING_MAX) break;
    const thing = i.work_id ?? i.id;
    if (usedThings.has(thing) || usedPeople.has(i.profile_id)) continue;
    usedThings.add(thing);
    usedPeople.add(i.profile_id);
    trending.push(toPick(i, week.byId.get(i.profile_id)!));
  }

  if (!fromFriends.length && !trending.length) return null;
  // what happened around their own hoshigos this week, when anything did
  const counts = await weekCounts(admin, profileId).catch(() => ({ saved: 0, loved: 0 }));
  const inspired = counts.saved || counts.loved ? [NEWS.inspirational(counts.saved, counts.loved)] : [];
  const t = encodeURIComponent(unsubscribeToken(profileId));
  const links = { unsubscribeUrl: `${SITE()}/unsubscribe?t=${t}`, oneClickUrl: `${SITE()}/api/unsubscribe?t=${t}` };
  const mail = renderEmail({
    preheader: WEEKLY.preheader,
    heading: WEEKLY.heading,
    paragraphs: [WEEKLY.line, ...inspired],
    sections: [
      { heading: WEEKLY.friendsHeading, picks: fromFriends },
      { heading: WEEKLY.trendingHeading, intro: WEEKLY.trendingIntro, picks: trending },
    ],
    signature: WEEKLY.signature,
    footer: WEEKLY.footer,
    footerLink: { label: WEEKLY.stop, href: links.oneClickUrl },
    home: SITE(),
  });
  return { subject: WEEKLY.subject, ...mail, links, counts: { friends: fromFriends.length, trending: trending.length } };
}

/** Who wants the weekly email; null before the weekly migration. */
async function weeklyRecipients(admin: SupabaseClient): Promise<{ id: string }[] | null> {
  const out: { id: string }[] = [];
  for (let from = 0; from < 100000; from += 1000) {
    const { data, error } = await admin.from("profiles").select("id, handle").eq("email_updates", true).eq("weekly_email", true).range(from, from + 999);
    if (error) return null;
    (data ?? []).forEach((p) => typeof p.handle === "string" && !p.handle.startsWith("user-") && out.push({ id: p.id as string }));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/**
 * Monday's run: one email per person per week (weekly_emails), skipped when there is nothing
 * to tell. Stops at the deadline; whoever is left is picked up by the next run that same week.
 */
export async function runWeekly(admin: SupabaseClient, deadline: number, now = Date.now()) {
  const week = weekStart(now);
  const people = await weeklyRecipients(admin);
  if (!people) return { week, sent: 0, skipped: 0, error: "weekly migration not run" };
  const { data: done } = await admin.from("weekly_emails").select("profile_id").eq("week_start", week);
  const had = new Set((done ?? []).map((r) => r.profile_id as string));
  const ctx = await loadWeek(admin, now);
  let sent = 0;
  let skipped = 0;
  for (const p of people) {
    if (had.has(p.id)) continue;
    if (Date.now() > deadline) break;
    const mail = await composeWeekly(admin, ctx, p.id);
    if (!mail) {
      skipped++;
      continue;
    }
    const { data: u } = await admin.auth.admin.getUserById(p.id);
    const email = u?.user?.email;
    if (!email) continue;
    const { error: claim } = await admin.from("weekly_emails").insert({ profile_id: p.id, week_start: week });
    if (claim) continue;
    if (sent) await new Promise((r) => setTimeout(r, 600));
    const res = await sendOne({ to: email, subject: mail.subject, html: mail.html, text: mail.text, ...mail.links });
    if (res.error) {
      await admin.from("weekly_emails").delete().eq("profile_id", p.id).eq("week_start", week);
      return { week, sent, skipped, error: res.error };
    }
    sent++;
  }
  return { week, sent, skipped, error: null };
}
