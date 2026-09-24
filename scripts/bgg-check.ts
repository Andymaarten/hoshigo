// Round 9: BoardGameGeek. Usage: npx tsx --env-file=.env.local scripts/bgg-check.ts
// Without BGG_TOKEN the live BGG calls return nothing; the parser is checked on a fixture
// in BGG's documented thing format instead.
import { readLink } from "../src/lib/read-link";
import { bggThings, resolveGame, searchGames, verifyWork } from "../src/lib/resolve-work";

const SLUGS = ["films", "albums", "books", "essays", "things", "tv", "songs", "podcasts", "games", "places", "videos"];
const FIXTURE = `<?xml version="1.0" encoding="utf-8"?><items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
<item type="boardgame" id="378524">
  <thumbnail>https://cf.geekdo-images.com/abc__thumb/img/x.jpg</thumbnail>
  <image>https://cf.geekdo-images.com/abc__original/img/y.jpg</image>
  <name type="primary" sortindex="1" value="Monsters of Loch Lomond" />
  <name type="alternate" sortindex="1" value="Les Monstres du Loch Lomond" />
  <yearpublished value="2023" />
  <link type="boardgamedesigner" id="1" value="Aaron Mesburne" />
  <link type="boardgamepublisher" id="2" value="Fantasia Games" />
</item>
<item type="boardgameexpansion" id="99">
  <name type="primary" sortindex="1" value="Catan: Seafarers &amp; Friends" />
  <yearpublished value="1997" />
  <link type="boardgamedesigner" id="3" value="(Uncredited)" />
  <link type="boardgamepublisher" id="4" value="KOSMOS" />
</item></items>`;

async function main() {
  console.log("BGG_TOKEN set:", !!process.env.BGG_TOKEN?.trim());
  console.log("\n## parser (fixture)");
  for (const w of bggThings(FIXTURE)) console.log(`- ${w.source}:${w.source_id} ${w.title} | ${w.by} | ${w.year} | ${w.detail} | img ${w.image_url}`);

  console.log("\n## pasted BGG link");
  for (const u of ["https://boardgamegeek.com/boardgame/378524/monsters-of-loch-lomond", "https://boardgamegeek.com/boardgame/13/catan"]) {
    const r = await readLink(u, SLUGS);
    const g = await resolveGame(r.title ?? "", u);
    console.log(`${u.slice(8)} → ${r.category_slug} (${r.reason}) "${r.title}"${r.title_from_url ? " (from URL)" : ""} | link kept: ${r.link === u} | photo: ${r.image_url ? "yes" : "no"} [${r.status}] | match: ${g ? `${g.source}:${g.source_id} ${g.title}` : "none"}`);
  }

  console.log("\n## search");
  for (const q of ["Monsters of Loch Lomond", "Catan", "Wingspan"]) {
    const r = await searchGames(q);
    console.log(`"${q}" → ${r.length}: ${r.slice(0, 4).map((w) => `${w.source}:${w.title} (${w.detail})`).join(" | ") || "(none)"}`);
  }

  console.log("\n## verify");
  console.log("bgg 378524 →", (await verifyWork("bgg", "378524"))?.title ?? "null (no token)");
  console.log("bgg 'abc' →", (await verifyWork("bgg", "abc"))?.title ?? "null (rejected)");
}
main().then(() => process.exit(0));
