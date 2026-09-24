-- Pick which profiles the red hoshigos on the homepage lead to.
-- Put 1 to 10 in profiles.homepage_order (Table Editor → profiles); lowest first, empty = not shown.
-- If nobody has a number, the homepage falls back to /testuser and /andymaarten.
-- Safe to run more than once.
alter table public.profiles add column if not exists homepage_order smallint
  check (homepage_order between 1 and 10);
