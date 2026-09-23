// Round 3 stress test: 100 varied real inputs through readLink().
// Usage: npx tsx --env-file=.env.local scripts/stress-100.ts > out.md
// "expected" is what a person would pick; "ask" means asking is the right outcome,
// "?" means any answer is acceptable (the page itself is ambiguous).
import { readLink } from "../src/lib/read-link";

const SLUGS = ["films", "albums", "books", "essays", "things", "tv", "songs", "podcasts", "games", "places", "videos"];
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
  const nrc = await firstLink("https://www.nrc.nl/", /https:\/\/www\.nrc\.nl\/nieuws\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+/);
  const vk = await firstLink("https://www.volkskrant.nl/", /https:\/\/www\.volkskrant\.nl\/[a-z-]+\/[a-z0-9-]+~b[a-f0-9]+\//);
  const dc = await firstLink("https://decorrespondent.nl/", /https:\/\/decorrespondent\.nl\/\d+\/[a-z0-9-]+\/[a-z0-9-]+/);
  const zeit = await firstLink("https://www.zeit.de/index", /https:\/\/www\.zeit\.de\/(kultur|politik|gesellschaft)\/\d{4}-\d{2}\/[a-z0-9-]+/);
  const lemonde = await firstLink("https://www.lemonde.fr/", /https:\/\/www\.lemonde\.fr\/[a-z-]+\/article\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-_]+\.html/);
  const nhk = await firstLink("https://www3.nhk.or.jp/news/", /\/news\/html\/\d{8}\/k\d+\.html/);
  const slowboring = await firstLink("https://www.slowboring.com/archive", /https:\/\/www\.slowboring\.com\/p\/[a-z0-9-]+/);
  const newyorker = await firstLink("https://www.newyorker.com/magazine", /\/magazine\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+/);
  const aeon = await firstLink("https://aeon.co/essays", /\/essays\/[a-z0-9-]+/);

  const inputs: [string, string, string][] = [
    // shops and products
    ["IKEA product (NL)", "https://www.ikea.com/nl/nl/p/billy-boekenkast-wit-00263850/", "things"],
    ["Coolblue product", "https://www.coolblue.nl/product/942486/apple-airpods-pro-2e-generatie-usb-c.html", "things"],
    ["Apple Store buy page", "https://www.apple.com/shop/buy-iphone/iphone-16", "things"],
    ["Patagonia product", "https://www.patagonia.com/product/mens-better-sweater-fleece-jacket/25528.html", "things"],
    ["REI product", "https://www.rei.com/product/148601/hydro-flask-32-oz-wide-mouth-water-bottle", "things"],
    ["Zalando product", "https://www.zalando.nl/nike-sportswear-air-force-1-sneakers-laag-white-ni112o0k4-a11.html", "things"],
    ["Uniqlo product", "https://www.uniqlo.com/nl/nl/products/E455498-000", "things"],
    ["LEGO product", "https://www.lego.com/en-us/product/the-botanical-collection-10329", "things"],
    ["Fairphone product", "https://www.fairphone.com/en/fairphone-5/", "things"],
    ["bol.com product (not a book)", "https://www.bol.com/nl/nl/p/apple-airpods-4/9300000190488770/", "things"],
    ["Amazon.de product", "https://www.amazon.de/dp/B0CHX1W1XY", "things"],
    ["Etsy listing (probably gone)", "https://www.etsy.com/listing/1234567890/handmade-ceramic-mug", "things"],
    ["Muji product", "https://www.muji.com/eu/products/cmdty/detail/4550583123440", "things"],
    ["Hema product", "https://www.hema.nl/wonen-slapen/keuken/", "?"],
    ["Marktplaats category page", "https://www.marktplaats.nl/l/fietsen-en-brommers/", "?"],
    // Dutch sites
    ["NRC article", nrc, "essays"],
    ["Volkskrant article", vk, "essays"],
    ["De Correspondent article", dc, "essays"],
    ["funda search page", "https://www.funda.nl/zoeken/koop?selected_area=%5B%22amsterdam%22%5D", "?"],
    ["bol.com book", "https://www.bol.com/nl/nl/p/de-avonden/9200000011297542/", "books"],
    // museums and exhibitions
    ["Rijksmuseum visit", "https://www.rijksmuseum.nl/en/visit", "places"],
    ["Van Gogh Museum", "https://www.vangoghmuseum.nl/en", "places"],
    ["MoMA", "https://www.moma.org/", "places"],
    ["Louvre", "https://www.louvre.fr/en", "places"],
    ["Tate Modern visit", "https://www.tate.org.uk/visit/tate-modern", "places"],
    ["Stedelijk Museum", "https://www.stedelijk.nl/en", "places"],
    ["Mori Art Museum (JP)", "https://www.mori.art.museum/en/", "places"],
    ["Pergamonmuseum (DE)", "https://www.smb.museum/en/museums-institutions/pergamonmuseum/home/", "places"],
    // restaurants, hotels, bars
    ["Noma (DK)", "https://www.noma.dk/", "places"],
    ["Sukiyabashi Jiro (JP)", "https://www.sukiyabashi-jiro.co.jp/", "places"],
    ["Hotel Sacher (AT)", "https://www.sacher.com/en/", "places"],
    ["The Ritz London", "https://www.theritzlondon.com/", "places"],
    ["Attaboy bar (US)", "https://www.attaboy.us/", "places"],
    ["Restaurant De Kas (NL)", "https://www.restaurantdekas.com/", "places"],
    ["Café Central Wien", "https://www.cafecentral.wien/en/", "places"],
    ["Chateau Marmont", "https://www.chateaumarmont.com/", "places"],
    ["Dishoom Covent Garden", "https://www.dishoom.com/covent-garden/", "places"],
    ["Yelp Katz's Deli", "https://www.yelp.com/biz/katzs-delicatessen-new-york", "places"],
    // Japanese, German, French
    ["Amazon.co.jp book (ISBN)", "https://www.amazon.co.jp/dp/4101010013", "books"],
    ["Zeit article", zeit, "essays"],
    ["Le Monde article", lemonde, "essays"],
    ["NHK news article", nhk.startsWith("/") ? `https://www3.nhk.or.jp${nhk}` : nhk, "essays"],
    ["Fnac broken product", "https://www.fnac.com/a0000000/does-not-exist", "?"],
    ["Spiegel homepage", "https://www.spiegel.de/", "?"],
    // music and podcasts
    ["Bandcamp album", "https://sufjanstevens.bandcamp.com/album/carrie-lowell", "albums"],
    ["SoundCloud track", "https://soundcloud.com/flume/never-be-like-you-feat-kai", "songs"],
    ["SoundCloud profile", "https://soundcloud.com/octobersveryown", "ask"],
    ["Apple Podcasts (NL)", "https://podcasts.apple.com/nl/podcast/de-dag/id1250436463", "podcasts"],
    ["Apple Podcasts Radiolab", "https://podcasts.apple.com/us/podcast/radiolab/id152249110", "podcasts"],
    ["Discogs master", "https://www.discogs.com/master/7218-Radiohead-OK-Computer", "albums"],
    ["Discogs release", "https://www.discogs.com/release/1085364", "albums"],
    ["Apple Music album (NL)", "https://music.apple.com/nl/album/blonde/1146195596", "albums"],
    ["Spotify playlist", "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", "ask"],
    ["Spotify artist", "https://open.spotify.com/artist/4tZwfgrHOc3mvqYlEYSvVi", "ask"],
    // games
    ["Steam Hades", "https://store.steampowered.com/app/1145360/Hades/", "games"],
    ["Steam Hollow Knight", "https://store.steampowered.com/app/367520/Hollow_Knight/", "games"],
    ["itch.io Celeste Classic", "https://maddymakesgames.itch.io/celeste-classic", "games"],
    ["Nintendo store Zelda", "https://www.nintendo.com/us/store/products/the-legend-of-zelda-tears-of-the-kingdom-switch/", "games"],
    ["PlayStation Astro Bot", "https://www.playstation.com/en-us/games/astro-bot/", "games"],
    // streaming
    ["Netflix Stranger Things", "https://www.netflix.com/title/80057281", "tv"],
    ["Netflix Roma (film)", "https://www.netflix.com/title/80240715", "films"],
    ["HBO The Last of Us", "https://www.hbo.com/the-last-of-us", "tv"],
    ["HBO Succession", "https://www.hbo.com/succession", "tv"],
    ["Apple TV Severance", "https://tv.apple.com/us/show/severance/umc.cmc.1srk2goyh2q2zdxcx605w8vtx", "tv"],
    ["Disney+ page", "https://www.disneyplus.com/en-gb/browse/entity-9ba7a8d0-0a16-4a15-a2b7-8a2c8f2cb0e4", "?"],
    // Wikipedia
    ["Wikipedia film", "https://en.wikipedia.org/wiki/Spirited_Away", "films"],
    ["Wikipedia book", "https://en.wikipedia.org/wiki/One_Hundred_Years_of_Solitude", "books"],
    ["Wikipedia album", "https://en.wikipedia.org/wiki/OK_Computer", "albums"],
    ["Wikipedia place", "https://en.wikipedia.org/wiki/Eiffel_Tower", "places"],
    ["Wikipedia NL book", "https://nl.wikipedia.org/wiki/De_ontdekking_van_de_hemel", "books"],
    ["Wikipedia DE book", "https://de.wikipedia.org/wiki/Der_Steppenwolf", "books"],
    ["Wikipedia JA film", "https://ja.wikipedia.org/wiki/千と千尋の神隠し", "films"],
    // Letterboxd and lists
    ["Letterboxd list", "https://letterboxd.com/dave/list/official-top-250-narrative-feature-films/", "?"],
    ["Letterboxd film", "https://letterboxd.com/film/spirited-away/", "films"],
    ["IMDb list", "https://www.imdb.com/list/ls055592025/", "?"],
    // essays
    ["Sam Altman blog", "https://blog.samaltman.com/the-days-are-long-but-the-decades-are-short", "essays"],
    ["Substack essay (Slow Boring)", slowboring, "essays"],
    ["New Yorker article", newyorker.startsWith("/") ? `https://www.newyorker.com${newyorker}` : newyorker, "essays"],
    ["Aeon essay", aeon.startsWith("/") ? `https://aeon.co${aeon}` : aeon, "essays"],
    ["Medium article", "https://medium.com/@karpathy/software-2-0-a64152b37c35", "essays"],
    // PDFs and images
    ["PDF dummy", "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", "?"],
    ["arXiv PDF", "https://arxiv.org/pdf/1706.03762", "essays"],
    ["Image JPG (Wikimedia)", "https://upload.wikimedia.org/wikipedia/commons/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg", "?"],
    ["Image (Unsplash CDN)", "https://images.unsplash.com/photo-1506744038136-46273834b3fb", "?"],
    // social
    ["Instagram post (made up id)", "https://www.instagram.com/p/C0abc123XYZ/", "?"],
    ["Instagram profile", "https://www.instagram.com/natgeo/", "ask"],
    ["TikTok video", "https://www.tiktok.com/@khaby.lame/video/7137423965982592262", "videos"],
    ["X post", "https://x.com/elonmusk/status/1519480761749016577", "?"],
    ["Twitter post (first tweet)", "https://twitter.com/jack/status/20", "?"],
    // Google search URLs
    ["Google search URL (film)", "https://www.google.com/search?q=spirited+away&oq=spirited&sourceid=chrome", "search"],
    ["Google search URL (place)", "https://www.google.nl/search?q=rijksmuseum+amsterdam", "search"],
    // plain text, emoji, long share text
    ["Plain title", "Spirited Away", "search"],
    ["Title with emoji", "🎬 Parasite 🍿", "search"],
    ["Only emoji", "🔥🔥🔥", "search"],
    [
      "Very long share text",
      "Heyyy!! 😍 you HAVE to listen to this, it's been on repeat all week, honestly the best album of the year, no skips, trust me 🙏🙏 https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa?si=Zx9 let me know what you think!!! also dinner friday?",
      "albums",
    ],
    ["Apple Music share text", "Listen to Blonde by Frank Ocean on Apple Music. https://music.apple.com/nl/album/blonde/1146195596", "albums"],
    // broken
    ["404 page", "https://www.example.com/this-page-does-not-exist-404", "?"],
    ["Domain does not exist", "https://thisdomaindoesnotexist-hoshigo-12345.com/", "?"],
    ["500 error", "https://httpstat.us/500", "?"],
    ["Typo in scheme", "htps://www.imdb.com/title/tt0245429/", "films"],
    ["No scheme IMDb", "imdb.com/title/tt0245429", "films"],
  ];

  console.log(`| # | Input | Expected | Got (confidence, reason) | Title | Image | Link | OK? | Time |`);
  console.log(`|---|---|---|---|---|---|---|---|---|`);
  let i = 0;
  for (const [label, input, expected] of inputs) {
    i++;
    const t = Date.now();
    let r;
    try {
      r = await readLink(input, SLUGS);
    } catch (e) {
      console.log(`| ${i} | ${label} | ${expected} | CRASH ${(e as Error).message} | | | | FAIL | |`);
      continue;
    }
    const got = r.status === "not_a_link" ? "search" : r.confidence === "low" ? "ask" : r.category_slug ?? "";
    const ok =
      expected === "?" ||
      got === expected ||
      (expected === "ask" && r.confidence !== "high") ||
      (got === "ask" && r.alternatives?.includes(expected))
        ? "ok"
        : "FAIL";
    const esc = (s?: string) => (s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 60);
    const detail = r.status === "not_a_link" ? `not a link → search "${esc(r.query)}"` : `${r.category_slug} (${r.confidence}, ${esc(r.reason)})${r.status !== "ok" ? ` [${r.status}]` : ""}`;
    console.log(
      `| ${i} | ${label}: \`${esc(input.trim())}\` | ${expected} | ${detail} | ${esc(r.title) || "(none)"}${r.title_from_url ? " (from URL)" : ""} | ${r.image_url ? "yes" : "no"} | ${r.link ? (r.link === input.trim() ? "exact" : "cleaned") : "n/a"} | ${ok} | ${Date.now() - t}ms |`
    );
  }
}

main().then(() => process.exit(0));
