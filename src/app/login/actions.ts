"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pendingInvitePath, safeNextPath } from "@/lib/post-login";
import { NEEDS_HUMAN_CHECK } from "@/lib/human-check-shared";
import { finish, isHumanToken, issueStart, type HumanSignals } from "@/lib/human-check";

export async function startHumanCheck() {
  return issueStart();
}

export async function finishHumanCheck(start: string, signals: HumanSignals) {
  return finish(String(start), {
    mode: signals?.mode === "keyboard" ? "keyboard" : "pointer",
    placed: Number(signals?.placed) || 0,
    moves: Number(signals?.moves) || 0,
    curved: Number(signals?.curved) || 0,
  });
}

// The honeypot is a field people never see; anything in it means a form filler.
function isBot(formData: FormData) {
  return String(formData.get("website") || "") !== "";
}

export async function signInWithPassword(_prev: string | null, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return "Fill in both fields.";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return error.message;

  redirect((await pendingInvitePath()) ?? safeNextPath(formData.get("next")) ?? "/");
}

export async function signUpWithPassword(_prev: string | null, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return "Fill in both fields.";
  if (password.length < 8) return "Password needs at least 8 characters.";
  if (isBot(formData)) return "Something went wrong. Please try again.";
  if (!isHumanToken(formData.get("human"))) return NEEDS_HUMAN_CHECK;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/confirm` },
  });
  if (error) return error.message;

  redirect("/onboarding");
}

export async function sendMagicLink(_prev: string | null, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  if (!email) return "Enter your email.";
  if (isBot(formData)) return "Something went wrong. Please try again.";

  // Existing accounts get their link straight away; a new address only gets
  // an account once the human check is done.
  const human = isHumanToken(formData.get("human"));
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
  if (error) return error.message;

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
