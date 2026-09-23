import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import SettingsForm from "./form";

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
          <div className="word" aria-label="hoshigo">
            hosh<span className="tittle">ı</span>go
          </div>
          <SiteNav loggedIn handle={profile.handle} />
        </div>
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
          initialAutoAccept={profile.auto_accept_friends ?? false}
          friendsEnabled={profile.auto_accept_friends !== undefined}
        />
      </section>

      <SiteFooter loggedIn />
    </div>
  );
}
