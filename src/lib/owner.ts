import { createClient } from "@/lib/supabase/server";

export function ownerHandles(): string[] {
  return (process.env.OWNER_HANDLES || "andymaarten")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

// The logged in owner's handle, or null for everyone else (callers answer 404 then).
export async function ownerHandle(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("handle").eq("id", user.id).maybeSingle();
  const handle = (data?.handle as string | undefined)?.toLowerCase();
  return handle && ownerHandles().includes(handle) ? handle : null;
}
