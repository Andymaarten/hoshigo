import { adminClient } from "@/lib/supabase/admin";

import { renderEmail } from "@/lib/email-layout";

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

    const { html, text } = renderEmail({
      preheader: `${fromName} would like to be able to see all your hoshigos.`,
      heading: `Hello! ${fromName} wants to be your friend.`,
      paragraphs: [
        [{ strong: fromName }, ` (@${fromHandle}) would like to be able to see all your hoshigos. Friends see everything on each other’s page, not just the latest five.`],
        "No rush. The request will wait.",
      ],
      button: { label: "Say yes or no", href: `${site}/friends` },
      footer: "You get this because you turned on friend request emails.",
      footerLink: { label: "Turn them off in your settings", href: `${site}/settings#friend-emails` },
    });
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.FRIENDS_EMAIL_FROM?.trim() || "hoshigo <onboarding@resend.dev>",
        to: [email],
        subject: `${fromName} wants to be your friend`,
        html,
        text,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("friend request email failed", res.status, await res.text());
  } catch (err) {
    // an email that fails must never undo or block the request itself
    console.error("friend request email failed", err);
  }
}
