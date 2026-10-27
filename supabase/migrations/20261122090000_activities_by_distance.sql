-- Activities by distance (#203): an Activity takes its host's location when posted, and the board shows
-- the Activities within the viewer's Discover Range, nearest first within a day, with a distance band.
-- The venue text stays for the host and accepted joiners. Activities lose their Area.

alter table public.activities add column place extensions.geography(Point, 4326);

-- Existing Activities: the host's fresh point, else the Activity's Area centre.
update public.activities a
set place = coalesce(public.member_point(a.host_id),
                     (select ar.center from public.areas ar where ar.id = a.area_id));

alter table public.activities alter column place set not null;
create index activities_place_idx on public.activities using gist (place);

-- Functions that take or return the Area go first, then the column.
drop function public.post_activity(varchar, public.activity_type, text, timestamptz, timestamptz,
  smallint, varchar, varchar, uuid);
drop function public.update_activity(uuid, varchar, varchar, smallint, timestamptz, timestamptz, text, varchar);
drop function public.activity_board();
drop function public.get_activity(uuid);
drop function public.joined_activities();
drop function public.circle_activities(uuid);

alter table public.activities drop column area_id;

-- Distance band from the caller's fresh point to a place; null without a point. Internal.
create function public.band_from_me(place extensions.geography) returns text
language sql stable
set search_path = ''
as $$
  select public.distance_band(extensions.st_distance(public.member_point(auth.uid()), place));
$$;

revoke execute on function public.band_from_me(extensions.geography) from public, anon, authenticated;

create function public.post_activity(
  title varchar,
  type public.activity_type,
  starts_at timestamptz,
  ends_at timestamptz default null,
  capacity smallint default 4,
  description varchar default null,
  venue_detail varchar default null,
  circle_id uuid default null
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  here extensions.geography := public.member_point(auth.uid());
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
  insert into public.activities (host_id, title, type, place, starts_at, ends_at, capacity, description, circle_id)
  values (me, btrim(post_activity.title), post_activity.type, here, post_activity.starts_at,
          post_activity.ends_at, post_activity.capacity, nullif(btrim(post_activity.description), ''),
          post_activity.circle_id)
  returning id into new_id;
  if nullif(btrim(post_activity.venue_detail), '') is not null then
    insert into public.activity_venues (activity_id, venue_detail)
    values (new_id, btrim(post_activity.venue_detail));
  end if;
  return new_id;
end;
$$;

revoke execute on function public.post_activity(varchar, public.activity_type, timestamptz, timestamptz,
  smallint, varchar, varchar, uuid) from public, anon;

-- Null keeps a field, empty clears description or venue; Locked allows only description and more spots.
-- The place never changes.
create function public.update_activity(
  activity_id uuid,
  title varchar default null,
  description varchar default null,
  capacity smallint default null,
  starts_at timestamptz default null,
  ends_at timestamptz default null,
  venue_detail varchar default null
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  old public.activities;
  old_venue varchar;
  new_venue varchar;
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
  select v.venue_detail into old_venue from public.activity_venues v where v.activity_id = old.id;
  new_venue := case when update_activity.venue_detail is null then old_venue
                    else nullif(btrim(update_activity.venue_detail), '') end;
  new_title := coalesce(btrim(update_activity.title), old.title);
  new_start := coalesce(update_activity.starts_at, old.starts_at);
  new_end := coalesce(update_activity.ends_at, old.ends_at);
  new_capacity := coalesce(update_activity.capacity, old.capacity);

  if public.activity_is_locked(old.id)
     and (new_title <> old.title or new_start <> old.starts_at or new_end is distinct from old.ends_at
          or new_venue is distinct from old_venue or new_capacity < old.capacity) then
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

  if new_venue is null then
    delete from public.activity_venues v where v.activity_id = old.id;
  else
    insert into public.activity_venues (activity_id, venue_detail) values (old.id, new_venue)
    on conflict on constraint activity_venues_pkey do update set venue_detail = excluded.venue_detail;
  end if;
end;
$$;

revoke execute on function public.update_activity(uuid, varchar, varchar, smallint, timestamptz, timestamptz,
  varchar) from public, anon;

-- The board: Activities whose place is within the caller's Discover Range of their fresh point (none
-- without one), by start day in IST, then nearest, then start time.
create function public.activity_board() returns table (
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
  circle_id uuid,
  circle_name varchar,
  host_photo_id uuid,
  visible_until timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select a.id, a.host_id, h.display_name, a.title, a.type, public.distance_band(d.metres), a.starts_at,
    a.ends_at, a.capacity, public.activity_spots_left(a.id), a.description,
    public.activity_starts_when(a.starts_at), a.host_id = auth.uid(), a.circle_id, cc.name,
    public.cover_photo_id(a.host_id), public.activity_ends_at(a)
  from public.profiles me
  cross join lateral (select public.member_point(me.id) as point) mp
  join public.activities a on extensions.st_dwithin(a.place, mp.point, me.discover_range_km * 1000)
  cross join lateral (select extensions.st_distance(a.place, mp.point) as metres) d
  join public.profiles h on h.id = a.host_id
  left join public.circles cc on cc.id = a.circle_id and cc.is_active
  where me.id = auth.uid()
    and public.is_visible(auth.uid())
    and public.can_see_activity(a, auth.uid())
    and not exists (select 1 from public.activity_requests r
                    where r.activity_id = a.id and r.requester_id = auth.uid())
  order by (a.starts_at at time zone 'Asia/Kolkata')::date, d.metres, a.starts_at, a.id;
$$;

revoke execute on function public.activity_board() from public, anon;

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
  distance_band text,
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
  select a.id, a.host_id, h.display_name, a.title, a.type, public.band_from_me(a.place), a.starts_at,
    a.ends_at, a.capacity,
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

create function public.circle_activities(circle_id uuid) returns table (
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

-- The report snapshot of an Activity no longer carries an Area.
create or replace function public.report(
  target_type public.report_target,
  target_id uuid,
  reason public.report_reason,
  details text default null
) returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  owner uuid;
  snapshot jsonb;
  evidence_media text;
  clean_details text := nullif(trim(report.details), '');
begin
  if not exists (select 1 from public.profiles where id = me and deleted_at is null and status <> 'banned') then
    raise exception 'sign in first';
  end if;
  if report.reason is null or report.reason = 'word_filter' then
    raise exception 'choose a reason';
  end if;
  if char_length(clean_details) > 500 then
    raise exception 'keep details to 500 characters';
  end if;

  case report.target_type
    when 'profile' then
      select p.id,
             jsonb_build_object(
               'display_name', p.display_name,
               'prompts', coalesce((
                 select jsonb_agg(jsonb_build_object('question', q.text, 'answer', pp.answer)
                                  order by pp.position)
                 from public.profile_prompts pp
                 join public.prompt_questions q on q.id = pp.question_id
                 where pp.user_id = p.id), '[]'::jsonb))
        into owner, snapshot
      from public.profiles p
      where p.id = report.target_id and p.deleted_at is null;
    when 'photo' then
      select ph.user_id, jsonb_build_object('owner_id', ph.user_id, 'object_key', ph.object_key),
             ph.object_key
        into owner, snapshot, evidence_media
      from public.photos ph
      where ph.id = report.target_id and ph.uploaded_at is not null;
    when 'message' then
      select m.sender_id, public.message_evidence(m), m.media_key
        into owner, snapshot, evidence_media
      from public.messages m
      join public.connections c on c.id = m.connection_id
      where m.id = report.target_id and me in (c.requester_id, c.addressee_id);
    when 'activity' then
      select a.host_id,
             jsonb_build_object('title', a.title, 'description', a.description, 'type', a.type,
                                'starts_at', a.starts_at, 'host_id', a.host_id)
        into owner, snapshot
      from public.activities a
      where a.id = report.target_id;
    else
      null;  -- a null target_type falls through to 'nothing to report'
  end case;

  if owner is null or owner = me then
    raise exception 'nothing to report';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, target_user_id, reason, details,
                              evidence, evidence_media_key)
  values (me, report.target_type, report.target_id, owner, report.reason, clean_details, snapshot, evidence_media);

  if report.target_type = 'message' then
    return;
  end if;

  -- Serialise reports on one target so concurrent third reports can't both miss the count.
  perform pg_advisory_xact_lock(hashtextextended(report.target_id::text, 0));
  -- Word-filter flags have no reporter, and count(distinct) skips nulls.
  if (select count(distinct r.reporter_id) from public.reports r
      where r.target_type = report.target_type and r.target_id = report.target_id
        and r.created_at > now() - interval '7 days' and r.status <> 'dismissed') >= 3 then
    case report.target_type
      when 'profile' then
        update public.profiles set hidden_at = now() where id = report.target_id and hidden_at is null;
      when 'photo' then
        update public.photos set hidden_at = now() where id = report.target_id and hidden_at is null;
      when 'activity' then
        update public.activities set hidden_at = now() where id = report.target_id and hidden_at is null;
    end case;
  end if;
end;
$$;
