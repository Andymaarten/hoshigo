-- Platform links per catalogue work ("Open in Letterboxd", "Search on StoryGraph"), and each
-- person's preferred platform per group. Safe to run more than once. The app works before
-- this runs: without the table no "Open in" button shows, without link_prefs viewers get
-- the defaults.

create table if not exists public.work_links (
  work_id uuid not null references public.works (id) on delete cascade,
  platform text not null,
  url text not null,
  kind text not null check (kind in ('direct', 'search')),
  -- where the link came from: tmdb, openlibrary, osm, pattern…
  source text not null,
  checked_at timestamptz not null default now(),
  primary key (work_id, platform)
);

alter table public.work_links enable row level security;

-- Anyone may read them (they only point at public pages); only the server writes them, with
-- the service role, which bypasses RLS. No insert/update/delete policy on purpose.
drop policy if exists "work links are public" on public.work_links;
create policy "work links are public" on public.work_links for select using (true);

-- {"films": "letterboxd", "books": "goodreads", …}; null means the defaults.
alter table public.profiles add column if not exists link_prefs jsonb;
