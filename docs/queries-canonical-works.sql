-- Run these in Supabase Dashboard → SQL Editor.

-- Most-added canonical works, with how many hoshigo items point at each one
-- (i.e. how many times it's been added, and on how many distinct profiles)
select
  w.title,
  w.by,
  w.year,
  w.source,
  w.match_confidence,
  count(i.id) as times_added,
  count(distinct i.profile_id) as distinct_profiles
from works w
join items i on i.work_id = w.id
group by w.id
order by times_added desc;

-- All canonical works, newest first (browse everything resolved so far)
select id, source, source_id, title, by, year, match_confidence, created_at
from works
order by created_at desc;

-- Only the "high confidence" ones — this is the pool a future taste-matching
-- feature should read from; "low"/null confidence rows should not be trusted
-- for that yet.
select title, by, year, source, created_at
from works
where match_confidence = 'high'
order by created_at desc;
