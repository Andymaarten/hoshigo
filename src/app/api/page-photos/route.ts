import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readPhotos } from "@/lib/read-link";

// Photos from any page or image link, for the photo picker. Only returns image URLs; the
// item's own link, title and category are never touched by this.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const raw = request.nextUrl.searchParams.get("url") ?? "";
  try {
    return NextResponse.json(await readPhotos(raw));
  } catch {
    return NextResponse.json({ status: "error", images: [] });
  }
}
