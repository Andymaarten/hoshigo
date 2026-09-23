"use client";

import { useActionState, useState } from "react";
import { saveProfile } from "./actions";
import SocialLinksEditor from "@/components/SocialLinksEditor";
import type { SocialLink } from "@/lib/supabase/types";

export default function SettingsForm({
  initialBio,
  initialName,
  initialSocialLinks,
  initialIsPrivate,
}: {
  initialBio: string;
  initialName: string;
  initialSocialLinks: SocialLink[];
  initialIsPrivate: boolean;
}) {
  const [error, action, pending] = useActionState(saveProfile, null);
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field">
        <label htmlFor="display_name">Name</label>
        <input id="display_name" name="display_name" maxLength={15} defaultValue={initialName} placeholder="Your name" />
      </div>
      <div className="field">
        <label htmlFor="bio">Bio</label>
        <textarea id="bio" name="bio" defaultValue={initialBio} placeholder="A line about you" />
      </div>
      <div role="group" aria-labelledby="visibility-legend" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span
          id="visibility-legend"
          style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--muted)" }}
        >
          Visibility
        </span>
        <div className="mode-tabs" role="tablist" aria-label="Profile visibility">
          <button
            type="button"
            role="tab"
            aria-selected={!isPrivate}
            className={`mode-tab${!isPrivate ? " active" : ""}`}
            onClick={() => setIsPrivate(false)}
          >
            Public
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isPrivate}
            className={`mode-tab${isPrivate ? " active" : ""}`}
            onClick={() => setIsPrivate(true)}
          >
            Private
          </button>
        </div>
        <p className="bio" style={{ fontSize: 14 }}>
          {isPrivate
            ? "Only you can see this profile. Nobody else can view it yet — hoshigo doesn't have friends approvals live yet."
            : "Anyone with the link can see this profile."}
        </p>
        <input type="checkbox" name="is_private" checked={isPrivate} onChange={() => {}} hidden readOnly />
      </div>
      <SocialLinksEditor initialLinks={initialSocialLinks} />
      {error && <p className="error">{error}</p>}
      <button type="submit" className="cta" disabled={pending} style={{ border: "none" }}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
