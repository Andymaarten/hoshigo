import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import HeaderStamp from "@/components/HeaderStamp";
import { createClient } from "@/lib/supabase/server";
import Wordmark from "@/components/Wordmark";

export default async function AboutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const myHandle = user ? (await supabase.from("profiles").select("handle").eq("id", user.id).single()).data?.handle : undefined;

  return (
    <div className="page">
      <header className="hero">
        <div className="masthead">
          <Wordmark handle={myHandle} />
          <SiteNav loggedIn={!!user} handle={myHandle} />
        </div>
        <HeaderStamp />
        <h1 style={{ fontSize: "clamp(40px,10vw,72px)" }}>what we&apos;re about</h1>
      </header>

      <section className="prose">
        <p>
          hoshigo comes from Japanese: <i>hoshi</i>, star, and <i>go</i>, five. Five stars.
        </p>
        <p>
          It&apos;s a personal place to keep the handful of things you&apos;d actually give five stars. Films, books,
          essays, albums.
        </p>
        <p>
          We&apos;re not traditional social media. No ads. No algorithm deciding what you see and trying to make you
          stay longer. Even better: we like you to be gone within <strong>a few minutes</strong>.
        </p>
        <p>
          hoshigo is by people, for people. No fake profiles, no bots. Only verified profiles of real people with real
          taste: every page here belongs to someone.
        </p>
        <p>So the next time somebody asks: do you have any podcast tips?</p>
        <p>Yes, have a look at my hoshigo.</p>
      </section>

      <SiteFooter loggedIn={!!user} />
    </div>
  );
}
