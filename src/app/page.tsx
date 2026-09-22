import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import RecoveryHashRedirect from "@/components/RecoveryHashRedirect";

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
      <RecoveryHashRedirect />
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
          <SiteNav />

        </div>
      </header>

      <SiteFooter />
    </div>
  );
}
