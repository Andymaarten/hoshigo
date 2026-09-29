import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";
import SiteNav from "@/components/SiteNav";
import HeaderStamp from "@/components/HeaderStamp";
import SiteFooter from "@/components/SiteFooter";
import SettingsForm from "./form";
import Section from "./Section";
import Wordmark from "@/components/Wordmark";
import Link from "next/link";
import InstallButton from "@/components/InstallButton";
import PushSetting from "@/components/PushSetting";
import LinkPrefsSetting from "@/components/LinkPrefsSetting";
import { cleanPrefs } from "@/lib/platforms";
import { signOut } from "@/app/[handle]/actions";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .returns<Profile[]>()
    .single();

  if (!profile) redirect("/onboarding");

  return (
    <div className="page">
      <header className="hero">
        <div className="masthead">
          <Wordmark handle={profile.handle} />
          <SiteNav loggedIn handle={profile.handle} />
        </div>
        <HeaderStamp />
        <div className="kicker">
          <span className="dot" aria-hidden="true" />
          settings
        </div>
        <h1 style={{ fontSize: "clamp(40px,10vw,72px)" }}>edit profile</h1>
      </header>

      <main className="settings">
        <SettingsForm
          handle={profile.handle}
          initialBio={profile.bio ?? ""}
          initialName={profile.display_name ?? ""}
          initialSocialLinks={profile.social_links ?? []}
          initialIsPrivate={profile.is_private ?? false}
          initialAutoAccept={profile.auto_accept_friends ?? false}
          initialEmail={profile.email_friend_requests ?? true}
          friendsEnabled={profile.auto_accept_friends !== undefined}
          initialSomedayPublic={profile.someday_public}
          initialEmailUpdates={profile.email_updates}
          initialWeekly={profile.weekly_email}
          deviceSettings={
            <div className="settings-device">
              <PushSetting />
              <p className="bio">
                hoshigo as an app: on your home screen, adding from any app. <Link href="/app">How it works</Link>
              </p>
              <InstallButton />
            </div>
          }
        />

        <Section title="links.">
            <p className="bio">
              Next to each hoshigo&apos;s own link, we show a button for the app you use. Only you see this choice. Saved as you pick.
            </p>
            <LinkPrefsSetting initial={cleanPrefs((profile as Profile & { link_prefs?: unknown }).link_prefs)} />
        </Section>

        <Section title="account.">
            <form action={signOut}>
              <button type="submit" className="btn">
                Log out
              </button>
            </form>
            <p className="hint">
              Want your account and page removed? Write to <a href="mailto:hi@hoshigo.cc">hi@hoshigo.cc</a>.
            </p>
        </Section>
      </main>

      <SiteFooter loggedIn />
    </div>
  );
}
