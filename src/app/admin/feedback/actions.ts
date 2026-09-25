"use server";

import { ownerHandle } from "@/lib/owner";
import { adminClient } from "@/lib/supabase/admin";
import { FEEDBACK_STATUSES, type FeedbackStatus } from "@/lib/feedback-admin";

export async function setFeedbackStatus(
  id: string,
  status: FeedbackStatus,
  note: string
): Promise<{ ok: true; handled_at: string | null } | { ok: false; error: string }> {
  if (!(await ownerHandle())) return { ok: false, error: "Not allowed." };
  const admin = adminClient();
  if (!admin) return { ok: false, error: "Needs SUPABASE_SERVICE_ROLE_KEY." };
  if (!/^[0-9a-f-]{36}$/i.test(id) || !FEEDBACK_STATUSES.includes(status)) return { ok: false, error: "Bad request." };
  const handled_at = status === "done" || status === "wontfix" ? new Date().toISOString() : null;
  const { error } = await admin
    .from("feedback")
    .update({ status, handled_at, handled_note: note.trim().slice(0, 500) || null })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true, handled_at };
}
