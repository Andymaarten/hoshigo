"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function emailOwner(message: string, page: string, who: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = process.env.SIGNUP_NOTIFY_EMAIL?.trim();
  if (!apiKey || !to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.SIGNUP_NOTIFY_FROM?.trim() || "hoshigo <onboarding@resend.dev>",
        to: [to],
        subject: `hoshigo feedback from ${who}`,
        html: `<p style="white-space:pre-wrap">${escapeHtml(message)}</p><p>From: ${escapeHtml(who)}<br>Page: ${escapeHtml(page)}</p>`,
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

export async function sendFeedback(message: string, page: string): Promise<FeedbackResult> {
  const text = message.trim().slice(0, 4000);
  if (!text) return { ok: false, error: "Write a few words first." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "Log in to send feedback." };

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
  return { ok: true };
}
