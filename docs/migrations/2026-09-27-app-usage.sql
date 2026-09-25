-- App usage: when someone first and last opened hoshigo as an installed app (home screen,
-- standalone). Kept out of public.profiles on purpose: profiles are readable by everyone,
-- and when a person opens an app is nobody else's business. Only the person can read or
-- write their own row; /stats reads it with the service role. Safe to run more than once.

create table if not exists public.app_usage (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  app_first_opened_at timestamptz not null default now(),
  app_last_opened_at timestamptz not null default now()
);

alter table public.app_usage enable row level security;

drop policy if exists "own app usage is readable" on public.app_usage;
create policy "own app usage is readable" on public.app_usage
  for select using (auth.uid() = profile_id);

drop policy if exists "own app usage can be added" on public.app_usage;
create policy "own app usage can be added" on public.app_usage
  for insert with check (auth.uid() = profile_id);

drop policy if exists "own app usage can be updated" on public.app_usage;
create policy "own app usage can be updated" on public.app_usage
  for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
