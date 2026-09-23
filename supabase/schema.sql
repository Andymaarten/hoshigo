-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique not null check (handle ~ '^[a-z0-9_-]{2,30}$'),
  display_name text,
  bio text,
  theme text not null default 'default' check (theme in ('default', 'duotone', 'noir', 'sage', 'blush')),
  created_at timestamptz not null default now()
);

-- other accounts a person links from their bio (Instagram, Substack, LinkedIn, etc.) —
-- kept as a small JSON array rather than its own table since it's just a handful of
-- {platform, handle, url} entries per profile with no cross-referencing needed.
alter table public.profiles add column if not exists social_links jsonb not null default '[]';

-- a private profile is hidden from everyone except its owner. There's no real
-- friends system yet, so "visible to friends" can't be enforced today — this
-- starts conservative (owner-only) rather than accidentally public; loosen the
-- RLS policies below to also allow accepted friends once that table exists.
alter table public.profiles add column if not exists is_private boolean not null default false;

create table if not exists public.categories (
  id serial primary key,
  slug text unique not null,
  label text not null,
  sort_order int not null default 0
);

insert into public.categories (slug, label, sort_order) values
  ('films', 'films', 1),
  ('albums', 'albums', 2),
  ('books', 'books', 3),
  ('essays', 'essays', 4),
  ('things', 'things', 5),
  ('tv', 'tv', 6),
  ('songs', 'songs', 7),
  ('podcasts', 'podcasts', 8),
  ('games', 'games', 9),
  ('places', 'places', 10),
  ('videos', 'videos', 11)
on conflict (slug) do nothing;

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  category_id int not null references public.categories (id),
  title text not null,
  by text,
  year int,
  url text,
  image_url text,
  note text,
  featured boolean not null default false,
  source_label text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Normalized form of `url`, used only for exact-link identity in categories with no
-- canonical database (essays, things, etc.) — see docs/sources.md "Non-canonical
-- categories: exact-link matching". Two items with the same non-null normalized_url are
-- a confirmed same-link match; this is intentionally separate from works/match_confidence,
-- which is for canonical-catalog identity, not raw-link identity.
alter table public.items add column if not exists normalized_url text;

-- only one featured item per profile per category
create unique index if not exists items_one_featured_per_category
  on public.items (profile_id, category_id)
  where featured;

-- canonical catalog: the "true" record for a film/album/book, resolved against an
-- authoritative source (TMDB, MusicBrainz, Open Library) so the same album added via
-- Bandcamp, Discogs or Apple Music all point at one row instead of three unrelated ones.
create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  category_id int not null references public.categories (id),
  -- tmdb = films, tmdb_tv = TV shows (kept separate: TMDB's movie and TV ids are
  -- independent numeric namespaces and can collide, e.g. movie 100 != tv 100).
  -- musicbrainz covers both albums (release-group MBID) and songs (recording MBID) —
  -- MBIDs are globally unique UUIDs regardless of entity type, so no collision risk there.
  source text not null check (source in ('tmdb', 'tmdb_tv', 'musicbrainz', 'openlibrary', 'itunes', 'igdb', 'youtube', 'nominatim')),
  source_id text not null,
  title text not null,
  by text,
  year int,
  image_url text,
  created_at timestamptz not null default now(),
  unique (source, source_id)
);

-- widen the source check for databases created before tv/songs/podcasts/games existed
alter table public.works drop constraint if exists works_source_check;
alter table public.works add constraint works_source_check
  check (source in ('tmdb', 'tmdb_tv', 'musicbrainz', 'openlibrary', 'itunes', 'igdb', 'youtube', 'nominatim'));

alter table public.items add column if not exists work_id uuid references public.works (id);

-- How much to trust that this row really is the work it claims to be, so a future
-- "match people by taste" feature can read only the rows worth basing anything on instead
-- of silently inheriting whatever the text-search resolver happened to guess. 'high' = an
-- essentially unambiguous match (near-exact title/artist agreement, or a direct ID lookup);
-- 'low' = an ordinary fuzzy text-search hit, which is most rows today. Left null on rows
-- created before this column existed — treat null the same as 'low' (unknown, don't trust
-- it for matching) rather than assuming it means anything better.
alter table public.works add column if not exists match_confidence text
  check (match_confidence in ('high', 'low'));

create table if not exists public.personalize_blocks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('text', 'image')),
  content text not null,
  x int not null default 0,
  y int not null default 0,
  w int not null default 190,
  h int not null default 100,
  created_at timestamptz not null default now()
);

-- keep a profile row in sync with auth.users automatically
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, handle)
  values (new.id, 'user-' || substr(new.id::text, 1, 8));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.personalize_blocks enable row level security;
alter table public.works enable row level security;

drop policy if exists "works are publicly readable" on public.works;
create policy "works are publicly readable" on public.works
  for select using (true);
drop policy if exists "any logged-in user can register a work" on public.works;
create policy "any logged-in user can register a work" on public.works
  for insert with check (auth.uid() is not null);

drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable" on public.profiles
  for select using (not is_private or auth.uid() = id);
drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "categories are publicly readable" on public.categories;
create policy "categories are publicly readable" on public.categories
  for select using (true);

drop policy if exists "items are publicly readable" on public.items;
create policy "items are publicly readable" on public.items
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = items.profile_id and (not p.is_private or auth.uid() = p.id)
    )
  );
drop policy if exists "users can insert their own items" on public.items;
create policy "users can insert their own items" on public.items
  for insert with check (auth.uid() = profile_id);
drop policy if exists "users can update their own items" on public.items;
create policy "users can update their own items" on public.items
  for update using (auth.uid() = profile_id);
drop policy if exists "users can delete their own items" on public.items;
create policy "users can delete their own items" on public.items
  for delete using (auth.uid() = profile_id);

drop policy if exists "personalize blocks are publicly readable" on public.personalize_blocks;
create policy "personalize blocks are publicly readable" on public.personalize_blocks
  for select using (true);
drop policy if exists "users can insert their own personalize blocks" on public.personalize_blocks;
create policy "users can insert their own personalize blocks" on public.personalize_blocks
  for insert with check (auth.uid() = profile_id);
drop policy if exists "users can update their own personalize blocks" on public.personalize_blocks;
create policy "users can update their own personalize blocks" on public.personalize_blocks
  for update using (auth.uid() = profile_id);
drop policy if exists "users can delete their own personalize blocks" on public.personalize_blocks;
create policy "users can delete their own personalize blocks" on public.personalize_blocks
  for delete using (auth.uid() = profile_id);

-- Classification feedback log (see docs/migrations/2026-09-23-classification-feedback.sql):
-- one row per pasted link where the person changed the detected category. Insert only,
-- no select policy, so it is readable from the dashboard only.
create table if not exists public.classification_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  url text not null,
  normalized_url text,
  detected_slug text,
  detected_confidence text,
  detected_reason text,
  final_slug text not null,
  path text not null default 'paste' check (path in ('paste', 'search')),
  changed_by_user boolean not null default false
);

create index if not exists classification_feedback_created_at_idx
  on public.classification_feedback (created_at desc);

alter table public.classification_feedback enable row level security;

drop policy if exists "users can log their own classification feedback" on public.classification_feedback;
create policy "users can log their own classification feedback" on public.classification_feedback
  for insert to authenticated with check (auth.uid() = user_id);
