"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signInWithPassword(_prev: string | null, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return "Fill in both fields.";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return error.message;

  redirect("/");
}

export async function signUpWithPassword(_prev: string | null, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return "Fill in both fields.";
  if (password.length < 8) return "Password needs at least 8 characters.";

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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/confirm` },
  });
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
