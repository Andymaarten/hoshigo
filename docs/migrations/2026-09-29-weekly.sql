-- "New since your last visit" on the Friends page, and the Monday email with what your
-- network kept that week. Safe to run more than once. Paste into the Supabase SQL editor.

-- when you last looked at the Friends page
create table if not exists public.friends_seen (
  profile_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  seen_at timestamptz not null default now()
);
alter table public.friends_seen enable row level security;
drop policy if exists "own friends_seen" on public.friends_seen;
create policy "own friends_seen" on public.friends_seen
  for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- "Updates from your network": the weekly email, on unless switched off
alter table public.profiles add column if not exists weekly_email boolean not null default true;

-- one row per person per week, so nobody gets two (service role only, no policies)
create table if not exists public.weekly_emails (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  sent_at timestamptz not null default now(),
  primary key (profile_id, week_start)
);
alter table public.weekly_emails enable row level security;
