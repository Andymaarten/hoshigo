-- Pinning: at most one pinned listing per category per person, always shown first.
-- Safe to run more than once. Paste into the Supabase SQL editor.

alter table public.items add column if not exists pinned boolean not null default false;

create unique index if not exists items_one_pinned_per_category
  on public.items (profile_id, category_id)
  where pinned;

-- Pin (or unpin) one of your own listings. Unpinning the other listing in that category and
-- pinning this one happen in one transaction, so the unique index never sees two pins.
create or replace function public.pin_item(p_item uuid, p_pin boolean default true)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  cat int;
begin
  if me is null then raise exception 'not logged in'; end if;
  select category_id into cat from public.items where id = p_item and profile_id = me;
  if not found then return false; end if;
  if p_pin then
    update public.items set pinned = false
    where profile_id = me and category_id = cat and pinned and id <> p_item;
  end if;
  update public.items set pinned = p_pin where id = p_item and profile_id = me;
  return true;
end;
$$;

revoke execute on function public.pin_item(uuid, boolean) from anon;

-- The public window (what non-friends see) is the first 5 in the order the profile shows:
-- the pinned listing first, then newest. So a pin takes one of the 5 places and is always
-- visible; it never adds a sixth.
create or replace function public.item_in_public_window(p_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  -- A private profile has no public window at all, so this can't be used to probe it.
  select coalesce((select not p.is_private from public.items t join public.profiles p on p.id = t.profile_id where t.id = p_id), false)
    and (
      select count(*) < 5 from public.items t join public.items i
        on i.profile_id = t.profile_id and i.category_id = t.category_id
       and (
         (i.pinned and not t.pinned)
         or (i.pinned = t.pinned and (i.created_at, i.id) > (t.created_at, t.id))
       )
      where t.id = p_id
    );
$$;

-- Verification (run after the migration):
--   select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'items';
-- Exactly one SELECT policy should exist: "items are visible to owner, friends, or latest 5".
--   select proname from pg_proc where proname in ('pin_item', 'item_in_public_window');
