-- Classification feedback log: one row per item saved via "Paste a link" where the person
-- ended on a different category than we detected, or pressed "change" at all.
-- Safe to run more than once. Paste into the Supabase SQL editor.

create table if not exists public.classification_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  url text not null,
  normalized_url text,
  detected_slug text,
  detected_confidence text,
  detected_reason text,
  final_slug text not null,
  path text not null default 'paste' check (path in ('paste', 'search')),
  changed_by_user boolean not null default false
);

create index if not exists classification_feedback_created_at_idx
  on public.classification_feedback (created_at desc);

alter table public.classification_feedback enable row level security;

-- Logged-in users may insert their own rows. There is deliberately no select, update or
-- delete policy, so nobody can read or change rows through the API; the owner reads them
-- in the dashboard (the service role bypasses RLS).
drop policy if exists "users can log their own classification feedback" on public.classification_feedback;
create policy "users can log their own classification feedback" on public.classification_feedback
  for insert to authenticated with check (auth.uid() = user_id);

-- Most common misclassifications, by domain:
--
-- select
--   regexp_replace(split_part(coalesce(normalized_url, url), '/', 1), '^www\.', '') as domain,
--   detected_slug,
--   final_slug,
--   count(*) as times,
--   max(created_at) as last_seen,
--   (array_agg(detected_reason order by created_at desc))[1] as last_reason
-- from public.classification_feedback
-- where detected_slug is distinct from final_slug
-- group by 1, 2, 3
-- order by times desc, last_seen desc
-- limit 50;
