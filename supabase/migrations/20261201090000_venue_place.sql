-- The venue is a place chosen from Google's place search (#248, decision 70): a name, an address, an
-- optional Google place id and a point. New Activities need one; older ones keep their typed venue.
-- A venue point is a public place the host chose, not a Member Location (hard rule 7 is untouched),
-- and the Activity's distance band keeps using where the host was when posting.

alter table public.activity_venues
  alter column venue_detail drop not null,
  add column name varchar(200),
  add column address varchar(400),
  add column google_place_id varchar(300),
  add column point extensions.geography(Point, 4326),
  add constraint activity_venues_typed_or_place
    check (venue_detail is not null or (name is not null and point is not null));

-- A place's point, or null when the name or a valid coordinate is missing. Internal.
create function public.venue_point(name varchar, lat double precision, lng double precision)
returns extensions.geography
language sql immutable
set search_path = ''
as $$
  select case when nullif(btrim(name), '') is not null and lat between -90 and 90 and lng between -180 and 180
    then extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography end;
$$;

revoke execute on function public.venue_point(varchar, double precision, double precision)
  from public, anon, authenticated;

drop function public.post_activity(varchar, public.activity_type, timestamptz, timestamptz,
  smallint, varchar, varchar, uuid);
drop function public.update_activity(uuid, varchar, varchar, smallint, timestamptz, timestamptz, varchar);
drop function public.get_activity(uuid);

