import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "./form";
import type { Profile } from "@/lib/supabase/types";
import { pendingInvitePath } from "@/lib/post-login";

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

  const invitePath = await pendingInvitePath();
  if (invitePath && profile?.handle && !profile.handle.startsWith("user-")) redirect(invitePath);

  return (
    <div className="page">
      <header className="hero">
        <div className="word" aria-label="hoshigo">
          hosh<span className="tittle">ı</span>go
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
