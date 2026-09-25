-- Feedback handling for the owner: a status, when it was handled, and a short note.
-- No new policies: people can still only insert feedback; the owner page reads and writes it
-- server side with the service role key. Safe to run more than once.

alter table public.feedback add column if not exists status text not null default 'open';
alter table public.feedback drop constraint if exists feedback_status_check;
alter table public.feedback add constraint feedback_status_check
  check (status in ('open', 'planned', 'done', 'wontfix'));
alter table public.feedback add column if not exists handled_at timestamptz;
alter table public.feedback add column if not exists handled_note text;
