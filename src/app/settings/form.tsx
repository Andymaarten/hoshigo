"use client";

import { useActionState } from "react";
import { saveProfile } from "./actions";
import SocialLinksEditor from "@/components/SocialLinksEditor";
import FriendRequestChoice from "@/components/FriendRequestChoice";
import SomedayChoice from "@/components/SomedayChoice";
import WeeklyChoice from "@/components/WeeklyChoice";
import VisibilityChoice from "@/components/VisibilityChoice";
import type { SocialLink } from "@/lib/supabase/types";
import Section from "./Section";

export default function SettingsForm({
  handle,
  initialBio,
  initialName,
  initialSocialLinks,
  initialAutoAccept,
  initialEmail,
  initialIsPrivate,
  friendsEnabled,
  initialSomedayPublic,
  initialEmailUpdates,
  initialWeekly,
  deviceSettings,
}: {
  handle: string;
  initialBio: string;
  initialName: string;
  initialSocialLinks: SocialLink[];
  initialAutoAccept: boolean;
  initialEmail: boolean;
  initialIsPrivate: boolean;
  friendsEnabled: boolean;
  /** undefined before the someday migration: no choice shown */
  initialSomedayPublic?: boolean;
  /** undefined before the changelog migration: no toggle */
  initialEmailUpdates?: boolean;
  /** undefined before the weekly migration: no choice */
  initialWeekly?: boolean;
  /** app install and push, which save on their own */
  deviceSettings?: React.ReactNode;
}) {
  const [error, action, pending] = useActionState(saveProfile, null);

  // Every section's Save submits the same single form, closed sections included, so one tap
  // keeps saving everything exactly as before.
  const save = (
    <div className="settings-save">
      {error && <p className="error">{error}</p>}
      <button type="submit" className="cta" disabled={pending} style={{ border: "none" }}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </div>
  );

  return (
    <form action={action} className="settings-form">
      <Section title="your page." save={save}>
        <p className="hint">hoshigo.cc/{handle}</p>
        <div className="field">
          <label htmlFor="display_name">Name</label>
          <input id="display_name" name="display_name" maxLength={15} defaultValue={initialName} placeholder="Your name" />
        </div>
        <div className="field">
          <label htmlFor="bio">Bio</label>
          <textarea id="bio" name="bio" defaultValue={initialBio} placeholder="A line about you" />
        </div>
        <SocialLinksEditor initialLinks={initialSocialLinks} />
        <VisibilityChoice initialPrivate={initialIsPrivate} />
      </Section>

      {(friendsEnabled || initialSomedayPublic !== undefined) && (
        <Section title="friends and privacy." save={save}>
          {friendsEnabled && <FriendRequestChoice initialAuto={initialAutoAccept} initialEmail={initialEmail} />}
          {initialSomedayPublic !== undefined && <SomedayChoice initialPublic={initialSomedayPublic} />}
        </Section>
      )}

      <Section title="notifications and emails." save={initialEmailUpdates !== undefined || initialWeekly !== undefined ? save : undefined}>
        {initialEmailUpdates !== undefined && (
          <label className="check-row">
            <input type="hidden" name="updates_choice" value="1" />
            <input type="checkbox" name="email_updates" defaultChecked={initialEmailUpdates} />
            Email me now and then about what&apos;s new on hoshigo
          </label>
        )}
        {initialWeekly !== undefined && <WeeklyChoice initialOn={initialWeekly} />}
        {deviceSettings}
      </Section>
    </form>
  );
}
