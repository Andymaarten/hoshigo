function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Email addresses are only ever read here, server side, with the service role key; nothing a
// logged in user can call returns another person's address.
export async function notifyFriendRequest({ toId, fromName, fromHandle }: { toId: string; fromName: string; fromHandle: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!apiKey || !serviceKey || !base) return;

  const admin = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://www.hoshigo.cc";
  try {
    const prefRes = await fetch(`${base}/rest/v1/profiles?select=email_friend_requests,auto_accept_friends&id=eq.${toId}`, {
      headers: admin,
      signal: AbortSignal.timeout(4000),
    });
    const [pref] = prefRes.ok ? await prefRes.json() : [];
    if (!pref?.email_friend_requests || pref.auto_accept_friends) return;

    const userRes = await fetch(`${base}/auth/v1/admin/users/${toId}`, { headers: admin, signal: AbortSignal.timeout(4000) });
    const email = userRes.ok ? ((await userRes.json()).email as string | undefined) : undefined;
    if (!email) return;

    const name = escapeHtml(fromName);
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.FRIENDS_EMAIL_FROM || "hoshigo <onboarding@resend.dev>",
        to: [email],
        subject: `${fromName} wants to be friends on hoshigo`,
        html: `<p>Hi,</p>
<p><strong>${name}</strong> (@${escapeHtml(fromHandle)}) would like to be your friend on hoshigo. Friends can see everything on each other's page.</p>
<p><a href="${site}/friends">Say yes or no on your Friends page</a></p>
<p>Warmly,<br>hoshigo</p>
<p style="color:#888;font-size:12px">You get this because you asked for friend request emails. You can turn them off in your settings.</p>`,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // an email that fails must never undo or block the request itself
  }
}
