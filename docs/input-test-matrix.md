# Add flow input test matrix

Run on 2026-09-23 against `readLink()` (the code behind `/api/fetch-metadata`) plus the
canonical matcher `resolveWork()`, with live network calls. Reproduce with:

```
npx tsx --env-file=.env.local scripts/input-matrix.ts           # classifier with LLM step
npx tsx --env-file=.env.local scripts/input-matrix.ts --no-llm  # rules only
npx tsx --env-file=.env.local scripts/search-matrix.ts          # "Find it yourself" search
```

Columns: *Link kept* says what the listing will send visitors to. "yes, exact" means
the pasted URL unchanged; "yes: …" means only tracking params (`si`, `utm_*`, `ref_`)
or surrounding share text/whitespace were removed. The pasted link is never swapped for a
catalog URL. "reads …" is where a short link lands; that URL is only used to read metadata.

## Paste a link

**LLM step status for this run:** no `ANTHROPIC_API_KEY` was available locally, so both
runs (with and without the LLM step) gave identical results. The classifier fell back to
rules only, as designed. Rows marked *low* are exactly where the LLM would be called in
production. Without it, the dialog shows the 2 or 3 likely categories as one tap choices.

| # | Input | Detected category (confidence, reason) | Title | By | Image | Link kept | Catalog match | Time |
|---|---|---|---|---|---|---|---|---|
| 1 | Spotify album (with ?si): `https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa?si=abc123` | albums (high, provider: Spotify) | Random Access Memories | Daft Punk | ok | yes: https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa | musicbrainz: Random Access Memories (2013) | 2884ms |
| 2 | Spotify track: `https://open.spotify.com/track/2Foc5Q5nqNiosCNqttzHof` | songs (high, provider: Spotify) | Get Lucky (Radio Edit) [feat. Pharrell Williams and Nile Rodgers] | Daft Punk, Pharrell Williams, Nile Rodgers | ok | yes, exact | musicbrainz: Get Lucky (2015) | 400ms |
| 3 | Spotify podcast show: `https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk` | podcasts (high, provider: Spotify) | The Joe Rogan Experience |  | ok | yes, exact | itunes: The Joe Rogan Experience | 1182ms |
| 4 | Spotify podcast episode: `https://open.spotify.com/episode/4IAZ21ICOQjQU4na6bfWDP` | podcasts (high, provider: Spotify) | The Ringer-Verse |  | ok | yes, exact | itunes: The Ringer-Verse | 866ms |
| 5 | Share text with URL inside: `Check this out https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa?si=xyz!` | albums (high, provider: Spotify) | Random Access Memories | Daft Punk | ok | yes: https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa | musicbrainz: Random Access Memories (2013) | 2005ms |
| 6 | Whitespace, no https: `   open.spotify.com/album/4m2880jivSbbyEGAKfITCa   ` | albums (high, provider: Spotify) | Random Access Memories | Daft Punk | ok | yes: https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa | musicbrainz: Random Access Memories (2013) | 1928ms |
| 7 | Apple Music album | albums (high, domain: apple music) | Random Access Memories | Daft Punk | ok | yes, exact | musicbrainz: Random Access Memories (2013) | 1893ms |
| 8 | Apple Music song (`?i=`) | songs (high, path: apple music song) | Get Lucky | Daft Punk, Pharrell Williams & Nile Rodgers | ok | yes, exact | musicbrainz: Get Lucky (2017) | 2786ms |
| 9 | Bandcamp album: `https://radiohead.bandcamp.com/album/in-rainbows` | albums (high, domain: bandcamp) | In Rainbows | Radiohead | ok | yes, exact | musicbrainz: In Rainbows (2007) | 2884ms |
| 10 | YouTube watch + utm | videos (high, provider: YouTube) | Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster) | Rick Astley | ok | yes: utm removed | youtube (id) | 647ms |
| 11 | youtu.be short + si | videos (high, provider: YouTube) | same | Rick Astley | ok | yes: `si` removed, still youtu.be | youtube (id) | 279ms |
| 12 | Vimeo | videos (high, domain: vimeo.com) | The New Vimeo Player (You Know, For Videos) |  | ok | yes, exact | none (no Vimeo catalog) | 977ms |
| 13 | IMDb film with `?ref_` | films (high, provider: IMDb) | Parasite |  | ok | yes: `ref_` removed (added after this run, verified in the browser) | tmdb: Parasite (2019) | 844ms |
| 14 | IMDb series, mobile `m.imdb.com` | tv (high, provider: IMDb) | Breaking Bad |  | ok | yes, exact | tmdb_tv: Breaking Bad (2008) | 381ms |
| 15 | `www.imdb.com/title/tt6751668` (no scheme) | films (high, provider: IMDb) | Parasite |  | ok | yes: https:// added | tmdb: Parasite (2019) | 365ms |
| 16 | Letterboxd | films (high, domain: letterboxd) | Paris, Texas |  | ok | yes, exact | tmdb: Paris, Texas (1984) | 1541ms |
| 17 | TMDB film page | films (high, provider: TMDB) | Parasite |  | ok | yes, exact | tmdb: Parasite (2019) | 367ms |
| 18 | TMDB tv page | tv (high, provider: TMDB) | Breaking Bad |  | ok | yes, exact | tmdb_tv: Breaking Bad (2008) | 358ms |
| 19 | Goodreads | books (high, domain: goodreads.com) | The Name of the Rose | Umberto Eco | ok | yes, exact | openlibrary: The name of the rose (1980) | 3066ms |
| 20 | Open Library edition (Dutch) | books (high, provider: Open Library) | De ontdekking van de hemel |  | ok | yes, exact | openlibrary: De ontdekking van de hemel (1993) | 2567ms |
| 21 | bol.com book (blocked) | things (**low**, no signal) [blocked] | De ontdekking van de hemel (from URL) |  | none | yes, exact | none until category picked | 885ms |
| 22 | Amazon book (`/dp/<isbn10>`) | books (high, path: amazon isbn) | How to Blog a Book Revised and Expanded Edition: Write, Publish, and Promote… | Nina Amir | ok | yes, exact | none | 4351ms |
| 23 | amzn.to short link `http://amzn.to/ZAcFu8` | books (high, path: amazon ebook) | War Remains | Jeffrey Miller | ok | yes, exact → reads amazon.com/War-Remains-ebook/dp/B004BLK4GY | openlibrary: War Remains (2011) | 2899ms |
| 24 | Apple Podcasts | podcasts (high, domain) | The Daily |  | ok | yes, exact | itunes: The Daily | 1695ms |
| 25 | Google Maps `/maps/place/…` | places (high, provider: Google Maps) | Rijksmuseum |  | none | yes, exact | nominatim: Rijksmuseum | 283ms |
| 26 | Google Maps `?q=` | places (high, provider: Google Maps) | Cafe de Klos Amsterdam |  | none | yes, exact | nominatim: Café De Klos | 168ms |
| 27 | News article (Guardian) | essays (medium, json-ld: NewsArticle) | Rights and freedom – a Guardian series |  | ok | yes, exact | n/a | 403ms |
| 28 | Substack essay (astralcodexten.com) | essays (medium, json-ld: NewsArticle) | Mysteries Of AI Generalization | Scott Alexander | ok | yes, exact | n/a | 374ms |
| 29 | Essay without metadata (paulgraham.com) | things (**low**, no signal) | How to Do Great Work |  | ok | yes, exact | n/a | 927ms |
| 30 | Shop product (allbirds.com) | things (**low**, no signal) | Shop Sustainable Footwear for Men |  | ok | yes, exact | n/a | 942ms |
| 31 | Museum homepage (rijksmuseum.nl) | things (**low**, no signal) | Rijksmuseum Amsterdam, home of Dutch master pieces |  | ok | yes, exact | n/a | 1457ms |
| 32 | Recipe (allrecipes, blocked) | things (**low**) [blocked] | Best chocolate chip cookies (from URL) |  | none | yes, exact | n/a | 283ms |
| 33 | Steam game | games (high, domain) | Portal 2 |  | ok | yes, exact | n/a (no games catalog) | 884ms |
| 34 | Wikipedia, entity in title | essays (medium, json-ld: Article) | Amélie |  | ok | yes, exact | n/a | 744ms |
| 35 | TripAdvisor (blocked, 403) | places (high, domain) [blocked] | Cafe de Klos (from URL) |  | none | yes, exact | nominatim: Café De Klos | 575ms |
| 36 | Timeout (`httpbin.org/delay/15`) | things (**low**) [timeout] | (none) → manual title |  | none | yes, exact |  | 8002ms |
| 37 | Plain text `Honderd jaar eenzaamheid` | not a link → "Search for … instead" | | | | n/a | | 0ms |

