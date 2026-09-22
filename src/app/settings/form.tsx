"use client";

import { useActionState } from "react";
import { saveProfile } from "./actions";
import SocialLinksEditor from "@/components/SocialLinksEditor";
import type { SocialLink } from "@/lib/supabase/types";

export default function SettingsForm({
  initialBio,
  initialName,
  initialSocialLinks,
}: {
  initialBio: string;
  initialName: string;
  initialSocialLinks: SocialLink[];
}) {
  const [error, action, pending] = useActionState(saveProfile, null);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field">
        <label htmlFor="display_name">Name</label>
        <input id="display_name" name="display_name" defaultValue={initialName} placeholder="Andreas" />
      </div>
      <div className="field">
        <label htmlFor="bio">Bio</label>
        <textarea id="bio" name="bio" defaultValue={initialBio} placeholder="Founder of hoshigo." />
      </div>
      <SocialLinksEditor initialLinks={initialSocialLinks} />
      {error && <p className="error">{error}</p>}
      <button type="submit" className="cta" disabled={pending} style={{ border: "none" }}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
