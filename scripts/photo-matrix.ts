// Photo sources for "Use another photo". Usage: npx tsx --env-file=.env.local scripts/photo-matrix.ts
import { readPhotos } from "../src/lib/read-link";

const UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
async function firstLink(page: string, re: RegExp): Promise<string> {
  try {
    const html = await (await fetch(page, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) })).text();
    const m = html.match(re)?.[0];
    return m ? new URL(m, page).toString() : page;
  } catch {
    return page;
  }
}

async function main() {
  const substack = await firstLink("https://www.slowboring.com/archive", /https:\/\/www\.slowboring\.com\/p\/[a-z0-9-]+/);
  const guardian = await firstLink("https://www.theguardian.com/uk/culture", /https:\/\/www\.theguardian\.com\/[a-z-]+\/\d{4}\/[a-z]{3}\/\d{2}\/[a-z0-9-]+/);
  const cases: [string, string][] = [
    ["Wikipedia article", "https://en.wikipedia.org/wiki/Spirited_Away"],
    ["Wikimedia Commons file page", "https://commons.wikimedia.org/wiki/File:Tour_Eiffel_Wikimedia_Commons.jpg"],
    ["Direct image (no extension)", "https://images.unsplash.com/photo-1506744038136-46273834b3fb"],
    ["Unsplash photo page", "https://unsplash.com/photos/a-body-of-water-surrounded-by-trees-and-mountains-eOpewngf68w"],
    ["Pinterest pin", "https://www.pinterest.com/pin/99360735500167749/"],
    ["Instagram post", "https://www.instagram.com/p/C9qV8Z8Mh1B/"],
    ["bol.com product", "https://www.bol.com/nl/nl/p/apple-airpods-4/9300000190488770/"],
    ["Amazon product", "https://www.amazon.com/dp/B0CHX1W1XY"],
    ["Zalando product", "https://www.zalando.nl/nike-sportswear-air-force-1-sneakers-laag-white-ni112o0k4-a11.html"],
    ["Museum object page (Rijksmuseum)", "https://www.rijksmuseum.nl/en/collection/SK-C-5"],
    ["Restaurant site (Dishoom)", "https://www.dishoom.com/covent-garden/"],
    ["Substack post", substack],
    ["Discogs release", "https://www.discogs.com/release/1085364"],
    ["Goodreads book", "https://www.goodreads.com/book/show/119073.The_Name_of_the_Rose"],
    ["IMDb title", "https://www.imdb.com/title/tt0245429/"],
    ["News article (Guardian)", guardian],
    ["Plain text", "not a link at all"],
  ];
  console.log("| # | Source | Status | Candidates | Best (first) | Time |");
  console.log("|---|---|---|---|---|---|");
  let i = 0;
  for (const [label, url] of cases) {
    i++;
    const t = Date.now();
    const r = await readPhotos(url);
    const best = r.images[0] ? r.images[0].slice(0, 90) : "";
    console.log(`| ${i} | ${label}: \`${url.slice(0, 70)}\` | ${r.status} | ${r.images.length} | ${best} | ${Date.now() - t}ms |`);
  }
}
main().then(() => process.exit(0));
