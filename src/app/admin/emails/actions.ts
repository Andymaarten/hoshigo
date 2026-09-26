"use server";

import { revalidatePath } from "next/cache";
import { ownerHandle } from "@/lib/owner";
import { adminClient } from "@/lib/supabase/admin";
import { sendOne } from "@/lib/changelog";
import { composeWelcome, setWelcomeSwitch } from "@/lib/welcome";
import type { WelcomeStep } from "@/lib/welcome-copy";
import { browseListings, type BrowseQuery, type BrowseRow } from "@/lib/picks-browse";

const UUID_RE = /^[0-9a-f-]{36}$/i;

async function gate() {
  return (await ownerHandle()) ? adminClient() : null;
}

export async function setWelcome(on: boolean): Promise<string | null> {
  const admin = await gate();
  if (!admin) return "Not allowed.";
  const { error } = await setWelcomeSwitch(admin, on);
  revalidatePath("/admin/emails");
  return error ? error.message : null;
}

async function personFor(handle: string) {
  const admin = await gate();
  if (!admin) return null;
  const { data } = await admin.from("profiles").select("id, handle, display_name").eq("handle", handle.trim().toLowerCase()).maybeSingle();
  return data ? { admin, profileId: data.id as string, handle: data.handle as string, name: (data.display_name as string) || (data.handle as string) } : null;
}

export async function previewWelcome(handle: string, step: WelcomeStep): Promise<{ html: string; subject: string; picks: number } | { error: string }> {
  const p = await personFor(handle);
  if (!p) return { error: "No such page (or not allowed)." };
  const mail = await composeWelcome(p.admin, step, p);
  return { html: mail.previewHtml, subject: mail.subject, picks: mail.picks.length };
}

export async function testWelcome(handle: string, step: WelcomeStep): Promise<string> {
  const p = await personFor(handle);
  if (!p) return "No such page (or not allowed).";
  // Test sends go to TEST_EMAIL_TO when set (e.g. a Hotmail inbox), else to the owner notification address.
  const to = (process.env.TEST_EMAIL_TO || process.env.SIGNUP_NOTIFY_EMAIL)?.trim();
  if (!to) return "SIGNUP_NOTIFY_EMAIL is not set.";
  const mail = await composeWelcome(p.admin, step, p);
  // a test never records picks or steps, and its unsubscribe link points at the chosen person
  const res = await sendOne({ to, subject: `[test] ${mail.subject}`, html: mail.html, text: mail.text, ...mail.links }, mail.inline);
  return res.error ?? `Test sent to ${to}.`;
}

/** Approve a listing as a tip: its catalogue work when it has one (any good listing of it may be shown). */
export async function approveTip(itemId: string, on: boolean): Promise<string | null> {
  const admin = await gate();
  if (!admin || !UUID_RE.test(itemId)) return "Not allowed.";
  const { data: item } = await admin.from("items").select("id, work_id").eq("id", itemId).maybeSingle();
  if (!item) return "That listing is gone.";
  if (on) {
    const row: { work_id: string | null; item_id: string | null } = item.work_id ? { work_id: item.work_id, item_id: null } : { work_id: null, item_id: item.id };
    const { error } = await admin.from("pick_approved").insert(row);
    if (error && error.code !== "23505") return error.message;
  } else {
    await admin.from("pick_approved").delete().eq("item_id", item.id);
    if (item.work_id) await admin.from("pick_approved").delete().eq("work_id", item.work_id).is("item_id", null);
  }
  revalidatePath("/admin/emails");
  return null;
}

export async function removeApproved(id: string): Promise<string | null> {
  const admin = await gate();
  if (!admin || !UUID_RE.test(id)) return "Not allowed.";
  const { error } = await admin.from("pick_approved").delete().eq("id", id);
  revalidatePath("/admin/emails");
  return error ? error.message : null;
}

export async function browseTips(query: BrowseQuery): Promise<{ rows: BrowseRow[]; hasMore: boolean; total: number } | null> {
  const admin = await gate();
  if (!admin) return null;
  return browseListings(admin, {
    q: String(query.q ?? "").slice(0, 60),
    category: Number.isInteger(query.category) ? query.category : null,
    withNote: !!query.withNote,
    withCover: !!query.withCover,
    sort: query.sort === "kept" ? "kept" : "newest",
    page: Math.max(0, Math.floor(Number(query.page) || 0)),
  });
}
