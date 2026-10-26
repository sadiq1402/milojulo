-- #200: a Connection Request may be sent when nothing overlaps, under one of the sender's own
-- Modes as well as the other's. The app warns first; the database allows it.
--
-- `eligible_modes` is not widened: Discover uses it for the Modes two Members actually share and
-- for who appears in the feed at all, and both must keep meaning what they mean.
--
-- Two guards stay (decision 39 and the dating preferences): Casual needs both sides to have chosen
-- it, and the dating Modes still need each side to fit the other's age, gender and distance.
create function public.requestable_modes(a uuid, b uuid) returns public.mode[]
language sql stable
set search_path = ''
as $$
  select array(
    select distinct m from unnest(pa.modes || pb.modes) m
    where (m <> 'casual' or ('casual' = any (pa.modes) and 'casual' = any (pb.modes)))
      and (m not in ('dating', 'serious', 'casual')
           or (public.fits_dating_preferences(a, b) and public.fits_dating_preferences(b, a)
               and public.within_range(b, a)))
    order by m)
  from public.profiles pa, public.profiles pb
  where pa.id = a and pb.id = b;
$$;

revoke execute on function public.requestable_modes(uuid, uuid) from public, anon, authenticated;

-- The profile lists what the viewer may ask under, which is now both sides' Modes.
create or replace function public.get_profile(member_id uuid) returns table (
  user_id uuid,
  display_name varchar,
  age integer,
  area_id text,
  modes public.mode[],
  their_modes public.mode[],
  distance_band text,
  why_you_match text,
  photo_ids uuid[],
  prompts jsonb,
  tag_ids smallint[],
  availability public.availability_slot[],
  request_modes public.mode[]
)
language sql stable security definer
set search_path = ''
as $$
  select
    p.id,
    p.display_name,
    public.age_of(p.date_of_birth),
    p.area_id,
    d.shared_modes,
    d.their_modes,
    public.distance_band(d.distance_m),
    public.match_reason(auth.uid(), p.id),
    array(select ph.id from public.photos ph
          where ph.user_id = p.id and ph.uploaded_at is not null
            and ph.hidden_at is null and ph.removed_at is null
          order by ph.position),
    (select jsonb_agg(jsonb_build_object('position', pp.position, 'question_id', pp.question_id,
                                         'answer', pp.answer) order by pp.position)
     from public.profile_prompts pp where pp.user_id = p.id),
    array(select t.id from public.tags t
          join public.profile_tags pt on pt.tag_id = t.id and pt.user_id = p.id
          order by t.sort_order),
    p.availability,
    public.requestable_modes(auth.uid(), p.id)
  from public.profiles p
  cross join lateral public.discover_pair(auth.uid(), p.id) d
  where p.id = member_id;
$$;
revoke execute on function public.get_profile(uuid) from public, anon;

-- The request itself follows the same rule.
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
  if not send_request.mode = any (public.requestable_modes(me, to_member)) then
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
