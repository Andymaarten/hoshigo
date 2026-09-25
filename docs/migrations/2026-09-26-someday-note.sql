-- Someday notes: a line of your own on a saved card, e.g. who gave you the tip. Shown with
-- your list (so also on a list you made visible). Safe to run more than once.

alter table public.someday_items add column if not exists note text;
alter table public.someday_items drop constraint if exists someday_items_note_length;
alter table public.someday_items add constraint someday_items_note_length check (note is null or char_length(note) <= 500);
