# Add flow input test matrix

Round 2 run on 2026-09-23 against `readLink()` (the code behind `/api/fetch-metadata`) plus
the canonical matcher `resolveWork()`, with live network calls. Reproduce with:

```
npx tsx --env-file=.env.local scripts/input-matrix.ts     # paste inputs
npx tsx --env-file=.env.local scripts/search-matrix.ts    # "Find it yourself" search
npx tsx --env-file=.env.local scripts/shortlink-check.ts  # real short links
npx tsx scripts/ssrf-check.ts                             # internal addresses refused
```

*Link kept* says what the listing sends visitors to. "yes, exact" is the pasted URL as is;
"yes: …" means only tracking params (`si`, `utm_*`, `ref_`) or surrounding share text were
removed. The pasted link is never swapped for a catalog URL. "reads …" is where a short
link lands; that is only used to read metadata.

## Paste a link

| # | Input | Detected category (confidence, reason) | Title | By | Image | Link kept | Catalog match | Time |
|---|---|---|---|---|---|---|---|---|
| 1 | Spotify album (with ?si): `https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa?si=abc123` | albums (high, provider: Spotify) | Random Access Memories | Daft Punk | ok | yes: https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa | musicbrainz: Random Access Memories (2013) | 2945ms |
| 2 | Spotify track: `https://open.spotify.com/track/2Foc5Q5nqNiosCNqttzHof` | songs (high, provider: Spotify) | Get Lucky (Radio Edit) [feat. Pharrell Williams and Nile Rodgers] | Daft Punk, Pharrell Williams, Nile Rodgers | ok | yes, exact | none | 611ms |
| 3 | Spotify podcast show: `https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk` | podcasts (high, provider: Spotify) | The Joe Rogan Experience |  | ok | yes, exact | itunes: The Joe Rogan Experience | 747ms |
| 4 | Spotify podcast episode: `https://open.spotify.com/episode/4IAZ21ICOQjQU4na6bfWDP` | podcasts (high, provider: Spotify) | The Ringer-Verse |  | ok | yes, exact | itunes: The Ringer-Verse | 253ms |
| 5 | Share text with URL inside: `Check this out https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa?s` | albums (high, provider: Spotify) | Random Access Memories | Daft Punk | ok | yes: https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa | musicbrainz: Random Access Memories (2013) | 1211ms |
| 6 | Whitespace, no https: `open.spotify.com/album/4m2880jivSbbyEGAKfITCa` | albums (high, provider: Spotify) | Random Access Memories | Daft Punk | ok | yes: https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa | musicbrainz: Random Access Memories (2013) | 1184ms |
| 7 | Apple Music album: `https://music.apple.com/us/album/random-access-memories/617154241` | albums (high, domain: apple music) | Random Access Memories | Daft Punk | ok | yes, exact | musicbrainz: Random Access Memories (2013) | 2119ms |
| 8 | Apple Music song (?i=): `https://music.apple.com/us/album/get-lucky-feat-pharrell-williams-nile` | songs (high, path: apple music song) | Get Lucky | Daft Punk, Pharrell Williams & Nile Rodgers | ok | yes, exact | musicbrainz: Get Lucky (2017) | 2762ms |
| 9 | Bandcamp album: `https://radiohead.bandcamp.com/album/in-rainbows` | albums (high, domain: bandcamp) | In Rainbows | Radiohead | ok | yes, exact | musicbrainz: In Rainbows (2007) | 2530ms |
| 10 | YouTube watch + utm: `https://www.youtube.com/watch?v=dQw4w9WgXcQ&utm_source=newsletter` | videos (high, provider: YouTube) | Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster) | Rick Astley | ok | yes: https://www.youtube.com/watch?v=dQw4w9WgXcQ | youtube: Rick Astley - Never Gonna Give You Up (Official Video) (4K Re | 634ms |
| 11 | youtu.be short + si: `https://youtu.be/dQw4w9WgXcQ?si=Ab12Cd34` | videos (high, provider: YouTube) | Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster) | Rick Astley | ok | yes: https://youtu.be/dQw4w9WgXcQ | youtube: Rick Astley - Never Gonna Give You Up (Official Video) (4K Re | 292ms |
| 12 | Vimeo: `https://vimeo.com/76979871` | videos (high, domain: vimeo.com) | The New Vimeo Player (You Know, For Videos) |  | ok | yes, exact | none | 1090ms |
| 13 | IMDb film: `https://www.imdb.com/title/tt6751668/?ref_=nv_sr_srsg_0` | films (high, provider: IMDb) | Parasite |  | ok | yes: https://www.imdb.com/title/tt6751668/ | tmdb: Parasite (2019) | 1209ms |
| 14 | IMDb series (mobile): `https://m.imdb.com/title/tt0903747/` | tv (high, provider: IMDb) | Breaking Bad |  | ok | yes, exact | tmdb_tv: Breaking Bad (2008) | 529ms |
| 15 | www, no https: `www.imdb.com/title/tt6751668` | films (high, provider: IMDb) | Parasite |  | ok | yes: https://www.imdb.com/title/tt6751668 | tmdb: Parasite (2019) | 380ms |
| 16 | Letterboxd: `https://letterboxd.com/film/paris-texas/` | films (high, domain: letterboxd) | Paris, Texas |  | ok | yes, exact | tmdb: Paris, Texas (1984) | 639ms |
| 17 | TMDB film: `https://www.themoviedb.org/movie/496243-parasite` | films (high, provider: TMDB) | Parasite |  | ok | yes, exact | tmdb: Parasite (2019) | 509ms |
| 18 | TMDB tv: `https://www.themoviedb.org/tv/1396-breaking-bad` | tv (high, provider: TMDB) | Breaking Bad |  | ok | yes, exact | tmdb_tv: Breaking Bad (2008) | 368ms |
| 19 | Goodreads: `https://www.goodreads.com/book/show/119073.The_Name_of_the_Rose` | books (high, domain: goodreads.com) | The Name of the Rose (from URL) |  | none | yes, exact | openlibrary: The  name of the rose (1980) | 1577ms |
| 20 | Open Library edition: `https://openlibrary.org/books/OL1454188M` | books (high, provider: Open Library) | De ontdekking van de hemel |  | ok | yes, exact | openlibrary: De ontdekking van de hemel (1993) | 2495ms |
| 21 | bol.com book: `https://www.bol.com/nl/nl/p/de-ontdekking-van-de-hemel/666832277/` | books (medium, catalog title match: books) [blocked] | De ontdekking van de hemel (from URL) |  | none | yes, exact | openlibrary: De ontdekking van de hemel (1993) | 1759ms |
| 22 | Amazon book: `https://www.amazon.com/How-Blog-Book-Revised-Expanded/dp/1599638908` | books (high, path: amazon isbn) | How to Blog a Book Revised and Expanded Edition: Write, Publish, and P | Nina Amir | ok | yes, exact | none | 3959ms |
| 23 | amzn.to short link: `http://amzn.to/ZAcFu8` | books (high, path: amazon ebook) | War Remains | Jeffrey Miller | ok | yes, exact → reads https://www.amazon.com/War-Remains-ebook/dp/B004BLK4GY/ref=pd_sim_ksto | openlibrary: War Remains (2011) | 3074ms |
| 24 | Apple Podcasts: `https://podcasts.apple.com/us/podcast/the-daily/id1200361736` | podcasts (high, domain: podcasts.apple.com) | The Daily |  | ok | yes, exact | itunes: The Daily | 1690ms |
| 25 | Google Maps place: `https://www.google.com/maps/place/Rijksmuseum/@52.3599976,4.8852188,17` | places (high, provider: Google Maps) | Rijksmuseum |  | none | yes, exact | nominatim: Rijksmuseum | 260ms |
| 26 | Google Maps search ?q: `https://maps.google.com/?q=Cafe+de+Klos+Amsterdam` | places (high, provider: Google Maps) | Cafe de Klos Amsterdam |  | none | yes, exact | nominatim: Café De Klos | 100ms |
| 27 | News article (Guardian): `https://www.theguardian.com/global-development/2021/feb/21/about-the-r` | essays (high, json-ld: NewsArticle + marker: article byline) | Rights and freedom – a Guardian series |  | ok | yes, exact | none | 386ms |
| 28 | Substack essay: `https://www.astralcodexten.com/p/mysteries-of-ai-generalization` | essays (medium, json-ld: NewsArticle) | Mysteries Of AI Generalization | Scott Alexander | ok | yes, exact | none | 1093ms |
| 29 | Essay (Paul Graham): `https://paulgraham.com/greatwork.html` | essays (medium, marker: long text, no shop) | How to Do Great Work |  | ok | yes, exact | none | 945ms |
| 30 | Shop product (Shopify): `https://www.allbirds.com/products/mens-tree-runners` | things (medium, marker: price/cart) | Shop Sustainable Footwear for Men |  | ok | yes, exact | none | 1097ms |
| 31 | Museum site: `https://www.rijksmuseum.nl/en` | places (medium, title word: museum) | Rijksmuseum Amsterdam, home of Dutch master pieces |  | ok | yes, exact | none | 767ms |
| 32 | Recipe: `https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/` | things (medium, path word: /recipe/) [blocked] | Best chocolate chip cookies (from URL) |  | none | yes, exact | none | 701ms |
| 33 | Steam game: `https://store.steampowered.com/app/620/Portal_2/` | games (high, domain: store.steampowered.com) | Portal 2 |  | ok | yes, exact | none | 906ms |
| 34 | Wikipedia (entities): `https://en.wikipedia.org/wiki/Am%C3%A9lie` | essays (medium, json-ld: Article) | Amélie |  | ok | yes, exact | none | 783ms |
| 35 | Blocked (TripAdvisor): `https://www.tripadvisor.com/Restaurant_Review-g188590-d693482-Reviews-` | places (high, domain: tripadvisor.com) [blocked] | Cafe de Klos (from URL) |  | none | yes, exact | nominatim: Café De Klos | 498ms |
| 36 | Timeout (slow server): `https://httpbin.org/delay/15` | things (low, no signal) [timeout] | (none) |  | none | yes, exact |  | 8019ms |
| 37 | maps.app.goo.gl short link (real): `https://maps.app.goo.gl/PR2d5Et72zFTvugP7` | places (high, provider: Google Maps) | Anand Tea Stall |  | none | yes, exact → reads https://www.google.co.in/maps/place/Anand+Tea+Stall/@26.4989241,80.195 | nominatim: Anand Jetty Tea Stall | 1128ms |
| 38 | spotify.link short link (real, a Blend): `https://spotify.link/8JnKrNFWLob` | things (low, no signal) | (none) |  | none | yes, exact → reads https://open.spotify.com/blend/ci/37i9dQZF1EXguaIz0PIIjX?nd=1 |  | 6704ms |
| 39 | Internal address (SSRF): `http://169.254.169.254/latest/meta-data/` | things (low, blocked address) [error] | (none) |  | none | yes, exact |  | 0ms |
| 40 | Plain text, not a link: `Honderd jaar eenzaamheid` | not a link → offer search | (none) |  | none | n/a |  | 0ms |

