"use client";

import { useActionState } from "react";
import { saveProfile } from "./actions";
import SocialLinksEditor from "@/components/SocialLinksEditor";
import FriendRequestChoice from "@/components/FriendRequestChoice";
import SomedayChoice from "@/components/SomedayChoice";
import WeeklyChoice from "@/components/WeeklyChoice";
import VisibilityChoice from "@/components/VisibilityChoice";
import type { SocialLink } from "@/lib/supabase/types";

// One form, three folding sections. Closed sections still send their fields, so a single
// Save keeps working exactly as before.
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

  return (
    <form action={action} className="settings-form">
      <details className="settings-group" open>
        <summary>your page.</summary>
        <div className="settings-body">
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
        </div>
      </details>

      {(friendsEnabled || initialSomedayPublic !== undefined) && (
        <details className="settings-group">
          <summary>friends and privacy.</summary>
          <div className="settings-body">
            {friendsEnabled && <FriendRequestChoice initialAuto={initialAutoAccept} initialEmail={initialEmail} />}
            {initialSomedayPublic !== undefined && <SomedayChoice initialPublic={initialSomedayPublic} />}
          </div>
        </details>
      )}

      <details className="settings-group">
        <summary>notifications and emails.</summary>
        <div className="settings-body">
          {initialEmailUpdates !== undefined && (
            <label className="check-row">
              <input type="hidden" name="updates_choice" value="1" />
              <input type="checkbox" name="email_updates" defaultChecked={initialEmailUpdates} />
              Email me now and then about what&apos;s new on hoshigo
            </label>
          )}
          {initialWeekly !== undefined && <WeeklyChoice initialOn={initialWeekly} />}
          {deviceSettings}
        </div>
      </details>

      {error && <p className="error">{error}</p>}
      <button type="submit" className="cta settings-save" disabled={pending} style={{ border: "none" }}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
