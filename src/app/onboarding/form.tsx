"use client";

import { useActionState, useState } from "react";
import { saveHandle } from "./actions";
import SocialLinksEditor from "@/components/SocialLinksEditor";
import type { SocialLink } from "@/lib/supabase/types";

export default function OnboardingForm({
  initialHandle,
  initialBio,
  initialName,
  initialSocialLinks = [],
}: {
  initialHandle: string;
  initialBio: string;
  initialName: string;
  initialSocialLinks?: SocialLink[];
}) {
  const [error, action, pending] = useActionState(saveHandle, null);
  const [handle, setHandle] = useState(initialHandle);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field">
        <label htmlFor="handle">Your page address</label>
        <input
          id="handle"
          name="handle"
          required
          pattern="[a-z0-9_\-]{2,30}"
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          value={handle}
          onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9_-]/g, ""))}
          placeholder="yourname"
          aria-describedby="handle-help"
        />
        <p id="handle-help" className="handle-preview">
          Your page: <strong>hoshigo.cc/{handle || "yourname"}</strong>
          <br />
          Lowercase letters, numbers, _ and the minus sign. You can share this address with anyone.
        </p>
      </div>
      <div className="field">
        <label htmlFor="display_name">Name</label>
        <input id="display_name" name="display_name" maxLength={15} defaultValue={initialName} placeholder="Your name" />
      </div>
      <div className="field">
        <label htmlFor="bio">Bio</label>
        <textarea id="bio" name="bio" defaultValue={initialBio} placeholder="A line about you" />
      </div>
      <SocialLinksEditor initialLinks={initialSocialLinks} />
      {error && <p className="error">{error}</p>}
      <button type="submit" className="cta" disabled={pending} style={{ border: "none" }}>
        {pending ? "Saving…" : "Start your hoshigo"}
      </button>
    </form>
  );
}