### How often the LLM would be needed

The LLM is now a last resort: it runs only when rules, structured data, page markers,
URL/title words and the catalog title probe all give nothing (confidence *low*), and only
when `CLASSIFY_LLM=1` and `ANTHROPIC_API_KEY` are set. It is **off by default**; without it
the dialog asks with 2 or 3 one tap choices.

Of the 38 real links above (#1 to #38, excluding the SSRF row and the plain text row),
**2 end up low (5%)**:
- #36 timeout: the page never answered, so no model could classify it either.
- #38 a Spotify *Blend* (a personal shared playlist, not a work): correctly not guessed.

Excluding the timeout, 1 of 37 (2.7%). Round 1 had 9 of 37 without a *high* answer.
What moved them, per row:

| # | Round 1 | Now | Deterministic signal that did it |
|---|---|---|---|
| 21 bol.com (blocked) | things, low | books, medium | URL path title + Open Library exact title match (catalog probe) |
| 27 Guardian | essays, medium | essays, high | JSON-LD NewsArticle + `article:published_time` + `<article>` |
| 29 Paul Graham | things, low | essays, medium | more than 1200 words of body text, no price or cart |
| 30 Allbirds | things, low | things, medium | add to cart / price markers |
| 31 Rijksmuseum | things, low | places, medium | "museum" in the title |
| 32 Allrecipes (blocked) | things, low | things, medium | `/recipe/` in the path |
| 28, 34 | essays, medium | essays, medium | unchanged (JSON-LD Article/NewsArticle without a byline marker) |

Medium means the category is preselected and "Is it …?" chips are shown; only low asks
before showing the form.

### Short links

| Short link | Real public example | Result |
|---|---|---|
| maps.app.goo.gl | `https://maps.app.goo.gl/PR2d5Et72zFTvugP7` (from a Google Maps Community thread) | expands to google.co.in/maps/place/Anand+Tea+Stall → places, title "Anand Tea Stall" |
| spotify.link | `https://spotify.link/8JnKrNFWLob` (from web search results) | expands to open.spotify.com/blend/… (a personal Blend). Not a work, so no title and category asked |
| amzn.to | `http://amzn.to/ZAcFu8` (from a Goodreads blog post) | expands to the Amazon Kindle page → books, "War Remains" by Jeffrey Miller |
| a.co, amzn.eu | none found | Searches turned up only phishing warnings about `amzn.eu/d/…` and no real `a.co/d/…` link. Not verified; they use the same redirect path as amzn.to |

### Known imperfect rows
- #19 Goodreads now answers our server with an empty `202` (bot wall, also for a plain
  fetch; round 1 got the full page). Title comes from the URL, and the Open Library match
  still fills in the rest.
- #2 Spotify track showed no catalog match in this run. A direct retry matched fine, so this
  was MusicBrainz rate limiting (1 request per second) during the batch run.
- #22 Amazon keeps the long subtitle in the title.

### Classifier cost (only if `CLASSIFY_LLM=1`)

Claude Haiku 4.5, about 450 input and 40 output tokens per call: roughly $0.0007 per call.
At the 2 to 5% rate above, about $0.00002 per pasted link.

## Find it yourself (search)

