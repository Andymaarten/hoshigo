import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { runWelcome } from "@/lib/welcome";

// the backfill sends about one email a second; stop well before this and carry on next run
export const maxDuration = 300;

// Called once a day by Vercel Cron (vercel.json), which sends "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Not found", { status: 404 });
  }
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "Needs SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });
  const result = await runWelcome(admin, Date.now() + 270_000);
  console.log(`[welcome] ${result.on ? "sending" : "switched off, would send"}:`, JSON.stringify(result.due), `sent=${result.sent}`, result.error ?? "", result.backfill ? `backfill=${JSON.stringify(result.backfill)}` : "");
  return NextResponse.json(result);
}
