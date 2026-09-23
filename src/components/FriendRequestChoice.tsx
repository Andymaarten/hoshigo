"use client";

import { useState } from "react";

export default function FriendRequestChoice({ initialAuto, initialEmail = true }: { initialAuto: boolean; initialEmail?: boolean }) {
  const [auto, setAuto] = useState(initialAuto);
  const [email, setEmail] = useState(initialEmail);

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
      {!auto && (
        <label className="check-row">
          <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
          Email me when I get a friend request
        </label>
      )}
      <input type="hidden" name="friend_choice" value="1" />
      <input type="checkbox" name="email_friend_requests" checked={email} onChange={() => {}} hidden readOnly />
      <input type="checkbox" name="auto_accept_friends" checked={auto} onChange={() => {}} hidden readOnly />
    </div>
  );
}
