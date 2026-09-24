// Round 10: what the backfill would match for the items that lost their work link last
// night, and the category/source guard. Usage: npx tsx --env-file=.env.local scripts/backfill-dryrun-check.ts
import { resolveWork } from "../src/lib/resolve-work";
import { sourceFitsCategory } from "../src/lib/category-display";

const items: [string, string, string | null, string | null][] = [
  ["albums", "Promises", "Floating Points, Pharoah Sanders & The London Symphony Orchestra", "https://open.spotify.com/album/1Xq3FlV3mEizOIZJqg3mO5"],
  ["albums", "Open", "Grandbrothers", null],
  ["podcasts", "ISVW Filosofie Podcast", null, null],
  ["books", "De jaren", "Annie Ernaux", null],
  ["places", "De Jaren", null, null],
];

async function main() {
  for (const [slug, title, by, url] of items) {
    const w = await resolveWork(slug, title, by, null, url);
    console.log(`${slug} "${title}" → ${w ? `${w.source}:${w.source_id} "${w.title}" by ${w.by ?? "-"} (${w.match_confidence})` : "no match"}`);
    await new Promise((r) => setTimeout(r, 1100));
  }
  console.log("\nguard: nominatim→books", sourceFitsCategory("nominatim", "books"), "| openlibrary→books", sourceFitsCategory("openlibrary", "books"), "| bgg→games", sourceFitsCategory("bgg", "games"), "| tmdb→tv", sourceFitsCategory("tmdb", "tv"));
}
main().then(() => process.exit(0));
