// Round 11: the "check it" links on /admin/backfill open the record's real page.
// Usage: npx tsx scripts/work-links-check.ts
import { workPageUrl } from "../src/lib/work-links";

const cases: [string, string, string][] = [
  ["tmdb", "129", "films"],
  ["tmdb_tv", "1396", "tv"],
  ["musicbrainz", "970f689d-1778-4953-b3ed-48d057625724", "albums"],
  ["openlibrary", "/works/OL102389W", "books"],
  ["itunes", "1485382086", "podcasts"],
  ["wikidata", "Q17271", "games"],
  ["bgg", "378524", "games"],
  ["nominatim", "N251823631", "places"],
  ["youtube", "dQw4w9WgXcQ", "videos"],
];

async function main() {
  for (const [source, id, slug] of cases) {
    const url = workPageUrl(source, id, slug);
    let status = "-";
    if (url) {
      try {
        const res = await fetch(url, { method: "GET", redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
        status = String(res.status);
      } catch (e) {
        status = e instanceof Error ? e.name : "error";
      }
    }
    console.log(`${source} ${id} → ${url} [${status}]`);
  }
}
main().then(() => process.exit(0));
