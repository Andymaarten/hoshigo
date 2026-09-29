import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { runWelcome } from "@/lib/welcome";
import { sendDailyPush } from "@/lib/push";
import { runWeekly } from "@/lib/weekly";

// the sends go about one a second; each step stops well before this and carries on next run
export const maxDuration = 300;

// The daily run, called by Vercel Cron (vercel.json) at 07:00 UTC with "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Not found", { status: 404 });
  }
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "Needs SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });
  const deadline = Date.now() + 270_000;

  // 1. welcome emails (and the owner's one off backfill)
  const result = await runWelcome(admin, deadline);
  console.log(`[welcome] ${result.on ? "sending" : "switched off, would send"}:`, JSON.stringify(result.due), `sent=${result.sent}`, result.error ?? "", result.backfill ? `backfill=${JSON.stringify(result.backfill)}` : "");

  // 2. Mondays: the weekly email, only when the owner switched it on (/admin/emails)
  let weekly: Awaited<ReturnType<typeof runWeekly>> | null = null;
  if (new Date().getUTCDay() === 1) {
    const { data } = await admin.from("app_settings").select("value").eq("key", "weekly_emails").maybeSingle();
    if ((data?.value as { on?: boolean } | undefined)?.on === true) weekly = await runWeekly(admin, deadline);
    console.log("[weekly]", weekly ? JSON.stringify(weekly) : "switched off");
  }

  // 3. daily push: one bundled notification per person at most
  const push = await sendDailyPush(admin).catch((e) => ({ people: 0, sent: 0, gone: 0, error: String(e) }));
  console.log("[push]", JSON.stringify(push));

  return NextResponse.json({ ...result, weekly, push });
}
