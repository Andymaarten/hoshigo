-- Follows: a one way "keep me posted" on a public profile. A follower sees what everyone sees
-- (the latest 5 per category, enforced by the items policy); their feed shows those.
-- Also friends_of(): the friends list on a profile, for logged in visitors.
-- Safe to run more than once. Paste into the Supabase SQL editor.

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
