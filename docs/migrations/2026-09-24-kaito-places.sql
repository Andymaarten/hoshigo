-- Places keep OpenStreetMap's structure: a type ("Bar", "Museum") and a location.
-- Safe to run more than once. Paste into the Supabase SQL editor.
-- Before this runs the app keeps working with the combined "by" line ("Bar · Amsterdam"),
-- which it still writes alongside the new columns.

alter table public.items add column if not exists place_type text;
alter table public.items add column if not exists city text;
alter table public.items add column if not exists country text;

alter table public.works add column if not exists place_type text;
alter table public.works add column if not exists city text;
alter table public.works add column if not exists country text;

-- Backfill: split existing place items' "by" line where it has exactly the
-- "Type · City" shape. Rows with another shape keep their by line and show it as location.
update public.items i
set place_type = split_part(i.by, ' · ', 1),
    city = split_part(i.by, ' · ', 2)
from public.categories c
where c.id = i.category_id
  and c.slug = 'places'
  and i.place_type is null
  and i.city is null
  and i.by like '% · %'
  and i.by not like '% · % · %';

update public.works w
set place_type = split_part(w.by, ' · ', 1),
    city = split_part(w.by, ' · ', 2)
where w.source = 'nominatim'
  and w.place_type is null
  and w.city is null
  and w.by like '% · %'
  and w.by not like '% · % · %';

-- Place items from before round 6 have "City, Country" as by (no type). Put that in city.
update public.items i
set city = i.by
from public.categories c
where c.id = i.category_id
  and c.slug = 'places'
  and i.place_type is null
  and i.city is null
  and i.by is not null
  and i.by not like '% · %';
