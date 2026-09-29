"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cleanPrefs } from "@/lib/platforms";

export async function saveLinkPrefs(raw: Record<string, string>): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Log in first.";
  const { error } = await supabase.from("profiles").update({ link_prefs: cleanPrefs(raw) }).eq("id", user.id);
  if (error) return /link_prefs/.test(error.message) ? "This can be saved once the owner has run the latest update." : "Couldn't save that. Try again.";
  revalidatePath("/", "layout");
  return null;
}
