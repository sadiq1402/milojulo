-- #134: a Member who sees an Activity on the board (or a Circle's feed) sees its host's photos, as
-- the card shows the host's cover photo.
create or replace function public.shares_photos_with(viewer uuid, member_id uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select exists (select 1 from public.discover_pair(viewer, member_id))
    or exists (select 1 from public.connections c
               where least(c.requester_id, c.addressee_id) = least(viewer, member_id)
                 and greatest(c.requester_id, c.addressee_id) = greatest(viewer, member_id)
                 and c.status <> 'declined')
    or exists (select 1 from public.activity_requests r
               join public.activities a on a.id = r.activity_id
               where r.status in ('requested', 'accepted')
                 and ((r.requester_id = viewer and a.host_id = member_id)
                      or (r.requester_id = member_id and a.host_id = viewer)))
    or exists (select 1 from public.activity_requests mine
               join public.activity_requests theirs on theirs.activity_id = mine.activity_id
               where mine.requester_id = viewer and mine.status = 'accepted'
                 and theirs.requester_id = member_id and theirs.status = 'accepted')
    or (public.is_visible(viewer) and public.is_visible(member_id)
        and exists (select 1 from public.circle_members mine
                    join public.circle_members theirs on theirs.circle_id = mine.circle_id
                    where mine.user_id = viewer and theirs.user_id = member_id))
    or (public.is_visible(viewer)
        and exists (select 1 from public.activities a
                    where a.host_id = member_id and public.can_see_activity(a, viewer)));
$$;

-- The board, a Circle's feed and the Activity give the host's cover photo for the card's avatar.
drop function public.activity_board();
create function public.activity_board() returns table (
  id uuid,
  host_id uuid,
  host_name varchar,
  title varchar,
  type public.activity_type,
  area_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity smallint,
  spots_left integer,
  description varchar,
  starts_when text,
  is_mine boolean,
  circle_id uuid,
  circle_name varchar,
  host_photo_id uuid
)
language sql stable security definer
set search_path = ''
as $$
  select a.id, a.host_id, h.display_name, a.title, a.type, a.area_id, a.starts_at, a.ends_at, a.capacity,
    public.activity_spots_left(a.id), a.description, public.activity_starts_when(a.starts_at),
    a.host_id = auth.uid(), a.circle_id, cc.name, public.cover_photo_id(a.host_id)
  from public.activities a
  join public.profiles h on h.id = a.host_id
  left join public.circles cc on cc.id = a.circle_id and cc.is_active
  where public.is_visible(auth.uid())
    and public.can_see_activity(a, auth.uid())
  order by a.starts_at, a.id;
$$;

revoke execute on function public.activity_board() from public, anon;

drop function public.circle_activities(uuid);
create function public.circle_activities(circle_id uuid) returns table (
  id uuid,
  host_id uuid,
  host_name varchar,
  title varchar,
  type public.activity_type,
  area_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity smallint,
  spots_left integer,
  description varchar,
  starts_when text,
  is_mine boolean,
  circle_id uuid,
  circle_name varchar,
  host_photo_id uuid
)
language sql stable security definer
set search_path = ''
as $$
  select a.id, a.host_id, h.display_name, a.title, a.type, a.area_id, a.starts_at, a.ends_at, a.capacity,
    public.activity_spots_left(a.id), a.description, public.activity_starts_when(a.starts_at),
    a.host_id = auth.uid(), a.circle_id, cc.name, public.cover_photo_id(a.host_id)
  from public.activities a
  join public.profiles h on h.id = a.host_id
  left join public.circles cc on cc.id = a.circle_id and cc.is_active
  where a.circle_id = circle_activities.circle_id
    and public.is_visible(auth.uid())
    and public.can_see_activity(a, auth.uid())
  order by a.starts_at, a.id;
$$;

revoke execute on function public.circle_activities(uuid) from public, anon;

drop function public.get_activity(uuid);
create function public.get_activity(activity_id uuid) returns table (
  id uuid,
  host_id uuid,
  host_name varchar,
  title varchar,
  type public.activity_type,
  area_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity smallint,
  spots_left integer,
  description varchar,
  starts_when text,
  is_mine boolean,
  status public.activity_status,
  venue_detail varchar,
  is_locked boolean,
  my_request_id uuid,
  my_request_status public.request_status,
  connection_id uuid,
  circle_id uuid,
  circle_name varchar,
  host_photo_id uuid
)
language sql stable security definer
set search_path = ''
as $$
  select a.id, a.host_id, h.display_name, a.title, a.type, a.area_id, a.starts_at, a.ends_at, a.capacity,
    public.activity_spots_left(a.id), a.description, public.activity_starts_when(a.starts_at),
    a.host_id = auth.uid(), a.status,
    case when a.host_id = auth.uid() or mine.status = 'accepted' then v.venue_detail end,
    public.activity_is_locked(a.id), mine.id, mine.status,
    case when mine.status = 'accepted' then public.accepted_connection_id(a.host_id, auth.uid()) end,
    a.circle_id, cc.name, public.cover_photo_id(a.host_id)
  from public.activities a
  join public.profiles h on h.id = a.host_id
  left join public.activity_venues v on v.activity_id = a.id
  left join public.activity_requests mine on mine.activity_id = a.id and mine.requester_id = auth.uid()
  left join public.circles cc on cc.id = a.circle_id and cc.is_active
  where a.id = get_activity.activity_id
    and (a.host_id = auth.uid()
         or (public.is_visible(auth.uid()) and public.can_see_activity(a, auth.uid()))
         or (mine.status = 'accepted' and a.status = 'open' and public.activity_ends_at(a) > now()));
$$;

revoke execute on function public.get_activity(uuid) from public, anon;

-- The Joined screen: Activities the caller is going to (accepted, not yet over) and Join Requests still
-- waiting (open, not yet started), soonest first. Hosts that are gone or blocked drop out, as in my_join_requests.
create function public.joined_activities() returns table (
  id uuid,
  host_id uuid,
  host_name varchar,
  title varchar,
  type public.activity_type,
  area_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity smallint,
  spots_left integer,
  description varchar,
  starts_when text,
  is_mine boolean,
  circle_id uuid,
  circle_name varchar,
  host_photo_id uuid,
  request_status public.request_status
)
language sql stable security definer
set search_path = ''
as $$
  select a.id, a.host_id, h.display_name, a.title, a.type, a.area_id, a.starts_at, a.ends_at, a.capacity,
    public.activity_spots_left(a.id), a.description, public.activity_starts_when(a.starts_at),
    false, a.circle_id, cc.name, public.cover_photo_id(a.host_id), r.status
  from public.activity_requests r
  join public.activities a on a.id = r.activity_id
  join public.profiles h on h.id = a.host_id
  left join public.circles cc on cc.id = a.circle_id and cc.is_active
  where r.requester_id = auth.uid()
    and a.status = 'open'
    and ((r.status = 'accepted' and public.activity_ends_at(a) > now())
         or (r.status = 'requested' and a.starts_at > now()))
    and public.is_reachable(a.host_id)
    and not public.is_blocked(auth.uid(), a.host_id)
  order by a.starts_at, a.id;
$$;

revoke execute on function public.joined_activities() from public, anon;
