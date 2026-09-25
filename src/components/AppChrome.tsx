"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { track } from "@vercel/analytics";
import { isAndroid, isIosSafari, isStandalone, store, useCanInstall } from "@/lib/install";
import { recordAppOpen } from "@/lib/app-usage";
import InstallHintText from "./InstallHintText";

const VISITS = "hoshigo.visits";
const HINT_PAUSE_MS = 14 * 24 * 60 * 60 * 1000;
const ADDED = "hoshigo.added";
const DISMISSED = "hoshigo.installHintDismissed";
const OPEN_DAY = "hoshigo.appOpenDay";
const OPEN_SESSION = "hoshigo.appOpenSession";

// Everything that makes hoshigo feel like an app: a quiet install hint for
// iPhone Safari and for browsers that can install, and a way back when the
// app runs standalone without browser buttons.
export default function AppChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const canInstall = useCanInstall();
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [android, setAndroid] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [depth, setDepth] = useState(0);
  const first = useRef(true);

  useEffect(() => {
    const visits = Number(store.get(VISITS) ?? "0") + 1;
    store.set(VISITS, String(visits));
    const onAdded = () => {
      store.set(ADDED, "1");
      setEligible(true);
    };
    window.addEventListener("hoshigo:added", onAdded);
    // read after mount only: these depend on the device, not the server render
    const app = isStandalone();
    if (app) {
      // one analytics event per launch, one database write per day
      try {
        if (!window.sessionStorage.getItem(OPEN_SESSION)) {
          window.sessionStorage.setItem(OPEN_SESSION, "1");
          track("app_opened");
        }
      } catch {
        // storage blocked: skip the event rather than repeat it
      }
      const today = new Date().toISOString().slice(0, 10);
      if (store.get(OPEN_DAY) !== today) {
        recordAppOpen()
          .then((ok) => ok && store.set(OPEN_DAY, today))
          .catch(() => {});
      }
    }
    queueMicrotask(() => {
      setStandalone(app);
      setIos(isIosSafari());
      setAndroid(isAndroid());
      // A dismissal holds for two weeks; the old value "1" counts as long ago, so the hint returns once.
      const dismissedAt = Number(store.get(DISMISSED) ?? "0");
      setDismissed(Date.now() - dismissedAt < HINT_PAUSE_MS);
      setEligible(visits >= 2 || store.get(ADDED) === "1");
    });
    return () => window.removeEventListener("hoshigo:added", onAdded);
  }, []);

  // count navigations inside this session, so Back only shows when there is somewhere to go
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    queueMicrotask(() => setDepth((d) => d + 1));
  }, [pathname]);

  const dismiss = () => {
    store.set(DISMISSED, String(Date.now()));
    setDismissed(true);
  };

  const hidden = standalone || dismissed || pathname === "/app" || pathname.startsWith("/login");
  const showIos = !hidden && ios && eligible;
  const showInstall = !hidden && !ios && (canInstall || android) && eligible;

  return (
    <>
      {standalone && depth > 0 && (
        <button type="button" className="app-back" onClick={() => router.back()} aria-label="Back">
          <span aria-hidden="true">‹</span> Back
        </button>
      )}
      {(showIos || showInstall) && (
        <aside className="install-hint" aria-label="hoshigo on your home screen">
          <InstallHintText platform={showIos ? "ios" : canInstall ? "prompt" : "android"} onInstalled={dismiss} />
          <div className="install-hint-actions">
            <Link href="/app" className="link-btn">
              How it works
            </Link>
            <button type="button" className="link-btn" onClick={dismiss}>
              Not now
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
