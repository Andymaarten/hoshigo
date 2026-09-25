import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";
import SiteNav from "@/components/SiteNav";
import HeaderStamp from "@/components/HeaderStamp";
import SiteFooter from "@/components/SiteFooter";
import SettingsForm from "./form";
import Wordmark from "@/components/Wordmark";

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

      <section style={{ maxWidth: 480 }}>
        <SettingsForm
          initialBio={profile.bio ?? ""}
          initialName={profile.display_name ?? ""}
          initialSocialLinks={profile.social_links ?? []}
          initialIsPrivate={profile.is_private ?? false}
          initialAutoAccept={profile.auto_accept_friends ?? false}
          initialEmail={profile.email_friend_requests ?? true}
          friendsEnabled={profile.auto_accept_friends !== undefined}
          initialSomedayPublic={profile.someday_public}
        />
      </section>

      <SiteFooter loggedIn />
    </div>
  );
}
