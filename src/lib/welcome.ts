import type { SupabaseClient } from "@supabase/supabase-js";
import { renderEmail, type EmailInput, type EmailParagraph } from "@/lib/email-layout";
import { SITE, sendBatch, unsubscribeToken } from "@/lib/changelog";
import { communityPicks, type Pick } from "@/lib/community-picks";
import { WELCOME_COPY, WELCOME_DAYS, WELCOME_FOOTER, WELCOME_STOP, type WelcomeStep } from "@/lib/welcome-copy";

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
    if (inWindow(1) && (itemCount.get(id) ?? 0) < 3) step = 1;
    else if (inWindow(2) && !hasApp.has(id)) step = 2;
    else if (inWindow(3)) step = 3;
    if (step) out.push({ profileId: id, handle: p.handle as string, name: (p.display_name as string) || (p.handle as string), step });
  }
  return out;
}

export function renderWelcome(step: WelcomeStep, d: { name: string; handle: string }, picks: Pick[], unsubscribeUrl: string) {
  const copy = WELCOME_COPY[step];
  const site = SITE();
  const paragraphs: EmailParagraph[] = copy.paragraphs.map((p) => p.replace("{name}", d.name));
  // Lucas is adding a community block to renderEmail; until it exists the picks go in as
  // plain paragraphs, and the same data rides along in `community` for when it does.
  if (picks.length) {
    paragraphs.push(copy.picksIntro);
    picks.forEach((p) =>
      paragraphs.push([{ strong: p.title }, `${p.by ? `, ${p.by}` : ""} (kept by ${p.name})\n“${p.note.slice(0, 200)}”\n${site}${p.path}`])
    );
  }
  const input = {
    preheader: copy.preheader,
    heading: copy.heading,
    paragraphs,
    button: { label: copy.button, href: step === 1 ? `${site}/${d.handle}` : step === 2 ? site : `${site}/${d.handle}` },
    footer: WELCOME_FOOTER,
    footerLink: { label: WELCOME_STOP, href: unsubscribeUrl },
    community: picks.map((p) => ({ ...p, href: `${site}${p.path}` })),
  } as EmailInput;
  return { subject: copy.subject, ...renderEmail(input) };
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
    const picks = await communityPicks(admin, d.profileId, 3).catch(() => []);
    const links = unsubscribeLinks(d.profileId);
    const mail = renderWelcome(d.step, d, picks, links.unsubscribeUrl);
    // claim the step first: if two runs overlap, the primary key lets only one send
    const { error: claim } = await admin.from("welcome_emails").insert({ profile_id: d.profileId, step: d.step });
    if (claim) continue;
    const res = await sendBatch([{ to: email, subject: mail.subject, html: mail.html, text: mail.text, ...links }]);
    if (res.error) {
      await admin.from("welcome_emails").delete().eq("profile_id", d.profileId).eq("step", d.step);
      return { on, due: summary, sent, error: res.error };
    }
    sent++;
  }
  return { on, due: summary, sent, error: null };
}
