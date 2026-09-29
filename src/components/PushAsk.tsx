"use client";

import { useEffect, useState } from "react";
import { isStandalone, store } from "@/lib/install";
import { pushSupported, subscribePush } from "@/lib/push-client";
import { createClient } from "@/lib/supabase/client";

const DISMISSED = "hoshigo.pushAskDismissed";

// One calm card on opening the installed app: only when logged in, the browser can
// still ask (permission "default") and it wasn't waved away before. Afterwards,
// settings is the only place to turn notifications on.
export default function PushAsk() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isStandalone() || !pushSupported() || Notification.permission !== "default" || store.get(DISMISSED) === "1") return;
    // the session is read locally, no network call
    createClient()
      .auth.getSession()
      .then(({ data }) => data.session && setShow(true))
      .catch(() => {});
  }, []);

  if (!show) return null;

  const notNow = () => {
    store.set(DISMISSED, "1");
    setShow(false);
  };

  const turnOn = async () => {
    setBusy(true);
    setError(null);
    const r = await subscribePush();
    setBusy(false);
    if (r.ok || r.reason === "blocked") return setShow(false);
    // closing the system prompt without choosing counts as "not now"
    if (r.reason === "dismissed") return notNow();
    setError(r.message ?? null);
  };

  return (
    <aside className="install-hint" aria-label="Notifications">
      <p>
        <b>A note when friends add something?</b>
        <br />
        At most once a day.
      </p>
      {error && <p className="error">{error}</p>}
      <div className="install-hint-actions">
        <button type="button" className="btn install-now" disabled={busy} onClick={turnOn}>
          Turn on notifications
        </button>
        <button type="button" className="link-btn" onClick={notNow}>
          Not now
        </button>
      </div>
    </aside>
  );
}
