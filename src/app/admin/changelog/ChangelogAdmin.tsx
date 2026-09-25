"use client";

import { useState, useTransition } from "react";
import type { ChangelogEntry } from "@/lib/changelog";
import { saveEntry, sendTest, sendToEveryone } from "./actions";

const today = () => new Date().toISOString().slice(0, 10);

function day(d: string) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

type Draft = { id?: string; shipped_on: string; title: string; body: string; audience: "public" | "internal"; hidden: boolean };

export default function ChangelogAdmin({
  entries: initial,
  pendingTitles,
  lastSent,
  recipientCount,
  previewHtml,
}: {
  entries: ChangelogEntry[];
  pendingTitles: string[];
  lastSent: string | null;
  recipientCount: number;
  previewHtml: string | null;
}) {
  const [entries, setEntries] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);

  const byDay = new Map<string, ChangelogEntry[]>();
  entries.forEach((e) => byDay.set(e.shipped_on, [...(byDay.get(e.shipped_on) ?? []), e]));

  function saved(e: ChangelogEntry) {
    setEntries((list) => {
      const rest = list.filter((x) => x.id !== e.id);
      return [e, ...rest].sort((a, b) => (a.shipped_on === b.shipped_on ? b.created_at.localeCompare(a.created_at) : b.shipped_on.localeCompare(a.shipped_on)));
    });
    setEditing(null);
  }

  return (
    <>
      <section>
        <h2>add an entry</h2>
        <EntryForm draft={{ shipped_on: today(), title: "", body: "", audience: "public", hidden: false }} onSaved={saved} resetAfter />
      </section>

      <section>
        <h2>compose update</h2>
        <Compose pendingTitles={pendingTitles} lastSent={lastSent} recipientCount={recipientCount} previewHtml={previewHtml} />
      </section>

      <section>
        <h2>all entries</h2>
        {entries.length === 0 && <p className="bio">Nothing yet.</p>}
        {[...byDay.entries()].map(([d, list]) => (
          <div key={d} className="changelog-day">
            <h3 className="block-label">{day(d)}</h3>
            <ul className="stats-feedback">
              {list.map((e) => (
                <li key={e.id}>
                  {editing === e.id ? (
                    <EntryForm
                      draft={{ id: e.id, shipped_on: e.shipped_on, title: e.title, body: e.body ?? "", audience: e.audience, hidden: e.hidden }}
                      onSaved={saved}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <>
                      <span className="feed-meta">
                        <strong>{e.audience === "internal" ? "internal" : "public"}</strong>
                        {e.hidden && <span>hidden</span>}
                      </span>
                      <p style={{ fontWeight: 700 }}>{e.title}</p>
                      {e.body && <p className="feedback-message">{e.body}</p>}
                      <button type="button" className="text-btn" onClick={() => setEditing(e.id)}>
                        Edit
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </>
  );
}

function EntryForm({ draft, onSaved, onCancel, resetAfter }: { draft: Draft; onSaved: (e: ChangelogEntry) => void; onCancel?: () => void; resetAfter?: boolean }) {
  const [d, setD] = useState(draft);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="stack"
      style={{ maxWidth: 560 }}
      onSubmit={(ev) => {
        ev.preventDefault();
        setMsg("");
        start(async () => {
          const res = await saveEntry(d);
          if (res.ok) {
            onSaved(res.entry);
            if (resetAfter) setD({ ...draft, shipped_on: d.shipped_on });
            setMsg("Saved.");
          } else setMsg(res.message);
        });
      }}
    >
      <div className="feedback-controls">
        <input type="date" aria-label="Shipped on" value={d.shipped_on} onChange={(e) => setD({ ...d, shipped_on: e.target.value })} style={{ flex: "none" }} />
        <select aria-label="Audience" value={d.audience} onChange={(e) => setD({ ...d, audience: e.target.value as Draft["audience"] })}>
          <option value="public">public</option>
          <option value="internal">internal</option>
        </select>
        <label className="check-row" style={{ fontSize: 14 }}>
          <input type="checkbox" checked={d.hidden} onChange={(e) => setD({ ...d, hidden: e.target.checked })} />
          Hidden
        </label>
      </div>
      <div className="field">
        <label htmlFor={`t-${d.id ?? "new"}`}>Title</label>
        <input id={`t-${d.id ?? "new"}`} value={d.title} maxLength={200} onChange={(e) => setD({ ...d, title: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor={`b-${d.id ?? "new"}`}>
          A few words <span className="optional">optional</span>
        </label>
        <textarea id={`b-${d.id ?? "new"}`} value={d.body} maxLength={4000} onChange={(e) => setD({ ...d, body: e.target.value })} />
      </div>
      <div className="sheet-row">
        <button type="submit" className="btn btn-small" disabled={pending || !d.title.trim()}>
          {pending ? "Saving…" : "Save"}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-small btn-quiet" onClick={onCancel}>
            Cancel
          </button>
        )}
        {msg && <span className="hint" aria-live="polite">{msg}</span>}
      </div>
    </form>
  );
}

function Compose({ pendingTitles, lastSent, recipientCount, previewHtml }: { pendingTitles: string[]; lastSent: string | null; recipientCount: number; previewHtml: string | null }) {
  const [subject, setSubject] = useState("New on hoshigo");
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  if (!pendingTitles.length) {
    return <p className="bio">Nothing new since {lastSent ? `the last update (${new Date(lastSent).toLocaleDateString("en-GB")})` : "the start"}. Add public entries first.</p>;
  }

  return (
    <div className="stack">
      <p className="bio" style={{ marginTop: 0 }}>
        {pendingTitles.length} {pendingTitles.length === 1 ? "entry" : "entries"} since {lastSent ? `the last update (${new Date(lastSent).toLocaleDateString("en-GB")})` : "the start"}.
      </p>
      <div className="field" style={{ maxWidth: 560 }}>
        <label htmlFor="update-subject">Subject</label>
        <input id="update-subject" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
      </div>
      {previewHtml && <iframe title="Email preview" className="email-preview" srcDoc={previewHtml} sandbox="" />}
      <div className="sheet-row">
        <button
          type="button"
          className="btn btn-small"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setMsg((await sendTest(subject)).message);
            })
          }
        >
          Send test to me
        </button>
        {confirming ? (
          <>
            <button
              type="button"
              className="btn btn-small btn-danger"
              disabled={pending || !subject.trim()}
              onClick={() =>
                start(async () => {
                  const res = await sendToEveryone(subject, recipientCount);
                  setMsg(res.message);
                  setConfirming(false);
                })
              }
            >
              Yes, send to {recipientCount} people
            </button>
            <button type="button" className="btn btn-small btn-quiet" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-small" disabled={pending || !subject.trim()} onClick={() => setConfirming(true)}>
            Send to everyone
          </button>
        )}
      </div>
      {msg && (
        <p className="hint" aria-live="polite">
          {msg}
        </p>
      )}
    </div>
  );
}
