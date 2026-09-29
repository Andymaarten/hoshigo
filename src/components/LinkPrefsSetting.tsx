"use client";

import { useState, useTransition } from "react";
import { DEFAULT_PREFS, GROUP_CHOICES, PLATFORMS, type LinkGroup, type LinkPrefs } from "@/lib/platforms";
import { saveLinkPrefs } from "@/app/settings/link-prefs-action";

// Settings: which platform the "Open in …" button uses, per kind of thing. Saves on change.
export default function LinkPrefsSetting({ initial }: { initial: LinkPrefs }) {
  const [prefs, setPrefs] = useState<Record<LinkGroup, string>>({ ...DEFAULT_PREFS, ...initial });
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();

  function choose(group: LinkGroup, platform: string) {
    const next = { ...prefs, [group]: platform };
    setPrefs(next);
    setStatus("");
    start(async () => {
      const error = await saveLinkPrefs(next);
      setStatus(error ?? "Saved.");
    });
  }

  return (
    <div className="stack">
      {(Object.keys(GROUP_CHOICES) as LinkGroup[]).map((group) => (
        <div className="field" key={group}>
          <label htmlFor={`open-in-${group}`}>{GROUP_CHOICES[group].label}</label>
          <select id={`open-in-${group}`} value={prefs[group]} onChange={(e) => choose(group, e.target.value)}>
            {GROUP_CHOICES[group].platforms.map((p) => (
              <option key={p} value={p}>
                {PLATFORMS[p].name}
              </option>
            ))}
          </select>
        </div>
      ))}
      <p className="hint" role="status">
        {pending ? "Saving…" : status}
      </p>
    </div>
  );
}
