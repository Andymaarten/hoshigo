"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isIosSafari, isStandalone, promptInstall, store, useCanInstall } from "@/lib/install";
import ShareIcon from "./ShareIcon";

const VISITS = "hoshigo.visits";
const ADDED = "hoshigo.added";
const DISMISSED = "hoshigo.installHintDismissed";

// Everything that makes hoshigo feel like an app: a quiet install hint for
// iPhone Safari and for browsers that can install, and a way back when the
// app runs standalone without browser buttons.
export default function AppChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const canInstall = useCanInstall();
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
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
    queueMicrotask(() => {
      setStandalone(isStandalone());
      setIos(isIosSafari());
      setDismissed(store.get(DISMISSED) === "1");
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
    store.set(DISMISSED, "1");
    setDismissed(true);
  };

  const hidden = standalone || dismissed || pathname === "/app" || pathname.startsWith("/login");
  const showIos = !hidden && ios && eligible;
  const showInstall = !hidden && !ios && canInstall && eligible;

  return (
    <>
      {standalone && depth > 0 && (
        <button type="button" className="app-back" onClick={() => router.back()} aria-label="Back">
          <span aria-hidden="true">‹</span> Back
        </button>
      )}
      {(showIos || showInstall) && (
        <aside className="install-hint" aria-label="hoshigo on your home screen">
          {showIos ? (
            <p>
              Add hoshigo to your home screen: tap <ShareIcon /> then <b>Add to Home Screen</b>.
            </p>
          ) : (
            <p>
              hoshigo works as an app too.{" "}
              <button type="button" className="link-btn" onClick={() => promptInstall().then(dismiss)}>
                Install hoshigo
              </button>
            </p>
          )}
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
