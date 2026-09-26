import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { runWelcome } from "@/lib/welcome";

// Called once a day by Vercel Cron (vercel.json), which sends "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Not found", { status: 404 });
  }
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "Needs SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });
  const result = await runWelcome(admin);
  console.log(`[welcome] ${result.on ? "sending" : "switched off, would send"}:`, JSON.stringify(result.due), `sent=${result.sent}`, result.error ?? "");
  return NextResponse.json(result);
}
