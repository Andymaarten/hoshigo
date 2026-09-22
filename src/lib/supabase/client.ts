import { createBrowserClient } from "@supabase/ssr";

// Not parameterized with a Database generic — supabase-js's generic typing is finicky
// to hand-roll correctly without codegen. Query results are typed at the call site instead.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
