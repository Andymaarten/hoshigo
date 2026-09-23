// Same work across languages: do translations resolve to the same catalog id?
// Usage: npx tsx --env-file=.env.local scripts/cross-language-check.ts
import { resolveBook, resolveFilm, searchBooks, searchFilms } from "../src/lib/resolve-work";

const books: [string, string, string | null][] = [
  ["The Years", "De jaren", "Annie Ernaux"],
  ["The Years", "Les Années", "Annie Ernaux"],
  ["One Hundred Years of Solitude", "Honderd jaar eenzaamheid", "Gabriel García Márquez"],
  ["The Discomfort of Evening", "De avond is ongemak", "Marieke Lucas Rijneveld"],
  ["The Name of the Rose", "De naam van de roos", "Umberto Eco"],
  ["Steppenwolf", "Der Steppenwolf", "Hermann Hesse"],
  ["The Stranger", "L'étranger", "Albert Camus"],
  ["The Stranger", "De vreemdeling", "Albert Camus"],
  ["The Discovery of Heaven", "De ontdekking van de hemel", "Harry Mulisch"],
  ["The Dinner", "Het diner", "Herman Koch"],
];
const films: [string, string][] = [
  ["Seven Samurai", "De zeven samoerai"],
  ["Spirited Away", "De reis van Chihiro"],
  ["The Lives of Others", "Das Leben der Anderen"],
  ["Amélie", "Le Fabuleux Destin d'Amélie Poulain"],
];

async function main() {
  console.log("## Books (resolveBook with author, then the search list's first hit)");
  for (const [a, b, author] of books) {
    const [ra, rb] = [await resolveBook(a, author), await resolveBook(b, author)];
    const [sa, sb] = [(await searchBooks(`${a} ${author ?? ""}`))[0], (await searchBooks(`${b} ${author ?? ""}`))[0]];
    const same = ra && rb && ra.source_id === rb.source_id;
    const sameSearch = sa && sb && sa.source_id === sb.source_id;
    console.log(`${same ? "SAME" : "DIFF"} resolve  ${a} → ${ra?.source_id} (${ra?.title}) | ${b} → ${rb?.source_id} (${rb?.title})`);
    console.log(`${sameSearch ? "SAME" : "DIFF"} search   ${a} → ${sa?.source_id} | ${b} → ${sb?.source_id} (${sb?.title})`);
  }
  console.log("\n## Films");
  for (const [a, b] of films) {
    const [ra, rb] = [await resolveFilm(a), await resolveFilm(b)];
    const sb = (await searchFilms(b))[0];
    console.log(`${ra && rb && ra.source_id === rb.source_id ? "SAME" : "DIFF"} ${a} → ${ra?.source_id} | ${b} → ${rb?.source_id} (${rb?.title}); search first: ${sb?.source_id} ${sb?.title}`);
  }
}
main().then(() => process.exit(0));
