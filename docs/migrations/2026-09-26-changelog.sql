-- Changelog: a dated record of what changed on hoshigo, a public "What's new" page, and the
-- occasional "new on hoshigo" email (sent by hand from /admin/changelog, never automatically).
-- Safe to run more than once. Paste into the Supabase SQL editor.

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
