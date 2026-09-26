"use client";

import { useState, useTransition } from "react";
import type { BackfillState } from "@/lib/welcome";
import { cancelBackfill, scheduleBackfill } from "./actions";

function when(s: string) {
  return new Date(s).toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

/** The one off welcome for people from before it existed: confirm, then the next daily run sends it. */
export default function Backfill({ count, state: initial }: { count: number; state: BackfillState | null }) {
  const [state, setState] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const last = state?.lastRun;

  return (
    <div className="stack">
      {last && (
        <p className="bio" style={{ marginTop: 0 }}>
          Last run {when(last.at)}: sent to {last.sent}
          {last.failed ? `, ${last.failed} failed` : ""}
          {last.left ? `, ${last.left} left for the next run` : ""}.
        </p>
      )}
      {state?.pending ? (
        <div className="sheet-row">
          <span className="bio" style={{ margin: 0 }}>
            Scheduled for the next run at 09:00{last?.left ? " (continuing)" : ""}.
          </span>
          <button
            type="button"
            className="btn btn-small btn-quiet"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const err = await cancelBackfill();
                if (err) setMsg(err);
                else setState({ ...state, pending: false });
              })
            }
          >
            Cancel
          </button>
        </div>
      ) : count === 0 ? (
        <p className="bio" style={{ marginTop: 0 }}>
          Everyone with a page has had the welcome.
        </p>
      ) : confirming ? (
        <div className="sheet-row">
          <button
            type="button"
            className="btn btn-small btn-danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await scheduleBackfill();
                setMsg(res.message);
                setConfirming(false);
                if (res.ok) setState({ ...(state ?? { pending: false }), pending: true, requestedAt: new Date().toISOString() });
              })
            }
          >
            Yes, send it to {count} {count === 1 ? "person" : "people"} at the next run
          </button>
          <button type="button" className="btn btn-small btn-quiet" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-small" style={{ alignSelf: "flex-start" }} onClick={() => setConfirming(true)}>
          Send the welcome to everyone who hasn&apos;t had it ({count})
        </button>
      )}
      <p className="hint">
        Real pages that want emails and never got the welcome. This runs on its own confirm, also while the daily welcome
        switch is off. Nobody gets it twice, and the day 10 and day 21 notes keep their usual timing.
      </p>
      {msg && <p className="hint">{msg}</p>}
    </div>
  );
}
