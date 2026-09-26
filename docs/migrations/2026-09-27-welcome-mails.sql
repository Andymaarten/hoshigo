-- Welcome emails (day 4, 10 and 21 after signing up) with a few community picks the owner
-- approved as good enough to recommend. Everything here is read and written server side with
-- the service role only: no policies, so regular users can't see or change any of it.
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

-- what the owner approved as a tip: a catalogue work (any good listing of it may be shown)
-- or one specific listing
create table if not exists public.pick_approved (
  id uuid primary key default gen_random_uuid(),
  work_id uuid references public.works (id) on delete cascade,
  item_id uuid references public.items (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  check (work_id is not null or item_id is not null)
);
create unique index if not exists pick_approved_work on public.pick_approved (work_id) where work_id is not null and item_id is null;
create unique index if not exists pick_approved_item on public.pick_approved (item_id) where item_id is not null;

-- which picks someone already got, so a later email never repeats one
create table if not exists public.welcome_email_picks (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  work_id uuid references public.works (id) on delete set null,
  item_id uuid references public.items (id) on delete set null,
  sent_at timestamptz not null default now()
);
create index if not exists welcome_email_picks_profile on public.welcome_email_picks (profile_id);

alter table public.welcome_emails enable row level security;
alter table public.app_settings enable row level security;
alter table public.pick_approved enable row level security;
alter table public.welcome_email_picks enable row level security;

