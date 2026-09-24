import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import RecoveryHashRedirect from "@/components/RecoveryHashRedirect";
import Wordmark from "@/components/Wordmark";

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
            <Wordmark />
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

      <p className="hero-prompt">Press one of the hoshigos below to get inspired.</p>

      <HeroField />

      <SiteFooter />
    </div>
  );
}

// Where the red hoshigos lead, in order of appearance. Cycled if a layout has
// more circles than entries.
const HOSHIGO_LINKS = ["/testuser", "/andymaarten", "/testuser", "/testuser", "/andymaarten", "/testuser"];

const BAR_SIZES: [number, number][] = [
  [59, 400], [55, 400], [54, 400], [58, 400], [56, 400], [56, 400], [55, 400],
  [57, 400], [58, 401], [54, 400], [54, 399], [58, 401], [58, 399],
];
const CIRCLE_SIZES: [number, number][] = [[300, 310], [300, 315], [300, 313], [300, 309], [300, 314]];

// Separate layouts per width instead of shrinking one: the drawing keeps its
// stroke size and simply loses bars. Numbers are the bar index a circle sits
// before. A circle spans about 3 bar slots, so circles in adjacent rows sit at
// least 4 slots apart and never overlap.
const HERO_LAYOUTS: { name: string; bars: number; circles: number[][] }[] = [
  { name: "wide", bars: 24, circles: [[4, 17], [8, 21], [2, 14]] },
  { name: "mid", bars: 16, circles: [[3, 11], [7, 15], [2, 11]] },
  { name: "narrow", bars: 8, circles: [[1], [6], [2]] },
];

// Deterministic so server and client render the same drawing.
function noise(seed: number) {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function wobble(seed: number, px: number, deg: number) {
  const y = ((noise(seed) - 0.5) * 2 * px).toFixed(1);
  const r = ((noise(seed + 101) - 0.5) * 2 * deg).toFixed(2);
  return { "--y": `${y}px`, "--r": `${r}deg` } as React.CSSProperties;
}

function HeroField() {
  return (
    <div className="hero-field">
      {HERO_LAYOUTS.map((layout, li) => {
        let circleCount = 0;
        let prevBar = -1;
        let prevCircle = -1;
        return (
          <div key={layout.name} className={`hero-paper hero-${layout.name}`}>
            {layout.circles.map((spots, row) => {
              const items: React.ReactNode[] = [];
              for (let b = 0; b <= layout.bars; b++) {
                const seed = li * 1000 + row * 100 + b;
                if (spots.includes(b)) {
                  let v = Math.floor(noise(seed + 7) * CIRCLE_SIZES.length);
                  if (v === prevCircle) v = (v + 1) % CIRCLE_SIZES.length;
                  prevCircle = v;
                  const [w, h] = CIRCLE_SIZES[v];
                  const href = HOSHIGO_LINKS[circleCount++ % HOSHIGO_LINKS.length];
                  items.push(
                    <Link key={`c${b}`} href={href} className="hero-circle" style={wobble(seed + 3, 5, 4)}>
                      <img src={`/hero/redhoshigos_${v + 1}.png`} width={w} height={h} alt="" loading="lazy" decoding="async" />
                      <span className="sr-only">Open a hoshigo page</span>
                    </Link>,
                  );
                }
                if (b === layout.bars) break;
                let v = Math.floor(noise(seed) * BAR_SIZES.length);
                if (v === prevBar) v = (v + 1 + Math.floor(noise(seed + 50) * (BAR_SIZES.length - 1))) % BAR_SIZES.length;
                prevBar = v;
                const [w, h] = BAR_SIZES[v];
                items.push(
                  <span key={`b${b}`} className="hero-bar" aria-hidden="true" style={wobble(seed, 4, 1)}>
                    <img src={`/hero/bluelines_${v + 1}.png`} width={w} height={h} alt="" loading="lazy" decoding="async" />
                  </span>,
                );
              }
              return (
                <div key={row} className="hero-row">
                  {items}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
