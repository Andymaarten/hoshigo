-- All migrations from the night of 2026-09-24, in order. Safe to run more than once.
-- Paste this whole file into the Supabase SQL editor and press Run.

-- ===== 2026-09-24-kaito.sql =====
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

-- ===== 2026-09-24-kaito-places.sql =====
-- Places keep OpenStreetMap's structure: a type ("Bar", "Museum") and a location.
-- Safe to run more than once. Paste into the Supabase SQL editor.
-- Before this runs the app keeps working with the combined "by" line ("Bar · Amsterdam"),
-- which it still writes alongside the new columns.

alter table public.items add column if not exists place_type text;
alter table public.items add column if not exists city text;
alter table public.items add column if not exists country text;

alter table public.works add column if not exists place_type text;
alter table public.works add column if not exists city text;
alter table public.works add column if not exists country text;

-- Backfill: split existing place items' "by" line where it has exactly the
-- "Type · City" shape. Rows with another shape keep their by line and show it as location.
update public.items i
set place_type = split_part(i.by, ' · ', 1),
    city = split_part(i.by, ' · ', 2)
from public.categories c
where c.id = i.category_id
  and c.slug = 'places'
  and i.place_type is null
  and i.city is null
  and i.by like '% · %'
  and i.by not like '% · % · %';

update public.works w
set place_type = split_part(w.by, ' · ', 1),
    city = split_part(w.by, ' · ', 2)
where w.source = 'nominatim'
  and w.place_type is null
  and w.city is null
  and w.by like '% · %'
  and w.by not like '% · % · %';

-- Place items from before round 6 have "City, Country" as by (no type). Put that in city.
update public.items i
set city = i.by
from public.categories c
where c.id = i.category_id
  and c.slug = 'places'
  and i.place_type is null
  and i.city is null
  and i.by is not null
  and i.by not like '% · %';

-- ===== 2026-09-24-hana.sql =====
-- Pinning: at most one pinned listing per category per person, always shown first.
-- Safe to run more than once. Paste into the Supabase SQL editor.

alter table public.items add column if not exists pinned boolean not null default false;

create unique index if not exists items_one_pinned_per_category
  on public.items (profile_id, category_id)
  where pinned;

-- Pin (or unpin) one of your own listings. Unpinning the other listing in that category and
-- pinning this one happen in one transaction, so the unique index never sees two pins.
create or replace function public.pin_item(p_item uuid, p_pin boolean default true)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  cat int;
begin
  if me is null then raise exception 'not logged in'; end if;
  select category_id into cat from public.items where id = p_item and profile_id = me;
  if not found then return false; end if;
  if p_pin then
    update public.items set pinned = false
    where profile_id = me and category_id = cat and pinned and id <> p_item;
  end if;
  update public.items set pinned = p_pin where id = p_item and profile_id = me;
  return true;
end;
$$;

revoke execute on function public.pin_item(uuid, boolean) from anon;

-- The public window (what non-friends see) is the first 5 in the order the profile shows:
-- the pinned listing first, then newest. So a pin takes one of the 5 places and is always
-- visible; it never adds a sixth.
create or replace function public.item_in_public_window(p_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  -- A private profile has no public window at all, so this can't be used to probe it.
  select coalesce((select not p.is_private from public.items t join public.profiles p on p.id = t.profile_id where t.id = p_id), false)
    and (
      select count(*) < 5 from public.items t join public.items i
        on i.profile_id = t.profile_id and i.category_id = t.category_id
       and (
         (i.pinned and not t.pinned)
         or (i.pinned = t.pinned and (i.created_at, i.id) > (t.created_at, t.id))
       )
      where t.id = p_id
    );
$$;

-- Verification (run after the migration):
--   select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'items';
-- Exactly one SELECT policy should exist: "items are visible to owner, friends, or latest 5".
--   select proname from pg_proc where proname in ('pin_item', 'item_in_public_window');

-- ===== 2026-09-24-sora.sql =====
-- Sora, round 3: invite link previews and the feedback tab. Safe to run more than once.

-- Link previews of an invite resolve the secret token to the inviter's handle only;
-- everything else shown comes from that person's public page.
create or replace function public.invite_preview_handle(invite_token text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.handle
  from public.friend_invites i join public.profiles p on p.id = i.profile_id
  where i.token = invite_token;
$$;
revoke execute on function public.invite_preview_handle(text) from public;
grant execute on function public.invite_preview_handle(text) to anon, authenticated;

-- Messages from the "feedback?" tab. Anyone logged in can add their own; nobody can read
-- them through the API (the owner reads them in the Supabase dashboard or by email).
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  message text not null check (char_length(message) between 1 and 4000),
  page text,
  user_agent text
);

alter table public.feedback enable row level security;

drop policy if exists "people add their own feedback" on public.feedback;
create policy "people add their own feedback" on public.feedback
  for insert to authenticated with check (auth.uid() = user_id);