create function public.post_activity(
  title varchar,
  type public.activity_type,
  starts_at timestamptz,
  ends_at timestamptz default null,
  capacity smallint default 4,
  description varchar default null,
  circle_id uuid default null,
  place_name varchar default null,
  place_address varchar default null,
  place_google_id varchar default null,
  place_lat double precision default null,
  place_lng double precision default null
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  here extensions.geography := public.member_point(auth.uid());
  venue extensions.geography := public.venue_point(place_name, place_lat, place_lng);
  new_id uuid;
begin
  if (select paused_at is not null from public.profiles where id = me) then
    raise exception 'unpause your profile to post activities';
  end if;
  if not public.is_visible(me) then
    raise exception 'your profile is not visible';
  end if;
  if here is null then
    raise exception 'turn on location to post an activity';
  end if;
  if post_activity.circle_id is not null
     and not exists (select 1 from public.circle_members cm
                     join public.circles c on c.id = cm.circle_id and c.is_active
                     where cm.circle_id = post_activity.circle_id and cm.user_id = me) then
    raise exception 'join the circle to post to it';
  end if;
  perform public.check_activity(post_activity.title, post_activity.starts_at, post_activity.ends_at,
                                post_activity.capacity, true);
  if venue is null then
    raise exception 'an activity needs a place';
  end if;
  insert into public.activities (host_id, title, type, place, starts_at, ends_at, capacity, description, circle_id)
  values (me, btrim(post_activity.title), post_activity.type, here, post_activity.starts_at,
          post_activity.ends_at, post_activity.capacity, nullif(btrim(post_activity.description), ''),
          post_activity.circle_id)
  returning id into new_id;
  insert into public.activity_venues (activity_id, name, address, google_place_id, point)
  values (new_id, btrim(place_name), nullif(btrim(place_address), ''), nullif(btrim(place_google_id), ''), venue);
  return new_id;
end;
$$;

revoke execute on function public.post_activity(varchar, public.activity_type, timestamptz, timestamptz,
  smallint, varchar, uuid, varchar, varchar, varchar, double precision, double precision) from public, anon;

-- Null keeps a field and an empty description clears it. A place given replaces the venue (a typed one
-- too); it cannot be cleared. Locked allows only description and more spots.
create function public.update_activity(
  activity_id uuid,
  title varchar default null,
  description varchar default null,
  capacity smallint default null,
  starts_at timestamptz default null,
  ends_at timestamptz default null,
  place_name varchar default null,
  place_address varchar default null,
  place_google_id varchar default null,
  place_lat double precision default null,
  place_lng double precision default null
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  old public.activities;
  old_venue public.activity_venues;
  new_point extensions.geography;
  venue_changed boolean := false;
  new_title varchar;
  new_start timestamptz;
  new_end timestamptz;
  new_capacity smallint;
begin
  select * into old from public.activities a
  where a.id = update_activity.activity_id and a.host_id = auth.uid() and a.status = 'open'
  for update;
  if not found then
    raise exception 'no activity to change';
  end if;
  select * into old_venue from public.activity_venues v where v.activity_id = old.id;
  if place_name is not null then
    new_point := public.venue_point(place_name, place_lat, place_lng);
    if new_point is null then
      raise exception 'an activity needs a place';
    end if;
    venue_changed := old_venue.point is null
      or old_venue.venue_detail is not null
      or old_venue.name is distinct from btrim(place_name)
      or old_venue.address is distinct from nullif(btrim(place_address), '')
      or old_venue.google_place_id is distinct from nullif(btrim(place_google_id), '')
      or not extensions.st_equals(old_venue.point::extensions.geometry, new_point::extensions.geometry);
  end if;
  new_title := coalesce(btrim(update_activity.title), old.title);
  new_start := coalesce(update_activity.starts_at, old.starts_at);
  new_end := coalesce(update_activity.ends_at, old.ends_at);
  new_capacity := coalesce(update_activity.capacity, old.capacity);

  if public.activity_is_locked(old.id)
     and (new_title <> old.title or new_start <> old.starts_at or new_end is distinct from old.ends_at
          or venue_changed or new_capacity < old.capacity) then
    raise exception 'this activity is locked: only its description and a higher number of spots can change';
  end if;
  perform public.check_activity(new_title, new_start, new_end, new_capacity,
                                new_start <> old.starts_at);

  update public.activities a
  set title = new_title,
      description = case when update_activity.description is null then a.description
                         else nullif(btrim(update_activity.description), '') end,
      capacity = new_capacity,
      starts_at = new_start,
      ends_at = new_end
  where a.id = old.id;

  if venue_changed then
    insert into public.activity_venues (activity_id, name, address, google_place_id, point)
    values (old.id, btrim(place_name), nullif(btrim(place_address), ''), nullif(btrim(place_google_id), ''),
            new_point)
    on conflict on constraint activity_venues_pkey do update
    set venue_detail = null, name = excluded.name, address = excluded.address,
        google_place_id = excluded.google_place_id, point = excluded.point;
  end if;
end;
$$;

revoke execute on function public.update_activity(uuid, varchar, varchar, smallint, timestamptz, timestamptz,
  varchar, varchar, varchar, double precision, double precision) from public, anon;

-- As before (decision 69), plus the chosen place: name, address, Google place id and point.
create function public.get_activity(activity_id uuid) returns table (
  id uuid,
  host_id uuid,
  host_name varchar,
  title varchar,
  type public.activity_type,
  distance_band text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity smallint,
  spots_left integer,
  description varchar,
  starts_when text,
  is_mine boolean,
  status public.activity_status,
  venue_detail varchar,
  venue_name varchar,
  venue_address varchar,
  venue_place_id varchar,
  venue_lat double precision,
  venue_lng double precision,
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
  select a.id, a.host_id, h.display_name, a.title, a.type, public.band_from_me(a.place), a.starts_at,
    a.ends_at, a.capacity,
    public.activity_spots_left(a.id), a.description, public.activity_starts_when(a.starts_at),
    a.host_id = auth.uid(), a.status,
    v.venue_detail, v.name, v.address, v.google_place_id,
    extensions.st_y(v.point::extensions.geometry), extensions.st_x(v.point::extensions.geometry),
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

-- Where the places function biases its search: the Member's fresh Member Location, rounded to about
-- 1 km. Only that function reads it, and it never reaches the phone. Service role only.
create function public.place_search_bias(member_id uuid) returns table (lat double precision, lng double precision)
language sql stable security definer
set search_path = ''
as $$
  select round(extensions.st_y(m.p::extensions.geometry)::numeric, 2)::double precision,
         round(extensions.st_x(m.p::extensions.geometry)::numeric, 2)::double precision
  from (select public.member_point(place_search_bias.member_id) as p) m
  where m.p is not null;
$$;

revoke execute on function public.place_search_bias(uuid) from public, anon, authenticated;
grant execute on function public.place_search_bias(uuid) to service_role;
