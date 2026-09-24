// Round 8: a picked search result is looked up again server side; only catalog data is used.
// Usage: npx tsx --env-file=.env.local scripts/verify-work-check.ts
import { verifyWork, type WorkSource } from "../src/lib/resolve-work";

const cases: [WorkSource, string, string][] = [
  ["tmdb", "129", "Spirited Away"],
  ["tmdb_tv", "1396", "Breaking Bad"],
  ["openlibrary", "/works/OL102389W", "The Years (Annie Ernaux)"],
  ["musicbrainz", "aa997ea0-2936-40bd-884d-3af8a0e064dc", "Random Access Memories (release group)"],
  ["musicbrainz", "345e4a72-46b4-48ba-8541-27c6b23c3b8c", "Get Lucky (recording)"],
  ["itunes", "1200361736", "The Daily"],
  ["nominatim", "N2626432820", "Café De Klos"],
  ["wikidata", "Q17271", "Catan"],
  ["youtube", "dQw4w9WgXcQ", "Rick Astley"],
  // must be rejected
  ["tmdb", "999999999", "does not exist"],
  ["openlibrary", "/works/OL1W; drop table", "bad id shape"],
  ["nominatim", "12345", "old place_id (not verifiable)"],
  ["wikidata", "Q42", "Douglas Adams, not a game"],
];

async function main() {
  for (const [source, id, label] of cases) {
    const w = await verifyWork(source, id);
    console.log(
      `${w ? "OK  " : "NULL"} ${source} ${id} (${label}) → ${w ? `${w.title} | ${w.by ?? ""} | ${w.year ?? ""} | img ${w.image_url ? "yes" : "no"}${w.website ? ` | site ${w.website}` : ""}${w.city ? ` | ${w.place_type} · ${w.city}` : ""}` : "rejected"}`
    );
  }
}
main().then(() => process.exit(0));
