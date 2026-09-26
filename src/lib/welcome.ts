import type { SupabaseClient } from "@supabase/supabase-js";
import { renderEmail, type EmailInput, type EmailParagraph } from "@/lib/email-layout";
import { SITE, sendBatch, unsubscribeToken } from "@/lib/changelog";
import { communityPicks, recordPicks, type Pick } from "@/lib/community-picks";
import {
  COMMUNITY_HEADING,
  COMMUNITY_INTRO,
  WELCOME_COPY,
  WELCOME_DAYS,
  WELCOME_FOOTER,
  WELCOME_GOODBYE,
  WELCOME_INSPIRATION,
  WELCOME_ONE_TAP,
  WELCOME_PS,
  WELCOME_PS_LINK,
  WELCOME_SIGNATURE,
  type WelcomeStep,
} from "@/lib/welcome-copy";

// Images in emails load from production directly: mail apps may not follow the hoshigo.cc to www redirect.
const EMAIL_ASSETS = "https://www.hoshigo.cc";

const DAY = 86400000;
// a step is only sent in the few days after its day, so people who signed up long before this
// feature existed never get a "few days in" email weeks late
const WINDOW_DAYS = 3;

export async function welcomeSwitch(admin: SupabaseClient): Promise<boolean | null> {
  const { data, error } = await admin.from("app_settings").select("value").eq("key", "welcome_emails").maybeSingle();
  if (error) return null;
  return (data?.value as { on?: boolean } | undefined)?.on === true;
}

export async function setWelcomeSwitch(admin: SupabaseClient, on: boolean) {
  return admin.from("app_settings").upsert({ key: "welcome_emails", value: { on }, updated_at: new Date().toISOString() });
}

export type Due = { profileId: string; handle: string; name: string; step: WelcomeStep };

/** Who gets which welcome email today (at most one each). */
export async function dueWelcomes(admin: SupabaseClient, now = Date.now()): Promise<Due[]> {
  const since = new Date(now - (WELCOME_DAYS[3] + WINDOW_DAYS + 1) * DAY).toISOString();
  const { data: people, error } = await admin
    .from("profiles")
    .select("id, handle, display_name, created_at")
    .eq("email_updates", true)
    .gte("created_at", since)
    .limit(5000);
  if (error || !people?.length) return [];
  const real = people.filter((p) => typeof p.handle === "string" && !(p.handle as string).startsWith("user-"));
  const ids = real.map((p) => p.id as string);
  if (!ids.length) return [];
  const [{ data: sent }, { data: items }, usage] = await Promise.all([
    admin.from("welcome_emails").select("profile_id, step").in("profile_id", ids),
    admin.from("items").select("profile_id").in("profile_id", ids).limit(20000),
    admin.from("app_usage").select("profile_id").in("profile_id", ids),
  ]);
  const sentSet = new Set((sent ?? []).map((s) => `${s.profile_id}|${s.step}`));
  const itemCount = new Map<string, number>();
  (items ?? []).forEach((i) => itemCount.set(i.profile_id as string, (itemCount.get(i.profile_id as string) ?? 0) + 1));
  // before the app usage migration nobody counts as having the app
  const hasApp = new Set(usage.error ? [] : (usage.data ?? []).map((u) => u.profile_id as string));

  const out: Due[] = [];
  for (const p of real) {
    const days = Math.floor((now - Date.parse(p.created_at as string)) / DAY);
    const id = p.id as string;
    const inWindow = (s: WelcomeStep) => days >= WELCOME_DAYS[s] && days <= WELCOME_DAYS[s] + WINDOW_DAYS && !sentSet.has(`${id}|${s}`);
    let step: WelcomeStep | null = null;
    if (inWindow(1)) step = 1;
    else if (inWindow(2) && !hasApp.has(id)) step = 2;
    else if (inWindow(3)) step = 3;
    if (step) out.push({ profileId: id, handle: p.handle as string, name: (p.display_name as string) || (p.handle as string), step });
  }
  return out;
}

/** The personal invite link for the day 21 email (made if the person has none yet). */
export async function inviteUrl(admin: SupabaseClient, profileId: string): Promise<string | null> {
  const { data } = await admin.from("friend_invites").select("token").eq("profile_id", profileId).maybeSingle();
  let token = data?.token as string | undefined;
  if (!token) {
    const { data: made } = await admin.from("friend_invites").insert({ profile_id: profileId }).select("token").single();
    token = made?.token as string | undefined;
  }
  return token ? `${SITE()}/invite/${token}` : null;
}

