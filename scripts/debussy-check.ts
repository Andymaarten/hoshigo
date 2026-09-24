// Round 12 regression: classical and multi-artist albums must match, and a match must verify.
// Usage: npx tsx --env-file=.env.local scripts/debussy-check.ts
import { readLink } from "../src/lib/read-link";
import { resolveAlbum, resolveWork, verifyWork } from "../src/lib/resolve-work";

const SLUGS = ["films", "albums", "books", "essays", "things", "tv", "songs", "podcasts", "games", "places", "videos"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Title and artist as Spotify gives them (composer in the title, performer as artist).
const albums: [string, string][] = [
  ["Bach: Goldberg Variations", "Glenn Gould"],
  ["Promises", "Floating Points, Pharoah Sanders, London Symphony Orchestra"],
  ["Recomposed by Max Richter: Vivaldi – The Four Seasons", "Max Richter"],
];

async function main() {
  let failed = 0;
  const url = "https://open.spotify.com/album/4oVqtr6UVWx5pCQpoOU6wU";
  const r = await readLink(url, SLUGS);
  const w = await resolveWork(r.category_slug ?? "albums", r.title ?? "", r.by, r.year, r.link);
  await sleep(1100);
  const v = w ? await verifyWork(w.source, w.source_id) : null;
  const ok = !!w && !!v && v.source_id === w.source_id;
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "FAIL"} paste ${url}: "${r.title}" by ${r.by} → ${w ? `${w.source_id} "${w.title}" by ${w.by} (${w.match_confidence})` : "no match"} | verify ${v ? "ok" : "rejected"}`);

  for (const [title, artist] of albums) {
    await sleep(1100);
    const m = await resolveAlbum(title, artist);
    await sleep(1100);
    const mv = m ? await verifyWork("musicbrainz", m.source_id) : null;
    const good = !!m && !!mv;
    if (!good) failed++;
    console.log(`${good ? "OK  " : "FAIL"} "${title}" by ${artist} → ${m ? `${m.source_id} "${m.title}" by ${m.by} (${m.match_confidence})` : "no match"}`);
  }
  console.log(failed ? `${failed} failed` : "all passed");
}
main().then(() => process.exit(0));
