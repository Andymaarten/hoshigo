import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import RecoveryHashRedirect from "@/components/RecoveryHashRedirect";
import Wordmark from "@/components/Wordmark";
import HeroField, { heroLinksFor } from "@/components/HeroField";
import type { Metadata } from "next";

const description = "A small place to keep the handful of things you would give five stars.";

// Set here, not in the layout, so profiles and listings never inherit the homepage's og:url.
export const metadata: Metadata = {
  description,
  openGraph: { type: "website", siteName: "hoshigo", title: "hoshigo", description, url: "https://www.hoshigo.cc" },
  twitter: { card: "summary_large_image", title: "hoshigo", description },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // PKCE-style recovery links carry `type=recovery` as a query param (reaches
  // the server); implicit-flow ones carry it in the URL hash (client-only) —
  // see RecoveryHashRedirect below for that case. Both happen when Supabase
  // falls back to the Site URL instead of our intended /auth/confirm target.
  if (sp.type === "recovery") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (typeof value === "string") params.set(key, value);
    }
    redirect(`/auth/confirm?${params.toString()}`);
  }

  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    heroLinks,
  ] = await Promise.all([supabase.auth.getUser(), heroLinksFor(supabase)]);

  // Logged in people can read the homepage too; only someone without a page yet is sent on.
  let myHandle: string | undefined;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("handle").eq("id", user.id).single();
    if (!profile || profile.handle.startsWith("user-")) redirect("/onboarding");
    myHandle = profile.handle;
  }

  return (
    <div className="page page-home">
      <RecoveryHashRedirect />
      <header className="hero">
        <div className="masthead">
          <div className="entry">
            <Wordmark handle={myHandle} />
            <div className="gloss">
              <span className="ja" lang="ja">
                星五
              </span>
              <span>[ho.ɕi.ɡo]</span>
              <i>noun</i>
            </div>
            <hr />
            <p className="def def-origin">
              hoshigo comes from Japanese: <i>hoshi</i>, star, and <i>go</i>, five. Five stars.
            </p>
          </div>
          <SiteNav loggedIn={!!user} handle={myHandle} />
        </div>
      </header>

      <section className="manifesto">
        <p className="manifesto-lead">
          hoshigo is a personal place to keep the handful of things you&apos;d actually give five stars. Films,
          books, essays, albums.
        </p>
        <span className="manifesto-sep" aria-hidden="true" />
        <p className="manifesto-mid">
          We&apos;re not traditional social media. No ads. No algorithm deciding what you see and trying to make you
          stay longer. Actually, we would like you <strong>to be gone within minutes</strong>.
        </p>
        <span className="manifesto-sep" aria-hidden="true" />
        <p className="manifesto-coda">
          hoshigo is by people, for people. No AI, no bots. Only verified profiles of real people with real taste:
          every page here belongs to someone.
        </p>
      </section>

      <p className="hero-prompt">Press one of the red hoshigos below to get inspired.</p>

      <HeroField links={heroLinks} />

      <SiteFooter loggedIn={!!user} handle={myHandle} />
    </div>
  );
}
