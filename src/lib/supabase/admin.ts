import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null | undefined;

// Server only. supabase-js handles both key formats (legacy service_role JWT and the newer
// sb_secret_ keys); hand-built "Authorization: Bearer" headers break with the latter.
export function adminClient(): SupabaseClient | null {
  if (admin === undefined) {
    // A key pasted into Vercel can pick up a line break; any whitespace inside a key is never valid.
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    admin = key && url ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  }
  return admin;
}
