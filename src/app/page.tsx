import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteFooter from "@/components/SiteFooter";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("handle").eq("id", user.id).single();
    if (profile && !profile.handle.startsWith("user-")) redirect(`/${profile.handle}`);
    redirect("/onboarding");
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="masthead">
          <div className="entry">
            <div className="word" aria-label="hoshigo">
              hosh<span className="tittle">ı</span>go
            </div>
            <div className="gloss">
              <span className="ja" lang="ja">
                星五
              </span>
              <span>[ho.ɕi.ɡo]</span>
              <i>noun</i>
            </div>
            <hr />
            <div className="def">
              <i>Japanese.</i> five stars. A place where you can curate everything that you give five stars.
              Nobody&apos;s selling your attention here — see{" "}
              <Link href="/about" style={{ textDecoration: "underline" }}>
                what we&apos;re about
              </Link>
              .
            </div>
          </div>
          <nav className="menu" aria-label="Main">
            <Link href="/login">
              <span>Log in</span>
            </Link>
            <Link href="/login" className="btn">
              Start / Login
            </Link>
          </nav>
        </div>
      </header>

      <SiteFooter />
    </div>
  );
}
