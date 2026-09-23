// Runs the "find it yourself" search per category and prints the top hits.
// Usage: npx tsx --env-file=.env.local scripts/search-matrix.ts
import { searchWorks } from "../src/lib/resolve-work";

const cases: [string, string][] = [
  ["books", "De ontdekking van de hemel"],
  ["books", "Honderd jaar eenzaamheid"],
  ["books", "De naam van de roos"],
  ["books", "Der Steppenwolf"],
  ["books", "Steppenwolf"],
  ["books", "L'étranger"],
  ["books", "De vreemdeling Camus"],
  ["films", "Solaris"],
  ["films", "Parasite"],
  ["tv", "The Office"],
  ["albums", "OK Computer"],
  ["songs", "Get Lucky"],
  ["songs", "get lucky daft punk"],
  ["podcasts", "The Daily"],
  ["places", "Rijksmuseum Amsterdam"],
];

async function main() {
  for (const [cat, q] of cases) {
    const t = Date.now();
    const r = await searchWorks(cat, q);
    console.log(`\n## ${cat}: "${q}" (${r.length} results, ${Date.now() - t}ms)`);
    for (const w of r.slice(0, 4))
      console.log(`- ${w.title} | ${w.by ?? ""} | ${w.year ?? ""} | ${w.detail ?? ""} | img:${w.image_url ? "yes" : "no"}`);
  }
}

main().then(() => process.exit(0));
