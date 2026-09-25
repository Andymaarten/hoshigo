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

-- profile setting: false (default) = everyone sees the latest 5 per category, true = friends only
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
-- 'wikidata' = games (video and board games), see docs/migrations/2026-09-24-kaito.sql
alter table public.works drop constraint if exists works_source_check;
alter table public.works add constraint works_source_check
  check (source in ('tmdb', 'tmdb_tv', 'musicbrainz', 'openlibrary', 'itunes', 'igdb', 'youtube', 'nominatim', 'wikidata', 'bgg'));

-- The thing's own website when the catalog knows it (places from OSM). Used as an item's
-- link only when the person gave none.
alter table public.works add column if not exists website text;

-- Places keep OSM's structure: type ("Bar") and location. The combined "by" line is still
-- written too. Backfill for existing rows: docs/migrations/2026-09-24-kaito-places.sql.
alter table public.works add column if not exists place_type text;
alter table public.works add column if not exists city text;
alter table public.works add column if not exists country text;
alter table public.items add column if not exists place_type text;
alter table public.items add column if not exists city text;
alter table public.items add column if not exists country text;

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
-- Only the server writes works, with the service role key (src/lib/works.ts); no insert or
-- update policy for users. See docs/migrations/2026-09-24-kaito-works.sql.
drop policy if exists "any logged-in user can register a work" on public.works;

drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable" on public.profiles
  for select using (true);
drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "categories are publicly readable" on public.categories;
create policy "categories are publicly readable" on public.categories
  for select using (true);

drop policy if exists "items are publicly readable" on public.items;
-- the items select policy lives in the Friends section at the end
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

-- Friends (see docs/migrations/2026-09-23-friends.sql, identical content)

-- false = requests need approval (the default); true = requests are accepted automatically
alter table public.profiles add column if not exists auto_accept_friends boolean not null default false;

-- One row per pair of people. A pending row is a request from requester to addressee;
-- an accepted row means they are friends (symmetric, whoever asked first).
create table if not exists public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester, addressee),
  check (requester <> addressee)
);

-- at most one row per pair regardless of who asked
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee_idx on public.friendships (addressee);

-- one secret invite token per person; knowing it is what lets someone befriend them directly
create table if not exists public.friend_invites (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  token text unique not null default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

create index if not exists items_profile_category_created_idx
  on public.items (profile_id, category_id, created_at desc, id desc);

alter table public.friendships enable row level security;
alter table public.friend_invites enable row level security;

drop policy if exists "people see their own friendships" on public.friendships;
create policy "people see their own friendships" on public.friendships
  for select to authenticated using (auth.uid() in (requester, addressee));
-- decline, cancel and unfriend are all a plain delete by either side;
-- creating and accepting only go through the functions below
drop policy if exists "people can remove their own friendships" on public.friendships;
create policy "people can remove their own friendships" on public.friendships
  for delete to authenticated using (auth.uid() in (requester, addressee));

drop policy if exists "people see their own invite" on public.friend_invites;
create policy "people see their own invite" on public.friend_invites
  for select to authenticated using (auth.uid() = profile_id);
drop policy if exists "people create their own invite" on public.friend_invites;
create policy "people create their own invite" on public.friend_invites
  for insert to authenticated with check (auth.uid() = profile_id);

-- security definer so the items policy can use these without recursing into items' own RLS
-- only ever answers about the caller, so it can't be used to probe other people's friendships
create or replace function public.is_friend_of_viewer(owner uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = auth.uid() and f.addressee = owner) or (f.requester = owner and f.addressee = auth.uid()))
  );
$$;

