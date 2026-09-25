"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pendingInvitePath, safeNextPath } from "@/lib/post-login";
import { NEEDS_HUMAN_CHECK } from "@/lib/human-check-shared";
import { checkHumanToken, finish, issueStart, type HumanSignals } from "@/lib/human-check";

export async function startHumanCheck() {
  return issueStart();
}

export async function finishHumanCheck(start: string, signals: HumanSignals) {
  const mode = signals?.mode === "keyboard" || signals?.mode === "touch" ? signals.mode : "pointer";
  return finish(String(start), {
    mode,
    placed: Number(signals?.placed) || 0,
    moves: Number(signals?.moves) || 0,
    curved: Number(signals?.curved) || 0,
    attempt: Math.max(1, Math.min(3, Number(signals?.attempt) || 1)),
  });
}

// Supabase's own wording is technical; people get a plain reason and a next step.
function friendlyAuthError(message: string, code?: string) {
  const m = `${message} ${code ?? ""}`;
  if (/rate limit|only request this after|over_email_send_rate/i.test(m)) {
    return "We just sent you an email. Give it a minute, check your spam folder, then try again.";
  }
  if (/invalid login credentials|invalid_credentials/i.test(m)) return "That email and password don't match. Try again, or use a magic link.";
  if (/email not confirmed/i.test(m)) return "Please confirm your email first; the link is in your inbox. Or use a magic link.";
  if (/redirect/i.test(m)) return "Login links are misconfigured on our side. Please use your password for now, or try again later.";
  return message;
}

async function landingPath(userId: string, next: FormDataEntryValue | null) {
  const path = (await pendingInvitePath()) ?? safeNextPath(next);
  if (path) return path;
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("handle").eq("id", userId).maybeSingle();
  const handle = profile?.handle as string | undefined;
  return handle && !handle.startsWith("user-") ? `/${handle}` : "/onboarding";
}

const ALREADY = "This email already has a hoshigo. Log in with your password, or use a magic link.";

// The honeypot is a field people never see; anything in it means a form filler.
function isBot(formData: FormData) {
  return String(formData.get("website") || "") !== "";
}

export async function signInWithPassword(_prev: string | null, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return "Fill in both fields.";

  const supabase = await createClient();
  const { data: signedIn, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return friendlyAuthError(error.message, error.code);

  // Straight to your own page after logging in; people without a page yet finish onboarding first.
  redirect(await landingPath(signedIn.user.id, formData.get("next")));
}

export async function signUpWithPassword(_prev: string | null, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return "Fill in both fields.";
  if (password.length < 8) return "Password needs at least 8 characters.";
  if (isBot(formData)) return "Something went wrong. Please try again.";

  // Someone who already has an account and typed it into the signup form is
  // simply logged in: no human check, no starting over.
  const supabase = await createClient();
  const existing = await supabase.auth.signInWithPassword({ email, password });
  if (!existing.error) redirect(await landingPath(existing.data.user.id, formData.get("next")));

  const human = checkHumanToken(formData.get("human"));
  if (!human.ok) return NEEDS_HUMAN_CHECK;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/confirm` },
  });
  if (error) return /already registered|already exists/i.test(error.message) ? ALREADY : friendlyAuthError(error.message, error.code);
  // Supabase answers an existing, confirmed address with a user that has no identities.
  if (data.user && data.user.identities?.length === 0) return ALREADY;
  if (!data.session) return "Check your email to confirm your address, then you're in.";
  if (human.review) console.warn(`[human-check] review signup user=${data.user?.id ?? "unknown"}`);

  redirect("/onboarding");
}

export async function sendMagicLink(_prev: string | null, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  if (!email) return "Enter your email.";
  if (isBot(formData)) return "Something went wrong. Please try again.";

  // Existing accounts get their link straight away; a new address only gets
  // an account once the human check is done.
  const check = checkHumanToken(formData.get("human"));
  const human = check.ok;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/confirm`,
      shouldCreateUser: human,
    },
  });
  if (error && !human && /signups? not allowed|not found|otp_disabled/i.test(`${error.message} ${error.code ?? ""}`)) {
    return NEEDS_HUMAN_CHECK;
  }
  if (error) return friendlyAuthError(error.message, error.code);
  if (check.review) console.warn("[human-check] review magic link signup");

  return "Check your email for the link.";
}

export async function sendPasswordReset(_prev: string | null, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  if (!email) return "Enter your email.";

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/confirm`,
  });
  // Deliberately show the same message whether or not the email is registered — telling a
  // visitor "that email isn't known to us" lets anyone check who has an account (email
  // enumeration), and Supabase itself only returns that specific error for unknown users, not
  // for real failures (bad request shape, rate limiting, etc. fail closed elsewhere already).
  if (error && !/user not found|not.*(registered|known)/i.test(error.message)) return error.message;

  return "Check your email for a reset link.";
}
