import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import { createClient } from "@/lib/supabase/server";

export default async function AboutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="page">
      <header className="hero">
        <Link href="/" className="word" aria-label="hoshigo">
          hosh<span className="tittle">ı</span>go
        </Link>
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
          It&apos;s a personal place to keep the handful of things you&apos;d actually give five stars. A film, a
          book, a restaurant. Nothing else.
        </p>
        <p>
          We&apos;re not traditional social media. No ads. No algorithm deciding what you see or how long you stay.
          No feed to scroll, no follower count to chase.
        </p>
        <p>
          By people, for people. No AI, no bots. Only verified profiles of real people with real taste. Every page
          here belongs to someone.
        </p>
      </section>

      <SiteFooter loggedIn={!!user} />
    </div>
  );
}
