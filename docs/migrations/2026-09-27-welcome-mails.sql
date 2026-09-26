-- Welcome emails (day 4, 10 and 21 after signing up), community picks and a blocklist so
-- picks never feature blockbusters. Everything here is read and written server side with the
-- service role only: no policies, so regular users can't see or change any of it.
-- Safe to run more than once. Paste into the Supabase SQL editor.

-- one row per email sent, so no step is ever sent twice
create table if not exists public.welcome_emails (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  step int not null check (step in (1, 2, 3)),
  sent_at timestamptz not null default now(),
  primary key (profile_id, step)
);

-- tiny key/value switches the owner flips on /admin/emails, e.g. welcome_emails = {"on": true}
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.pick_blocklist (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('work', 'title', 'by')),
  value text not null,
  created_at timestamptz not null default now(),
  unique (kind, value)
);

alter table public.welcome_emails enable row level security;
alter table public.app_settings enable row level security;
alter table public.pick_blocklist enable row level security;
