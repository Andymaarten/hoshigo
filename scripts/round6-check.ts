// Round 6: places, games, film bridge. Usage: npx tsx --env-file=.env.local scripts/round6-check.ts
import { resolveFilm, resolveGame, resolvePlace, searchFilms, searchGames, searchPlaces } from "../src/lib/resolve-work";
import { withWebsitePhoto } from "../src/lib/works";
import { readLink } from "../src/lib/read-link";

const SLUGS = ["films", "albums", "books", "essays", "things", "tv", "songs", "podcasts", "games", "places", "videos"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("## Places: search list (kind · city, website)");
  for (const q of ["Rijksmuseum Amsterdam", "Café de Klos Amsterdam", "Dishoom London", "Noma Copenhagen", "Pllek Amsterdam", "Shakespeare and Company Paris"]) {
    const r = await searchPlaces(q);
    await sleep(1100); // Nominatim: 1 request per second
    console.log(`\n"${q}" (${r.length})`);
    for (const p of r.slice(0, 3)) console.log(`- ${p.title} | ${p.by} | ${p.detail} | site: ${p.website ?? "-"} | id ${p.source_id}`);
  }
  console.log("\n## Places: resolve + website photo");
  for (const q of ["Rijksmuseum", "Dishoom Covent Garden"]) {
    const r = await resolvePlace(q);
    await sleep(1100);
    const withPhoto = r ? await withWebsitePhoto(r) : null;
    console.log(`${q} → ${r?.title} | ${r?.by} | ${r?.match_confidence} | site ${r?.website ?? "-"} | photo ${withPhoto?.image_url?.slice(0, 80) ?? "-"}`);
  }

  console.log("\n## Games: search");
  for (const q of ["Hades", "Catan", "Wingspan", "Zelda Tears of the Kingdom", "Celeste", "Ticket to Ride", "Portal 2"]) {
    const t = Date.now();
    const r = await searchGames(q);
    console.log(`\n"${q}" (${r.length}, ${Date.now() - t}ms)`);
    for (const g of r.slice(0, 3)) console.log(`- ${g.title} | ${g.by ?? ""} | ${g.year ?? ""} | ${g.detail} | img ${g.image_url ? "yes" : "no"} | ${g.source_id}`);
  }
  console.log("\n## Games: pasted links");
  for (const u of [
    "https://store.steampowered.com/app/1145360/Hades/",
    "https://store.steampowered.com/app/620/Portal_2/",
    "https://boardgamegeek.com/boardgame/13/catan",
    "https://boardgamegeek.com/boardgame/266192/wingspan",
    "https://www.playstation.com/en-us/games/astro-bot/",
    "https://www.nintendo.com/us/store/products/the-legend-of-zelda-tears-of-the-kingdom-switch/",
    "https://maddymakesgames.itch.io/celeste-classic",
    "https://en.wikipedia.org/wiki/Hollow_Knight",
  ]) {
    const link = await readLink(u, SLUGS);
    const g = link.category_slug === "games" ? await resolveGame(link.title ?? "", u) : null;
    console.log(`${u.slice(8, 70)} → ${link.category_slug} (${link.reason}) "${link.title ?? ""}" → ${g ? `${g.title} [${g.source_id}] ${g.detail} ${g.match_confidence}` : "no match"}`);
  }

  console.log("\n## Films: Dutch titles");
  for (const q of ["De reis van Chihiro", "De zeven samoerai", "Het leven van anderen"]) {
    const r = await resolveFilm(q);
    const s = (await searchFilms(q))[0];
    console.log(`${q} → resolve ${r?.source_id} ${r?.title} | search ${s?.source_id} ${s?.title}`);
  }
}
main().then(() => process.exit(0));
