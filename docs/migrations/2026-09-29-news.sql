-- news: when you last looked at /news, for the quiet dot in the nav. The events themselves
-- come from existing tables (friendships, follows, someday_items), read server side.
-- Safe to run more than once. Paste into the Supabase SQL editor.

create table if not exists public.news_seen (
  profile_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  seen_at timestamptz not null default now()
);
alter table public.news_seen enable row level security;
drop policy if exists "own news_seen" on public.news_seen;
create policy "own news_seen" on public.news_seen
  for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