-- true when the item is among its owner's 5 newest in that category (ties broken by id).
-- Takes only the item id and looks the rest up itself, so callers can't feed in arbitrary
-- timestamps to learn when hidden items were added; hidden ids are never sent to non-friends.
create or replace function public.item_in_public_window(p_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select count(*) < 5 from public.items t join public.items i
    on i.profile_id = t.profile_id and i.category_id = t.category_id
   and (i.created_at, i.id) > (t.created_at, t.id)
  where t.id = p_id;
$$;

-- which of a person's categories have more than the public 5, so the page can show a
-- "see more" tile without sending the hidden rows. Nothing at all for a private profile.
create or replace function public.categories_with_more(p_profile uuid)
returns setof int
language sql stable security definer set search_path = public
as $$
  select category_id from public.items
  where profile_id = p_profile
    and not exists (select 1 from public.profiles p where p.id = p_profile and p.is_private)
  group by category_id having count(*) > 5;
$$;

create or replace function public.request_friend(target uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  existing public.friendships;
  auto boolean;
begin
  if me is null then raise exception 'not logged in'; end if;
  if target = me then return 'self'; end if;

  select * into existing from public.friendships
  where (requester = me and addressee = target) or (requester = target and addressee = me);

  if found then
    if existing.status = 'accepted' then return 'friends'; end if;
    if existing.requester = me then return 'pending'; end if;
    -- they already asked me: asking back is agreeing
    update public.friendships set status = 'accepted', accepted_at = now()
    where requester = target and addressee = me;
    return 'friends';
  end if;

  select auto_accept_friends into auto from public.profiles where id = target;
  if not found then raise exception 'no such profile'; end if;

  insert into public.friendships (requester, addressee, status, accepted_at)
  values (me, target, case when auto then 'accepted' else 'pending' end, case when auto then now() end);
  return case when auto then 'friends' else 'pending' end;
end;
$$;

create or replace function public.accept_friend(other uuid)
returns text
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not logged in'; end if;
  update public.friendships set status = 'accepted', accepted_at = now()
  where requester = other and addressee = auth.uid() and status = 'pending';
  return case when found then 'friends' else 'none' end;
end;
$$;

-- the inviter made the link, so opening it makes you friends straight away
create or replace function public.accept_invite(invite_token text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  inviter uuid;
  inviter_handle text;
begin
  if me is null then raise exception 'not logged in'; end if;
  select i.profile_id, p.handle into inviter, inviter_handle
  from public.friend_invites i join public.profiles p on p.id = i.profile_id
  where i.token = invite_token;
  if inviter is null then return null; end if;
  if inviter = me then return inviter_handle; end if;

  update public.friendships set status = 'accepted', accepted_at = coalesce(accepted_at, now())
  where (requester = me and addressee = inviter) or (requester = inviter and addressee = me);
  if not found then
    insert into public.friendships (requester, addressee, status, accepted_at)
    values (inviter, me, 'accepted', now());
  end if;
  return inviter_handle;
end;
$$;

revoke execute on function public.request_friend(uuid) from anon;
revoke execute on function public.accept_friend(uuid) from anon;
revoke execute on function public.accept_invite(text) from anon;

-- Profiles (name, bio, handle) are readable by everyone, private ones included.
-- is_private is a profile setting: a private profile shows its items to friends only.
drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable" on public.profiles
  for select using (true);

drop policy if exists "items are publicly readable" on public.items;
drop policy if exists "items are visible to owner, friends, or latest 5" on public.items;
create policy "items are visible to owner, friends, or latest 5" on public.items
  for select using (
    auth.uid() = profile_id
    or public.is_friend_of_viewer(profile_id)
    or (
      not exists (select 1 from public.profiles p where p.id = items.profile_id and p.is_private)
      and public.item_in_public_window(id)
    )
  );

-- only after the policy above stops referencing them
drop function if exists public.are_friends(uuid, uuid);
drop function if exists public.item_in_public_window(uuid, int, timestamptz, uuid);

-- Verification (run after the migration):
--   select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'items';
-- Exactly one SELECT policy should exist: "items are visible to owner, friends, or latest 5".

-- Friend request emails (see docs/migrations/2026-09-24-friend-request-email.sql)
alter table public.profiles add column if not exists email_friend_requests boolean not null default true;

-- Pinning (see docs/migrations/2026-09-24-hana.sql). Replaces the item_in_public_window
-- defined above with a pin aware version.

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

-- Invite previews and feedback (see docs/migrations/2026-09-24-sora.sql)

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
-- Pick which profiles the red hoshigos on the homepage lead to.
-- Put 1 to 10 in profiles.homepage_order (Table Editor → profiles); lowest first, empty = not shown.
-- If nobody has a number, the homepage falls back to /testuser and /andymaarten.
-- Safe to run more than once.
alter table public.profiles add column if not exists homepage_order smallint
  check (homepage_order between 1 and 10);

-- Owner review of catalog suggestions: rejected suggestions (docs/migrations/2026-09-25-backfill-rejections.sql).
-- Server only (service role): RLS on, no user policies.
create table if not exists public.backfill_rejections (
  item_id uuid not null references public.items (id) on delete cascade,
  work_source text not null,
  work_source_id text not null,
  created_at timestamptz not null default now(),
  primary key (item_id, work_source, work_source_id)
);
alter table public.backfill_rejections enable row level security;

-- Follows and friends_of (see docs/migrations/2026-09-25-follows.sql)

create table if not exists public.follows (
  follower uuid not null references public.profiles (id) on delete cascade,
  followee uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);

create index if not exists follows_followee_idx on public.follows (followee);

alter table public.follows enable row level security;

drop policy if exists "people see follows they are part of" on public.follows;
create policy "people see follows they are part of" on public.follows
  for select to authenticated using (auth.uid() in (follower, followee));

-- only your own follow, and never of a private profile
drop policy if exists "people follow public profiles" on public.follows;
create policy "people follow public profiles" on public.follows
  for insert to authenticated with check (
    follower = auth.uid()
    and not exists (select 1 from public.profiles p where p.id = followee and p.is_private)
  );

drop policy if exists "people unfollow" on public.follows;
create policy "people unfollow" on public.follows
  for delete to authenticated using (follower = auth.uid());

-- A profile's friends (handle and name only), for a logged in caller, and for a private
-- profile only when the caller is that person or one of their friends. Nothing else.
create or replace function public.friends_of(p_profile uuid)
returns table (handle text, display_name text)
language sql stable security definer set search_path = public
as $$
  select p.handle, p.display_name
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester = p_profile then f.addressee else f.requester end
  where f.status = 'accepted'
    and (f.requester = p_profile or f.addressee = p_profile)
    and auth.uid() is not null
    and exists (
      select 1 from public.profiles o
      where o.id = p_profile
        and (not o.is_private or o.id = auth.uid() or public.is_friend_of_viewer(o.id))
    )
  order by lower(coalesce(p.display_name, p.handle));
$$;

revoke execute on function public.friends_of(uuid) from anon;

-- Friends line in pages (see docs/migrations/2026-09-25-friends-page.sql)

create or replace function public.friends_of_page(p_profile uuid, p_limit int default 20, p_offset int default 0)
returns table (handle text, display_name text, mutual boolean, total bigint)
language sql stable security definer set search_path = public
as $$
  with visible as (
    select 1 from public.profiles o
    where o.id = p_profile
      and auth.uid() is not null
      and (not o.is_private or o.id = auth.uid() or public.is_friend_of_viewer(o.id))
  ),
  f as (
    select p.handle, p.display_name,
           (p.id <> auth.uid() and public.is_friend_of_viewer(p.id)) as mutual
    from public.friendships fr
    join public.profiles p
      on p.id = case when fr.requester = p_profile then fr.addressee else fr.requester end
    where fr.status = 'accepted'
      and (fr.requester = p_profile or fr.addressee = p_profile)
      and exists (select 1 from visible)
  )
  select handle, display_name, mutual, count(*) over () as total
  from f
  order by mutual desc, lower(coalesce(display_name, handle)), handle
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
$$;

revoke execute on function public.friends_of_page(uuid, int, int) from anon;

-- Friends are not followers (see docs/migrations/2026-09-25-followers-fix.sql)

create or replace function public.drop_follows_between_friends()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'accepted' then
    delete from public.follows
    where (follower = new.requester and followee = new.addressee)
       or (follower = new.addressee and followee = new.requester);
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_drop_follows on public.friendships;
create trigger friendships_drop_follows
  after insert or update of status on public.friendships
  for each row execute function public.drop_follows_between_friends();

-- one time cleanup: follow rows between people who are already friends
delete from public.follows fo
using public.friendships f
where f.status = 'accepted'
  and ((fo.follower = f.requester and fo.followee = f.addressee)
    or (fo.follower = f.addressee and fo.followee = f.requester));

-- Feedback status (see docs/migrations/2026-09-25-feedback-status.sql)

alter table public.feedback add column if not exists status text not null default 'open';
alter table public.feedback drop constraint if exists feedback_status_check;
alter table public.feedback add constraint feedback_status_check
  check (status in ('open', 'planned', 'done', 'wontfix'));
alter table public.feedback add column if not exists handled_at timestamptz;
alter table public.feedback add column if not exists handled_note text;

-- Accent insensitive people search (see docs/migrations/2026-09-26-search-unaccent.sql)

create extension if not exists unaccent with schema extensions;

create or replace function public.search_people(q text)
returns table (id uuid, handle text, display_name text, is_private boolean)
language sql stable security definer set search_path = public, extensions
as $$
  with s as (
    -- the typed text is matched literally: its own % and _ are escaped
    select '%' || replace(replace(replace(unaccent(lower(trim(q))), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
  )
  select p.id, p.handle, p.display_name, p.is_private
  from public.profiles p, s
  where auth.uid() is not null
    and length(trim(q)) >= 2
    and p.id <> auth.uid()
    and p.handle not like 'user-%'
    and (
      unaccent(lower(p.handle)) like s.pat
      or unaccent(lower(coalesce(p.display_name, ''))) like s.pat
    )
  order by p.handle
  limit 10;
$$;

revoke execute on function public.search_people(text) from anon;

-- Someday list (see docs/migrations/2026-09-26-someday.sql)

alter table public.profiles add column if not exists someday_public boolean not null default false;

create table if not exists public.someday_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  from_profile_id uuid references public.profiles (id) on delete set null,
  source_item_id uuid references public.items (id) on delete set null,
  work_id uuid references public.works (id) on delete set null,
  category_id int not null references public.categories (id),
  title text not null,
  by text,
  year int,
  image_url text,
  url text,
  created_at timestamptz not null default now()
);

create index if not exists someday_items_profile_idx on public.someday_items (profile_id, created_at desc);
-- saving twice doesn't make a second row: by catalog work, else by the source listing
create unique index if not exists someday_items_one_per_work
  on public.someday_items (profile_id, work_id) where work_id is not null;
create unique index if not exists someday_items_one_per_source
  on public.someday_items (profile_id, source_item_id) where work_id is null and source_item_id is not null;

alter table public.someday_items enable row level security;

drop policy if exists "owners manage their someday" on public.someday_items;
create policy "owners manage their someday" on public.someday_items
  for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- others: only when the owner made the list visible, and only if they can see the profile
drop policy if exists "visible someday lists" on public.someday_items;
create policy "visible someday lists" on public.someday_items
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = someday_items.profile_id
        and p.someday_public
        and (not p.is_private or public.is_friend_of_viewer(p.id))
    )
  );

-- Someday history (see docs/migrations/2026-09-26-someday-history.sql)

alter table public.someday_items add column if not exists status text not null default 'saved';
alter table public.someday_items drop constraint if exists someday_items_status_check;
alter table public.someday_items add constraint someday_items_status_check
  check (status in ('saved', 'loved', 'not_for_me'));
alter table public.someday_items add column if not exists resolved_at timestamptz;
alter table public.someday_items add column if not exists loved_item_id uuid references public.items (id) on delete set null;

-- no duplicates among what's still saved; saving the same thing again later is fine
drop index if exists public.someday_items_one_per_work;
drop index if exists public.someday_items_one_per_source;
create unique index if not exists someday_items_saved_per_work
  on public.someday_items (profile_id, work_id) where status = 'saved' and work_id is not null;
create unique index if not exists someday_items_saved_per_source
  on public.someday_items (profile_id, source_item_id) where status = 'saved' and work_id is null and source_item_id is not null;

-- others only ever see what's still saved
drop policy if exists "visible someday lists" on public.someday_items;
create policy "visible someday lists" on public.someday_items
  for select using (
    status = 'saved'
    and exists (
      select 1 from public.profiles p
      where p.id = someday_items.profile_id
        and p.someday_public
        and (not p.is_private or public.is_friend_of_viewer(p.id))
    )
  );

-- Changelog and update emails (see docs/migrations/2026-09-26-changelog.sql)

create table if not exists public.changelog_entries (
  id uuid primary key default gen_random_uuid(),
  shipped_on date not null default current_date,
  title text not null,
  body text,
  audience text not null default 'public',
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.changelog_entries drop constraint if exists changelog_entries_audience_check;
alter table public.changelog_entries add constraint changelog_entries_audience_check
  check (audience in ('public', 'internal'));
create index if not exists changelog_entries_shipped_idx on public.changelog_entries (shipped_on desc, created_at desc);

create table if not exists public.update_emails (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  subject text not null,
  sent_at timestamptz,
  sent_count int not null default 0,
  entry_ids uuid[] not null default '{}'
);

-- opt out of the occasional update email
alter table public.profiles add column if not exists email_updates boolean not null default true;

alter table public.changelog_entries enable row level security;
alter table public.update_emails enable row level security;

-- everyone may read what's public; writing only happens server side with the service role
drop policy if exists "public changelog" on public.changelog_entries;
create policy "public changelog" on public.changelog_entries
  for select using (audience = 'public' and not hidden);
-- update_emails: no policies at all, so only the service role can touch it
