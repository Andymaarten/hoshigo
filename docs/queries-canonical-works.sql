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

-- Every work with a clickable link back to its authoritative source page —
-- proof the canonical matching is real, not just an internal id. MusicBrainz
-- is the one source whose URL path depends on category (release-group for
-- albums, recording for songs), everything else is a flat id-in-path pattern.
select
  w.title,
  w.by,
  w.source,
  case w.source
    when 'tmdb'        then 'https://www.themoviedb.org/movie/' || w.source_id
    when 'tmdb_tv'      then 'https://www.themoviedb.org/tv/' || w.source_id
    when 'musicbrainz'  then
      case c.slug
        when 'songs' then 'https://musicbrainz.org/recording/' || w.source_id
        else 'https://musicbrainz.org/release-group/' || w.source_id
      end
    when 'openlibrary'  then 'https://openlibrary.org' || w.source_id
    when 'itunes'       then 'https://podcasts.apple.com/us/podcast/id' || w.source_id
    when 'youtube'      then 'https://www.youtube.com/watch?v=' || w.source_id
    -- Nominatim only stores its own internal place_id, not the osm_type+osm_id pair a real
    -- openstreetmap.org page needs — this hits Nominatim's own details page instead, the only
    -- public URL a bare place_id resolves to.
    when 'nominatim'    then 'https://nominatim.openstreetmap.org/ui/details.html?place_id=' || w.source_id
    else null
  end as canonical_url
from works w
join categories c on c.id = w.category_id
order by w.created_at desc;
