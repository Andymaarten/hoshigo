-- Sora, round 3: invite link previews and the feedback tab. Safe to run more than once.

-- Link previews of an invite resolve the secret token to the inviter's handle only;
-- everything else shown comes from that person's public page.
create or replace function public.invite_preview_handle(invite_token text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.handle
  from public.friend_invites i join public.profiles p on p.id = i.profile_id
  where i.token = invite_token;
$$;
revoke execute on function public.invite_preview_handle(text) from public;
grant execute on function public.invite_preview_handle(text) to anon, authenticated;

-- Messages from the "feedback?" tab. Anyone logged in can add their own; nobody can read
-- them through the API (the owner reads them in the Supabase dashboard or by email).
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  message text not null check (char_length(message) between 1 and 4000),
  page text,
  user_agent text
);

alter table public.feedback enable row level security;

drop policy if exists "people add their own feedback" on public.feedback;
create policy "people add their own feedback" on public.feedback
  for insert to authenticated with check (auth.uid() = user_id);
