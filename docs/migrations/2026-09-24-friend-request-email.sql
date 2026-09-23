-- Friend request emails: people who approve requests themselves can get an email when one
-- arrives. On by default. Safe to run more than once. Paste into the Supabase SQL editor.
-- The address itself is looked up server side with the service role key only.
alter table public.profiles add column if not exists email_friend_requests boolean not null default true;
