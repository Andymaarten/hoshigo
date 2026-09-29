"use client";

import { useState, useTransition } from "react";
import { previewWeekly, setWeekly, testWeekly } from "./actions";

export default function WeeklyAdmin({ on: initialOn, defaultHandle }: { on: boolean; defaultHandle: string }) {
  const [on, setOn] = useState(initialOn);
  const [handle, setHandle] = useState(defaultHandle);
  const [preview, setPreview] = useState<{ html: string; subject: string; note: string } | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="stack">
      <div className="mode-tabs" role="radiogroup" aria-label="Weekly email">
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
                const err = await setWeekly(v);
                if (!err) setOn(v);
                setMsg(err ?? "");
              })
            }
          >
            {v ? "on" : "off"}
          </button>
        ))}
      </div>
      <p className="bio" style={{ marginTop: 0 }}>
        Mondays at 09:00 to people who chose the weekly email. {on ? "Sending is on." : "Off: nothing is sent."} Skipped for anyone with nothing new.
      </p>
      <div className="feedback-controls">
        <input aria-label="Page name" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="page name" />
        <button
          type="button"
          className="btn btn-small"
          disabled={pending || !handle.trim()}
          onClick={() =>
            start(async () => {
              const r = await previewWeekly(handle);
              if ("error" in r) {
                setPreview(null);
                setMsg(r.error);
              } else {
                setPreview(r);
                setMsg("");
              }
            })
          }
        >
          Preview
        </button>
        <button type="button" className="btn btn-small" disabled={pending || !handle.trim()} onClick={() => start(async () => setMsg(await testWeekly(handle)))}>
          Send test to me
        </button>
      </div>
      {msg && <p className="hint">{msg}</p>}
      {preview && (
        <>
          <p className="bio">
            Subject: {preview.subject}. {preview.note}
          </p>
          <iframe title="Weekly email preview" className="email-preview" srcDoc={preview.html} sandbox="" />
        </>
      )}
    </div>
  );
}
