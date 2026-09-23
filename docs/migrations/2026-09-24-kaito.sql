-- Round 6 (Kaito): games from Wikidata, places' own websites.
-- Safe to run more than once. Paste into the Supabase SQL editor.
-- The app works before this runs: games then save without a catalog link, and places
-- don't get their website as link.

alter table public.works drop constraint if exists works_source_check;
alter table public.works add constraint works_source_check
  check (source in ('tmdb', 'tmdb_tv', 'musicbrainz', 'openlibrary', 'itunes', 'igdb', 'youtube', 'nominatim', 'wikidata'));

alter table public.works add column if not exists website text;


-- ---------------------------------------------------------------------------------------
-- OPTIONAL, READ BEFORE RUNNING: merging duplicate works
-- ---------------------------------------------------------------------------------------
-- Translations of one book or film already resolve to one work (Open Library work keys,
-- TMDB ids; tested with 10 books and 4 films, see docs/input-test-matrix.md "Round 6").
-- Duplicates can still exist from earlier versions of the matcher, e.g. an Open Library
-- *edition* or a second OL work for the same book, or places stored under Nominatim's
-- place_id before this round (now the stable OSM id like N123456).
--
-- Step 1: look at candidates. Same category, same maker (normalised), and either the same
-- year or a very similar title. Nothing is changed by this query.
--
-- select a.category_id, a.by, a.id as keep_id, a.title as keep_title, a.source_id as keep_source_id,
--        b.id as drop_id, b.title as drop_title, b.source_id as drop_source_id,
--        (select count(*) from public.items i where i.work_id = b.id) as items_on_drop
-- from public.works a
-- join public.works b
--   on a.category_id = b.category_id
--  and a.source = b.source
--  and a.id < b.id
--  and lower(coalesce(a.by, '')) = lower(coalesce(b.by, ''))
--  and coalesce(a.by, '') <> ''
--  and (a.year = b.year or lower(a.title) = lower(b.title))
-- order by a.category_id, a.by;
--
-- Step 2: for each pair you agree is the same work, move the items and remove the
-- duplicate. Replace the two ids. Run one pair at a time.
--
-- begin;
--   update public.items set work_id = '<keep_id>' where work_id = '<drop_id>';
--   delete from public.works where id = '<drop_id>';
-- commit;
