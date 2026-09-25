-- Someday history: "Loved it" and "Not a hoshigo" no longer delete the row; they mark it,
-- so we learn what turned out to be five stars and what didn't. The list shows saved rows only.
-- Safe to run more than once. Paste into the Supabase SQL editor.

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
