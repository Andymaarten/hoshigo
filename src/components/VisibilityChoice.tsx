"use client";

import { useState } from "react";

export default function VisibilityChoice({ initialPrivate }: { initialPrivate: boolean }) {
  const [isPrivate, setIsPrivate] = useState(initialPrivate);

  return (
    <div role="group" aria-labelledby="visibility-legend" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span id="visibility-legend" className="field-label">
        Who can see your page?
      </span>
      <div className="mode-tabs" role="radiogroup" aria-label="Who can see your page?">
        <button
          type="button"
          role="radio"
          aria-checked={!isPrivate}
          className={`mode-tab${!isPrivate ? " active" : ""}`}
          onClick={() => setIsPrivate(false)}
        >
          Everyone
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={isPrivate}
          className={`mode-tab${isPrivate ? " active" : ""}`}
          onClick={() => setIsPrivate(true)}
        >
          Only friends
        </button>
      </div>
      <p className="bio" style={{ fontSize: 14 }}>
        {isPrivate
          ? "Others see only your name and bio, and can ask to be your friend. Friends see everything."
          : "Everyone sees your latest five per category. Friends see everything."}
      </p>
      <input type="checkbox" name="is_private" checked={isPrivate} onChange={() => {}} hidden readOnly />
    </div>
  );
}
