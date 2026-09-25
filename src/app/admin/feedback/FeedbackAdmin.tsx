"use client";

import { useState, useTransition } from "react";
import { FEEDBACK_STATUSES, STATUS_LABEL, type FeedbackRow, type FeedbackStatus } from "@/lib/feedback-admin";
import { setFeedbackStatus } from "./actions";

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function safeHref(page: string | null): string | null {
  if (!page) return null;
  if (page.startsWith("/") && !page.startsWith("//")) return page;
  try {
    const u = new URL(page);
    return u.protocol === "https:" || u.protocol === "http:" ? page : null;
  } catch {
    return null;
  }
}

export default function FeedbackAdmin({ rows: initial, hasStatus }: { rows: FeedbackRow[]; hasStatus: boolean }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<Set<FeedbackStatus>>(new Set(["open", "planned"]));

  const visible = hasStatus ? rows.filter((r) => filter.has(r.status ?? "open")) : rows;

  function toggle(s: FeedbackStatus) {
    setFilter((f) => {
      const next = new Set(f);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  return (
    <>
      {hasStatus && (
        <div className="chip-row" role="group" aria-label="Show messages that are">
          {FEEDBACK_STATUSES.map((s) => (
            <button key={s} type="button" className={`chip${filter.has(s) ? " active" : ""}`} aria-pressed={filter.has(s)} onClick={() => toggle(s)}>
              {STATUS_LABEL[s]} ({rows.filter((r) => (r.status ?? "open") === s).length})
            </button>
          ))}
        </div>
      )}
      {visible.length === 0 ? (
        <p className="bio">Nothing here.</p>
      ) : (
        <ul className="stats-feedback">
          {visible.map((r) => (
            <FeedbackItem key={r.id} row={r} hasStatus={hasStatus} onSaved={(u) => setRows((rs) => rs.map((x) => (x.id === u.id ? u : x)))} />
          ))}
        </ul>
      )}
    </>
  );
}

function FeedbackItem({ row, hasStatus, onSaved }: { row: FeedbackRow; hasStatus: boolean; onSaved: (r: FeedbackRow) => void }) {
  const [status, setStatus] = useState<FeedbackStatus>(row.status ?? "open");
  const [note, setNote] = useState(row.handled_note ?? "");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const href = safeHref(row.page);
  const dirty = status !== (row.status ?? "open") || note !== (row.handled_note ?? "");

  return (
    <li>
      <span className="feed-meta">
        <time dateTime={row.created_at}>{formatDate(row.created_at)}</time>
        <span>{row.handle ? `@${row.handle}` : "logged out"}</span>
        {row.page && (href ? <a href={href}>{row.page}</a> : <span>{row.page}</span>)}
        {hasStatus && <strong>{STATUS_LABEL[row.status ?? "open"]}</strong>}
        {row.handled_at && <span>handled {formatDate(row.handled_at)}</span>}
      </span>
      <p className="feedback-message">{row.message}</p>
      {hasStatus && (
        <form
          className="feedback-controls"
          onSubmit={(e) => {
            e.preventDefault();
            setMsg("");
            start(async () => {
              const res = await setFeedbackStatus(row.id, status, note);
              if (res.ok) {
                onSaved({ ...row, status, handled_note: note.trim() || null, handled_at: res.handled_at });
                setMsg("Saved.");
              } else setMsg(res.error);
            });
          }}
        >
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as FeedbackStatus)}>
            {FEEDBACK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <input aria-label="Note" placeholder="A short note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="submit" className="btn btn-small" disabled={pending || !dirty}>
            {pending ? "Saving…" : "Save"}
          </button>
          {msg && <span className="hint" aria-live="polite">{msg}</span>}
        </form>
      )}
    </li>
  );
}
