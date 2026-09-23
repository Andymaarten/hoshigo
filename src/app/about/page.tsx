import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import HeaderStamp from "@/components/HeaderStamp";
import { createClient } from "@/lib/supabase/server";

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
          <Link href="/" className="word" aria-label="hoshigo">
            hosh<span className="tittle">ı</span>go
          </Link>
          <SiteNav loggedIn={!!user} handle={myHandle} />
        </div>
        <HeaderStamp />
        <div className="kicker">
          <span className="dot" aria-hidden="true" />
          manifesto
        </div>
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
          stay longer. We like you to be gone within a few minutes.
        </p>
        <p>
          hoshigo is by people, for people. No AI, no bots. Only verified profiles of real people with real taste:
          every page here belongs to someone.
        </p>
      </section>

      <SiteFooter loggedIn={!!user} />
    </div>
  );
}
