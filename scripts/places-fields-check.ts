// Round 7: structured place fields from live OSM. Usage: npx tsx --env-file=.env.local scripts/places-fields-check.ts
import { resolvePlace, searchPlaces } from "../src/lib/resolve-work";
import { placeDisplay, placeLine, splitPlaceLine } from "../src/lib/place-fields";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("## search: type | city | country | by (combined, still written) | detail (street)");
  for (const q of ["Dishoom London", "Café de Klos Amsterdam", "Shakespeare and Company Paris", "Vondelpark", "Sukiyabashi Jiro Tokyo", "Pergamonmuseum Berlin"]) {
    const r = await searchPlaces(q);
    await sleep(1100);
    console.log(`\n"${q}"`);
    for (const p of r.slice(0, 3)) console.log(`- ${p.title} | ${p.place_type ?? "-"} | ${p.city ?? "-"} | ${p.country ?? "-"} | ${p.by} | ${p.detail}`);
  }
  console.log("\n## resolve (pasted Maps link path)");
  for (const q of ["Rijksmuseum", "Café De Klos"]) {
    const r = await resolvePlace(q);
    await sleep(1100);
    console.log(`${q} → ${r?.title} | ${r?.place_type} | ${r?.city} | ${r?.country} | ${r?.match_confidence}`);
  }
  console.log("\n## helpers");
  console.log(JSON.stringify(splitPlaceLine("Bar · Amsterdam")), JSON.stringify(splitPlaceLine("Amsterdam, Netherlands")), placeLine("Bar", "Amsterdam"));
  console.log(JSON.stringify(placeDisplay({ by: "Museum · Amsterdam" })), JSON.stringify(placeDisplay({ by: "x", place_type: "Park", city: "Utrecht", country: "Netherlands" })));
}
main().then(() => process.exit(0));