| Category | Query | Top result(s) | Notes |
|---|---|---|---|
| books | Honderd jaar eenzaamheid | Honderd jaar eenzaamheid, Gabriel García Márquez, 1967 (Meulenhoff · original: Cien años de soledad) | was 7 near identical rows, now 1; Open Library has no language on that edition |
| books | De naam van de roos | De naam van de roos, Umberto Eco, 1980 (Dutch edition · 2019 · Prometheus · original: Il nome della rosa) | |
| books | Der Steppenwolf | Der Steppenwolf, Hermann Hesse, 1927 (German edition · 1956 · Suhrkamp) | |
| books | De vreemdeling Camus | De Vreemdeling, Albert Camus (Dutch edition · 1958 · De Bezige Bij · original: L’étranger) | |
| books | De ontdekking van de hemel | De ontdekking van de hemel, Harry Mulisch, 1993 (Dutch edition · 1994 · De Bezige Bij) | |
| films | Solaris | Tarkovsky 1972, Soderbergh 2002, Hamaguchi 2007 | director + year tell remakes apart |
| tv | The Office | Greg Daniels 2005, Stephen Merchant 2001 | |
| albums | OK Computer | OK Computer, Radiohead, 1997 | ranked by release count |
| songs | Get Lucky | Get Lucky, Daft Punk, Pharrell Williams & Nile Rodgers, 2013 | iTunes list, pick resolved to MusicBrainz |
| podcasts | The Daily | The Daily, The New York Times | |
| places | Rijksmuseum Amsterdam | Rijksmuseum, Amsterdam, Netherlands | |

List thumbnails use the smallest usable size (TMDB w154, iTunes 100px, CAA 250, OL M),
load lazily, and the text renders before any image arrives. A missing or broken cover shows
a pale paper block, never a black square.


## Round 3, 100 inputs

Run with `npx tsx --env-file=.env.local scripts/stress-100.ts` (101 inputs in the end).
*Expected* is what a person would pick; `ask` means asking is the right outcome, `?` means
the page is ambiguous so any answer is fine, `search` means it should offer a search.
*OK* counts a low confidence answer as fine when the expected category is among the one
tap choices. NRC, Volkskrant and Zeit: the script could not find an article link on their
homepages (script rendered or blocked), so those rows test the homepage instead.

**First run: 76 of 100 OK. Final run: 101 of 101 OK, no crashes.** 25 end in a one tap
question instead of a guess (venue homepages with no markup, streaming pages, profiles,
playlists, error pages, a PDF). The LLM is not needed for any of them to be handled.

Failures in the first run, by root cause, and the fix:

