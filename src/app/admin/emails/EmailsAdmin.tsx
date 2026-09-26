"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import CoverImage from "@/components/CoverImage";
import { WELCOME_COPY, WELCOME_DAYS, type WelcomeStep } from "@/lib/welcome-copy";
import { approveTip, previewWelcome, removeApproved, setWelcome, testWelcome } from "./actions";

export type Candidate = { id: string; title: string; by: string | null; imageUrl: string; note: string; handle: string; matched: boolean; approved: boolean };
export type Approved = { id: string; kind: "work" | "listing"; title: string; by: string | null };

const STEPS: WelcomeStep[] = [1, 2, 3];

export default function EmailsAdmin({
  on: initialOn,
  due,
  candidates,
  approved: initialApproved,
  defaultHandle,
}: {
  on: boolean;
  due: { handle: string; step: number }[];
  candidates: Candidate[];
  approved: Approved[];
  defaultHandle: string;
}) {
  const [on, setOn] = useState(initialOn);
  const [pending, start] = useTransition();
  const [handle, setHandle] = useState(defaultHandle);
  const [step, setStep] = useState<WelcomeStep>(1);
  const [preview, setPreview] = useState<{ html: string; subject: string; picks: number } | null>(null);
  const [msg, setMsg] = useState("");
  const [approvedIds, setApprovedIds] = useState(new Set(candidates.filter((c) => c.approved).map((c) => c.id)));
  const [approved, setApproved] = useState(initialApproved);

  return (
    <>
      <section>
        <h2>welcome emails</h2>
        <div className="mode-tabs" role="radiogroup" aria-label="Welcome emails">
          {[false, true].map((v) => (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={on === v}
              className={`mode-tab${on === v ? " active" : ""}`}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const err = await setWelcome(v);
                  if (!err) setOn(v);
                  setMsg(err ?? "");
                })
              }
            >
              {v ? "on" : "off"}
            </button>
          ))}
        </div>
        <p className="bio">
          Sent once a day around 09:00: day {WELCOME_DAYS[1]} (fewer than 3 hoshigos), day {WELCOME_DAYS[2]} (no app yet), day{" "}
          {WELCOME_DAYS[3]}. {on ? "Sending is on." : "Off: the daily run only logs what it would send."}
        </p>
        <p className="bio">
          {due.length ? `Due today: ${due.map((d) => `@${d.handle} (${d.step})`).join(", ")}.` : "Nobody is due today."}
        </p>
      </section>

      <section>
        <h2>preview</h2>
        <div className="feedback-controls">
          <input aria-label="Page name" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="page name" />
          <select aria-label="Which email" value={step} onChange={(e) => setStep(Number(e.target.value) as WelcomeStep)}>
            {STEPS.map((s) => (
              <option key={s} value={s}>
                day {WELCOME_DAYS[s]}: {WELCOME_COPY[s].subject}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-small"
            disabled={pending || !handle.trim()}
            onClick={() =>
              start(async () => {
                const res = await previewWelcome(handle, step);
                if ("error" in res) {
                  setMsg(res.error);
                  setPreview(null);
                } else {
                  setPreview(res);
                  setMsg("");
                }
              })
            }
          >
            Preview
          </button>
          <button type="button" className="btn btn-small" disabled={pending || !handle.trim()} onClick={() => start(async () => setMsg(await testWelcome(handle, step)))}>
            Send test to me
          </button>
        </div>
        {msg && <p className="hint">{msg}</p>}
        {preview && (
          <>
            <p className="bio">
              Subject: {preview.subject}. {preview.picks ? `${preview.picks} tips.` : "No tips (fewer than 2 approved ones fit this person)."}
            </p>
            <iframe title="Email preview" className="email-preview" srcDoc={preview.html} sandbox="" />
          </>
        )}
      </section>

      <section>
        <h2>approved tips</h2>
        {approved.length === 0 ? (
          <p className="bio">None yet. Approve a few below.</p>
        ) : (
          <ul className="stats-list">
            {approved.map((a) => (
              <li key={a.id}>
                {a.title}
                {a.by && <span className="by">, {a.by}</span>} <span className="by">({a.kind})</span>{" "}
                <button
                  type="button"
                  className="text-btn"
                  onClick={() =>
                    start(async () => {
                      if (!(await removeApproved(a.id))) setApproved((l) => l.filter((x) => x.id !== a.id));
                    })
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>candidates</h2>
        <p className="bio">Recent listings on public pages with a cover and a note, catalogue matches first. Approving a matched one approves the work.</p>
        <ul className="feed-list">
          {candidates.map((c) => (
            <li key={c.id} className="feed-row someday-row">
              <div className="thumb" aria-hidden="true">
                <CoverImage src={c.imageUrl} small />
              </div>
              <div className="feed-txt">
                <span className="title">{c.title}</span>
                {c.by && <span className="by">{c.by}</span>}
                <span className="someday-meta">
                  <Link href={`/${c.handle}/${c.id}`}>@{c.handle}</Link> · {c.matched ? "catalogue" : "by hand"}
                </span>
                <p className="someday-note">{c.note.slice(0, 200)}</p>
              </div>
              <div className="someday-actions">
                <label className="check-row" style={{ fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={approvedIds.has(c.id)}
                    disabled={pending}
                    onChange={(e) => {
                      const v = e.target.checked;
                      start(async () => {
                        const err = await approveTip(c.id, v);
                        if (err) return setMsg(err);
                        setApprovedIds((s) => {
                          const n = new Set(s);
                          if (v) n.add(c.id);
                          else n.delete(c.id);
                          return n;
                        });
                      });
                    }}
                  />
                  Approve for tips
                </label>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
