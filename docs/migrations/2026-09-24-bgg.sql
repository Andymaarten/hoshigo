-- BoardGameGeek as a games catalog ('bgg'), next to Wikidata. Safe to run more than once.
-- Before this runs, BGG games still save, just without a catalog link.

alter table public.works drop constraint if exists works_source_check;
alter table public.works add constraint works_source_check
  check (source in ('tmdb', 'tmdb_tv', 'musicbrainz', 'openlibrary', 'itunes', 'igdb', 'youtube', 'nominatim', 'wikidata', 'bgg'));
