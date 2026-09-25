import type { SupabaseClient } from "@supabase/supabase-js";

export const FEEDBACK_STATUSES = ["open", "planned", "done", "wontfix"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export const STATUS_LABEL: Record<FeedbackStatus, string> = { open: "open", planned: "planned", done: "done", wontfix: "won't do" };

export type FeedbackRow = {
  id: string;
  created_at: string;
  handle: string | null;
  page: string | null;
  message: string;
  user_agent: string | null;
  status: FeedbackStatus | null;
  handled_at: string | null;
  handled_note: string | null;
};

/**
 * All feedback, newest first, with the sender's handle (never their email).
 * hasStatus = false before docs/migrations/2026-09-25-feedback-status.sql has run.
 * null = no feedback table at all.
 */
export async function loadFeedback(admin: SupabaseClient): Promise<{ rows: FeedbackRow[]; hasStatus: boolean } | null> {
  const read = async (cols: string) => {
    const out: Record<string, unknown>[] = [];
    for (let from = 0; from < 50000; from += 1000) {
      const { data, error } = await admin.from("feedback").select(cols).order("created_at", { ascending: false }).range(from, from + 999);
      if (error) return from === 0 ? { error } : { data: out };
      out.push(...((data ?? []) as unknown as Record<string, unknown>[]));
      if (!data || data.length < 1000) break;
    }
    return { data: out };
  };
  let hasStatus = true;
  let res = await read("id, created_at, user_id, page, message, user_agent, status, handled_at, handled_note");
  if ("error" in res) {
    hasStatus = false;
    res = await read("id, created_at, user_id, page, message, user_agent");
    if ("error" in res) return null;
  }
  const rows = res.data ?? [];
  const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean) as string[])];
  const handles = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from("profiles").select("id, handle").in("id", ids.slice(i, i + 200));
    (data ?? []).forEach((p) => handles.set(p.id as string, p.handle as string));
  }
  return {
    hasStatus,
    rows: rows.map((r) => ({
      id: r.id as string,
      created_at: r.created_at as string,
      handle: r.user_id ? handles.get(r.user_id as string) ?? null : null,
      page: (r.page as string) ?? null,
      message: r.message as string,
      user_agent: (r.user_agent as string) ?? null,
      status: hasStatus ? ((r.status as FeedbackStatus) ?? "open") : null,
      handled_at: hasStatus ? ((r.handled_at as string) ?? null) : null,
      handled_note: hasStatus ? ((r.handled_note as string) ?? null) : null,
    })),
  };
}
