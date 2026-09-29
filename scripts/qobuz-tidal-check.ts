// Round 15: Qobuz and TIDAL link shapes are read, classified and matched to MusicBrainz.
// Usage: npx tsx --env-file=.env.local scripts/qobuz-tidal-check.ts
import { readLink } from "../src/lib/read-link";
import { resolveWork } from "../src/lib/resolve-work";

const SLUGS = ["films", "albums", "books", "essays", "things", "tv", "songs", "podcasts", "games", "places", "videos"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// [link, category, title fragment ("" = category only)]
const cases: [string, string, string][] = [
  ["https://www.qobuz.com/gb-en/album/random-access-memories-daft-punk/0886443927087", "albums", "Random Access Memories"],
  ["https://open.qobuz.com/album/0886443927087", "albums", "Random Access Memories"],
  ["https://play.qobuz.com/album/0886443927087", "albums", "Random Access Memories"],
  ["https://open.qobuz.com/track/9140024", "songs", ""],
  ["https://tidal.com/browse/album/77646169", "albums", "Sea Change"],
  ["https://tidal.com/browse/album/77646169?u", "albums", "Sea Change"],
  ["https://listen.tidal.com/album/77646169", "albums", "Sea Change"],
  ["https://tidal.com/album/77646169", "albums", "Sea Change"],
  ["https://tidal.com/browse/track/77646170", "songs", "The Golden Age"],
  ["https://listen.tidal.com/track/77646170", "songs", "The Golden Age"],
  ["Listen to Sea Change by Beck on TIDAL https://tidal.com/browse/album/77646169?u", "albums", "Sea Change"],
];

async function main() {
  let failed = 0;
  for (const [input, want, title] of cases) {
    const r = await readLink(input, SLUGS, { useLlm: false });
    const w = r.title ? await resolveWork(r.category_slug ?? want, r.title, r.by, r.year, r.link) : null;
    const ok = r.category_slug === want && (!title || (r.title ?? "").includes(title)) && (!title || !!w) && !!r.link;
    if (!ok) failed++;
    console.log(
      `${ok ? "OK  " : "FAIL"} ${input.slice(0, 70)} → ${r.category_slug} "${r.title ?? ""}" by ${r.by ?? "?"} | ${w ? `${w.source} "${w.title}" (${w.match_confidence})` : "no match"} | keeps ${r.link}`
    );
    await sleep(1100);
  }
  console.log(failed ? `${failed} failed` : "all passed");
}
main().then(() => process.exit(0));
