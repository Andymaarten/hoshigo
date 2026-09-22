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
| Discogs | ✅ hostname | ✅ resolved direct via Discogs' publieke API (site zelf blokkeert scraping net als IMDb, zelfde Cloudflare-uitdaging) |
| Apple Music | ✅ hostname | ✅ getest: `music.apple.com/us/album/random-access-memories/617154241` → og:title `"Random Access Memories by Daft Punk on Apple Music"`, `" on Apple Music"`-suffix wordt gestript vóór de bestaande "X, by Y"-split → MusicBrainz-match op titel+artiest correct |
| MusicBrainz zelf | ✅ hostname | ✅ (uiteraard) |
| AllMusic | ✅ hostname | ❌ blokkeert server-side fetch (403), geen publieke API gevonden — zie beperkingen |
| RateYourMusic | ✅ hostname toegevoegd | ❌ blokkeert server-side fetch (403 Cloudflare) — zie beperkingen |
| Last.fm | ✅ hostname toegevoegd | ❌ blokkeert server-side fetch ("Client Challenge"); Last.fm heeft wél een publieke API maar die vereist een gratis API-key + registratie die we hier niet konden aanmaken — zie beperkingen |

## Boeken

| Bron | Categorie-detectie | Canonieke match |
|---|---|---|
| Goodreads | ✅ hostname | ✅ Open Library (titel+auteur search) |
| Open Library zelf | ✅ hostname | ✅ |
| Google Books | ✅ hostname toegevoegd (was al gedekt door og:type "book", nu ook als vangnet in de hostname-map) | ✅ getest: `books.google.com/books?id=...` → og:type `"book"`, og:title schoon → Open Library-match correct |
| Amazon (boekpagina's) | ❌ niet toegevoegd | server-side fetch krijgt een 200 maar een lege bot-afweerpagina zonder og-tags terug (geen "Robot Check"-tekst zoals vroeger, gewoon een JS-shell) — zie beperkingen |
| StoryGraph | ❌ niet toegevoegd | blokkeert server-side fetch (403) — zie beperkingen |

## TV-series

| Bron | Categorie-detectie | Canonieke match |
|---|---|---|
| IMDb | ✅ hostname, onderscheidt film vs. serie via TMDB's `/find` resultaat | ✅ TMDB (direct via tt-id) |
| TMDB zelf | ✅ hostname + pad (`/tv/` vs `/movie/`) | ✅ |
| Letterboxd | — geen tv-content op Letterboxd, niet van toepassing | — |

Getest met: IMDb-link naar Breaking Bad → categorie "tv", titel + maker (Vince Gilligan) +
jaar + poster correct via TMDB.

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
| Spotify (show/episode-link) | ✅ padherkenning | resolver nog niet aangesloten voor podcasts via Spotify, categorie wordt wel goed herkend |

Getest met: Apple Podcasts-link naar "This American Life" → categorie "podcasts", titel + cover
correct. **Let op:** het jaarveld laten we bewust leeg bij podcasts — iTunes' `releaseDate` voor
een show is de datum van de laatste aflevering, niet de startdatum, en dat als "jaar" tonen zou
actief misleidend zijn geweest (kwam eerst naar boven als bug: toonde "2026").

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
- **Wikipedia (film/boek/album-pagina's)**: og:type is altijd `"website"` ongeacht het onderwerp
  van het artikel — Wikipedia host alle categorieën onder één domein, dus er is geen betrouwbare
  hostname- of og:type-regel die "dit is een film" van "dit is een boek" onderscheidt zonder de
  paginatekst te parsen (bv. op `"(2019 film)"` vs. `"(novel)"` in de titel, wat fragiel is en
  makkelijk foutief positieve categorieën oplevert). Bewust niet toegevoegd; blijft bij "niet
  herkend → handmatig invullen".
- **Titel-ambiguïteit**: een titel als "Parasite" bestaat meerdere keren in elke catalogus. We
  geven het gedetecteerde jaar altijd mee als filter om dit te verkleinen; zonder jaar kan een
  match soms fout gaan. Bij twijfel toont de UI wél een editable resultaat vóór opslaan — nooit
  blind opgeslagen.

## Uitbreiden

Nieuwe bron toevoegen aan de categorie-herkenning: `HOSTNAME_CATEGORY` in
[`src/app/api/fetch-metadata/route.ts`](../src/app/api/fetch-metadata/route.ts). Nieuwe
catalogus-bron toevoegen (naast TMDB/MusicBrainz/Open Library): nieuwe `resolve*`-functie in
[`src/lib/resolve-work.ts`](../src/lib/resolve-work.ts) plus een nieuwe waarde in de
`source`-check van de `works`-tabel (`supabase/schema.sql`).
