import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "./form";
import type { Profile } from "@/lib/supabase/types";
import { pendingAddPath, pendingInvitePath } from "@/lib/post-login";
import Wordmark from "@/components/Wordmark";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("handle, display_name, bio, social_links")
    .eq("id", user.id)
    .returns<Pick<Profile, "handle" | "display_name" | "bio" | "social_links">[]>()
    .single();

  const hasHandle = !!profile?.handle && !profile.handle.startsWith("user-");
  const invitePath = await pendingInvitePath();
  if (invitePath && hasHandle) redirect(invitePath);
  // Magic link logins land here; an existing account with a link waiting goes on to add it.
  const addPath = await pendingAddPath();
  if (addPath && hasHandle) redirect(addPath);

  return (
    <div className="page">
      <header className="hero">
        <Wordmark />
        <div className="kicker">
          <span className="dot" aria-hidden="true" />
          welcome
        </div>
        <p className="lede">One last thing — pick your page address.</p>
        <p className="bio">It becomes the link to your page, like hoshigo.cc/yourname. Your name and bio can change anytime later.</p>
      </header>
      <section style={{ maxWidth: 480 }}>
        <OnboardingForm
          initialHandle={profile?.handle?.startsWith("user-") ? "" : profile?.handle ?? ""}
          initialBio={profile?.bio ?? ""}
          initialName={profile?.display_name ?? ""}
          initialSocialLinks={profile?.social_links ?? []}
        />
      </section>
    </div>
  );
}
