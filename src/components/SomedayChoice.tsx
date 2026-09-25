"use client";

import { useState } from "react";
import { SOMEDAY } from "@/lib/someday";

export default function SomedayChoice({ initialPublic }: { initialPublic: boolean }) {
  const [pub, setPub] = useState(initialPublic);
  return (
    <div role="group" aria-labelledby="someday-legend" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span id="someday-legend" className="field-label">
        {SOMEDAY.settingsLabel}
      </span>
      <div className="mode-tabs" role="radiogroup" aria-label={SOMEDAY.settingsLabel}>
        <button type="button" role="radio" aria-checked={!pub} className={`mode-tab${!pub ? " active" : ""}`} onClick={() => setPub(false)}>
          {SOMEDAY.onlyMe}
        </button>
        <button type="button" role="radio" aria-checked={pub} className={`mode-tab${pub ? " active" : ""}`} onClick={() => setPub(true)}>
          {SOMEDAY.onPage}
        </button>
      </div>
      <p className="bio" style={{ fontSize: 14 }}>
        {pub ? SOMEDAY.onPageHint : SOMEDAY.onlyMeHint}
      </p>
      <input type="hidden" name="someday_choice" value="1" />
      <input type="checkbox" name="someday_public" checked={pub} onChange={() => {}} hidden readOnly />
    </div>
  );
}
