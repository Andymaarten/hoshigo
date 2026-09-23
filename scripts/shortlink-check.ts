// Real public short links found on the web. Usage: npx tsx --env-file=.env.local scripts/shortlink-check.ts
import { readLink } from "../src/lib/read-link";

const SLUGS = ["films", "albums", "books", "essays", "things", "tv", "songs", "podcasts", "games", "places", "videos"];

async function main() {
  for (const u of ["https://maps.app.goo.gl/PR2d5Et72zFTvugP7", "https://spotify.link/8JnKrNFWLob", "http://amzn.to/ZAcFu8"]) {
    const r = await readLink(u, SLUGS);
    console.log(JSON.stringify({ input: u, link: r.link, target: r.target, status: r.status, title: r.title, category: r.category_slug, reason: r.reason }));
  }
}

main().then(() => process.exit(0));
