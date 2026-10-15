-- Decision 43 (#118): a request goes only to a Member the sender could see in Discover, so the sender's
-- Discover Range (no range: their Service Region) now applies as well. Accepting a request is not
-- re-checked, and nor is a Mode Change inside an accepted Connection.
create or replace function public.send_request(to_member uuid, mode public.mode, note varchar default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  -- One send at a time per sender, so concurrent calls cannot slip past the Request Cap.
  perform 1 from public.profiles where id = me for update;
  if (select paused_at is not null from public.profiles where id = me) then
    raise exception 'unpause your profile to send requests';
  end if;
  if not public.is_visible(me) then
    raise exception 'your profile is not visible';
  end if;
  if public.is_blocked(me, to_member) or not public.is_visible(to_member) then
    raise exception 'you cannot send a request to this member';
  end if;
  if not public.within_range(me, to_member) then
    raise exception 'that member is not in your Discover';
  end if;
  if not send_request.mode = any (public.eligible_modes(me, to_member)) then
    raise exception 'that mode is not open between you';
  end if;
  if exists (select 1 from public.connections c
             where least(c.requester_id, c.addressee_id) = least(me, to_member)
               and greatest(c.requester_id, c.addressee_id) = greatest(me, to_member)
               and c.status in ('requested', 'accepted')) then
    raise exception 'you already have a connection or request with this member';
  end if;
  if exists (select 1 from public.connections c
             where c.requester_id = me and c.addressee_id = to_member and c.status = 'declined'
               and c.responded_at > now() - interval '30 days') then
    raise exception 'this member declined your request recently';
  end if;
  if (select count(*) from public.connections
      where requester_id = me and activity_id is null and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'you have sent 10 requests in the last 24 hours';
  end if;
  insert into public.connections (requester_id, addressee_id, mode, note)
  values (me, to_member, send_request.mode, send_request.note)
  returning id into new_id;
  return new_id;
end;
$$;
