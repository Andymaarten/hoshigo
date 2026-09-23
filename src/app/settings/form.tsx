"use client";

import { useActionState } from "react";
import { saveProfile } from "./actions";
import SocialLinksEditor from "@/components/SocialLinksEditor";
import FriendRequestChoice from "@/components/FriendRequestChoice";
import type { SocialLink } from "@/lib/supabase/types";

export default function SettingsForm({
  initialBio,
  initialName,
  initialSocialLinks,
  initialAutoAccept,
  friendsEnabled,
}: {
  initialBio: string;
  initialName: string;
  initialSocialLinks: SocialLink[];
  initialAutoAccept: boolean;
  friendsEnabled: boolean;
}) {
  const [error, action, pending] = useActionState(saveProfile, null);

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
      {friendsEnabled && <FriendRequestChoice initialAuto={initialAutoAccept} />}
      <SocialLinksEditor initialLinks={initialSocialLinks} />
      {error && <p className="error">{error}</p>}
      <button type="submit" className="cta" disabled={pending} style={{ border: "none" }}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
