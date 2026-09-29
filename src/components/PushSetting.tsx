"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isStandalone } from "@/lib/install";
import { removePushSubscription } from "@/lib/push-actions";
import { pushSupported, subscribePush } from "@/lib/push-client";

type State = "loading" | "unsupported" | "install-first" | "blocked" | "off" | "on";

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// "Notifications on this device: Off / Once a day". On iPhone, web push only exists inside
// the installed app, so the browser gets a pointer to /app instead of a button that can't work.
export default function PushSetting() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    (async () => {
      if (!pushSupported()) {
        setState(isIos() && !isStandalone() ? "install-first" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [key]);

  const turnOn = async () => {
    setBusy(true);
    setError(null);
    const r = await subscribePush();
    if (r.ok) setState("on");
    else if (r.reason === "blocked") setState("blocked");
    else if (r.message) setError(r.message);
    setBusy(false);
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") return null;
  return (
    <div className="push-setting">
      <p className="push-label">
        Notifications on this device: <b>{state === "on" ? "Once a day" : "Off"}</b>
      </p>
      {state === "install-first" && (
        <p className="bio">
          <Link href="/app">Install hoshigo as an app</Link> to get notifications.
        </p>
      )}
      {state === "unsupported" && <p className="bio">This browser can&apos;t show notifications from hoshigo.</p>}
      {state === "blocked" && <p className="bio">Notifications are blocked for hoshigo. Allow them in your phone or browser settings, then come back.</p>}
      {state === "off" && (
        <>
          <p className="bio">At most one a day, and only when friends or people you follow added something.</p>
          <button type="button" className="btn" disabled={busy} onClick={turnOn}>
            Turn on, once a day
          </button>
        </>
      )}
      {state === "on" && (
        <button type="button" className="btn" disabled={busy} onClick={turnOff}>
          Turn off
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
