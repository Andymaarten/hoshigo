-- Find people ignoring accents and case: "Romee" finds "Romée", in handle and name.
-- Safe to run more than once. Paste into the Supabase SQL editor.

create extension if not exists unaccent with schema extensions;

create or replace function public.search_people(q text)
returns table (id uuid, handle text, display_name text, is_private boolean)
language sql stable security definer set search_path = public, extensions
as $$
  with s as (
    -- the typed text is matched literally: its own % and _ are escaped
    select '%' || replace(replace(replace(unaccent(lower(trim(q))), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
  )
  select p.id, p.handle, p.display_name, p.is_private
  from public.profiles p, s
  where auth.uid() is not null
    and length(trim(q)) >= 2
    and p.id <> auth.uid()
    and p.handle not like 'user-%'
    and (
      unaccent(lower(p.handle)) like s.pat
      or unaccent(lower(coalesce(p.display_name, ''))) like s.pat
    )
  order by p.handle
  limit 10;
$$;

revoke execute on function public.search_people(text) from anon;
