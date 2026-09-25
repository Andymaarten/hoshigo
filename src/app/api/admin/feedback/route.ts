import { NextResponse } from "next/server";
import { ownerHandle } from "@/lib/owner";
import { adminClient } from "@/lib/supabase/admin";
import { loadFeedback } from "@/lib/feedback-admin";

// Owner only JSON export of all feedback; everyone else gets a plain 404.
export async function GET() {
  if (!(await ownerHandle())) return new NextResponse("Not found", { status: 404 });
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "Needs SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });
  const data = await loadFeedback(admin);
  if (!data) return NextResponse.json({ error: "No feedback table" }, { status: 503 });
  return NextResponse.json(data.rows, { headers: { "Cache-Control": "no-store" } });
}
