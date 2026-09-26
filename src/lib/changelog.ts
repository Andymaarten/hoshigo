import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderEmail, type EmailParagraph } from "@/lib/email-layout";

export type ChangelogEntry = {
  id: string;
  shipped_on: string;
  title: string;
  body: string | null;
  audience: "public" | "internal";
  hidden: boolean;
  created_at: string;
};

export const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://www.hoshigo.cc").replace(/\/$/, "");
export const UPDATES_FROM = () => process.env.UPDATES_EMAIL_FROM || process.env.FRIENDS_EMAIL_FROM || "hoshigo <onboarding@resend.dev>";

// ---- unsubscribe tokens: no login needed, so the link itself proves who it's for ----

function secret() {
  return (process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/\s+/g, "");
}

export function unsubscribeToken(userId: string): string {
  const sig = createHmac("sha256", secret()).update(`updates.${userId}`).digest("base64url").slice(0, 32);
  return `${userId}.${sig}`;
}

/** The user id when the token is genuine, else null. */
export function readUnsubscribeToken(token: string | null | undefined): string | null {
  if (!token || !secret()) return null;
  const [id, sig] = token.split(".");
  if (!id || !sig || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const want = unsubscribeToken(id).split(".")[1];
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

// ---- composing ----

export function formatDay(d: string) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function renderUpdate(entries: ChangelogEntry[], unsubscribeUrl: string) {
  const paragraphs: EmailParagraph[] = [
    "A few things changed on hoshigo since we last wrote. Here they are, in the order they arrived.",
    ...entries.map((e): EmailParagraph => [{ strong: e.title }, ...(e.body ? [`\n${e.body}`] : [])]),
    "That's all for now. Thank you for keeping your page.",
  ];
  return renderEmail({
    preheader: entries.map((e) => e.title).join(", ").slice(0, 120),
    heading: "New on hoshigo",
    paragraphs,
    button: { label: "Open hoshigo", href: SITE() },
    footer: "You get this now and then because you have a hoshigo page.",
    footerLink: { label: "Stop these emails", href: unsubscribeUrl },
  });
}

// ---- reading what to send ----

export async function lastSentAt(admin: SupabaseClient): Promise<string | null> {
  const { data } = await admin.from("update_emails").select("sent_at").not("sent_at", "is", null).order("sent_at", { ascending: false }).limit(1);
  return (data?.[0]?.sent_at as string | undefined) ?? null;
}

/** Public, visible entries added after the last update email went out. */
export async function pendingEntries(admin: SupabaseClient): Promise<ChangelogEntry[]> {
  const since = await lastSentAt(admin);
  let q = admin.from("changelog_entries").select("*").eq("audience", "public").eq("hidden", false);
  if (since) q = q.gt("created_at", since);
  const { data } = await q.order("shipped_on", { ascending: true }).order("created_at", { ascending: true });
  return (data ?? []) as ChangelogEntry[];
}

/** Everyone who wants these emails: a real page and email_updates on. Emails come from auth, server side only. */
export async function recipients(admin: SupabaseClient): Promise<{ id: string; email: string }[]> {
  const ids = new Set<string>();
  for (let from = 0; from < 100000; from += 1000) {
    const { data, error } = await admin.from("profiles").select("id, handle").eq("email_updates", true).range(from, from + 999);
    if (error) return [];
    (data ?? []).forEach((p) => {
      if (typeof p.handle === "string" && !p.handle.startsWith("user-")) ids.add(p.id as string);
    });
    if (!data || data.length < 1000) break;
  }
  const out: { id: string; email: string }[] = [];
  for (let page = 1; page < 200; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    data.users.forEach((u) => {
      if (u.email && ids.has(u.id)) out.push({ id: u.id, email: u.email });
    });
    if (data.users.length < 1000) break;
  }
  return out;
}

export async function recipientCount(admin: SupabaseClient): Promise<number | null> {
  const { data, error } = await admin.from("profiles").select("handle").eq("email_updates", true);
  if (error) return null;
  return (data ?? []).filter((p) => typeof p.handle === "string" && !(p.handle as string).startsWith("user-")).length;
}

/** Resend's batch endpoint takes up to 100 emails per call. Returns how many were accepted. */
export type InlineImage = { filename: string; content: string; content_id: string };

/**
 * One email through Resend's single endpoint, which (unlike /emails/batch) takes inline
 * attachments: images referenced as <img src="cid:...">, shown even when remote images
 * are blocked (Proton, Apple Mail with remote content off).
 */
export async function sendOne(
  m: { to: string; subject: string; html: string; text: string; oneClickUrl: string },
  inline: InlineImage[] = []
): Promise<{ error: string | null }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { error: "RESEND_API_KEY is not set." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: UPDATES_FROM(),
        to: [m.to],
        subject: m.subject,
        html: m.html,
        text: m.text,
        headers: { "List-Unsubscribe": `<${m.oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        ...(inline.length ? { attachments: inline.map((a) => ({ ...a, content_type: "image/png" })) } : {}),
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { error: `Resend said ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { error: null };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function sendBatch(
  messages: { to: string; subject: string; html: string; text: string; unsubscribeUrl: string; oneClickUrl: string }[]
): Promise<{ sent: number; error: string | null }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: 0, error: "RESEND_API_KEY is not set." };
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100).map((m) => ({
      from: UPDATES_FROM(),
      to: [m.to],
      subject: m.subject,
      html: m.html,
      text: m.text,
      headers: { "List-Unsubscribe": `<${m.oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }));
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return { sent, error: `Resend said ${res.status}: ${(await res.text()).slice(0, 200)}` };
      sent += chunk.length;
    } catch (e) {
      return { sent, error: String(e) };
    }
  }
  return { sent, error: null };
}
