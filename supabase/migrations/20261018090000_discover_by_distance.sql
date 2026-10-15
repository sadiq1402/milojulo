-- Discover by distance (#103, decisions 38 and 42): everyone visible within the viewer's range, no Mode
-- overlap needed, Casual only to Casual, distance as a ranking signal and a rounded band on cards.

-- Where MiloJulo runs. A new city is a row (added by a migration or an admin), not a code change.
create table public.service_regions (
  id smallint generated always as identity primary key,
  name text not null unique,
  min_lat double precision not null,
  max_lat double precision not null,
  min_lng double precision not null,
  max_lng double precision not null,
  active boolean not null default true,
  check (min_lat < max_lat and min_lng < max_lng)
);
alter table public.service_regions enable row level security;
-- No policies and no grants: clients neither read nor write it; only security definer functions do.
revoke all on public.service_regions from anon, authenticated;

insert into public.service_regions (name, min_lat, max_lat, min_lng, max_lng)
values ('Pune', 18.40, 18.75, 73.65, 74.05);

-- The active region holding a point, or null. Internal.
create function public.region_of(point extensions.geography) returns smallint
language sql stable
set search_path = ''
as $$
  select r.id from public.service_regions r
  where r.active
    and extensions.st_y(point::extensions.geometry) between r.min_lat and r.max_lat
    and extensions.st_x(point::extensions.geometry) between r.min_lng and r.max_lng
  order by r.id
  limit 1;
$$;

revoke execute on function public.region_of(extensions.geography) from public, anon, authenticated, service_role;

-- A point outside every active region is refused; inside a region, an hour apart, no move is implausible.
create or replace function public.set_location(lat double precision, lng double precision) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  raw extensions.geography;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and deleted_at is null) then
    raise exception 'create your profile first';
  end if;
  if lat is not null and lng is not null then
    raw := extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography;
  end if;
  if raw is null or public.region_of(raw) is null then
    raise exception 'MiloJulo isn''t in your city yet';
  end if;
  if exists (select 1 from public.member_locations
             where user_id = auth.uid() and updated_at > now() - interval '1 hour') then
    raise exception 'you can update your location once an hour';
  end if;

  -- The first update draws the offset (column defaults); every update then stores the point moved by it.
  insert into public.member_locations (user_id, point) values (auth.uid(), raw)
  on conflict (user_id) do update set updated_at = now();
  update public.member_locations
  set point = extensions.st_project(raw, offset_m, offset_azimuth)
  where user_id = auth.uid();
end;
$$;

-- A location older than 7 days is ignored: the Area centre stands in.
create or replace function public.member_point(member_id uuid) returns extensions.geography
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select l.point from public.member_locations l
     where l.user_id = member_id and l.updated_at > now() - interval '7 days'),
    (select a.center from public.profiles p join public.areas a on a.id = p.area_id where p.id = member_id));
$$;

-- For the app: false when the Member's point lies in no active region ("MiloJulo isn't in your city yet").
create function public.in_service_region() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.region_of(public.member_point(auth.uid())) is not null;
$$;

revoke execute on function public.in_service_region() from public, anon;

