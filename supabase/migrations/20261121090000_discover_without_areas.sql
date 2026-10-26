-- Discover without Areas (#203): MiloJulo goes global. A Member is measured only from a Member Location
-- updated in the last 7 days; with none, they are not a Discover candidate and see nobody. Service
-- Regions and the Area on a profile go; Discover Range is 2, 5, 10, 25, 50 or 100 km. Activities and
-- Circles keep their Area for now.

-- Locations are taken anywhere in the world: no more Service Regions.
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
  if lat is null or lng is null or lat not between -90 and 90 or lng not between -180 and 180 then
    raise exception 'that location is not valid';
  end if;
  if exists (select 1 from public.member_locations
             where user_id = auth.uid() and updated_at > now() - interval '1 hour') then
    raise exception 'you can update your location once an hour';
  end if;

  raw := extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography;
  -- The first update draws the offset (column defaults); every update then stores the point moved by it.
  insert into public.member_locations (user_id, point) values (auth.uid(), raw)
  on conflict (user_id) do update set updated_at = now();
  update public.member_locations
  set point = extensions.st_project(raw, offset_m, offset_azimuth)
  where user_id = auth.uid();
end;
$$;

drop function public.in_service_region();
drop function public.region_of(extensions.geography);
drop table public.service_regions;

-- The Member's offset point if updated in the last 7 days, else null: no fallback. Internal.
create or replace function public.member_point(member_id uuid) returns extensions.geography
language sql stable security definer
set search_path = ''
as $$
  select l.point from public.member_locations l
  where l.user_id = member_id and l.updated_at > now() - interval '7 days';
$$;

-- For the app: whether the caller has a location Discover can use (else it asks for one).
create function public.has_fresh_location() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.member_point(auth.uid()) is not null;
$$;

revoke execute on function public.has_fresh_location() from public, anon;
grant execute on function public.has_fresh_location() to authenticated;

-- Is other within owner's Discover Range? False unless both have a fresh point. Internal.
create or replace function public.within_range(owner uuid, other uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(
    extensions.st_distance(public.member_point(owner), public.member_point(other)) <= p.discover_range_km * 1000,
    false)
  from public.profiles p where p.id = owner;
$$;

-- Dating distance is measured between the two Members' points; without one, it doesn't fit. Internal.
create or replace function public.fits_dating_preferences(seeker uuid, candidate uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(c.gender = any (s.pref_genders)
                  and public.age_of(c.date_of_birth) between s.pref_age_min and s.pref_age_max
                  and extensions.st_distance(public.member_point(seeker), public.member_point(candidate))
                      <= s.pref_max_km * 1000, false)
  from public.profiles s
  cross join public.profiles c
  where s.id = seeker and c.id = candidate;
$$;

-- Discover Range: no "anywhere" any more; those who had it get the widest range.
update public.profiles set discover_range_km = 100 where discover_range_km is null;
alter table public.profiles drop constraint profiles_discover_range_km_check;
alter table public.profiles
  add constraint profiles_discover_range_km_check check (discover_range_km in (2, 5, 10, 25, 50, 100)),
  alter column discover_range_km set not null,
  alter column discover_range_km set default 10;

create index member_locations_point_idx on public.member_locations using gist (point);

-- Functions that return the Area go first, then the column.
drop function public.discover_feed(public.mode[], integer, text);
drop function public.get_profile(uuid);
drop function public.my_connections();
drop function public.activity_join_requests(uuid);
drop function public.circle_members_of(uuid);
drop trigger enforce_profile_minimum on public.profiles;

alter table public.profiles drop column area_id;

-- The profile minimum without an Area.
create or replace function public.profile_minimum_gap(member_id uuid) returns text
language sql stable
set search_path = ''
as $$
  select case
    when p.display_name is null then 'add your first name'
    when cardinality(p.modes) = 0 then 'choose at least one mode'
    when p.modes && '{dating,serious,casual}' and p.gender is null then 'add your gender'
    when p.modes && '{dating,serious,casual}'
      and (coalesce(cardinality(p.pref_genders), 0) = 0 or p.pref_age_min is null
           or p.pref_age_max is null or p.pref_max_km is null) then 'set your dating preferences'
    when (select count(*) from public.profile_prompts where user_id = p.id) < 2 then 'answer 2 prompts'
    when (select count(*) from public.photos
          where user_id = p.id and uploaded_at is not null
            and hidden_at is null and removed_at is null) < 2 then 'add at least 2 photos'
  end
  from public.profiles p
  where p.id = member_id;
$$;

create or replace function public.enforce_profile_minimum() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'profiles' then
    if new.submitted_at is not null then
      if new.display_name is null then raise exception 'add your first name'; end if;
      if cardinality(new.modes) = 0 then raise exception 'choose at least one mode'; end if;
      if new.modes && '{dating,serious,casual}' then
        if new.gender is null then raise exception 'add your gender'; end if;
        if coalesce(cardinality(new.pref_genders), 0) = 0 or new.pref_age_min is null
           or new.pref_age_max is null or new.pref_max_km is null then
          raise exception 'set your dating preferences';
        end if;
      end if;
    end if;
    return new;
  end if;

  -- During account deletion the profile is already gone, so nothing is checked.
  if not exists (select 1 from public.profiles where id = old.user_id and submitted_at is not null) then
    return old;
  end if;

  if tg_table_name = 'profile_prompts' then
    raise exception 'answer 2 prompts';
  end if;

  if old.uploaded_at is not null and old.hidden_at is null and old.removed_at is null
     and (select count(*) from public.photos
          where user_id = old.user_id and uploaded_at is not null
            and hidden_at is null and removed_at is null) < 2 then
    raise exception 'add at least 2 photos';
  end if;
  return old;
end;
$$;

create trigger enforce_profile_minimum before update of display_name, modes, gender,
  pref_genders, pref_age_min, pref_age_max, pref_max_km on public.profiles
  for each row execute function public.enforce_profile_minimum();

-- The functions that returned the Area, without it; otherwise as before.
create function public.discover_feed(
  mode_filter public.mode[] default null,
  page_size integer default 20,
  after text default null
) returns table (
  user_id uuid,
  display_name varchar,
  age integer,
  modes public.mode[],
  their_modes public.mode[],
  distance_band text,
  photo_ids uuid[],
  shared_tag_ids smallint[],
  why_you_match text,
  cursor text
)
language sql stable security definer
set search_path = ''
as $$
  with candidates as (
    select p.*, me.id as viewer_id, d.their_modes, d.shared_modes, d.distance_m,
      case when mode_filter = '{networking}'::public.mode[]
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
      and public.active_connection_id(me.id, p.id) is null
  )
  select
    c.id,
    c.display_name,
    public.age_of(c.date_of_birth),
    c.shared_modes,
    c.their_modes,
    public.distance_band(c.distance_m),
    array(select ph.id from public.photos ph
          where ph.user_id = c.id and ph.uploaded_at is not null
            and ph.hidden_at is null and ph.removed_at is null
          order by ph.position),
    array(select id from public.shared_tags(c.viewer_id, c.id)),
    public.match_reason(c.viewer_id, c.id),
    c.rank || ':' || c.score || ':' || c.id
  from candidates c
  where (coalesce(cardinality(mode_filter), 0) = 0 or mode_filter && c.their_modes)
    and (after is null
         or (c.rank, c.score, c.id) < (split_part(after, ':', 1)::integer, split_part(after, ':', 2)::integer,
                                       split_part(after, ':', 3)::uuid))
  order by c.rank desc, c.score desc, c.id desc
  limit least(greatest(page_size, 1), 50);
$$;

revoke execute on function public.discover_feed(public.mode[], integer, text) from public, anon;

create function public.get_profile(member_id uuid) returns table (
  user_id uuid,
  display_name varchar,
  age integer,
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

create function public.my_connections() returns table (
  connection_id uuid,
  other_id uuid,
  other_name varchar,
  other_photo_id uuid,
  mode public.mode,
  status public.connection_status,
  direction public.connection_direction,
  note varchar,
  last_message_type public.message_type,
  last_message_body text,
  last_message_at timestamptz,
  unread_count integer
)
language sql stable security definer
set search_path = ''
as $$
  select c.id, o.id, o.display_name,
    -- A hidden or removed cover gives way to the next live photo; banned or Auto-hidden
    -- Members stay in history without one until restored.
    case when o.status = 'active' and o.hidden_at is null then
      (select ph.id from public.photos ph
       where ph.user_id = o.id and ph.uploaded_at is not null
         and ph.hidden_at is null and ph.removed_at is null
       order by ph.position limit 1)
    end,
    c.mode, c.status, side.direction, c.note,
    last.type, last.body, last.created_at,
    (select count(*) from public.messages m
     where m.connection_id = c.id and m.sender_id <> auth.uid() and m.removed_at is null
       and m.created_at > coalesce(me.last_read_at, '-infinity'))::integer
  from public.connections c
  cross join lateral (
    select case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end,
           case when c.requester_id = auth.uid() then 'outgoing' else 'incoming' end::public.connection_direction
  ) side (other_id, direction)
  join public.profiles o on o.id = side.other_id
  left join public.connection_members me on me.connection_id = c.id and me.user_id = auth.uid()
  left join lateral (
    select m.type, m.body, m.created_at from public.messages m
    where m.connection_id = c.id and m.removed_at is null
    order by m.created_at desc limit 1
  ) last on true
  where auth.uid() in (c.requester_id, c.addressee_id)
    and c.status <> 'declined'
    and o.deleted_at is null
  order by coalesce(last.created_at, c.responded_at, c.created_at) desc;
$$;

revoke execute on function public.my_connections() from public, anon;

create function public.activity_join_requests(activity_id uuid) returns table (
  request_id uuid,
  requester_id uuid,
  requester_name varchar,
  requester_photo_id uuid,
  status public.request_status,
  created_at timestamptz,
  connection_id uuid
)
language sql stable security definer
set search_path = ''
as $$
  select r.id, p.id, p.display_name, public.cover_photo_id(p.id), r.status, r.created_at,
    case when r.status = 'accepted' then public.accepted_connection_id(a.host_id, p.id) end
  from public.activity_requests r
  join public.activities a on a.id = r.activity_id
  join public.profiles p on p.id = r.requester_id
  where r.activity_id = activity_join_requests.activity_id
    and a.host_id = auth.uid()
    and r.status in ('requested', 'accepted')
    and public.is_reachable(p.id)
    and not public.is_blocked(a.host_id, p.id)
  order by r.created_at, r.id;
$$;

revoke execute on function public.activity_join_requests(uuid) from public, anon;

create function public.circle_members_of(circle_id uuid) returns table (
  member_id uuid,
  display_name varchar,
  cover_photo_id uuid
)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.display_name, public.cover_photo_id(p.id)
  from public.circle_members cm
  join public.profiles p on p.id = cm.user_id
  where cm.circle_id = circle_members_of.circle_id
    and public.is_visible(auth.uid())
    and public.is_circle_member(circle_members_of.circle_id, auth.uid())
    and p.id <> auth.uid()
    and public.is_visible(p.id)
    and not public.is_blocked(auth.uid(), p.id)
  order by p.display_name, p.id;
$$;

revoke execute on function public.circle_members_of(uuid) from public, anon;
