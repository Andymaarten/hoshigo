-- Web push: one row per device that turned on notifications. The daily run (src/lib/push.ts)
-- sends at most one bundled notification per person and sets last_sent_at. Only the person
-- can see or change their own devices; the daily run uses the service role. Safe to run more
-- than once.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);

create index if not exists push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "own push subscriptions are readable" on public.push_subscriptions;
create policy "own push subscriptions are readable" on public.push_subscriptions
  for select using (auth.uid() = profile_id);

drop policy if exists "own push subscriptions can be added" on public.push_subscriptions;
create policy "own push subscriptions can be added" on public.push_subscriptions
  for insert with check (auth.uid() = profile_id);

drop policy if exists "own push subscriptions can be updated" on public.push_subscriptions;
create policy "own push subscriptions can be updated" on public.push_subscriptions
  for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists "own push subscriptions can be removed" on public.push_subscriptions;
create policy "own push subscriptions can be removed" on public.push_subscriptions
  for delete using (auth.uid() = profile_id);
