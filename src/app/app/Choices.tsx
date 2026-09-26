"use client";

import { useEffect, useState } from "react";
import styles from "./app.module.css";

export type Choice = { key: "ios" | "android" | "computer"; label: string; icon: React.ReactNode; panel: React.ReactNode };

function deviceChoice(): Choice["key"] | null {
  const ua = navigator.userAgent;
  if (/bot|crawl|spider|slurp|preview|lighthouse/i.test(ua)) return null;
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "computer";
}

// Three equal choices; one open at a time. Every panel is in the server rendered HTML
// (hidden="until-found" keeps it findable by search engines and the browser's find), and
// the one for this device opens after load.
export default function Choices({ choices }: { choices: Choice[] }) {
  const [open, setOpen] = useState<Choice["key"] | null>(null);
  useEffect(() => {
    queueMicrotask(() => setOpen(deviceChoice()));
    // a find in page that lands inside a closed panel opens it
    const onMatch = (e: Event) => {
      const id = (e.target as HTMLElement).id?.replace("panel-", "");
      if (id === "ios" || id === "android" || id === "computer") setOpen(id);
    };
    document.addEventListener("beforematch", onMatch, true);
    return () => document.removeEventListener("beforematch", onMatch, true);
  }, []);

  return (
    <div className={styles.choices}>
      <div className={styles.choiceRow} role="tablist" aria-label="Your device">
        {choices.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            id={`tab-${c.key}`}
            aria-selected={open === c.key}
            aria-controls={`panel-${c.key}`}
            className={`${styles.choice}${open === c.key ? ` ${styles.choiceOn}` : ""}`}
            onClick={() => setOpen(open === c.key ? null : c.key)}
          >
            <span className={styles.choiceIcon} aria-hidden="true">
              {c.icon}
            </span>
            {c.label}
          </button>
        ))}
      </div>
      {choices.map((c) => (
        <div
          key={c.key}
          id={`panel-${c.key}`}
          role="tabpanel"
          aria-labelledby={`tab-${c.key}`}
          className={styles.panel}
          hidden={open === c.key ? undefined : ("until-found" as unknown as boolean)}
        >
          <h2>{c.label}</h2>
          {c.panel}
        </div>
      ))}
    </div>
  );
}
