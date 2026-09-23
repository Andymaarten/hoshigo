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
