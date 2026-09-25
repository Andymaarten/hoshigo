"use server";

import { revalidatePath } from "next/cache";
import { ownerHandle } from "@/lib/owner";
import { adminClient } from "@/lib/supabase/admin";
import { pendingEntries, recipients, renderUpdate, sendBatch, SITE, unsubscribeToken, type ChangelogEntry } from "@/lib/changelog";

type Result = { ok: true; message: string } | { ok: false; message: string };

async function gate() {
  if (!(await ownerHandle())) return null;
  return adminClient();
}

export async function saveEntry(entry: {
  id?: string;
  shipped_on: string;
  title: string;
  body: string;
  audience: "public" | "internal";
  hidden: boolean;
}): Promise<{ ok: true; entry: ChangelogEntry } | { ok: false; message: string }> {
  const admin = await gate();
  if (!admin) return { ok: false, message: "Not allowed." };
  const title = entry.title.trim().slice(0, 200);
  if (!title) return { ok: false, message: "A title is needed." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.shipped_on)) return { ok: false, message: "That date doesn't look right." };
  const row = {
    shipped_on: entry.shipped_on,
    title,
    body: entry.body.trim().slice(0, 4000) || null,
    audience: entry.audience === "internal" ? "internal" : "public",
    hidden: !!entry.hidden,
  };
  const q = entry.id ? admin.from("changelog_entries").update(row).eq("id", entry.id) : admin.from("changelog_entries").insert(row);
  const { data, error } = await q.select("*").single();
  if (error) return { ok: false, message: error.message };
  return { ok: true, entry: data as ChangelogEntry };
}

function compose(entries: ChangelogEntry[], userId: string) {
  const t = encodeURIComponent(unsubscribeToken(userId));
  const unsubscribeUrl = `${SITE()}/unsubscribe?t=${t}`;
  const oneClickUrl = `${SITE()}/api/unsubscribe?t=${t}`;
  return { ...renderUpdate(entries, unsubscribeUrl), unsubscribeUrl, oneClickUrl };
}

export async function sendTest(subject: string): Promise<Result> {
  const admin = await gate();
  if (!admin) return { ok: false, message: "Not allowed." };
  const to = process.env.SIGNUP_NOTIFY_EMAIL;
  if (!to) return { ok: false, message: "SIGNUP_NOTIFY_EMAIL is not set." };
  const entries = await pendingEntries(admin);
  if (!entries.length) return { ok: false, message: "Nothing new to send yet." };
  // a real token for a made up id: the link works visually but unsubscribes nobody
  const mail = compose(entries, "00000000-0000-0000-0000-000000000000");
  const res = await sendBatch([{ to, subject: `[test] ${subject}`, ...mail }]);
  return res.error ? { ok: false, message: res.error } : { ok: true, message: `Test sent to ${to}.` };
}

export async function sendToEveryone(subject: string, expectedCount: number): Promise<Result> {
  const admin = await gate();
  if (!admin) return { ok: false, message: "Not allowed." };
  const clean = subject.trim().slice(0, 200);
  if (!clean) return { ok: false, message: "A subject is needed." };
  const entries = await pendingEntries(admin);
  if (!entries.length) return { ok: false, message: "Nothing new to send." };
  const people = await recipients(admin);
  if (!people.length) return { ok: false, message: "Nobody to send to." };
  // the confirm step showed a number; if it moved a lot, stop and show the new one
  if (Math.abs(people.length - expectedCount) > Math.max(5, expectedCount * 0.1)) {
    return { ok: false, message: `The list changed to ${people.length} people. Check and confirm again.` };
  }
  const { data: record, error: recErr } = await admin
    .from("update_emails")
    .insert({ subject: clean, entry_ids: entries.map((e) => e.id) })
    .select("id")
    .single();
  if (recErr) return { ok: false, message: recErr.message };

  const res = await sendBatch(people.map((p) => ({ to: p.email, subject: clean, ...compose(entries, p.id) })));
  // only a send that went out marks these entries as covered
  if (res.sent > 0) {
    await admin.from("update_emails").update({ sent_at: new Date().toISOString(), sent_count: res.sent }).eq("id", record.id);
  }
  revalidatePath("/admin/changelog");
  return res.error
    ? { ok: false, message: `Sent to ${res.sent} of ${people.length}, then: ${res.error}` }
    : { ok: true, message: `Sent to ${res.sent} people.` };
}