**Summary (37 inputs):** 29 fully right (category, clean title, link kept, catalog match
where one exists). 7 fall back gracefully: low confidence shows the category choice, and
a missing title goes to a manual title (#21, #29, #31, #32, #36, and the medium essay
rows). 1 has a poor title: #30, where Allbirds redirects the product to a collection
page and we read that page's title. No input crashed or dead-ended, and every link was
kept.

**Not tested with real links:** `spotify.link`, `maps.app.goo.gl`, `a.co` and `amzn.eu`.
I could not find real public examples of these, and the ones I guessed were 404s. The
expander handles them in two ways: a plain HTTP redirect (verified with `amzn.to`, #23),
or an HTML interstitial where the destination is looked up in the body. Google Maps short
links used to return a JS-only interstitial (see sources.md). Paste one real link of each
from a phone to confirm.

### Classifier cost estimate (LLM step)

Only called when steps 1 and 2 (domain/path rules, JSON-LD, og:type) give no *high*
answer. That was 9 of 37 rows here (the *low* and *medium* rows). Per call, Claude Haiku
4.5: about 450 input tokens (system prompt + tool schema + URL, title, description,
500 chars of page text) and about 40 output tokens. At $1 / $5 per million tokens that is
roughly **$0.0007 per call**, so about $0.0002 per pasted link on average. Results are
cached in memory per URL, and there's a 5 second timeout with no retries.

## Find it yourself (search)

| Category | Query | Top result | Notes |
|---|---|---|---|
| books | De ontdekking van de hemel | De ontdekking van de hemel, Harry Mulisch, 1993 (Dutch edition · De Bezige Bij) | original |
| books | Honderd jaar eenzaamheid | Honderd jaar eenzaamheid, García Márquez (original: Cien años de soledad) | translation found, Dutch cover |
| books | De naam van de roos | De naam van de roos, Umberto Eco (Dutch edition · Bert Bakker · 1985 · original: Il nome della rosa) | translation found |
| books | Der Steppenwolf | Der Steppenwolf, Hermann Hesse, 1927 | work title shown because it matches the query better than the top edition |
| books | Steppenwolf | Steppenwolf, Hermann Hesse (English edition · original: Der Steppenwolf) | |
| books | L'étranger | L’étranger, Albert Camus, 1942 | OL labels this edition English (data error upstream) |
| books | De vreemdeling Camus | De Vreemdeling, Albert Camus (Dutch edition · original: L’étranger) | |
| films | Solaris | Tarkovsky 1972, Soderbergh 2002, Hamaguchi 2007 | director + year tell remakes apart |
| films | Parasite | Bong Joon Ho 2019 (original title 기생충), Charles Band 1982… | |
| tv | The Office | Greg Daniels 2005 (US), Stephen Merchant 2001 (UK) | |
| albums | OK Computer | OK Computer, Radiohead, 1997, Album | ranked by release count |
| songs | Get Lucky | Get Lucky, Daft Punk, Pharrell Williams & Nile Rodgers, 2013 (on Random Access Memories) | list from iTunes, pick resolved to MusicBrainz |
| podcasts | The Daily | The Daily, The New York Times | |
| places | Rijksmuseum Amsterdam | Rijksmuseum, Amsterdam, Netherlands (museum · Stadhouderskade…) | |

Search times: 200 to 900 ms, except the first Open Library query (about 2 s).
