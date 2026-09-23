"use client";

import { useState } from "react";

export default function FriendRequestChoice({ initialAuto }: { initialAuto: boolean }) {
  const [auto, setAuto] = useState(initialAuto);

  return (
    <div role="group" aria-labelledby="friend-requests-legend" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span id="friend-requests-legend" className="field-label">
        Friend requests
      </span>
      <div className="mode-tabs" role="radiogroup" aria-label="Friend requests">
        <button
          type="button"
          role="radio"
          aria-checked={!auto}
          className={`mode-tab${!auto ? " active" : ""}`}
          onClick={() => setAuto(false)}
        >
          Ask me first
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={auto}
          className={`mode-tab${auto ? " active" : ""}`}
          onClick={() => setAuto(true)}
        >
          Accept automatically
        </button>
      </div>
      <p className="bio" style={{ fontSize: 14 }}>
        {auto
          ? "Anyone who adds you becomes your friend right away."
          : "You approve each request on your Friends page."}
      </p>
      <input type="hidden" name="friend_choice" value="1" />
      <input type="checkbox" name="auto_accept_friends" checked={auto} onChange={() => {}} hidden readOnly />
    </div>
  );
}
