"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ADD_COOKIE, ADD_MAX_LENGTH } from "@/lib/add-link";

// Called by /add with the link it read from the address (or null when there was no url=).
// The link is only ever stored for the add dialog's input box; nothing here fetches it or
// redirects to it. Returns a same-site path for the client to go to.
export async function startAdd(link: string | null): Promise<string> {
  const store = await cookies();
  const text = link === null ? store.get(ADD_COOKIE)?.value ?? "" : link.slice(0, ADD_MAX_LENGTH);
  store.set(ADD_COOKIE, text, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 30 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "/login?next=/add";

  const { data: profile } = await supabase.from("profiles").select("handle").eq("id", user.id).maybeSingle();
  const handle = profile?.handle;
  if (!handle || handle.startsWith("user-")) return "/onboarding";
  return `/${handle}?adding=1`;
}

// The dialog has the link; forget it so it doesn't pop up again later.
export async function clearPendingAdd() {
  (await cookies()).delete(ADD_COOKIE);
}