-- Is other within owner's Discover Range? Null range: anywhere in owner's region. Internal.
create function public.within_range(owner uuid, other uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(case when p.discover_range_km is null
    then public.region_of(public.member_point(owner)) = public.region_of(public.member_point(other))
    else extensions.st_distance(public.member_point(owner), public.member_point(other)) <= p.discover_range_km * 1000
  end, false)
  from public.profiles p where p.id = owner;
$$;

-- The Modes of member that viewer may see. A Member who chose Casual is shown only to Casual Members;
-- a Dating Mode needs both sides' Dating Preferences and member's own range to include viewer. Internal.
create function public.discover_modes(viewer uuid, member uuid) returns public.mode[]
language sql stable
set search_path = ''
as $$
  select case when 'casual' = any (pb.modes) and not 'casual' = any (pa.modes) then '{}'::public.mode[]
    else array(
      select m from unnest(pb.modes) m
      where m not in ('dating', 'serious', 'casual')
         or (public.fits_dating_preferences(viewer, member) and public.fits_dating_preferences(member, viewer)
             and public.within_range(member, viewer))
      order by m)
  end
  from public.profiles pa, public.profiles pb
  where pa.id = viewer and pb.id = member;
$$;

-- '<2 km' or '~N km': never finer than a kilometre.
create function public.distance_band(metres double precision) returns text
language sql immutable
set search_path = ''
as $$
  select case when metres < 2000 then '<2 km' else '~' || round(metres / 1000)::integer || ' km' end;
$$;

-- Who viewer may discover: both visible, no Block, within viewer's range, at least one Mode to see.
-- One row with the Modes, the shared ones and the distance; none otherwise. Internal.
create function public.discover_pair(viewer uuid, member uuid)
returns table (their_modes public.mode[], shared_modes public.mode[], distance_m double precision)
language sql stable
set search_path = ''
as $$
  select x.modes,
    array(select m from unnest(x.modes) m where m = any (me.modes) order by m),
    extensions.st_distance(public.member_point(viewer), public.member_point(member))
  from public.profiles me
  cross join lateral (select public.discover_modes(viewer, member) as modes) x
  where me.id = viewer
    and viewer <> member
    and public.is_visible(viewer)
    and public.is_visible(member)
    and not public.is_blocked(viewer, member)
    and public.within_range(viewer, member)
    and cardinality(x.modes) > 0;
$$;

create function public.mode_phrase(m public.mode) returns text
language sql immutable
set search_path = ''
as $$
  select case m
    when 'friends' then 'friends'
    when 'activities' then 'activity partners'
    when 'networking' then 'professional contacts'
    when 'dating' then 'dates'
    when 'serious' then 'something serious'
    when 'casual' then 'something casual'
  end;
$$;

-- 'You both ...' from what is shared; the other Member's Modes when none is; then the distance.
create or replace function public.match_reason(a uuid, b uuid) returns text
language sql stable
set search_path = ''
as $$
  select concat_ws(' ',
    'You both ' || case cardinality(parts)
      when 1 then parts[1]
      else array_to_string(parts[1:cardinality(parts) - 1], ', ') || ', and ' || parts[cardinality(parts)]
    end || '.',
    case when cardinality(d.shared_modes) = 0 then
      pb.display_name || ' wants '
      || public.english_list(array(select public.mode_phrase(m) from unnest(d.their_modes) m)) || '.'
    end,
    case when d.distance_m < 2000 then 'Less than 2 km away.'
      else 'About ' || round(d.distance_m / 1000)::integer || ' km away.' end)
  from public.discover_pair(a, b) d
  join public.profiles pa on pa.id = a
  join public.profiles pb on pb.id = b
  cross join lateral (
    select array_remove(array[
      'want ' || public.english_list(array(select public.mode_phrase(m) from unnest(d.shared_modes) m)),
      'like ' || public.english_list(array(select lower(label) from public.shared_tags(a, b) limit 2)),
      'are free on ' || public.english_list(array(
        select replace(s::text, '_', ' ') from (
          select unnest(pa.availability) s intersect select unnest(pb.availability)
          order by 1) shared))
    ], null) parts) r;
$$;

revoke execute on function public.within_range(uuid, uuid), public.discover_modes(uuid, uuid),
  public.distance_band(double precision), public.discover_pair(uuid, uuid), public.mode_phrase(public.mode)
  from public, anon, authenticated;

-- Cursor is rank:score:id (opaque). Score: shared tags, shared availability, shared Modes, and nearness
-- (3 under 2 km, 2 under 5, 1 up to 10). The Networking filter ranks by shared Industry and Career Stage first.
drop function public.discover_feed(public.mode, integer, text);
create function public.discover_feed(
  mode_filter public.mode default null,
  page_size integer default 20,
  after text default null
) returns table (
  user_id uuid,
  display_name varchar,
  age integer,
  area_id text,
  modes public.mode[],
  their_modes public.mode[],
  distance_band text,
  cover_photo_id uuid,
  shared_tag_ids smallint[],
  why_you_match text,
  cursor text
)
language sql stable security definer
set search_path = ''
as $$
  with candidates as (
    select p.*, me.id as viewer_id, d.their_modes, d.shared_modes, d.distance_m,
      case when mode_filter = 'networking'
        then coalesce(p.industry_id = me.industry_id, false)::integer
             + coalesce(p.career_stage = me.career_stage, false)::integer
        else 0
      end as rank,
      (select count(*) from public.shared_tags(me.id, p.id))::integer
      + cardinality(array(select unnest(p.availability) intersect select unnest(me.availability)))
      + cardinality(d.shared_modes)
      + case when d.distance_m < 2000 then 3 when d.distance_m < 5000 then 2 when d.distance_m <= 10000 then 1
             else 0 end as score
    from public.profiles me
    join public.profiles p on p.id <> me.id
    cross join lateral public.discover_pair(me.id, p.id) d
    where me.id = auth.uid()
  )
  select
    c.id,
    c.display_name,
    public.age_of(c.date_of_birth),
    c.area_id,
    c.shared_modes,
    c.their_modes,
    public.distance_band(c.distance_m),
    (select ph.id from public.photos ph
     where ph.user_id = c.id and ph.uploaded_at is not null
       and ph.hidden_at is null and ph.removed_at is null
     order by ph.position limit 1),
    array(select id from public.shared_tags(c.viewer_id, c.id)),
    public.match_reason(c.viewer_id, c.id),
    c.rank || ':' || c.score || ':' || c.id
  from candidates c
  where (mode_filter is null or mode_filter = any (c.their_modes))
    and (after is null
         or (c.rank, c.score, c.id) < (split_part(after, ':', 1)::integer, split_part(after, ':', 2)::integer,
                                       split_part(after, ':', 3)::uuid))
  order by c.rank desc, c.score desc, c.id desc
  limit least(greatest(page_size, 1), 50);
$$;

revoke execute on function public.discover_feed(public.mode, integer, text) from public, anon;

-- The full profile, under the feed's rules.
drop function public.get_profile(uuid);
create function public.get_profile(member_id uuid) returns table (
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
  availability public.availability_slot[]
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
    p.availability
  from public.profiles p
  cross join lateral public.discover_pair(auth.uid(), p.id) d
  where p.id = member_id;
$$;

revoke execute on function public.get_profile(uuid) from public, anon;

-- Whether the viewer may see another Member's photos: they could open each other in Discover or the
-- profile view, or they share a Connection (any but declined, so history keeps its faces), a
-- waiting or accepted Join Request, or a place among an Activity's accepted joiners. Join Requests
-- count whatever became of the Activity since (cancelled or over), as history.
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
                 and theirs.requester_id = member_id and theirs.status = 'accepted');
$$;
