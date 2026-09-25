import Link from "next/link";
import type { createClient } from "@/lib/supabase/server";

// profiles.homepage_order (1 to 10) is set by hand in Supabase to pick who the red hoshigos show.
export async function heroLinksFor(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string[]> {
  const { data } = await supabase.from("profiles").select("handle").not("homepage_order", "is", null).order("homepage_order").limit(10);
  return data?.length ? data.map((p) => `/${p.handle}`) : HOSHIGO_LINKS;
}

// Fallback for where the red hoshigos lead when no profile has a homepage_order yet.
// Cycled if a layout has more circles than entries.
const HOSHIGO_LINKS = ["/testuser", "/andymaarten", "/testuser", "/testuser", "/andymaarten", "/testuser"];

const BAR_SIZES: [number, number][] = [
  [59, 400], [55, 400], [54, 400], [58, 400], [56, 400], [56, 400], [55, 400],
  [57, 400], [58, 401], [54, 400], [54, 399], [58, 401], [58, 399],
];
const CIRCLE_SIZES: [number, number][] = [[300, 310], [300, 315], [300, 313], [300, 309], [300, 314]];

// Separate layouts per width instead of shrinking one: the drawing keeps its
// stroke size and simply loses bars. Numbers are the bar index a circle sits
// before. A circle spans about 4 bar slots, so circles in adjacent rows sit at
// least 5 slots apart and never overlap.
const HERO_LAYOUTS: { name: string; bars: number; circles: number[][] }[] = [
  { name: "wide", bars: 26, circles: [[4, 17], [10, 23], [2, 16]] },
  { name: "mid", bars: 16, circles: [[2, 10], [8, 16], [1, 10]] },
  { name: "narrow", bars: 10, circles: [[0], [7], [1]] },
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

export default function HeroField({ links }: { links: string[] }) {
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
                  const href = links[circleCount++ % links.length];
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