export function renderWelcome(
  step: WelcomeStep,
  picks: Pick[],
  links: { oneClickUrl: string },
  invite: string | null
) {
  const copy = WELCOME_COPY[step];
  const site = SITE();
  const paragraphs: EmailParagraph[] = [...copy.paragraphs];
  if (step === 3 && invite) paragraphs.push(invite);
  // picks lead to the person's page, not the single card: the page is the invitation
  const communityPicks = picks.map((p) => ({
    title: p.title,
    by: p.by ?? undefined,
    owner: p.name,
    href: `${site}/${p.handle}`,
    image: p.imageUrl ?? undefined,
  }));
  const footerParts = { footer: WELCOME_FOOTER, footerLink: { label: WELCOME_ONE_TAP, href: links.oneClickUrl }, home: site };

  const input: EmailInput =
    step === 1
      ? {
          preheader: copy.preheader,
          heading: copy.heading,
          paragraphs,
          // /add logs people in if needed and opens the add dialog on their page
          imageButton: { src: `${EMAIL_ASSETS}/email/add-a-hoshigo.png`, alt: copy.button, href: `${site}/add`, width: 180, height: 180 },
          community: picks.length >= 2 ? { heading: WELCOME_INSPIRATION, picks: communityPicks } : undefined,
          quietButton: { label: WELCOME_GOODBYE, href: site },
          ps: { text: WELCOME_PS, icon: `${EMAIL_ASSETS}/email/app-icon.png`, iconLabel: "hoshigo", linkLabel: WELCOME_PS_LINK, href: `${site}/app` },
          ...footerParts,
        }
      : {
          preheader: copy.preheader,
          heading: copy.heading,
          paragraphs,
          button: { label: copy.button, href: step === 2 ? `${site}/app` : invite ?? `${site}/friends` },
          community: picks.length >= 2 ? { heading: COMMUNITY_HEADING, intro: COMMUNITY_INTRO, picks: communityPicks } : undefined,
          signature: WELCOME_SIGNATURE,
          ...footerParts,
        };
  return { subject: copy.subject, ...renderEmail(input) };
}

/** Everything for one person's email, also used for the owner's preview and test. */
export async function composeWelcome(admin: SupabaseClient, step: WelcomeStep, d: { profileId: string; name: string; handle: string }) {
  const [picks, invite] = await Promise.all([
    communityPicks(admin, d.profileId, 3).catch(() => [] as Pick[]),
    step === 3 ? inviteUrl(admin, d.profileId) : Promise.resolve(null),
  ]);
  const links = unsubscribeLinks(d.profileId);
  return { ...renderWelcome(step, picks, links, invite), picks, links };
}

export function unsubscribeLinks(profileId: string) {
  const t = encodeURIComponent(unsubscribeToken(profileId));
  return { unsubscribeUrl: `${SITE()}/unsubscribe?t=${t}`, oneClickUrl: `${SITE()}/api/unsubscribe?t=${t}` };
}

async function emailOf(admin: SupabaseClient, id: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(id);
  return data?.user?.email ?? null;
}

/**
 * The welcome, sent right after onboarding. Once only (the welcome_emails row), only when the
 * owner's switch is on and the person wants emails. Never throws: onboarding must not fail on it.
 */
export async function sendWelcomeNow(admin: SupabaseClient, profileId: string) {
  try {
    if ((await welcomeSwitch(admin)) !== true) return;
    const { data: p } = await admin.from("profiles").select("handle, display_name, email_updates").eq("id", profileId).maybeSingle();
    if (!p || p.email_updates === false || typeof p.handle !== "string" || p.handle.startsWith("user-")) return;
    const email = await emailOf(admin, profileId);
    if (!email) return;
    const { error: claim } = await admin.from("welcome_emails").insert({ profile_id: profileId, step: 1 });
    if (claim) return;
    const mail = await composeWelcome(admin, 1, { profileId, handle: p.handle, name: (p.display_name as string) || p.handle });
    const res = await sendBatch([{ to: email, subject: mail.subject, html: mail.html, text: mail.text, ...mail.links }]);
    if (res.error) {
      await admin.from("welcome_emails").delete().eq("profile_id", profileId).eq("step", 1);
      console.error("[welcome] send failed", res.error);
      return;
    }
    await recordPicks(admin, profileId, mail.picks).catch(() => {});
  } catch (e) {
    console.error("[welcome] failed", e);
  }
}

/**
 * The daily run. Sends only when the owner switched welcome emails on; otherwise it just
 * reports what it would send. Records each sent step so nothing goes out twice.
 */
export async function runWelcome(admin: SupabaseClient): Promise<{ on: boolean; due: { handle: string; step: number }[]; sent: number; error: string | null }> {
  const on = (await welcomeSwitch(admin)) === true;
  const due = await dueWelcomes(admin);
  const summary = due.map((d) => ({ handle: d.handle, step: d.step }));
  if (!on || !due.length) return { on, due: summary, sent: 0, error: null };

  let sent = 0;
  for (const d of due) {
    const email = await emailOf(admin, d.profileId);
    if (!email) continue;
    const mail = await composeWelcome(admin, d.step, d);
    // claim the step first: if two runs overlap, the primary key lets only one send
    const { error: claim } = await admin.from("welcome_emails").insert({ profile_id: d.profileId, step: d.step });
    if (claim) continue;
    const res = await sendBatch([{ to: email, subject: mail.subject, html: mail.html, text: mail.text, ...mail.links }]);
    if (res.error) {
      await admin.from("welcome_emails").delete().eq("profile_id", d.profileId).eq("step", d.step);
      return { on, due: summary, sent, error: res.error };
    }
    await recordPicks(admin, d.profileId, mail.picks).catch(() => {});
    sent++;
  }
  return { on, due: summary, sent, error: null };
}
