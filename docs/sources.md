# Bronnen-ondersteuning

Naast films/albums/boeken bestaan er ook canonieke catalogi voor **tv-series**, **losse
nummers** en **podcasts** — die zijn inmiddels toegevoegd (zie tabellen hieronder). Videogames
(via IGDB) staat klaar in het datamodel maar wacht nog op een API-key. Kunstwerken en recepten
hebben geen bruikbare universele catalogus en blijven daarom op de handmatige fallback.

Hoe een geplakte link wordt afgehandeld, van beste naar slechtste geval:

1. **Canoniek gematcht** — categorie correct herkend, en titel/by/jaar/cover komen van een
   autoritatieve catalogus (TMDB/MusicBrainz/Open Library), niet van de bronsite zelf. Dit is
   ook waar cross-source dedup vandaan komt: twee mensen die "hetzelfde album" via verschillende
   sites toevoegen komen op hetzelfde `work_id` uit.
2. **Alleen categorie + ruwe metadata** — categorie correct herkend, titel/afbeelding komen
   rechtstreeks van de bronsite (Open Graph-tags), geen canonieke match (bijv. omdat de titel
   niet uniek genoeg is, of omdat de categorie geen catalogus heeft — essays/things).
3. **Fallback: handmatig** — link kon niet gelezen worden, of niets herkend. Gebruiker vult zelf
   alles in. Dit blijft altijd de bodem, per ontwerp.

## Films

