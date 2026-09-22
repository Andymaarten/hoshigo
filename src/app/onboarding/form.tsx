"use client";

import { useActionState } from "react";
import { saveHandle } from "./actions";

export default function OnboardingForm({
  initialHandle,
  initialBio,
  initialName,
}: {
  initialHandle: string;
  initialBio: string;
  initialName: string;
}) {
  const [error, action, pending] = useActionState(saveHandle, null);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field">
        <label htmlFor="handle">Handle</label>
        <input
          id="handle"
          name="handle"
          required
          pattern="[a-z0-9_-]{2,30}"
          defaultValue={initialHandle}
          placeholder="andreas"
        />
      </div>
      <div className="field">
        <label htmlFor="display_name">Name</label>
        <input id="display_name" name="display_name" defaultValue={initialName} placeholder="Andreas" />
      </div>
      <div className="field">
        <label htmlFor="bio">Bio</label>
        <textarea id="bio" name="bio" defaultValue={initialBio} placeholder="Founder of hoshigo." />
      </div>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="cta" disabled={pending} style={{ border: "none" }}>
        {pending ? "Saving…" : "Start your hoshigo"}
      </button>
    </form>
  );
}
