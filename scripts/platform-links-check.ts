// Round 16: the "Open in …" links built for real catalogue works, and the choice per viewer.
// Usage: npx tsx --env-file=.env.local scripts/platform-links-check.ts
import { resolveWork } from "../src/lib/resolve-work";
import { buildWorkLinks } from "../src/lib/work-links-build";
import { chooseOpenLink, openLinkLabel } from "../src/lib/platforms";

const cases: [string, string, string | null, string[]][] = [
  ["films", "Parasite", "Bong Joon-ho", ["tmdb", "imdb", "letterboxd"]],
  ["tv", "Breaking Bad", null, ["tmdb", "imdb"]],
  ["books", "The Name of the Rose", "Umberto Eco", ["openlibrary", "goodreads", "storygraph"]],
  ["places", "Rijksmuseum Amsterdam", null, ["google_maps", "apple_maps"]],
];

async function main() {
  let failed = 0;
  for (const [slug, title, by, want] of cases) {
    const w = await resolveWork(slug, title, by, undefined, undefined);
    if (!w) {
      failed++;
      console.log(`FAIL ${slug} "${title}": no work`);
      continue;
    }
    const links = await buildWorkLinks({ id: "x", source: w.source, source_id: w.source_id, title: w.title, by: w.by ?? null, city: w.city, country: w.country });
    const missing = want.filter((p) => !links.some((l) => l.platform === p));
    if (missing.length) failed++;
    console.log(`${missing.length ? "FAIL" : "OK  "} ${slug} ${w.source}:${w.source_id} "${w.title}"`);
    for (const l of links) console.log(`       ${l.platform} ${l.kind} ${l.url}`);
    const group = slug === "tv" ? "films" : slug === "books" ? "books" : slug === "places" ? "places" : "films";
    const pick = chooseOpenLink(links, group, {}, null);
    console.log(`       default for a logged out viewer: ${pick ? openLinkLabel(pick) : "none"}`);
    await new Promise((r) => setTimeout(r, 1100));
  }
  // own link on the same platform: only one button
  const same = chooseOpenLink([{ platform: "letterboxd", url: "https://letterboxd.com/film/x/", kind: "direct" }], "films", {}, "https://letterboxd.com/film/x/");
  if (same) failed++;
  console.log(`${same ? "FAIL" : "OK  "} own Letterboxd link hides the Letterboxd button`);
  console.log(failed ? `${failed} failed` : "all passed");
}
main().then(() => process.exit(0));
