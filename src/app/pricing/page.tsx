import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import { createClient } from "@/lib/supabase/server";

// Not linked from SiteNav or anywhere in global navigation on purpose — this page
// is only reachable from a locked "see more" tile on someone else's profile.
export default async function PricingPage() {
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
        <div className="kicker">
          <span className="dot" aria-hidden="true" />
          hoshigo+
        </div>
        <h1 style={{ fontSize: "clamp(40px,10vw,72px)" }}>see the full list.</h1>
      </header>

      <section className="prose">
        <p>
          Every profile shows the first five items in each list for free. hoshigo+ unlocks the rest — the full
          history of what someone else has starred, not just the newest five.
        </p>
        <p>We&apos;re also planning matching and recommendations based on shared taste, once that&apos;s ready.</p>
        <p>hoshigo+ isn&apos;t live yet. This page is a placeholder for what&apos;s coming.</p>
      </section>

      <SiteFooter loggedIn={!!user} />
    </div>
  );
}
