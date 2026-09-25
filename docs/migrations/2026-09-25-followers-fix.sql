-- Friends are not followers: once a friendship is accepted, follow rows between the two go.
-- A trigger instead of edits to accept_friend / request_friend / accept_invite, so every path
-- that accepts (those three and any future one) is covered in one place.
-- Safe to run more than once. Paste into the Supabase SQL editor.

create or replace function public.drop_follows_between_friends()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'accepted' then
    delete from public.follows
    where (follower = new.requester and followee = new.addressee)
       or (follower = new.addressee and followee = new.requester);
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_drop_follows on public.friendships;
create trigger friendships_drop_follows
  after insert or update of status on public.friendships
  for each row execute function public.drop_follows_between_friends();

-- one time cleanup: follow rows between people who are already friends
delete from public.follows fo
using public.friendships f
where f.status = 'accepted'
  and ((fo.follower = f.requester and fo.followee = f.addressee)
    or (fo.follower = f.addressee and fo.followee = f.requester));
