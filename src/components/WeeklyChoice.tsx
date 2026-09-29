"use client";

import { useState } from "react";
import { WEEKLY } from "@/lib/weekly-copy";

export default function WeeklyChoice({ initialOn }: { initialOn: boolean }) {
  const [on, setOn] = useState(initialOn);
  return (
    <div role="group" aria-labelledby="weekly-legend" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span id="weekly-legend" className="field-label">
        {WEEKLY.settingsLabel}
      </span>
      <div className="mode-tabs" role="radiogroup" aria-label={WEEKLY.settingsLabel}>
        <button type="button" role="radio" aria-checked={!on} className={`mode-tab${!on ? " active" : ""}`} onClick={() => setOn(false)}>
          {WEEKLY.none}
        </button>
        <button type="button" role="radio" aria-checked={on} className={`mode-tab${on ? " active" : ""}`} onClick={() => setOn(true)}>
          {WEEKLY.weekly}
        </button>
      </div>
      <p className="bio" style={{ fontSize: 14 }}>
        {on ? WEEKLY.weeklyHint : WEEKLY.noneHint}
      </p>
      <input type="hidden" name="weekly_choice" value="1" />
      <input type="checkbox" name="weekly_email" checked={on} onChange={() => {}} hidden readOnly />
    </div>
  );
}
