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

      <p className="hero-prompt">
        Press one of the hoshigo below for a preview.
        <span className="hero-prompt-sub">
          <i>Japanese.</i> five stars. A place to curate everything you give five stars.
        </span>
      </p>

      <HeroField />

      <div className="hero-footline">
        <div className="hero-outline">hoshigo</div>
        <div className="hero-tag">星五 · no. 5000</div>
      </div>

      <SiteFooter />
    </div>
  );
}

// Reference grid quarter-turned: the poster's four landscape rows read as four
// columns here, one disc left deliberately alone off-centre. Every disc links
// to the seeded demo profile as a "preview a hoshigo page" callout; the larger
// ones are big enough to carry the ring text legibly on hover.
const HERO_DOTS: Array<[number, number, number]> = [
  [12, 18, 96],
  [34, 12, 70],
  [57, 20, 84],
  [80, 14, 62],
  [20, 46, 74],
  [46, 52, 120],
  [72, 44, 68],
  [14, 78, 66],
  [40, 86, 92],
  [68, 76, 78],
  [90, 88, 54],
];

const RING_TEXT = "Press here to visit this hoshigo · Press here to visit this hoshigo · ";

function HeroField() {
  return (
    <div className="hero-field" aria-label="Preview hoshigo pages">
      {HERO_DOTS.map(([x, y, s], i) => (
        <Link
          key={i}
          href="/testuser"
          className="hero-dot"
          style={{ left: `${x}%`, top: `${y}%`, width: `calc(${s}px * var(--k))`, height: `calc(${s}px * var(--k))` }}
        >
          <span className="hero-disc">
            {s >= 70 && (
              <svg className="hero-ring" viewBox="0 0 116 116" aria-hidden="true" focusable="false">
                <defs>
                  <path id={`hero-ring-${i}`} d="M58,58 m-47,0 a47,47 0 1,1 94,0 a47,47 0 1,1 -94,0" />
                </defs>
                <text>
                  <textPath href={`#hero-ring-${i}`} textLength="292">
                    {RING_TEXT}
                  </textPath>
                </text>
              </svg>
            )}
          </span>
          <span className="sr-only">Preview a hoshigo profile</span>
        </Link>
      ))}
    </div>
  );
}
