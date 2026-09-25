-- Someday: things you saved from other people's hoshigos to try one day. A snapshot, so it
-- stays when the original is deleted. Private unless profiles.someday_public.
-- Safe to run more than once. Paste into the Supabase SQL editor.

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
