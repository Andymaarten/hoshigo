import { adminClient } from "@/lib/supabase/admin";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Email addresses are only ever read here, server side, with the service role key; nothing a
// logged in user can call returns another person's address.
export async function notifyFriendRequest({ toId, fromName, fromHandle }: { toId: string; fromName: string; fromHandle: string }) {
  const apiKey = process.env.RESEND_API_KEY?.replace(/\s+/g, "");
  const admin = adminClient();
  if (!apiKey || !admin) {
    console.warn("friend request email skipped: RESEND_API_KEY or SUPABASE_SERVICE_ROLE_KEY missing");
    return;
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.hoshigo.cc";
  try {
    const { data: pref, error: prefError } = await admin
      .from("profiles")
      .select("email_friend_requests, auto_accept_friends")
      .eq("id", toId)
      .maybeSingle();
    if (prefError) console.error("friend request email: reading preferences failed", prefError.message);
    if (!pref?.email_friend_requests || pref.auto_accept_friends) return;

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(toId);
    const email = userData?.user?.email;
    if (!email) {
      console.error("friend request email: no address for recipient", userError?.message);
      return;
    }

    const name = escapeHtml(fromName);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.FRIENDS_EMAIL_FROM?.trim() || "hoshigo <onboarding@resend.dev>",
        to: [email],
        subject: `${fromName} wants to be your friend`,
        html: `<p>Hello! <strong>${name}</strong> (@${escapeHtml(fromHandle)}) wants to be your friend.</p>
<p>${name} would like to be able to see all your hoshigos. Friends see everything on each other&rsquo;s page, not just the latest five.</p>
<p><a href="${site}/friends">Say yes or no on your Friends page</a></p>
<p>No rush. The request will wait.</p>
<p>hoshigo</p>
<p style="color:#888;font-size:12px">You get this because you turned on friend request emails. You can turn them off in your settings.</p>`,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("friend request email failed", res.status, await res.text());
  } catch (err) {
    // an email that fails must never undo or block the request itself
    console.error("friend request email failed", err);
  }
}
