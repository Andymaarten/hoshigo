import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import HeaderStamp from "@/components/HeaderStamp";
import { createClient } from "@/lib/supabase/server";
import HeroField, { heroLinksFor } from "@/components/HeroField";
import Wordmark from "@/components/Wordmark";

export default async function AboutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [myHandle, heroLinks] = await Promise.all([
    user ? supabase.from("profiles").select("handle").eq("id", user.id).single().then((r) => r.data?.handle as string | undefined) : undefined,
    heroLinksFor(supabase),
  ]);

  return (
    <div className="page page-home">
      <header className="hero">
        <div className="masthead">
          <Wordmark handle={myHandle} />
          <SiteNav loggedIn={!!user} handle={myHandle} />
        </div>
        <HeaderStamp />
        <h1 style={{ fontSize: "clamp(40px,10vw,72px)", textAlign: "center" }}>what we&apos;re about</h1>
      </header>

      <section className="manifesto about-text">
        <p className="manifesto-lead">
          hoshigo comes from Japanese: <i>hoshi</i>, star, and <i>go</i>, five. Five stars.
        </p>
        <p className="manifesto-lead">
          It&apos;s a personal place to keep the handful of things you&apos;d actually give five stars. Films, books,
          essays, albums.
        </p>
        <span className="manifesto-sep" aria-hidden="true" />
        <p className="manifesto-mid">
          We&apos;re not traditional social media. No ads. No algorithm deciding what you see and trying to make you
          stay longer. Even better: we like you to be gone within <strong>a few minutes</strong>.
        </p>
        <span className="manifesto-sep" aria-hidden="true" />
        <p className="manifesto-coda">
          hoshigo is by people, for people. No fake profiles, no bots. Only verified profiles of real people with real
          taste: every page here belongs to someone.
        </p>
        <span className="manifesto-sep" aria-hidden="true" />
        <p className="manifesto-coda">So the next time somebody asks: do you have any podcast tips?</p>
        <p className="manifesto-coda">Yes, have a look at my hoshigo.</p>
      </section>

      <HeroField links={heroLinks} />

      <SiteFooter loggedIn={!!user} />
    </div>
  );
}
