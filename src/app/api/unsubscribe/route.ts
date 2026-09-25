import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { readUnsubscribeToken } from "@/lib/changelog";

// One click unsubscribe (RFC 8058): mail apps POST here from the List-Unsubscribe header.
export async function POST(request: NextRequest) {
  const id = readUnsubscribeToken(request.nextUrl.searchParams.get("t"));
  const admin = adminClient();
  if (!id || !admin) return new NextResponse("Invalid", { status: 400 });
  await admin.from("profiles").update({ email_updates: false }).eq("id", id);
  return new NextResponse("Unsubscribed", { status: 200 });
}

// A plain visit goes to the page with the button.
export async function GET(request: NextRequest) {
  const t = request.nextUrl.searchParams.get("t") ?? "";
  return NextResponse.redirect(new URL(`/unsubscribe?t=${encodeURIComponent(t)}`, request.url));
}
