"use server";

import { createHmac } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function emailOwner(message: string, page: string, who: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.replace(/\s+/g, "");
  const to = process.env.SIGNUP_NOTIFY_EMAIL?.trim();
  if (!apiKey || !to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.SIGNUP_NOTIFY_FROM?.trim() || "hoshigo <onboarding@resend.dev>",
        to: [to],
        subject: `A note from ${who}`,
        html: `<p style="white-space:pre-wrap">${escapeHtml(message)}</p><p>From: ${escapeHtml(who)}<br>Written on: ${escapeHtml(page)}</p>`,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("feedback email failed", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("feedback email failed", err);
    return false;
  }
}

export type FeedbackResult = { ok: true } | { ok: false; error: string };

const PER_HOUR = 5;
const COOLDOWN_MS = 60_000;
const COOKIE = "hoshigo_fb";
const LIMITED = "Thank you, we have your notes. Give it a little while before sending more.";

// The user's feedback timestamps from the last hour, read with the service role key because
// the table has no select policy. Null when that isn't possible (no key, or no table yet).
async function recentFeedback(userId: string): Promise<number[] | null> {
  const admin = adminClient();
  if (!admin) return null;
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { data, error } = await admin
    .from("feedback")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(PER_HOUR);
  if (error || !data) return null;
  return (data as { created_at: string }[]).map((r) => Date.parse(r.created_at));
}

// Fallback cooldown that works without the table: a signed cookie holding when this user last sent.
function sign(value: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "") || process.env.RESEND_API_KEY?.replace(/\s+/g, "") || "hoshigo";
  return createHmac("sha256", secret).update(value).digest("hex").slice(0, 32);
}

async function cookieCooldownActive(userId: string): Promise<boolean> {
  const raw = (await cookies()).get(COOKIE)?.value;
  const [id, at, sig] = raw?.split(".") ?? [];
  if (!id || !at || !sig || id !== userId || sign(`${id}.${at}`) !== sig) return false;
  return Date.now() - Number(at) < COOLDOWN_MS;
}

async function markSent(userId: string) {
  const value = `${userId}.${Date.now()}`;
  (await cookies()).set(COOKIE, `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 3600,
  });
}

export async function sendFeedback(message: string, page: string): Promise<FeedbackResult> {
  const text = message.trim().slice(0, 4000);
  if (!text) return { ok: false, error: "Write a few words first." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "Log in to send feedback." };

  const recent = await recentFeedback(data.user.id);
  if (recent && (recent.length >= PER_HOUR || (recent[0] && Date.now() - recent[0] < COOLDOWN_MS))) {
    return { ok: false, error: LIMITED };
  }
  if (await cookieCooldownActive(data.user.id)) return { ok: false, error: LIMITED };

  const pagePath = page.slice(0, 500);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 500) ?? null;
  const { data: profile } = await supabase.from("profiles").select("handle").eq("id", data.user.id).maybeSingle();
  const who = profile?.handle ? `@${profile.handle}` : (data.user.email ?? data.user.id);

  // Stored and emailed independently: if the table isn't there yet, the email still arrives.
  const [{ error }, emailed] = await Promise.all([
    supabase.from("feedback").insert({ message: text, page: pagePath, user_agent: userAgent }),
    emailOwner(text, pagePath, who),
  ]);
  if (error) console.error("feedback insert failed", error.message);
  if (error && !emailed) return { ok: false, error: "That didn't go through. Please try again in a moment." };
  await markSent(data.user.id);
  return { ok: true };
}
