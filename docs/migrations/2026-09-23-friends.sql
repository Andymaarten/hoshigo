-- Friends: mutual friendships, friend requests, personal invite links, and friend-aware
-- item visibility (non-friends see only the latest 5 per category, enforced by RLS).
-- Safe to run more than once. Paste into the Supabase SQL editor.

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
