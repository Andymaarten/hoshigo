-- Friends line in pages: one page of a profile's friends, mutual friends first, then by name.
-- Same rules as friends_of(): logged in callers only; a private profile's friends only for
-- that person and their friends. Returns handle, name, whether the caller also knows them,
-- and the total, so the page can say "and 297 others" without fetching them.
-- Safe to run more than once. Paste into the Supabase SQL editor.

create or replace function public.friends_of_page(p_profile uuid, p_limit int default 20, p_offset int default 0)
returns table (handle text, display_name text, mutual boolean, total bigint)
language sql stable security definer set search_path = public
as $$
  with visible as (
    select 1 from public.profiles o
    where o.id = p_profile
      and auth.uid() is not null
      and (not o.is_private or o.id = auth.uid() or public.is_friend_of_viewer(o.id))
  ),
  f as (
    select p.handle, p.display_name,
           (p.id <> auth.uid() and public.is_friend_of_viewer(p.id)) as mutual
    from public.friendships fr
    join public.profiles p
      on p.id = case when fr.requester = p_profile then fr.addressee else fr.requester end
    where fr.status = 'accepted'
      and (fr.requester = p_profile or fr.addressee = p_profile)
      and exists (select 1 from visible)
  )
  select handle, display_name, mutual, count(*) over () as total
  from f
  order by mutual desc, lower(coalesce(display_name, handle)), handle
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
$$;

revoke execute on function public.friends_of_page(uuid, int, int) from anon;
