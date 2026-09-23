function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function notifyNewSignup({ handle, displayName, email }: { handle: string; displayName: string; email: string | undefined }) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.SIGNUP_NOTIFY_EMAIL;
  if (!apiKey || !to) {
    console.warn("signup notify skipped: RESEND_API_KEY or SIGNUP_NOTIFY_EMAIL missing");
    return;
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://www.hoshigo.cc";
  const name = displayName || handle;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.SIGNUP_NOTIFY_FROM || "hoshigo <onboarding@resend.dev>",
        to: [to],
        subject: `New on hoshigo: ${name} (@${handle})`,
        html: `<p><strong>${escapeHtml(name)}</strong> just joined hoshigo.</p>
<p>Page: <a href="${site}/${encodeURIComponent(handle)}">${site}/${escapeHtml(handle)}</a><br>Email: ${escapeHtml(email ?? "unknown")}</p>`,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("signup notify failed", res.status, await res.text());
  } catch (err) {
    // a missed notification must never block someone finishing their signup
    console.error("signup notify failed", err);
  }
}