| Bron | Categorie-detectie | Canonieke match |
|---|---|---|
| Letterboxd | ✅ hostname | ✅ TMDB (titel+jaar search) |
| IMDb | ✅ hostname | ✅ TMDB (direct via tt-id, IMDb blokkeert scraping) |
| TMDB zelf | ✅ hostname | ✅ (titel+jaar search — kan later direct op TMDB-ID) |
| Rotten Tomatoes | ✅ hostname | ✅ getest: `rottentomatoes.com/m/parasite_2019` → og:title is `"Parasite (2019) \| Rotten Tomatoes"`, site-suffix + jaar worden gestript → TMDB-id 496243 (zelfde rij als de al geverifieerde IMDb/Letterboxd-Parasite) |
| Metacritic | ✅ hostname (og:type/og:site_name ontbreken beide) | ✅ getest: og:title is `"Parasite Reviews - Metacritic"` — Metacritic-specifieke regex strip `" Reviews - Metacritic"` → TMDB-id 496243, zelfde canonieke rij |
| Wikipedia (filmpagina's) | ❌ niet toegevoegd, zie beperkingen | — |

## Albums

| Bron | Categorie-detectie | Canonieke match |
|---|---|---|
| Spotify | ✅ hostname + eigen oEmbed | ✅ MusicBrainz (titel+artiest search) |
| Bandcamp | ✅ hostname | ✅ MusicBrainz — titel/artiest gesplitst uit Bandcamp's "Album, by Artist"-titelformaat |
| Discogs | ✅ hostname | ✅ resolved direct via Discogs' publieke API (site zelf blokkeert scraping net als IMDb, zelfde Cloudflare-uitdaging) — werkt nu voor **beide** URL-vormen: `/release/<id>` (specifieke persing, `artists_sort`-veld) én `/master/<id>` (release-group-pagina, `artists[0].name`-veld); eerder gaf `/master/` een lege response omdat alleen het release-regex-patroon bestond |
| Bandcamp (custom domain) | ✅ `<meta name="generator" content="Bandcamp">` als fallback | ✅ getest: `musique.coeurdepirate.com/album/blonde` (artiest-eigen domein, geen `*.bandcamp.com`-hostname) → title/artist/cover correct via bestaande "X, by Y"-og:site_name-split, categorie nu ook herkend via de generator-meta-tag die Bandcamp altijd zet ongeacht domein |
| Apple Music | ✅ hostname | ✅ getest: `music.apple.com/us/album/random-access-memories/617154241` → og:title `"Random Access Memories by Daft Punk on Apple Music"`, `" on Apple Music"`-suffix wordt gestript vóór de bestaande "X, by Y"-split → MusicBrainz-match op titel+artiest correct |
| MusicBrainz zelf | ✅ hostname | ✅ (uiteraard) |
| AllMusic | ✅ hostname | ❌ blokkeert server-side fetch (403), geen publieke API gevonden — zie beperkingen |
| RateYourMusic | ✅ hostname toegevoegd | ❌ blokkeert server-side fetch (403 Cloudflare) — zie beperkingen |
| Last.fm | ✅ hostname toegevoegd | ❌ blokkeert server-side fetch ("Client Challenge"); Last.fm heeft wél een publieke API maar die vereist een gratis API-key + registratie die we hier niet konden aanmaken — zie beperkingen |
| Tidal | ✅ hostname toegevoegd | ✅ getest: `tidal.com/browse/album/211822890` → og:title is `"Daft Punk - Random Access Memories"` (artiest-titel-volgorde, tegenovergesteld aan Bandcamp's "Titel, by Artiest") — nieuwe Tidal-specifieke split (alleen actief bij `og:site_name: "Music on TIDAL"`) haalt titel en artiest er correct uit → MusicBrainz-match correct. Track-pagina's (`/browse/track/`) niet geverifieerd: kon deze ronde geen bestaand track-id vinden om te testen (verzonnen/verouderde ids gaven allemaal 404) |
| Deezer | ✅ al gedekt via generieke og:type-fallback (`music.album`) | ✅ getest: `deezer.com/us/album/6575789` → titel schoon, geen extra code nodig |
| YouTube Music | ✅ al gedekt via generieke og:type-fallback | ✅ getest: `music.youtube.com/playlist?list=...` (album-playlist) → titel schoon, geen extra code nodig |

## Boeken

| Bron | Categorie-detectie | Canonieke match |
|---|---|---|
| Goodreads | ✅ hostname | ✅ Open Library (titel+auteur search) |
| Open Library zelf | ✅ hostname | ✅ |
| Google Books | ✅ hostname toegevoegd (was al gedekt door og:type "book", nu ook als vangnet in de hostname-map) | ✅ getest: `books.google.com/books?id=...` → og:type `"book"`, og:title schoon → Open Library-match correct |
| Amazon (boekpagina's) | ❌ niet toegevoegd | server-side fetch krijgt een 200 maar een lege bot-afweerpagina zonder og-tags terug (geen "Robot Check"-tekst zoals vroeger, gewoon een JS-shell) — zie beperkingen |
| StoryGraph | ❌ niet toegevoegd | **deze ronde getest**: `app.thestorygraph.com/books/<uuid>` → 403 op elke server-side fetch, ook met browser-UA. Zelfde categorie bot-afweer als AllMusic/RateYourMusic — zie beperkingen |
| Kobo | ❌ niet toegevoegd | **deze ronde getest**: `kobo.com/us/en/ebook/...` → 403, zelfde bot-afweer patroon |

## TV-series

| Bron | Categorie-detectie | Canonieke match |
|---|---|---|
| IMDb | ✅ hostname, onderscheidt film vs. serie via TMDB's `/find` resultaat | ✅ TMDB (direct via tt-id) |
| TMDB zelf | ✅ hostname + pad (`/tv/` vs `/movie/`) | ✅ |
| Letterboxd | — geen tv-content op Letterboxd, niet van toepassing | — |
| JustWatch | ✅ hostname + pad (`/tv-show/` vs `/movie/`) toegevoegd | ✅ net als Rotten Tomatoes/Metacritic: geen eigen API, maar de opgeschoonde titel + categorie gaan alsnog door de normale TMDB-titel-zoekopdracht (`resolveTv`/`resolveFilm`) → canonieke match, zie hieronder |

Getest met: IMDb-link naar Breaking Bad → categorie "tv", titel + maker (Vince Gilligan) +
jaar + poster correct via TMDB.

### JustWatch: titel-suffix opgeschoond, categorie toegevoegd

`justwatch.com/us/tv-show/breaking-bad` → og:title was `"Breaking Bad - watch tv show
streaming online"`, en `justwatch.com/us/movie/el-camino-a-breaking-bad-movie` → og:title was
`"El Camino: A Breaking Bad Movie streaming online"` (twee verschillende suffix-vormen, geen
dash bij films). JustWatch's og:site_name is simpelweg `"JustWatch"`, dus de generieke
site-naam-strip ving deze suffixen niet af — nieuwe JustWatch-specifieke regex toegevoegd, zelfde
patroon als de Metacritic/Apple Music-regels. Categorie wordt nu ook via het URL-pad herkend
(`/tv-show/` → tv, `/movie/` → films), zelfde patroon als TMDB. Geen canonieke bron gekoppeld
(resolve-work.ts) omdat JustWatch zelf geen ID-systeem is dat overeenkomt met TMDB — dit blijft
tier 2 (categorie + schone titel), maar dat is al een verbetering t.o.v. de rommelige titel.

## Losse nummers

| Bron | Categorie-detectie | Canonieke match |
|---|---|---|
| Spotify (track-link) | ✅ padherkenning (`/track/` i.p.v. `/album/`) | ✅ MusicBrainz (recording search) |

Getest met: Spotify-tracklink naar "Bohemian Rhapsody" → categorie "songs", titel + artiest
(Queen) correct, cover via Cover Art Archive. Jaar komt niet altijd mee (MusicBrainz vult
`first-release-date` niet op elke recording in) — blijft dan leeg en bewerkbaar, geen foute
waarde.

## Podcasts

| Bron | Categorie-detectie | Canonieke match |
|---|---|---|
| Apple Podcasts | ✅ hostname | ✅ iTunes Search API (geen key nodig) |
| Spotify (show/episode-link) | ✅ padherkenning | ✅ **opgelost deze ronde** — zie hieronder |
| Pocket Casts | ✅ hostname toegevoegd | ✅ getest: `pocketcasts.com/podcast/this-american-life/<uuid>` → og:type is generiek `"website"` (geen signaal), maar og:title is al de schone show-naam → hostname-regel toegevoegd, iTunes-match correct |

Getest met: Apple Podcasts-link naar "This American Life" → categorie "podcasts", titel + cover
correct. **Let op:** het jaarveld laten we bewust leeg bij podcasts — iTunes' `releaseDate` voor
een show is de datum van de laatste aflevering, niet de startdatum, en dat als "jaar" tonen zou
actief misleidend zijn geweest (kwam eerst naar boven als bug: toonde "2026").

### Spotify-podcasts: bug gevonden en opgelost

Het probleem zat niet in de resolver (`resolveWork("podcasts", title)` → `resolvePodcast()` →
iTunes Search werkte al voor elke categorie, ook podcasts van Spotify) maar in de **titel die
Spotify's eigen oEmbed-endpoint teruggeeft**: voor een `/show/<id>`-link is dat niet de
show-naam maar de titel van de nieuwste (of vastgepinde "Trailer") aflevering, en voor een
`/episode/<id>`-link is het de aflevering-titel — geen van beide is bruikbaar als zoekterm voor
een podcast-catalogus. Getest en bevestigd met drie shows (Joe Rogan Experience, Lex Fridman
Podcast, een NL true-crime-podcast): oEmbed gaf steeds `"#1767 - James Lindsay"`,
`"#2555 - Ron White"`, `"Trailer"` — nooit de show-naam.

`open.spotify.com`-pagina's zijn met een gewone fetch een lege client-rendered SPA-shell (geen
og-tags), maar Spotify serveert wél een volledig server-gerenderde pagina aan crawler-UA's
(bevestigd met een Googlebot-UA): daar staat op `/show/`-pagina's `og:title` = de echte
show-naam, en op `/episode/`-pagina's staat de show-naam in `og:description` in het patroon
`"<Show Name> · Episode"`. Nieuwe functie `fromSpotifyPodcast()` in
`src/app/api/fetch-metadata/route.ts` doet deze Googlebot-UA-fetch voor `/show/` en `/episode/`
Spotify-links vóórdat oEmbed geprobeerd wordt (oEmbed blijft de fallback als de SSR-fetch om wat
reden dan ook faalt, en blijft ongewijzigd voor `/track/`-links, die album/song-flow is niet
geraakt).

Geverifieerd end-to-end: `open.spotify.com/show/6rz0PtkHkAnjK0jwAkB7AK` → title
"De Brand in het Landhuis" → iTunes Search vindt exact deze podcast. Idem voor een JRE-episode:
`open.spotify.com/episode/2rYwwE7hcpgsDo9vRVHxAI` → title "The Joe Rogan Experience" (uit
og:description geparsed, niet de episode-titel) → iTunes Search matcht correct.

## Videos

YouTube (via `youtube.com`/`youtu.be` hostname detection) is the primary source. Unlike every
other resolver in this file, YouTube needs no fuzzy text search at all — the URL already
contains the exact video id (`watch?v=<id>`, `youtu.be/<id>`, `/shorts/<id>`), so
`resolveVideo()` in `resolve-work.ts` extracts the id and calls YouTube's no-auth oEmbed
endpoint directly, registering a `works` row with `source: 'youtube'`, `source_id: <video id>`,
`match_confidence: 'high'` — always high, since there's no ambiguity to score. This is the
first genuinely ID-based canonical route in this codebase (see the "Match confidence" section
below for why IMDb/Discogs, despite also being ID-based lookups, still go through the ordinary
text-search path).

**Wiring note**: getting the video id to `resolveWork()` required passing the source `url`
through `/api/resolve-work` and `AddStamp.tsx`'s `lookUpCanonical()` call (previously only
`title`/`by`/`year` were sent, since every other resolver works from title text alone). This is
a narrow, mechanical change — a `url` field threaded through, nothing else touched.

Getest deze ronde (live tegen YouTube's oEmbed): `youtube.com/watch?v=dQw4w9WgXcQ` en
`youtu.be/dQw4w9WgXcQ` → beide geven identieke titel/artiest/thumbnail terug, `works`-rij met
`source: 'youtube'`, `match_confidence: 'high'`.

**Fallback voor andere videobronnen** (Vimeo e.d.): geen ID-resolver, maar valt nog steeds
terug op categorie-herkenning via `og:type` — elke `video.*`-og:type behalve
`video.tv_show`/`video.episode`/`video.movie` (die al naar tv/films gaan) wordt nu als
`videos` herkend in plaats van blind "films" (de oude regel ving *elke* `video.*` als films —
dat was fout voor bijvoorbeeld Vimeo's `video.other`). Niet apart getest tegen een echte
Vimeo-pagina deze ronde, maar de og:type-regel is dezelfde generieke vangnet-aanpak die al
bewezen werkt voor Deezer/YouTube Music bij albums.

## Places

Geen ID-systeem beschikbaar zoals bij YouTube — een plaatsnaam is net zo dubbelzinnig als een
albumtitel, dus `resolvePlace()` in `resolve-work.ts` gebruikt hetzelfde
`assessMatch`/similarity-patroon als songs/albums/films, tegen OpenStreetMap's Nominatim
(`nominatim.openstreetmap.org/search`, geen API-key nodig, wel een beschrijvende
`User-Agent`-header verplicht per hun gebruiksbeleid — zelfde patroon als de bestaande
MusicBrainz-calls). `match_confidence: 'high'` alleen bij een bijna-letterlijke naam-match,
verder identiek aan de rest van dit bestand.

**Categorie-detectie**: Google Maps-links zijn het voor de hand liggende eerste signaal
(`maps.google.com`-hostname, en `google.com/maps/...`/`goo.gl/maps/...`/`maps.app.goo.gl`
padherkenning — een kale `google.com`- of `goo.gl`-hostnameregel zou veel te breed zijn, dus
gescoped op het `/maps/`-pad).

**Getest deze ronde, eerlijk beperkt bevonden**: een plain server-side fetch van een Google
Maps-URL (`google.com/maps/place/Eiffel+Tower/...`) komt wél door (200, geen bot-afweer) maar
de og-tags zijn voor **elke** plaats identiek generiek: `og:title` is altijd letterlijk
`"Google Maps"`, `og:image` is een generieke statische kaart-thumbnail rond de coördinaten uit
de URL, geen plaatsnaam. Google Maps is een zware client-rendered app — de echte plaatsnaam
wordt pas door JavaScript ingevuld, wat een gewone fetch niet ziet. Dit is een **bevestigd
geblokkeerd geval**, zelfde categorie als AllMusic/RateYourMusic/StoryGraph: categorie-detectie
werkt (het wordt correct als "places" herkend), maar er is geen bruikbare titel om aan
`resolvePlace()` door te geven zonder een headless browser (bewust niet ingebouwd, zie
Bekende beperkingen). Coördinaten uit de URL zouden in theorie tegen Nominatim's reverse-geocoding
gebruikt kunnen worden, maar dat is niet gebouwd deze ronde.

**Getest tegen de live Nominatim-API** (niet gemockt): "Eiffel Tower" en "Central Park" (met
"New York" als context) → beide `high`-confidence matches. Onderweg een echte matching-beperking
gevonden: Nominatim's data heeft de Eiffel-toren zelf onder haar Franse naam staan ("Tour
Eiffel"), dus een letterlijke Engelse zoekopdracht "Eiffel Tower" matcht die kandidaat helemaal
niet (haalt de gelijkenis-drempel niet) en `resolvePlace()` valt terug op een kleine gelijknamige
berg in Alberta, Canada die wél letterlijk "Eiffel Tower" heet. Een `importance`-gewogen
tie-break (Nominatim's eigen prominentie-score, zelfde rol als de `primary-type: "Album"`-bonus
bij `resolveAlbum()`) is toegevoegd voor het geval waarin *meerdere tekstueel gelijkende*
kandidaten wedijveren, maar lost dit specifieke geval niet op — dat is een taalverschil-probleem
(vertaalde naam), niet een rangschikkingsprobleem, en blijft dus een bekende beperking i.p.v.
een verzonnen fix.

## Videogames

Datamodel (`works.source = 'igdb'`, categorie `games`) staat klaar, resolver nog niet gebouwd —
IGDB vereist een gratis Twitch-developer-app (client id + secret) die de eigenaar nog moet
aanmaken. Zodra die er is: zelfde patroon als de andere resolvers in `resolve-work.ts`.

## Essays & Dingen

Geen universele catalogus hiervoor beschikbaar (een willekeurig artikel of product heeft geen
canoniek ID-systeem zoals TMDB/MusicBrainz). Titel/afbeelding komen rechtstreeks van de
Open Graph-tags van de pagina; categorie wordt herkend via `og:type` (`article` → essays,
`product` → things). Dit blijft "tier 2", en dat is oké — er is simpelweg geen "waar record"
om tegenaan te matchen.

Getest deze ronde (allemaal `og:type: article`, categorie "essays" correct herkend):

| Bron | Resultaat |
|---|---|
| Wait But Why | ✅ `waitbutwhy.com/.../artificial-intelligence-revolution-1.html` → titel + cover schoon |
| Substack (elk blog erop) | ✅ `theremightbecupcakes.substack.com/p/...` → titel schoon, `source_label` = hostinstantie zelf (geen og:site_name, geen probleem) |
| NPR | ✅ `npr.org/2019/10/22/...` — hier zat de HTML-entity-bug (zie hieronder), nu correct: `'Parasite' Is A Genre-Bending Look At Capitalism` |
| Wikipedia | ⚠️ og:type is altijd "website", dus categorie blijft (bewust) niet herkend — zie Bekende beperkingen. Titel werd wel getoond mét " - Wikipedia"-suffix, nu gestript (zie hieronder) |
| New York Times | ❌ blokkeert (DataDome-uitdaging, 403 op elke server-side fetch, ook met browser-UA) |
| Medium | ❌ blokkeert (403 op elke server-side fetch) |
| Etsy | ❌ blokkeert (403) |
| IKEA (productpagina) | ⚠️ og:type "product" werkt in principe, maar een niet meer bestaande product-id redirect't naar een generieke "Products"-pagina — niet verder getest met een geldige id, geen bug in onze code |
| Amazon | zie bestaande beperking hieronder (audiobook-pagina's via Audible werken wél, zie Boeken-achtige noot) |
| BBC News | ✅ **deze ronde getest**: `bbc.com/news/articles/<id>` → titel + cover schoon, categorie "essays" correct |
| The Guardian | ✅ **deze ronde getest**: `theguardian.com/books/.../swan-song-...` → dit is de link waarmee de "by"-split-bug (zie hierboven) gevonden werd; na de fix komt de titel schoon binnen |
| Uncommon Goods | ⚠️ geteste product-URL bleek niet meer te bestaan (geen og-tags terug, alleen og:site_name) — niet verder onderzocht, waarschijnlijk gewoon een verlopen productpagina, geen bevestigde blokkade |
| bol.com | ❌ blokkeert (403), zelfde categorie als Etsy/Medium |

**Extra gevonden**: Audible (`audible.com/pd/...`) wordt niet expliciet in de hostname-map
gedekt, maar werkt al via de `og:type: "book"`-vangnet-regel → categorie "books", titel schoon.
Audiobook-vermeldingen zijn dus al bruikbaar zonder extra werk.

## Deze ronde: bug gevonden — "by"-split corrumpeerde essay/artikel-titels

De Bandcamp/Apple Music-regel die `"Album, by Artist"` splitst in titel + artiest liep
**ongescoped over elke bron heen**, dus ook over essays/artikelen. Gevonden via een echte
Guardian-link: `theguardian.com/books/2026/sep/22/swan-song-charles-spencer-review-...` → og:title
`"Swan Song by Charles Spencer review – a furious exercise in score-settling by Diana's
brother"` werd fout gesplitst in titel `"Swan Song"` + by `"Charles Spencer review – ..."` — het
woord "by" komt gewoon veel voor in normaal Engels proza (recensietitels, artikelkoppen), niet
alleen in Bandcamp/Apple Music's titelformaat. De split is nu gescoped tot alleen bekende
albumbronnen (`bandcamp.com`-hostname, `music.apple.com`-hostname, of de Bandcamp
generator-meta-tag) — elders blijft de titel ongesplitst. Geverifieerd: Guardian-titel blijft nu
intact, Bandcamp/Apple Music/Bandcamp-custom-domain blijven correct splitsen (alle drie opnieuw
getest na de fix).

## Deze ronde: generieke titel-fixes

- **HTML-entities**: `decodeHtmlEntities()` decodeerde alleen `&amp; &quot; &#39; &lt; &gt;`
  letterlijk. Veel CMS'en (WordPress, Substack, NPR) coderen leestekens als numerieke entities
  (`&#039;`, `&#8217;`) in plaats van de named-vorm — kwam als `&#039;Parasite&#039;` letterlijk
  in de titel terecht. Nu generiek: decimale (`&#\d+;`) én hex (`&#x[0-9a-f]+;`) numerieke
  entities via `String.fromCodePoint`, plus een paar veelvoorkomende named entities
  (`&apos; &nbsp; &ndash; &mdash;`) die nog ontbraken.
- **Wikipedia-titel-suffix**: og:title eindigt altijd op `" - Wikipedia"` (geen og:site_name om
  dit generiek te stripping, zelfde situatie als Metacritic) — nu hardcoded gestript, zelfde
  patroon als de Metacritic-regel. Wikipedia's categorie blijft bewust niet herkend (zie
  beperkingen), maar de titel wordt overal getoond waar fetch-metadata's output gebruikt wordt
  (ook tier-3 fallback), dus de opschoning heeft nog steeds waarde.

## Bekende beperkingen

- **IMDb**: blokkeert server-side scraping volledig (lege 202-response). Opgelost via TMDB's
  find-by-imdb-id endpoint in plaats van IMDb's eigen HTML te lezen.
- **Discogs**: zelfde probleem (Cloudflare-uitdaging, 403). Opgelost via Discogs' eigen publieke
  release-API (geen key nodig) in plaats van de paginatekst te lezen.
- **Sites met alleen JS-gerenderde content** (geen server-side og-tags): worden niet ondersteund
  zonder een headless browser, wat we bewust niet hebben ingebouwd (te zwaar voor de winst).
- **AllMusic, RateYourMusic, StoryGraph**: geven een 403 (Cloudflare-achtige bot-afweer) terug op
  elke server-side fetch, ook met een realistische browser User-Agent. Geen van drieën heeft een
  publieke, sleutelloze API zoals Discogs — dus in tegenstelling tot IMDb/Discogs was er geen
  directe-API-omweg te bouwen binnen deze sessie. Categorie-detectie werkt niet voor deze bronnen
  (AllMusic's hostname-mapping blijft staan voor het geval dit ooit verandert, RateYourMusic is nu
  ook als hostname toegevoegd zodat category-detectie tenminste al klaarstaat).
- **Last.fm**: zelfde bot-afweer (`"Client Challenge"`-pagina). Last.fm heeft wél een publieke
  REST-API (`ws.audioscrobbler.com`), maar die vereist een gratis maar geregistreerde API-key —
  niet iets wat zonder mensencontact aan te maken was in deze sessie. Als iemand die key aanmaakt,
  is een `fromLastfmId`-achtige resolver (album+artiest uit het pad, `album.getInfo`-call) een
  kleine toevoeging.
- **Amazon (boekpagina's)**: reageert met 200 en een volledige HTML-pagina, maar zonder og-tags —
  het is Amazon's JS-shell/bot-afweerpagina, niet de echte productpagina. Amazon heeft een
  Product Advertising API, maar die vereist een Amazon Associates-account en keys die we niet
  hebben; niet op te lossen zonder die registratie.
- **StoryGraph**: 403 op elke server-side fetch, geen publieke API bekend.
- **New York Times**: blokkeert met een DataDome-uitdaging (403), ook met een realistische
  browser-UA. Geen sleutelloze publieke API bekend voor artikelmetadata.
- **Medium, Etsy, bol.com**: allemaal 403 op elke server-side fetch, zelfde categorie probleem als
  AllMusic/RateYourMusic/StoryGraph — geen workaround binnen deze sessie gevonden.
- **Trakt.tv**: geen bot-blokkade (200, en `og:type` is zelfs correct `"video.tv_show"` per
  pagina), maar Trakt is een client-rendered SPA die voor **elke** pagina hetzelfde generieke
  `og:title`/`og:description` server-side rendert (`"Trakt Web: Track Your Shows & Movies"`) —
  de echte titel wordt pas door JavaScript ingevuld, wat een gewone fetch niet ziet. Categorie
  zou dus wel herkend kunnen worden, maar zonder bruikbare titel heeft dat geen zin — niet
  toegevoegd. Zou alleen op te lossen zijn met een headless browser (bewust niet ingebouwd, zie
  hierboven).
- **TV Time**: `tvtime.com` is dit jaar stopgezet — elke pagina (getest met een oude
  Breaking Bad-URL) redirect't naar een "Thank You"-afscheidspagina. Geen bug, de dienst bestaat
  gewoon niet meer.
- **Wikipedia (film/boek/album-pagina's)**: og:type is altijd `"website"` ongeacht het onderwerp
  van het artikel — Wikipedia host alle categorieën onder één domein, dus er is geen betrouwbare
  hostname- of og:type-regel die "dit is een film" van "dit is een boek" onderscheidt zonder de
  paginatekst te parsen (bv. op `"(2019 film)"` vs. `"(novel)"` in de titel, wat fragiel is en
  makkelijk foutief positieve categorieën oplevert). Bewust niet toegevoegd; blijft bij "niet
  herkend → handmatig invullen".
- **Google Maps**: 200, geen bot-afweer, maar `og:title` is voor elke plaats letterlijk
  `"Google Maps"` en `og:image` een generieke kaart-thumbnail — geen bruikbare titel via een
  gewone server-side fetch. Client-rendered app, zelfde categorie beperking als Trakt.tv. Zie
  de "Places"-sectie hierboven voor het volledige testresultaat.
- **Titel-ambiguïteit**: een titel als "Parasite" bestaat meerdere keren in elke catalogus. We
  geven het gedetecteerde jaar altijd mee als filter om dit te verkleinen; zonder jaar kan een
  match soms fout gaan. Bij twijfel toont de UI wél een editable resultaat vóór opslaan — nooit
  blind opgeslagen.

## Match confidence

Elke rij in `works` krijgt nu een `match_confidence` (`'high'` | `'low'` | `null`,
`supabase/schema.sql`). Dit bestaat puur om een toekomstige "match mensen op smaak"-feature
(nu nog een placeholder in `/explore`) alleen te laten leunen op matches waarvan we vrij zeker
zijn — niet om iets aan de huidige flow te veranderen. Elke resolver in `resolve-work.ts`
bepaalt dit zelf, op basis van hoe goed de teruggekregen titel (en artiest/auteur, waar van
toepassing) overeenkomt met de zoekopdracht:

- **`high`** — titel- én artiest/auteur-vergelijking zitten allebei boven een hoge
  gelijkenis-drempel (≥0.92 resp. ≥0.8, zie `HIGH_TITLE_SIMILARITY`/`HIGH_BY_SIMILARITY` in
  `resolve-work.ts`) — in de praktijk zo goed als een letterlijke match.
- **`low`** — een match die is geaccepteerd (titel ≥0.55, artiest/auteur ≥0.35) maar niet aan
  de `high`-lat voldoet: de gewone fuzzy tekst-zoekopdracht-hit. Dit blijft vandaag de meeste
  rijen, en dat is prima — de rij is nog steeds bruikbaar om te tonen, alleen (nog) niet
  bruikbaar als bewijs voor "deze twee mensen houden van hetzelfde nummer".
- **`null`** (alleen op rijen van vóór deze kolom) — onbekend, behandel hetzelfde als `low`.

Belangrijk: er is geen aparte hoge-vertrouwen-route via directe ID-lookups. `fromImdbId()` en
`fromDiscogsId()` in `fetch-metadata/route.ts` lezen alleen de titel/jaar van de bron-URL uit
(scraping-laag) — de daadwerkelijke `works`-rij ontstaat pas in `resolve-work/route.ts`, dat
altijd via `resolveWork()` — dus altijd via tekst-zoekopdracht — gaat, ook voor een IMDb- of
Discogs-link. Dat is geen bug: omdat de titel dan al schoon en exact is (rechtstreeks van
TMDB/Discogs zelf), scoort die tekst-zoekopdracht vrijwel altijd `high` vanzelf via dezelfde
gelijkenis-toets. Een losse ID-gebaseerde kortere weg zou dus weinig extra betrouwbaarheid
toevoegen, maar wel een tweede code-pad zijn om te onderhouden.

Als je een `works`-tabel opzoekt: `null`/`low` betekent niet "fout", het betekent alleen "niet
bevestigd genoeg om blind op te matchen". Toon deze rijen gewoon normaal aan de gebruiker —
alleen een toekomstige matching-feature moet filteren op `match_confidence = 'high'`.

### Deze ronde: songs-matching verbeterd

`resolveSong()` pakte voorheen blind het eerste MusicBrainz-recording-resultaat (`limit=1`).
MusicBrainz' recording-search geeft voor bekende nummers regelmatig een live-opname, remix of
video als eerste (of gelijk gescoorde) hit terug in plaats van de studio-opname — getest en
bevestigd met "Blinding Lights" / The Weeknd, waar meerdere kandidaten (waaronder een
livevideo van 2024) op score 100 gelijk staan.

Nu: `limit=8`, elke kandidaat wordt gescoord op titel- én artiestgelijkenis (Dice-coëfficiënt
over karakter-bigrams, `similarity()`), met een strafpunt voor titels/disambiguaties die
"live", "remix", "karaoke", "cover version", "demo" e.d. bevatten en een kleine bonus voor een
bekende releasedatum. De hoogst scorende kandidaat die de gelijkenis-drempel haalt wint; haalt
niets de drempel, dan levert `resolveSong()` `null` op (geen canonieke match) in plaats van een
gok. Dezelfde gelijkenis-toets is nu ook toegepast op alle andere resolvers (films, tv, albums,
boeken, podcasts) — voorheen namen die ook zonder enige check het eerste resultaat.

Onderweg ook een echte bug gevonden en gefixt in `resolveAlbum()`: MusicBrainz' release-group-
zoekopdracht voor "Random Access Memories" / Daft Punk geeft *drie* release-groups terug op
dezelfde topscore — het echte album, een "(Vanderway Edit)"-single en een "(drumless
edition)" — en `limit=1` pakte willekeurig een van de drie (in de praktijk vaak niet het echte
album). Zelfde scoring-aanpak als songs, plus een bonus voor `primary-type: "Album"` zonder
`secondary-types` en voor een titel die *letterlijk* (niet alleen na haakjes-strippen) gelijk
is aan de zoekopdracht. Geverifieerd: nu altijd het echte album.

Getest tegen de live MusicBrainz/TMDB/OpenLibrary-API's (niet gemockt): "Bohemian Rhapsody"/
Queen, "Hurt"/Johnny Cash (beroemde cover — moet wél matchen, dit is de erkende opname), "Blinding
Lights"/The Weeknd, "Wonderwall"/Oasis, "Yesterday"/The Beatles, "Creep"/Radiohead, "Africa"/
Toto — allemaal `high`-confidence correcte matches. Een onzin-titel + onzin-artiest gaf terecht
`NO MATCH`. Een bestaande titel met een verkeerd gekoppelde artiest ("Bohemian Rhapsody"/Ed
Sheeran) gaf ook terecht `NO MATCH` in plaats van het Queen-nummer alsnog toe te wijzen aan de
verkeerde artiestcombinatie. Films (Parasite/2019, The Matrix/1999), tv (Breaking Bad/2008) en
boeken (Dune/Frank Herbert) bleven allemaal correct en `high`-confidence na de wijziging —
geen regressie op de bestaande hoge-kwaliteit matches.

### Non-canonical categories: exact-link matching

Categorieën zonder canonieke database (essays, things, en elke categorie die nog geen resolver
heeft — nu ook places/videos totdat hun resolvers volledig dekkend zijn) hadden tot nu toe
helemaal geen manier om te herkennen dat twee mensen "hetzelfde ding" toevoegden: geen
`work_id`, geen `match_confidence`, niks. De product owner's expliciete keuze hiervoor: **de
enige manier waarop twee items in zo'n categorie ooit als match mogen tellen, is een exact
gelijke link** (na redelijke normalisatie) — geen fuzzy titel-matching, om de simpele reden dat
er geen catalogus is om een titel tegenaan te controleren, dus elke fuzzy match hier zou pure
gok zijn. Lagere hitrate dan fuzzy matching, maar kan per ontwerp nooit een fout-positieve match
opleveren — dezelfde "geen match is beter dan een foute match"-filosofie als de
`match_confidence`-kolom hierboven.

**Implementatie**: `normalizeUrl()` in `src/lib/normalize-url.ts` strip het `http`/`https`-
schemaverschil, een `www.`-prefix, een trailing slash, en bekende tracking-queryparams
(`utm_*`, `ref`, `fbclid`, `gclid`, `mc_cid`, `mc_eid`, `igshid`) — nooit pad of overige
queryparams, die de daadwerkelijke resource kunnen veranderen. Geeft `null` terug voor alles
wat niet als geldige `http(s)`-URL parseert. Het resultaat wordt opgeslagen in een nieuwe
`normalized_url text`-kolom op `public.items` (`supabase/schema.sql`), gevuld in `addItem()`
(`src/app/[handle]/actions.ts`) wanneer een item met een link wordt toegevoegd. `updateItem()`
heeft geen `url`-veld in zijn formulier (de link is niet bewerkbaar via de edit-flow), dus daar
was niets te wiren — als dat ooit verandert, moet dezelfde `normalizeUrl()`-aanroep daar ook bij.

Getest: `https://www.example.com/article/` en `http://example.com/article?utm_source=x` geven
allebei `example.com/article` terug — bevestigd identiek na normalisatie. Een betekenisvol
andere URL (`?id=5`) blijft correct apart (`example.com/article?id=5`).

**Belangrijk — dit is expres géén onderdeel van `works`/`match_confidence`**: die tabel is voor
canonieke-catalogus-identiteit (twee mensen linken "hetzelfde MusicBrainz-album"), dit is voor
ruwe-link-identiteit (twee mensen linken letterlijk dezelfde URL). Twee rijen in `items` met
dezelfde niet-lege `normalized_url` zijn een bevestigde match, punt — geen scoring, geen
drempel. Dit is puur voorbereidend werk: er is nog geen feature die deze kolom daadwerkelijk
gebruikt om "mensen die hetzelfde linkten" te tonen (zelfde status als `match_confidence` zelf
toen dat werd toegevoegd) — alleen de garantie dat de data er correct en consistent inzit voor
wanneer die feature gebouwd wordt.

## Uitbreiden

Nieuwe bron toevoegen aan de categorie-herkenning: `HOSTNAME_CATEGORY` in
[`src/app/api/fetch-metadata/route.ts`](../src/app/api/fetch-metadata/route.ts). Nieuwe
catalogus-bron toevoegen (naast TMDB/MusicBrainz/Open Library): nieuwe `resolve*`-functie in
[`src/lib/resolve-work.ts`](../src/lib/resolve-work.ts) plus een nieuwe waarde in de
`source`-check van de `works`-tabel (`supabase/schema.sql`).
