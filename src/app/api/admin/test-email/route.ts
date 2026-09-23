import { createClient } from "@/lib/supabase/server";

// Diagnostic for the owner only: sends one test email and shows Resend's raw answer.
// Gated on the logged-in account's email matching SIGNUP_NOTIFY_EMAIL, so nobody else can use it.
export async function GET() {
  const to = process.env.SIGNUP_NOTIFY_EMAIL?.trim();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !to || user.email?.toLowerCase() !== to.toLowerCase()) {
    // Yes/no answers only: never echo the configured address to someone who isn't the owner.
    return Response.json(
      {
        error: "Only available to the owner, logged in with the SIGNUP_NOTIFY_EMAIL address.",
        loggedIn: !!user,
        SIGNUP_NOTIFY_EMAIL_set: !!to,
        RESEND_API_KEY_set: !!apiKey,
        yourEmailMatches: !!user && !!to && user.email?.toLowerCase() === to.toLowerCase(),
      },
      { status: 403 }
    );
  }

  const report: Record<string, unknown> = {
    RESEND_API_KEY: apiKey ? `set (starts with ${apiKey.slice(0, 3)}, ${apiKey.length} chars)` : "MISSING",
    SIGNUP_NOTIFY_EMAIL: to,
    from: process.env.SIGNUP_NOTIFY_FROM || "hoshigo <onboarding@resend.dev>",
  };
  if (!apiKey) return Response.json(report);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: report.from,
        to: [to],
        subject: "hoshigo test email",
        html: "<p>If you can read this, signup emails work.</p>",
      }),
      signal: AbortSignal.timeout(8000),
    });
    report.resendStatus = res.status;
    report.resendAnswer = await res.text();
  } catch (err) {
    report.resendError = String(err);
  }
  return Response.json(report);
}
