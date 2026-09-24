-- Owner review of catalog suggestions (/admin/backfill): "Not this one" is remembered here,
-- so the same suggestion for the same item doesn't come back. Safe to run more than once.
-- Only the server (service role) reads and writes it: RLS on, no policies for users.

create table if not exists public.backfill_rejections (
  item_id uuid not null references public.items (id) on delete cascade,
  work_source text not null,
  work_source_id text not null,
  created_at timestamptz not null default now(),
  primary key (item_id, work_source, work_source_id)
);

alter table public.backfill_rejections enable row level security;
