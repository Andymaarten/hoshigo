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
| Rotten Tomatoes | — nog niet toegevoegd | zou via titel+jaar-search moeten werken, niet getest |
| Metacritic | — nog niet toegevoegd | idem |

## Albums

| Bron | Categorie-detectie | Canonieke match |
|---|---|---|
| Spotify | ✅ hostname + eigen oEmbed | ✅ MusicBrainz (titel+artiest search) |
| Bandcamp | ✅ hostname | ✅ MusicBrainz — titel/artiest gesplitst uit Bandcamp's "Album, by Artist"-titelformaat |
| Discogs | ✅ hostname | ✅ resolved direct via Discogs' publieke API (site zelf blokkeert scraping net als IMDb, zelfde Cloudflare-uitdaging) |
| Apple Music | ✅ hostname | ✅ MusicBrainz search (nog niet los getest) |
| MusicBrainz zelf | ✅ hostname | ✅ (uiteraard) |
| AllMusic | ✅ hostname | niet los getest |
| RateYourMusic | — nog niet toegevoegd | zou via generieke og:type "music.album" moeten werken |
| Last.fm | — nog niet toegevoegd | idem |

## Boeken

| Bron | Categorie-detectie | Canonieke match |
|---|---|---|
| Goodreads | ✅ hostname | ✅ Open Library (titel+auteur search) |
| Open Library zelf | ✅ hostname | ✅ |
| Amazon (boekpagina's) | — nog niet toegevoegd | zou via og:type "book" moeten werken, niet getest |
| StoryGraph | — nog niet toegevoegd | zou via og:type "book" moeten werken |
| Google Books | — nog niet toegevoegd | eigen API bestaat, nog niet aangesloten |

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
