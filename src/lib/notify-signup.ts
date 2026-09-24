import { renderEmail } from "@/lib/email-layout";

export async function notifyNewSignup({ handle, displayName, email }: { handle: string; displayName: string; email: string | undefined }) {
  const apiKey = process.env.RESEND_API_KEY?.replace(/\s+/g, "");
  const to = process.env.SIGNUP_NOTIFY_EMAIL?.trim();
  if (!apiKey || !to) {
    console.warn("signup notify skipped: RESEND_API_KEY or SIGNUP_NOTIFY_EMAIL missing");
    return;
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.hoshigo.cc";
  const name = displayName || handle;
  const { html, text } = renderEmail({
    preheader: `${name} just made a hoshigo page.`,
    heading: "Someone new.",
    paragraphs: [[{ strong: name }, " just made a hoshigo page."], `Page: ${site}/${handle}\nEmail: ${email ?? "unknown"}`],
    button: { label: "Open their page", href: `${site}/${encodeURIComponent(handle)}` },
    footer: "Sent to you because you make hoshigo.",
  });
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.SIGNUP_NOTIFY_FROM?.trim() || "hoshigo <onboarding@resend.dev>",
        to: [to],
        subject: `Someone new: ${name} (@${handle})`,
        html,
        text,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("signup notify failed", res.status, await res.text());
  } catch (err) {
    // a missed notification must never block someone finishing their signup
    console.error("signup notify failed", err);
  }
}
