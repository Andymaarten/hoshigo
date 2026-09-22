import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "./form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("handle, display_name, bio")
    .eq("id", user.id)
    .single();

  return (
    <div className="page">
      <header className="hero">
        <div className="word" aria-label="hoshigo">
          hosh<span className="tittle">ı</span>go
        </div>
        <p className="lede">One last thing — pick your handle.</p>
        <p className="bio">This becomes your page: hoshigo.cc/&lt;handle&gt;. You can change your bio anytime later.</p>
      </header>
      <section style={{ maxWidth: 480 }}>
        <OnboardingForm initialHandle={profile?.handle?.startsWith("user-") ? "" : profile?.handle ?? ""} initialBio={profile?.bio ?? ""} initialName={profile?.display_name ?? ""} />
      </section>
    </div>
  );
}
