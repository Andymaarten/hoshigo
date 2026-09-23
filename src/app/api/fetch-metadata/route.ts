import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readLink } from "@/lib/read-link";

let slugCache: { at: number; slugs: string[] } | null = null;

async function categorySlugs(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string[]> {
  if (slugCache && Date.now() - slugCache.at < 10 * 60_000) return slugCache.slugs;
  try {
    const { data } = await supabase.from("categories").select("slug");
    const slugs = (data ?? []).map((c: { slug: string }) => c.slug);
    if (slugs.length) slugCache = { at: Date.now(), slugs };
    return slugs;
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const raw = request.nextUrl.searchParams.get("url") ?? "";
  const useLlm = request.nextUrl.searchParams.get("llm") !== "0";
  try {
    return NextResponse.json(await readLink(raw, await categorySlugs(supabase), { useLlm }));
  } catch {
    return NextResponse.json({ status: "error" });
  }
}
