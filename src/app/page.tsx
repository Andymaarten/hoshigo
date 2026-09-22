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
            <p className="def def-origin">
              hoshigo comes from Japanese: <i>hoshi</i>, star, and <i>go</i>, five. Five stars.
            </p>
          </div>
          <SiteNav />

        </div>
      </header>

      <section className="manifesto">
        <p className="manifesto-lead">
          It&apos;s a personal place to keep the handful of things you&apos;d actually give five stars. Films, books,
          essays, albums.
        </p>
        <span className="manifesto-sep" aria-hidden="true" />
        <p className="manifesto-mid">
          We&apos;re not traditional social media. No ads. No algorithm deciding what you see and trying to make you
          stay longer. We like you to be gone within a few minutes.
        </p>
        <span className="manifesto-sep" aria-hidden="true" />
        <p className="manifesto-coda">
          hoshigo is by people, for people. No AI, no bots. Only verified profiles of real people with real taste:
          every page here belongs to someone.
        </p>
      </section>

      <p className="hero-prompt">Press one of the hoshigo&apos;s below to get inspired.</p>

      <HeroField />

      <SiteFooter />
    </div>
  );
}

// A staggered grid of flat stamps, wider than the frame so the outer columns
// bleed off both edges. Rows are rendered explicitly so alternating rows can be
// offset half a step; the row simply clips where the viewport ends.
const HERO_ROWS = 6;
const HERO_PER_ROW = 18;

// PLACEHOLDER: profiles have no avatar field yet, so every stamp reveals one of
// five bundled textures instead of a real person's photo, and every stamp links
// to the seeded demo profile. Same spirit as ProfileStats' stand-in counts.
const HERO_PHOTOS = [1, 2, 3, 4, 5].map((n) => `/hero/placeholder-${n}.jpg`);

const RING_TEXT = "Press here to visit this hoshigo";

function HeroField() {
  return (
    <div className="hero-field" aria-label="Preview hoshigo pages">
      <div className="hero-grid">
        {Array.from({ length: HERO_ROWS }, (_, row) => (
          <div key={row} className={row % 2 ? "hero-row hero-row-offset" : "hero-row"}>
            {Array.from({ length: HERO_PER_ROW }, (_, col) => {
              const i = row * HERO_PER_ROW + col;
              // Every stamp is the same link, so only the first one takes a tab
              // stop; the rest stay clickable but out of the keyboard order.
              const first = i === 0;
              return (
                <Link
                  key={col}
                  href="/testuser"
                  className="hero-dot"
                  tabIndex={first ? undefined : -1}
                  aria-hidden={first ? undefined : true}
                >
                  <span className="hero-disc">
                    <img className="hero-photo" src={HERO_PHOTOS[i % HERO_PHOTOS.length]} alt="" aria-hidden="true" />
                  </span>
                  <svg className="hero-ring" viewBox="0 0 116 116" aria-hidden="true" focusable="false">
                    {/* Only the top half of the ring is used — text following the
                        full circle read upside-down along the bottom half. A
                        left-to-right arc over the top reads cleanly. */}
                    <defs>
                      <path id={`hero-ring-${i}`} d="M11,58 a47,47 0 1,1 94,0" />
                    </defs>
                    <text>
                      <textPath href={`#hero-ring-${i}`} textLength="146" startOffset="0">
                        {RING_TEXT}
                      </textPath>
                    </text>
                  </svg>
                  {first && <span className="sr-only">Preview a hoshigo profile</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
