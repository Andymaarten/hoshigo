// Runs the paste inputs from docs/input-test-matrix.md through readLink() and prints a
// markdown table. Usage: npx tsx --env-file=.env.local scripts/input-matrix.ts [--no-llm]
import { readLink } from "../src/lib/read-link";
import { resolveWork } from "../src/lib/resolve-work";

const SLUGS = ["films", "albums", "books", "essays", "things", "tv", "songs", "podcasts", "games", "places", "videos"];

async function firstLink(page: string, re: RegExp): Promise<string> {
  try {
    const html = await (await fetch(page, { headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }, signal: AbortSignal.timeout(10000) })).text();
    return html.match(re)?.[0] ?? page;
  } catch {
    return page;
  }
}

async function main() {
  const useLlm = !process.argv.includes("--no-llm");
  const guardian = await firstLink("https://www.theguardian.com/uk", /https:\/\/www\.theguardian\.com\/[a-z-]+\/\d{4}\/[a-z]{3}\/\d{2}\/[a-z0-9-]+/);
  const substack = await firstLink("https://www.astralcodexten.com/archive", /https:\/\/www\.astralcodexten\.com\/p\/[a-z0-9-]+/);
  const episode = await firstLink(
    "https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk",
    /https:\/\/open\.spotify\.com\/episode\/[A-Za-z0-9]+/
  );

  const inputs: [string, string][] = [
    ["Spotify album (with ?si)", "https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa?si=abc123"],
    ["Spotify track", "https://open.spotify.com/track/2Foc5Q5nqNiosCNqttzHof"],
    ["Spotify podcast show", "https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk"],
    ["Spotify podcast episode", episode.includes("/episode/") ? episode : "https://open.spotify.com/episode/4IAZ21ICOQjQU4na6bfWDP"],
    ["Share text with URL inside", "Check this out https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa?si=xyz!"],
    ["Whitespace, no https", "   open.spotify.com/album/4m2880jivSbbyEGAKfITCa   "],
    ["Apple Music album", "https://music.apple.com/us/album/random-access-memories/617154241"],
    ["Apple Music song (?i=)", "https://music.apple.com/us/album/get-lucky-feat-pharrell-williams-nile-rodgers/617154241?i=617154366"],
    ["Bandcamp album", "https://radiohead.bandcamp.com/album/in-rainbows"],
    ["YouTube watch + utm", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&utm_source=newsletter"],
    ["youtu.be short + si", "https://youtu.be/dQw4w9WgXcQ?si=Ab12Cd34"],
    ["Vimeo", "https://vimeo.com/76979871"],
    ["IMDb film", "https://www.imdb.com/title/tt6751668/?ref_=nv_sr_srsg_0"],
    ["IMDb series (mobile)", "https://m.imdb.com/title/tt0903747/"],
    ["www, no https", "www.imdb.com/title/tt6751668"],
    ["Letterboxd", "https://letterboxd.com/film/paris-texas/"],
    ["TMDB film", "https://www.themoviedb.org/movie/496243-parasite"],
    ["TMDB tv", "https://www.themoviedb.org/tv/1396-breaking-bad"],
    ["Goodreads", "https://www.goodreads.com/book/show/119073.The_Name_of_the_Rose"],
    ["Open Library edition", "https://openlibrary.org/books/OL1454188M"],
    ["bol.com book", "https://www.bol.com/nl/nl/p/de-ontdekking-van-de-hemel/666832277/"],
    ["Amazon book", "https://www.amazon.com/How-Blog-Book-Revised-Expanded/dp/1599638908"],
    ["amzn.to short link", "http://amzn.to/ZAcFu8"],
    ["Apple Podcasts", "https://podcasts.apple.com/us/podcast/the-daily/id1200361736"],
    ["Google Maps place", "https://www.google.com/maps/place/Rijksmuseum/@52.3599976,4.8852188,17z/"],
    ["Google Maps search ?q", "https://maps.google.com/?q=Cafe+de+Klos+Amsterdam"],
    ["News article (Guardian)", guardian],
    ["Substack essay", substack],
    ["Essay (Paul Graham)", "https://paulgraham.com/greatwork.html"],
    ["Shop product (Shopify)", "https://www.allbirds.com/products/mens-tree-runners"],
    ["Museum site", "https://www.rijksmuseum.nl/en"],
    ["Recipe", "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/"],
    ["Steam game", "https://store.steampowered.com/app/620/Portal_2/"],
    ["Wikipedia (entities)", "https://en.wikipedia.org/wiki/Am%C3%A9lie"],
    ["Blocked (TripAdvisor)", "https://www.tripadvisor.com/Restaurant_Review-g188590-d693482-Reviews-Cafe_de_Klos-Amsterdam_North_Holland_Province.html"],
    ["Timeout (slow server)", "https://httpbin.org/delay/15"],
    ["Plain text, not a link", "Honderd jaar eenzaamheid"],
  ];

  console.log(`| # | Input | Detected category (confidence, reason) | Title | By | Image | Link kept | Catalog match | Time |`);
  console.log(`|---|---|---|---|---|---|---|---|---|`);
  let i = 0;
  for (const [label, input] of inputs) {
    i++;
    const t = Date.now();
    const r = await readLink(input, SLUGS, { useLlm });
    let image = "none";
    if (r.image_url) {
      try {
        const ir = await fetch(r.image_url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0" } });
        image = ir.ok && (ir.headers.get("content-type") ?? "").startsWith("image/") ? "ok" : `broken ${ir.status}`;
      } catch {
        image = "broken (timeout)";
      }
    }
    let match = "";
    if (r.category_slug && (r.title || r.category_slug === "videos")) {
      const w = await resolveWork(r.category_slug, r.title ?? "", r.by, r.year, r.link);
      match = w ? `${w.source}: ${w.title}${w.year ? ` (${w.year})` : ""}` : "none";
    }
    const cat = r.status === "not_a_link" ? "not a link → offer search" : `${r.category_slug} (${r.confidence}, ${r.reason})`;
    const kept = r.link ? (r.link === input.trim() ? "yes, exact" : `yes: ${r.link}`) : "n/a";
    const esc = (s?: string) => (s ?? "").replace(/\|/g, "\\|").slice(0, 70);
    console.log(
      `| ${i} | ${label}: \`${esc(input.trim())}\` | ${cat}${r.status !== "ok" && r.status !== "not_a_link" ? ` [${r.status}]` : ""} | ${esc(r.title) || "(none)"}${r.title_from_url ? " (from URL)" : ""} | ${esc(r.by)} | ${image} | ${esc(kept)}${r.target ? ` → reads ${esc(r.target)}` : ""} | ${esc(match)} | ${Date.now() - t}ms |`
    );
  }
}

main().then(() => process.exit(0));