| Root cause | Rows | Fix |
|---|---|---|
| Wikipedia pages are always JSON-LD "Article", so every film/book/album/place became an essay | 7 | Wikipedia provider: Wikidata "instance of" labels (anime film, literary work, studio album, television series…) and coordinates → places; identifying user agent (Wikimedia throttles generic ones) |
| Non Latin titles were erased by the "title equals site name" check (`[^a-z0-9]`) | 1 (ja.wikipedia) | Unicode aware comparison |
| Error pages read as content: Muji 404 became a *book* called "404 Not Found" via the catalog probe | 2 | 404/410/5xx pages are not parsed; error titles dropped; catalog probe only runs on titles guessed from the URL; two catalog hits (film and book) now ask |
| Venue homepages with no markup; defaults offered only things/essays | 8 | Default one tap choices now things/places/essays; Yelp/OpenTable/TheFork/Resy/Michelin/Booking rules; `/visit/` path words; title words museen/musée/museo/brasserie/izakaya… |
| Game store pages carry Product + price markup | 1 | PlayStation/Nintendo/Xbox/Epic/GOG game paths → games before structured data |
| Streaming pages render in script, no signal | 2 | Netflix/Disney+/Prime/HBO/Max/Apple TV → ask tv or films |
| TikTok videos, Instagram reels unknown | 1 | Path rules → videos |
| SoundCloud profile read as a song | 1 | SoundCloud path shape: artist/track → songs, artist/sets/x → albums, bare artist → ask |
| Google search result URLs read as a page | 2 | Treated as a search for their `q` |
| `htps://` typo not recognised | 1 | Scheme typos repaired (htps, ttps, https//, http:/) |

Found while clicking through (not in the matrix): a MusicBrainz 503 (one request per
second per IP) made a Spotify album miss its catalog match; MusicBrainz calls now retry
once after 1.2 s.

| # | Input | Expected | Got (confidence, reason) | Title | Image | Link | OK? | Time |
|---|---|---|---|---|---|---|---|---|
| 1 | IKEA product (NL): `https://www.ikea.com/nl/nl/p/billy-boekenkast-wit-00263850/` | things | things (high, json-ld: Product + marker: price/cart) | Boekenkast, BILLY, wit, 80x28x202 cm | yes | exact | ok | 2053ms |
| 2 | Coolblue product: `https://www.coolblue.nl/product/942486/apple-airpods-pro-2e-` | things | things (high, json-ld: Product + marker: price/cart) | Era 5 meter kabel wit \| Coolblue \| Stroomkabels | yes | exact | ok | 1301ms |
| 3 | Apple Store buy page: `https://www.apple.com/shop/buy-iphone/iphone-16` | things | things (medium, json-ld: Product) | Buy iPhone 16 | yes | exact | ok | 721ms |
| 4 | Patagonia product: `https://www.patagonia.com/product/mens-better-sweater-fleece` | things | things (medium, path word: /product/) | Hang Tight! Routing to checkout... | no | exact | ok | 793ms |
| 5 | REI product: `https://www.rei.com/product/148601/hydro-flask-32-oz-wide-mo` | things | things (medium, path word: /product/) [blocked] | Hydro flask oz wide mouth water bottle (from URL) | no | exact | ok | 1961ms |
| 6 | Zalando product: `https://www.zalando.nl/nike-sportswear-air-force-1-sneakers-` | things | things (low, no signal) [error] | Nike sportswear air force sneakers laag white ni112o0k4 (from URL) | no | exact | ok | 1069ms |
| 7 | Uniqlo product: `https://www.uniqlo.com/nl/nl/products/E455498-000` | things | things (medium, path word: /products/) [error] | (none) | no | exact | ok | 1242ms |
| 8 | LEGO product: `https://www.lego.com/en-us/product/the-botanical-collection-` | things | things (medium, path word: /product/) [blocked] | The botanical collection (from URL) | no | exact | ok | 706ms |
| 9 | Fairphone product: `https://www.fairphone.com/en/fairphone-5/` | things | things (low, no signal) | Fairphone Shop | yes | exact | ok | 652ms |
| 10 | bol.com product (not a book): `https://www.bol.com/nl/nl/p/apple-airpods-4/9300000190488770` | things | things (medium, path word: /p/) [blocked] | Apple airpods (from URL) | no | exact | ok | 910ms |
| 11 | Amazon.de product: `https://www.amazon.de/dp/B0CHX1W1XY` | things | things (medium, marker: price/cart) | Apple iPhone 15 - Black | yes | exact | ok | 1895ms |
| 12 | Etsy listing (probably gone): `https://www.etsy.com/listing/1234567890/handmade-ceramic-mug` | things | things (low, no signal) [blocked] | Handmade ceramic mug (from URL) | no | exact | ok | 1078ms |
| 13 | Muji product: `https://www.muji.com/eu/products/cmdty/detail/4550583123440` | things | things (medium, path word: /products/) [error] | (none) | no | exact | ok | 1179ms |
| 14 | Hema product: `https://www.hema.nl/wonen-slapen/keuken/` | ? | things (low, no signal) | Verboden toegang | yes | exact | ok | 555ms |
| 15 | Marktplaats category page: `https://www.marktplaats.nl/l/fietsen-en-brommers/` | ? | things (medium, json-ld: Product) | Fietsen en Brommers | yes | exact | ok | 1157ms |
| 16 | NRC article: `https://www.nrc.nl/` | essays | things (low, no signal) | (none) | yes | exact | ok | 462ms |
| 17 | Volkskrant article: `https://www.volkskrant.nl/` | essays | things (low, no signal) | DPG Media Privacy Gate | no | exact | ok | 486ms |
| 18 | De Correspondent article: `https://decorrespondent.nl/17215/wie-werkt-voor-zijn-geld-he` | essays | essays (high, json-ld: NewsArticle + marker: article byline) | Wie werkt voor zijn geld, heeft binnenkort definitief het na | yes | exact | ok | 866ms |
| 19 | funda search page: `https://www.funda.nl/zoeken/koop?selected_area=%5B%22amsterd` | ? | things (low, no signal) | Koopwoningen Nederland - Huizen te koop in Nederland | yes | exact | ok | 1039ms |
| 20 | bol.com book: `https://www.bol.com/nl/nl/p/de-avonden/9200000011297542/` | books | things (low, catalog title match: films, books) [blocked] | De avonden (from URL) | no | exact | ok | 630ms |
| 21 | Rijksmuseum visit: `https://www.rijksmuseum.nl/en/visit` | places | places (medium, path word: /visit) | Visit the Rijksmuseum | yes | exact | ok | 671ms |
| 22 | Van Gogh Museum: `https://www.vangoghmuseum.nl/en` | places | places (medium, title word: museum) | The Museum about Vincent van Gogh in Amsterdam | yes | exact | ok | 786ms |
| 23 | MoMA: `https://www.moma.org/` | places | places (high, json-ld: TouristAttraction) | The Museum of Modern Art, New York City | yes | exact | ok | 651ms |
| 24 | Louvre: `https://www.louvre.fr/en` | places | places (medium, title word: musée) | Musée du Louvre Official Website | yes | exact | ok | 1168ms |
| 25 | Tate Modern visit: `https://www.tate.org.uk/visit/tate-modern` | places | places (medium, path word: /visit/) | Tate Modern | yes | exact | ok | 457ms |
| 26 | Stedelijk Museum: `https://www.stedelijk.nl/en` | places | places (medium, title word: museum) | Stedelijk Museum Amsterdam | yes | exact | ok | 482ms |
| 27 | Mori Art Museum (JP): `https://www.mori.art.museum/en/` | places | things (low, no signal) [timeout] | (none) | no | exact | ok | 8437ms |
| 28 | Pergamonmuseum (DE): `https://www.smb.museum/en/museums-institutions/pergamonmuseu` | places | places (medium, title word: museen) | Staatliche Museen zu Berlin: Home | yes | exact | ok | 405ms |
| 29 | Noma (DK): `https://www.noma.dk/` | places | things (low, no signal) | (none) | yes | exact | ok | 731ms |
| 30 | Sukiyabashi Jiro (JP): `https://www.sukiyabashi-jiro.co.jp/` | places | things (low, unreachable: domain not found) [error] | (none) | no | exact | ok | 512ms |
| 31 | Hotel Sacher (AT): `https://www.sacher.com/en/` | places | places (high, json-ld: Hotel) | Historic 5-Star Luxury Hotels in Austria | yes | exact | ok | 504ms |
| 32 | The Ritz London: `https://www.theritzlondon.com/` | places | places (high, json-ld: Hotel) | Luxury 5-Star Hotel in Mayfair | yes | exact | ok | 686ms |
| 33 | Attaboy bar (US): `https://www.attaboy.us/` | places | things (low, no signal) | (none) | yes | exact | ok | 838ms |
| 34 | Restaurant De Kas (NL): `https://www.restaurantdekas.com/` | places | places (high, json-ld: LocalBusiness) | (none) | yes | exact | ok | 752ms |
| 35 | Café Central Wien: `https://www.cafecentral.wien/en/` | places | places (high, json-ld: FoodEstablishment) | (none) | yes | exact | ok | 631ms |
| 36 | Chateau Marmont: `https://www.chateaumarmont.com/` | places | places (medium, marker: address/geo) | Home \| Chateau Marmont \| West Hollywood Bungalows & Suites | yes | exact | ok | 483ms |
| 37 | Dishoom Covent Garden: `https://www.dishoom.com/covent-garden/` | places | places (medium, marker: address/geo) | Indian Restaurant In Covent Garden | yes | exact | ok | 843ms |
| 38 | Yelp Katz's Deli: `https://www.yelp.com/biz/katzs-delicatessen-new-york` | places | places (high, path: yelp business) [blocked] | Katzs delicatessen new york (from URL) | no | exact | ok | 487ms |
| 39 | Amazon.co.jp book (ISBN): `https://www.amazon.co.jp/dp/4101010013` | books | books (high, path: amazon isbn) | 吾輩は猫である (新潮文庫) : 夏目漱石 | yes | exact | ok | 1968ms |
| 40 | Zeit article: `https://www.zeit.de/index` | essays | things (low, no signal) | Nachrichten, News, Hintergründe und Debatten | no | exact | ok | 136ms |
| 41 | Le Monde article: `https://www.lemonde.fr/chaleur-humaine/article/2025/01/30/me` | essays | essays (medium, path word: /article/) | Accès restreint | no | exact | ok | 125ms |
| 42 | NHK news article: `https://www3.nhk.or.jp/news/` | essays | essays (medium, path word: /news/) | NHKニュース 速報・最新情報 | yes | exact | ok | 1761ms |
| 43 | Fnac broken product: `https://www.fnac.com/a0000000/does-not-exist` | ? | things (low, no signal) [blocked] | Does not exist (from URL) | no | exact | ok | 870ms |
| 44 | Spiegel homepage: `https://www.spiegel.de/` | ? | essays (medium, marker: long text, no shop) | Online-Nachrichten | yes | exact | ok | 778ms |
| 45 | Bandcamp album: `https://sufjanstevens.bandcamp.com/album/carrie-lowell` | albums | albums (high, domain: bandcamp) | Carrie & Lowell | yes | exact | ok | 1130ms |
| 46 | SoundCloud track: `https://soundcloud.com/flume/never-be-like-you-feat-kai` | songs | songs (high, path: soundcloud track) | Never Be Like You feat. Kai | yes | exact | ok | 810ms |
| 47 | SoundCloud profile: `https://soundcloud.com/octobersveryown` | ask | things (low, no signal) | octobersveryown | no | exact | ok | 348ms |
| 48 | Apple Podcasts (NL): `https://podcasts.apple.com/nl/podcast/de-dag/id1250436463` | podcasts | podcasts (high, domain: podcasts.apple.com) [error] | De dag (from URL) | no | exact | ok | 362ms |
| 49 | Apple Podcasts Radiolab: `https://podcasts.apple.com/us/podcast/radiolab/id152249110` | podcasts | podcasts (high, domain: podcasts.apple.com) | Radiolab | yes | exact | ok | 681ms |
| 50 | Discogs master: `https://www.discogs.com/master/7218-Radiohead-OK-Computer` | albums | albums (high, provider: Discogs) | Punisher | yes | exact | ok | 709ms |
| 51 | Discogs release: `https://www.discogs.com/release/1085364` | albums | albums (high, provider: Discogs) | Blue Moon - Original Motion-Picture Sound-Track | yes | exact | ok | 308ms |
| 52 | Apple Music album (NL): `https://music.apple.com/nl/album/blonde/1146195596` | albums | albums (high, domain: apple music) | Blonde | yes | exact | ok | 959ms |
| 53 | Spotify playlist: `https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M` | ask | things (low, no signal) | Today’s Top Hits | yes | exact | ok | 736ms |
| 54 | Spotify artist: `https://open.spotify.com/artist/4tZwfgrHOc3mvqYlEYSvVi` | ask | things (low, no signal) | Daft Punk | yes | exact | ok | 523ms |
| 55 | Steam Hades: `https://store.steampowered.com/app/1145360/Hades/` | games | games (high, domain: store.steampowered.com) | Hades | yes | exact | ok | 660ms |
| 56 | Steam Hollow Knight: `https://store.steampowered.com/app/367520/Hollow_Knight/` | games | games (high, domain: store.steampowered.com) | Hollow Knight | yes | exact | ok | 399ms |
| 57 | itch.io Celeste Classic: `https://maddymakesgames.itch.io/celeste-classic` | games | games (high, domain: maddymakesgames.itch.io) [error] | Celeste classic (from URL) | no | exact | ok | 722ms |
| 58 | Nintendo store Zelda: `https://www.nintendo.com/us/store/products/the-legend-of-zel` | games | games (high, path: nintendo game) | The Legend of Zelda™: Tears of the Kingdom for Nintendo Swit | yes | exact | ok | 605ms |
| 59 | PlayStation Astro Bot: `https://www.playstation.com/en-us/games/astro-bot/` | games | games (high, path: playstation game) | ASTRO BOT - PS5 Games | yes | exact | ok | 922ms |
| 60 | Netflix Stranger Things: `https://www.netflix.com/title/80057281` | tv | tv (low, domain: streaming (netflix.com)) | (none) | yes | exact | ok | 1849ms |
| 61 | Netflix Roma (film): `https://www.netflix.com/title/80240715` | films | tv (low, domain: streaming (netflix.com)) | (none) | yes | exact | ok | 1544ms |
| 62 | HBO The Last of Us: `https://www.hbo.com/the-last-of-us` | tv | tv (high, json-ld: TVSeries) | Watch The Last of Us | yes | exact | ok | 1292ms |
| 63 | HBO Succession: `https://www.hbo.com/succession` | tv | tv (high, json-ld: TVSeries) | Watch Succession | yes | exact | ok | 1174ms |
| 64 | Apple TV Severance: `https://tv.apple.com/us/show/severance/umc.cmc.1srk2goyh2q2z` | tv | tv (high, json-ld: TVSeries) | Watch Severance - Show | yes | exact | ok | 342ms |
| 65 | Disney+ page: `https://www.disneyplus.com/en-gb/browse/entity-9ba7a8d0-0a16` | ? | tv (low, domain: streaming (disneyplus.com)) | Sorry, Disney+ is not available in your region. | yes | exact | ok | 601ms |
| 66 | Wikipedia film: `https://en.wikipedia.org/wiki/Spirited_Away` | films | films (high, wikidata: anime film) | Spirited Away | no | exact | ok | 1075ms |
| 67 | Wikipedia book: `https://en.wikipedia.org/wiki/One_Hundred_Years_of_Solitude` | books | books (high, wikidata: literary work) | One Hundred Years of Solitude | no | exact | ok | 690ms |
| 68 | Wikipedia album: `https://en.wikipedia.org/wiki/OK_Computer` | albums | albums (high, wikidata: album) | OK Computer | no | exact | ok | 928ms |
| 69 | Wikipedia place: `https://en.wikipedia.org/wiki/Eiffel_Tower` | places | places (high, wikidata: has coordinates) | Eiffel Tower | yes | exact | ok | 701ms |
| 70 | Wikipedia NL book: `https://nl.wikipedia.org/wiki/De_ontdekking_van_de_hemel` | books | books (high, wikidata: literary work) | De ontdekking van de hemel | no | exact | ok | 819ms |
| 71 | Wikipedia DE book: `https://de.wikipedia.org/wiki/Der_Steppenwolf` | books | books (high, wikidata: literary work) | Der Steppenwolf | yes | exact | ok | 871ms |
| 72 | Wikipedia JA film: `https://ja.wikipedia.org/wiki/千と千尋の神隠し` | films | films (high, wikidata: anime film) | 千と千尋の神隠し | no | cleaned | ok | 967ms |
| 73 | Letterboxd list: `https://letterboxd.com/dave/list/official-top-250-narrative-` | ? | films (high, domain: letterboxd) [error] | Official top narrative feature films (from URL) | no | exact | ok | 261ms |
| 74 | Letterboxd film: `https://letterboxd.com/film/spirited-away/` | films | films (high, domain: letterboxd) | Spirited Away | yes | exact | ok | 374ms |
| 75 | IMDb list: `https://www.imdb.com/list/ls055592025/` | ? | films (high, domain: imdb.com) | (none) | no | exact | ok | 462ms |
| 76 | Sam Altman blog: `https://blog.samaltman.com/the-days-are-long-but-the-decades` | essays | essays (medium, og:type: article) | The days are long but the decades are short | no | exact | ok | 537ms |
| 77 | Substack essay (Slow Boring): `https://www.slowboring.com/p/the-republican-urge-to-start-wa` | essays | essays (medium, json-ld: NewsArticle) | The Republican urge to start wars in the Middle East | yes | exact | ok | 333ms |
| 78 | New Yorker article: `https://www.newyorker.com/magazine/2026/09/28/our-ai-problem` | essays | essays (medium, json-ld: NewsArticle) | Our A.I. Problem | yes | exact | ok | 212ms |
| 79 | Aeon essay: `https://aeon.co/essays/feed` | essays | essays (medium, path word: /essays/) [error] | (none) | no | exact | ok | 101ms |
| 80 | Medium article: `https://medium.com/@karpathy/software-2-0-a64152b37c35` | essays | essays (high, domain: medium.com) [blocked] | Software a64152b37c35 (from URL) | no | exact | ok | 83ms |
| 81 | PDF dummy: `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pd` | ? | things (low, no signal) [blocked] | (none) | no | exact | ok | 69ms |
| 82 | arXiv PDF: `https://arxiv.org/pdf/1706.03762` | essays | essays (medium, marker: long text, no shop) | (none) | no | exact | ok | 933ms |
| 83 | Image JPG (Wikimedia): `https://upload.wikimedia.org/wikipedia/commons/a/a8/Tour_Eif` | ? | essays (medium, marker: long text, no shop) | Tour Eiffel Wikimedia Commons (from URL) | no | exact | ok | 2621ms |
| 84 | Image (Unsplash CDN): `https://images.unsplash.com/photo-1506744038136-46273834b3fb` | ? | essays (medium, marker: long text, no shop) | Photo 46273834b3fb (from URL) | no | exact | ok | 2372ms |
| 85 | Instagram post (made up id): `https://www.instagram.com/p/C0abc123XYZ/` | ? | things (medium, path word: /p/) | (none) | no | exact | ok | 605ms |
| 86 | Instagram profile: `https://www.instagram.com/natgeo/` | ask | things (low, no signal) | (none) | no | exact | ok | 525ms |
| 87 | TikTok video: `https://www.tiktok.com/@khaby.lame/video/7137423965982592262` | videos | videos (high, path: tiktok video) | (none) | no | exact | ok | 1044ms |
| 88 | X post: `https://x.com/elonmusk/status/1519480761749016577` | ? | essays (high, og:type: article + marker: article byline) | Elon Musk (@elonmusk) on X | yes | exact | ok | 4065ms |
| 89 | Twitter post (first tweet): `https://twitter.com/jack/status/20` | ? | essays (high, og:type: article + marker: article byline) | jack (@jack) on X | yes | exact | ok | 1126ms |
| 90 | Google search URL (film): `https://www.google.com/search?q=spirited+away&oq=spirited&so` | search | not a link → search "spirited away" | (none) | no | n/a | ok | 0ms |
| 91 | Google search URL (place): `https://www.google.nl/search?q=rijksmuseum+amsterdam` | search | not a link → search "rijksmuseum amsterdam" | (none) | no | n/a | ok | 0ms |
| 92 | Plain title: `Spirited Away` | search | not a link → search "Spirited Away" | (none) | no | n/a | ok | 0ms |
| 93 | Title with emoji: `🎬 Parasite 🍿` | search | not a link → search "🎬 Parasite 🍿" | (none) | no | n/a | ok | 1ms |
| 94 | Only emoji: `🔥🔥🔥` | search | not a link → search "🔥🔥🔥" | (none) | no | n/a | ok | 0ms |
| 95 | Very long share text: `Heyyy!! 😍 you HAVE to listen to this, it's been on repeat a` | albums | albums (high, provider: Spotify) | Random Access Memories | yes | cleaned | ok | 507ms |
| 96 | Apple Music share text: `Listen to Blonde by Frank Ocean on Apple Music. https://musi` | albums | albums (high, domain: apple music) | Blonde | yes | cleaned | ok | 100ms |
| 97 | 404 page: `https://www.example.com/this-page-does-not-exist-404` | ? | things (low, no signal) [error] | This page does not exist (from URL) | no | exact | ok | 907ms |
| 98 | Domain does not exist: `https://thisdomaindoesnotexist-hoshigo-12345.com/` | ? | things (low, unreachable: domain not found) [error] | (none) | no | exact | ok | 470ms |
| 99 | 500 error: `https://httpstat.us/500` | ? | things (low, no signal) [timeout] | (none) | no | exact | ok | 8153ms |
| 100 | Typo in scheme: `htps://www.imdb.com/title/tt0245429/` | films | films (high, provider: IMDb) | Spirited Away | yes | cleaned | ok | 217ms |
| 101 | No scheme IMDb: `imdb.com/title/tt0245429` | films | films (high, provider: IMDb) | Spirited Away | yes | cleaned | ok | 170ms |


## Round 4, photo sources ("Use another photo")

Run with `npx tsx --env-file=.env.local scripts/photo-matrix.ts`. The picker accepts any page
or image link; a direct image is detected by content type (row 3 has no extension). The
item's own link, title, by and category are never changed by this.

| # | Source | Status | Candidates | Best (first) | Time |
|---|---|---|---|---|---|
| 1 | Wikipedia article: `https://en.wikipedia.org/wiki/Spirited_Away` | ok | 10 | https://upload.wikimedia.org/wikipedia/en/d/db/Spirited_Away_Japanese_poster.png?utm_sourc | 521ms |
| 2 | Wikimedia Commons file page: `https://commons.wikimedia.org/wiki/File:Tour_Eiffel_Wikimedia_Commons.` | ok | 3 | https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg | 365ms |
| 3 | Direct image (no extension): `https://images.unsplash.com/photo-1506744038136-46273834b3fb` | image | 1 | https://images.unsplash.com/photo-1506744038136-46273834b3fb | 278ms |
| 4 | Unsplash photo page: `https://unsplash.com/photos/a-body-of-water-surrounded-by-trees-and-mo` | image | 1 | https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?ixlib=rb-4.1.0&q=85&fm=jpg&cr | 512ms |
| 5 | Pinterest pin: `https://www.pinterest.com/pin/99360735500167749/` | ok | 3 | https://i.pinimg.com/736x/a7/66/56/a76656e966b1958f568d63c3f1c05aec.jpg | 876ms |
| 6 | Instagram post: `https://www.instagram.com/p/C9qV8Z8Mh1B/` | none | 0 |  | 1256ms |
| 7 | bol.com product: `https://www.bol.com/nl/nl/p/apple-airpods-4/9300000190488770/` | blocked | 0 |  | 4726ms |
| 8 | Amazon product: `https://www.amazon.com/dp/B0CHX1W1XY` | blocked | 0 |  | 650ms |
| 9 | Zalando product: `https://www.zalando.nl/nike-sportswear-air-force-1-sneakers-laag-white` | blocked | 0 |  | 1661ms |
| 10 | Museum object page (Rijksmuseum): `https://www.rijksmuseum.nl/en/collection/SK-C-5` | ok | 16 | https://iiif.micr.io/PJEZO/73,3768.6884765625,14459,7596.623046875/1024,538/0/default.webp | 710ms |
| 11 | Restaurant site (Dishoom): `https://www.dishoom.com/covent-garden/` | ok | 2 | https://cdn.sanity.io/images/daku84np/production/b492504165ed7b5327abddaf1086b7a099f65418- | 965ms |
| 12 | Substack post: `https://www.slowboring.com/p/the-republican-urge-to-start-wars` | ok | 12 | https://substackcdn.com/image/fetch/$s_!hrIu!,w_1200,h_675,c_fill,f_jpg,q_auto:good,fl_pro | 32ms |
| 13 | Discogs release: `https://www.discogs.com/release/1085364` | ok | 1 | https://i.discogs.com/XED_KoRgsC1og_6PxVBHKCwBXAH-AzyytuFY9DZnJQ4/rs:fit/g:sm/q:90/h:598/w | 468ms |
| 14 | Goodreads book: `https://www.goodreads.com/book/show/119073.The_Name_of_the_Rose` | ok | 16 | https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1415375471i/11907 | 1731ms |
| 15 | IMDb title: `https://www.imdb.com/title/tt0245429/` | ok | 1 | https://image.tmdb.org/t/p/w342/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg | 432ms |
| 16 | News article (Guardian): `https://www.theguardian.com/info/2016/jan/25/content-funding` | none | 0 |  | 290ms |
| 17 | Plain text: `not a link at all` | not_a_link | 0 |  | 1ms |

**Was the best (first) one right?** Yes for every source that returned photos: the film
poster (1, 15), the Commons photo (2), the Unsplash photo (3, 4: photo pages sit behind a
bot check, so we use Unsplash's public download URL), the pin image (5), the painting (10,
a 1024px crop of the Night Watch), the restaurant interior (11), the post's header image
(12), the record cover (13), the book cover (14).

**No photos:** bol.com, Amazon and Zalando block server requests (shown as "That site
doesn't let us look at its photos"); Instagram requires login ("No photos found"); the
Guardian page picked by the script (an info page) has only a logo, which is filtered.

**Regressions found and fixed this round** (earlier input matrix rerun):
- The new srcset parser split on commas inside Amazon image URLs (`_SR116,116_.jpg`) and
  produced a broken relative URL. Fixed: entries split only on ", ".
- Allbirds then picked an unrendered template URL (`{{…}}`). Template placeholders are
  now rejected.
- Not a regression but a correction: Guardian and Allbirds og:images are site logos
  (`fallback-logo.png`, `logo-seo.jpg`); round 2 counted them as "image ok", the junk
  filter now drops them.
- Wikipedia (round 3 provider) returned no image for pages whose lead image is non-free
  (film posters): the pageimages API now asks for any license.


## Round 6: places, games, same work across languages

Run with `scripts/round6-check.ts` and `scripts/cross-language-check.ts`
(`npx tsx --env-file=.env.local …`).

### Same work across languages

Books already group correctly: all 10 translation pairs resolve to one Open Library work
key, both through the paste matcher and the search list's first hit (De jaren / The Years
/ Les Années → `/works/OL102389W`, Honderd jaar eenzaamheid / One Hundred Years of
Solitude → `/works/OL274505W`, De avond is ongemak / The Discomfort of Evening →
`/works/OL19740451W`, …). Nothing needed fixing there.

Films: TMDB has one id per film, but only matches titles it knows. "De zeven samoerai"
worked; **"De reis van Chihiro" found nothing** (TMDB has no Dutch title for it). Fixed with
a Wikidata bridge: labels and aliases in nl/de/fr/es/it/en, then the TMDB id (P4947 film,
P4983 series) → the same TMDB work 129. Still not found: "Het leven van anderen"; Dutch
Wikipedia and Wikidata list that film under its original title "Das Leben der Anderen",
which does match.

```
## Books (resolveBook with author, then the search list's first hit)
SAME resolve  The Years → /works/OL102389W (The years) | De jaren → /works/OL102389W (De jaren)
SAME search   The Years → /works/OL102389W | De jaren → /works/OL102389W (De jaren)
SAME resolve  The Years → /works/OL102389W (The years) | Les Années → /works/OL102389W (The years)
SAME search   The Years → /works/OL102389W | Les Années → /works/OL102389W (Les années)
SAME resolve  One Hundred Years of Solitude → /works/OL274505W (One Hundred Years of Solitude) | Honderd jaar eenzaamheid → /works/OL274505W (Honderd jaar eenzaamheid)
SAME search   One Hundred Years of Solitude → /works/OL274505W | Honderd jaar eenzaamheid → /works/OL274505W (Honderd jaar eenzaamheid)
SAME resolve  The Discomfort of Evening → /works/OL19740451W (The Discomfort of Evening) | De avond is ongemak → /works/OL19740451W (De avond is ongemak)
SAME search   The Discomfort of Evening → /works/OL19740451W | De avond is ongemak → /works/OL19740451W (De avond is ongemak)
SAME resolve  The Name of the Rose → /works/OL8996439W (The  name of the rose) | De naam van de roos → /works/OL8996439W (De naam van de roos)
SAME search   The Name of the Rose → /works/OL8996439W | De naam van de roos → /works/OL8996439W (De naam van de roos)
SAME resolve  Steppenwolf → /works/OL872773W (Steppenwolf) | Der Steppenwolf → /works/OL872773W (Steppenwolf)
SAME search   Steppenwolf → /works/OL872773W | Der Steppenwolf → /works/OL872773W (Der Steppenwolf)
SAME resolve  The Stranger → /works/OL1230613W (The Stranger) | L'étranger → /works/OL1230613W (L'étranger Par Albert Camus)
SAME search   The Stranger → /works/OL1230613W | L'étranger → /works/OL1230613W (L'étranger Par Albert Camus)
SAME resolve  The Stranger → /works/OL1230613W (The Stranger) | De vreemdeling → /works/OL1230613W (De Vreemdeling)
SAME search   The Stranger → /works/OL1230613W | De vreemdeling → /works/OL1230613W (De Vreemdeling)
SAME resolve  The Discovery of Heaven → /works/OL659062W (The Discovery of Heaven) | De ontdekking van de hemel → /works/OL659062W (De ontdekking van de hemel)
SAME search   The Discovery of Heaven → /works/OL659062W | De ontdekking van de hemel → /works/OL659062W (De ontdekking van de hemel)
SAME resolve  The Dinner → /works/OL2486917W (The Dinner) | Het diner → /works/OL2486917W (The Dinner)
SAME search   The Dinner → /works/OL2486917W | Het diner → /works/OL2486917W (Het Diner)

## Films
SAME Seven Samurai → 346 | De zeven samoerai → 346 (Seven Samurai); search first: 346 Seven Samurai
DIFF Spirited Away → 129 | De reis van Chihiro → undefined (undefined); search first: undefined undefined
SAME The Lives of Others → 582 | Das Leben der Anderen → 582 (The Lives of Others); search first: 582 The Lives of Others
SAME Amélie → 194 | Le Fabuleux Destin d'Amélie Poulain → 194 (Amélie); search first: 194 Amélie
```

### Places, games, film bridge

```
## Places: search list (kind · city, website)

"Rijksmuseum Amsterdam" (1)
- Rijksmuseum | Museum · Amsterdam | Hobbemastraat, Zuid, Amsterdam, Netherlands | site: https://www.rijksmuseum.nl/ | id W29989787

"Café de Klos Amsterdam" (1)
- Café De Klos | Barbecue restaurant · Amsterdam | Kerkstraat 41-43, Centrum, Amsterdam, Netherlands | site: https://dekloscafe.wordpress.com/ | id N2626432820

"Dishoom London" (7)
- Dishoom | Indian restaurant · Greater London | Boundary Street 7, Whitechapel, Greater London, United Kingdom | site: https://www.dishoom.com/shoreditch/ | id W276329431
- Dishoom | Indian restaurant · City of Westminster | Upper St Martin's Lane 12, Covent Garden, City of Westminster, United Kingdom | site: http://www.dishoom.com/covent-garden/ | id W207104925
- Dishoom | Indian restaurant · Greater London | Derry Street 4, Kensington, Greater London, United Kingdom | site: https://www.dishoom.com/kensington/ | id N6306940350

"Noma Copenhagen" (1)
- Noma | Regional restaurant · Copenhagen | Bjørnekloen, Amagerbro, Copenhagen, Denmark | site: https://noma.dk/ | id N5416925514

"Pllek Amsterdam" (2)
- Pllek | Beach · Amsterdam | Noord, Amsterdam, Netherlands | site: https://www.pllek.nl/ | id W254154642
- Pllek | Restaurant · Amsterdam | tt. Neveritaweg 59, Noord, Amsterdam, Netherlands | site: https://pllek.nl/ | id N4913392670

"Shakespeare and Company Paris" (1)
- Shakespeare and Company | Bookshop · Paris | Rue de la Bûcherie 37, 5th Arrondissement, Paris, France | site: https://www.shakespeareandcompany.com/ | id N251373380

## Places: resolve + website photo
Rijksmuseum → Rijksmuseum | Museum · Amsterdam | high | site https://www.rijksmuseum.nl/ | photo https://www.rijksmuseum.nl/assets/147dde9e-c250-4ed9-b941-39800085a4e3?w=2880&h=
Dishoom Covent Garden → Dishoom | Indian restaurant · City of Westminster | low | site http://www.dishoom.com/covent-garden/ | photo https://cdn.sanity.io/images/daku84np/production/b492504165ed7b5327abddaf1086b7a

## Games: search

"Hades" (2, 4173ms)
- Hades | Supergiant Games | 2018 | Nintendo Switch, Microsoft Windows, macOS | img yes | Q59756366
- Hades II | Supergiant Games | 2024 | Microsoft Windows, Nintendo Switch, Nintendo Switch 2 | img yes | Q115641620

"Catan" (4, 2049ms)
- The Settlers of Catan | Franckh-Kosmos | 1995 | Board game · 1995 | img yes | Q17271
- Catan | Game Republic | 2008 | PlayStation 3 | img no | Q5051418
- Catan | Big Huge Games | 2007 | Xbox 360 | img no | Q16266534

"Wingspan" (2, 1881ms)
- Wingspan |  | 2020 | Microsoft Windows, macOS, Nintendo Switch | img no | Q111109349
- Wingspan | Feuerland Spiele | 2019 | Board game · 2019 | img yes | Q65784798

"Zelda Tears of the Kingdom" (1, 1927ms)
- The Legend of Zelda: Tears of the Kingdom | Nintendo Entertainment Planning & Development | 2022 | Nintendo Switch, Nintendo Switch 2 | img yes | Q64577191

"Celeste" (2, 2146ms)
- Celeste | Maddy Makes Games | 2018 | Microsoft Windows, Nintendo Switch, Linux | img yes | Q28451532
- Celeste Classic | Maddy Thorson | 2015 | PICO-8, web browser | img yes | Q99593577

"Ticket to Ride" (3, 1783ms)
- Ticket to Ride | Days of Wonder | 2004 | Board game · 2004 | img yes | Q228308
- Ticket to Ride | Next Level Games | 2008 | Android, Xbox 360, Microsoft Windows | img no | Q7800668
- Ticket to Ride |  | 2023 | Microsoft Windows | img no | Q124050300

"Portal 2" (3, 1630ms)
- Portal 2 | Valve Corporation | 2011 | Microsoft Windows, macOS, PlayStation 3 | img yes | Q279446
- Portal 2 Sixense Perceptual Pack |  | 2013 | Microsoft Windows | img no | Q124069832
- Portal 2: Confinement |  | 2024 | Microsoft Windows, macOS, Linux | img no | Q141483864

## Games: pasted links
store.steampowered.com/app/1145360/Hades/ → games (domain: store.steampowered.com) "Hades" → Hades [Q59756366] Nintendo Switch, Microsoft Windows, macOS high
store.steampowered.com/app/620/Portal_2/ → games (domain: store.steampowered.com) "Portal 2" → Portal 2 [Q279446] Microsoft Windows, macOS, PlayStation 3 high
boardgamegeek.com/boardgame/13/catan → games (domain: boardgamegeek.com) "Catan" → The Settlers of Catan [Q17271] Board game · 1995 high
boardgamegeek.com/boardgame/266192/wingspan → games (domain: boardgamegeek.com) "Wingspan" → Wingspan [Q65784798] Board game · 2019 high
www.playstation.com/en-us/games/astro-bot/ → games (path: playstation game) "ASTRO BOT - PS5 Games" → Astro Bot [Q126199700] PlayStation 5 high
www.nintendo.com/us/store/products/the-legend-of-zelda-tears-o → games (path: nintendo game) "The Legend of Zelda™: Tears of the Kingdom for Nintendo Switch" → The Legend of Zelda: Tears of the Kingdom [Q64577191] Nintendo Switch, Nintendo Switch 2 high
maddymakesgames.itch.io/celeste-classic → games (domain: maddymakesgames.itch.io) "Celeste classic" → Celeste Classic [Q99593577] PICO-8, web browser high
en.wikipedia.org/wiki/Hollow_Knight → games (wikidata: video game) "Hollow Knight" → Hollow Knight [Q29300592] Microsoft Windows, macOS, Linux high

## Films: Dutch titles
De reis van Chihiro → resolve 129 Spirited Away | search 129 Spirited Away
De zeven samoerai → resolve 346 Seven Samurai | search 346 Seven Samurai
Het leven van anderen → resolve undefined undefined | search undefined undefined
```

Notes:
- Places now show kind and city in the "by" line ("Indian restaurant · City of
  Westminster"); three Dishoom branches are told apart by street in the detail line.
- "Dishoom Covent Garden" matches the right branch at *low* confidence, so the dialog
  doesn't link it; picking it from the search list does.
- Games: Steam and BoardGameGeek links resolve exactly through the ids on the Wikidata
  item (confidence high). BGG pages block us, so the title comes from the URL.


## Round 7: structured place fields (type, location)

Run with `npx tsx --env-file=.env.local scripts/places-fields-check.ts` against live OSM.
Found and fixed: London branches came back as "Greater London" / "City of Westminster" and
Tokyo as its ward "Chuo" (OSM puts districts in `city` there); both now read as the city
people name. Branches are still told apart by street in the detail line.

```
## search: type | city | country | by (combined, still written) | detail (street)

"Dishoom London"
- Dishoom | Indian restaurant | London | United Kingdom | Indian restaurant · London | Boundary Street 7, Whitechapel, London, United Kingdom
- Dishoom | Indian restaurant | London | United Kingdom | Indian restaurant · London | Upper St Martin's Lane 12, Covent Garden, London, United Kingdom
- Dishoom | Indian restaurant | London | United Kingdom | Indian restaurant · London | Derry Street 4, Kensington, London, United Kingdom

"Café de Klos Amsterdam"
- Café De Klos | Barbecue restaurant | Amsterdam | Netherlands | Barbecue restaurant · Amsterdam | Kerkstraat 41-43, Centrum, Amsterdam, Netherlands

"Shakespeare and Company Paris"
- Shakespeare and Company | Bookshop | Paris | France | Bookshop · Paris | Rue de la Bûcherie 37, 5th Arrondissement, Paris, France

"Vondelpark"
- Vondelpark | Park | Amsterdam | Netherlands | Park · Amsterdam | Zuid, Amsterdam, Netherlands
- Vondelpark | Park | Maassluis | Netherlands | Park · Maassluis | Maassluis, Netherlands
- Vondelpark | Park | Harderwijk | Netherlands | Park · Harderwijk | Harderwijk, Netherlands

"Sukiyabashi Jiro Tokyo"
- すきやばし次郎 | Sushi restaurant | Tokyo | Japan | Sushi restaurant · Tokyo | Ginza, Ginza 4, Tokyo, Japan

"Pergamonmuseum Berlin"
- Pergamonmuseum | Museum | Berlin | Germany | Museum · Berlin | Am Kupfergraben 5, Mitte, Berlin, Germany

## resolve (pasted Maps link path)
Rijksmuseum → Rijksmuseum | Museum | Amsterdam | Netherlands | high
Café De Klos → Café De Klos | Barbecue restaurant | Amsterdam | Netherlands | high

## helpers
{"placeType":"Bar","city":"Amsterdam"} {"placeType":"","city":"Amsterdam, Netherlands"} Bar · Amsterdam
{"placeType":"Museum","city":"Amsterdam","country":""} {"placeType":"Park","city":"Utrecht","country":"Netherlands"}
```
