create type public.request_status as enum ('requested', 'accepted', 'declined', 'cancelled', 'withdrawn');

-- One Join Request per Member per Activity, ever; writes only through the functions below.
create table public.activity_requests (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  status public.request_status not null default 'requested',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  withdrawn_at timestamptz,
  constraint activity_requests_one_per_member unique (activity_id, requester_id)
);
create index on public.activity_requests (requester_id, created_at);
alter table public.activity_requests enable row level security;
revoke all on public.activity_requests from anon, authenticated;
grant select on public.activity_requests to authenticated;

-- Members cannot read activities, so the policy asks a definer function about the caller only.
create function public.hosts_activity(activity_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.activities a
                 where a.id = hosts_activity.activity_id and a.host_id = auth.uid());
$$;

revoke execute on function public.hosts_activity(uuid) from public, anon;

create policy "requester and host read a Join Request" on public.activity_requests for select to authenticated
  using (requester_id = (select auth.uid()) or public.hosts_activity(activity_id));

-- The Activity that created an Activity Connection.
alter table public.connections
  add column activity_id uuid references public.activities (id) on delete set null;
create index on public.connections (activity_id) where activity_id is not null;

create or replace function public.activity_spots_left(activity_id uuid) returns integer
language sql stable
set search_path = ''
as $$
  select a.capacity - (select count(*)::integer from public.activity_requests r
                       where r.activity_id = a.id and r.status = 'accepted')
  from public.activities a where a.id = activity_spots_left.activity_id;
$$;

create or replace function public.activity_is_locked(activity_id uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select exists (select 1 from public.activity_requests r
                 where r.activity_id = activity_is_locked.activity_id and r.status = 'accepted');
$$;

-- The pair's accepted Connection, if any.
create function public.accepted_connection_id(a uuid, b uuid) returns uuid
language sql stable
set search_path = ''
as $$
  select c.id from public.connections c
  where least(c.requester_id, c.addressee_id) = least(a, b)
    and greatest(c.requester_id, c.addressee_id) = greatest(a, b)
    and c.status = 'accepted';
$$;

-- First live photo, so a hidden or removed cover gives way to the next.
create function public.cover_photo_id(member_id uuid) returns uuid
language sql stable
set search_path = ''
as $$
  select ph.id from public.photos ph
  where ph.user_id = member_id and ph.uploaded_at is not null
    and ph.hidden_at is null and ph.removed_at is null
  order by ph.position limit 1;
$$;

revoke execute on function public.accepted_connection_id(uuid, uuid), public.cover_photo_id(uuid)
  from public, anon, authenticated;

create function public.join_activity_request(activity_id uuid) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  act public.activities;
  new_id uuid;
begin
  -- One join at a time per Member, so concurrent calls cannot slip past the Join Cap.
  perform 1 from public.profiles where id = me for update;
  if (select paused_at is not null from public.profiles where id = me) then
    raise exception 'unpause your profile to join activities';
  end if;
  if not public.is_visible(me) then
    raise exception 'your profile is not visible';
  end if;
  select * into act from public.activities a where a.id = join_activity_request.activity_id;
  if not found or not public.can_see_activity(act, me) then
    raise exception 'no activity to join';
  end if;
  if act.host_id = me then
    raise exception 'you cannot join your own activity';
  end if;
  if act.starts_at <= now() then
    raise exception 'this activity has already started';
  end if;
  if exists (select 1 from public.activity_requests r where r.activity_id = act.id and r.requester_id = me) then
    raise exception 'you already asked to join this activity';
  end if;
  if public.activity_spots_left(act.id) <= 0 then
    raise exception 'no spots left';
  end if;
  -- Every request made counts, whatever became of it.
  if (select count(*) from public.activity_requests r
      where r.requester_id = me and r.created_at > now() - interval '24 hours') >= 10 then
    raise exception 'you have sent 10 join requests in the last 24 hours';
  end if;
  insert into public.activity_requests (activity_id, requester_id) values (act.id, me)
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.join_activity_request(uuid) from public, anon;

-- The host answers a waiting request before the start. Accepting returns the Activity Connection:
-- the pair's accepted Connection as it is, their waiting Connection Request accepted, or a new one.
create function public.respond_activity_request(request_id uuid, accept boolean) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  act public.activities;
  req public.activity_requests;
  conn public.connections;
begin
  -- The Activity row is locked first so concurrent accepts cannot overfill its spots.
  select a.* into act from public.activities a
  join public.activity_requests r on r.activity_id = a.id
  where r.id = respond_activity_request.request_id and a.host_id = me
  for update of a;
  if found then
    select * into req from public.activity_requests r where r.id = respond_activity_request.request_id for update;
  end if;
  if act.id is null or req.status is distinct from 'requested' or act.status <> 'open' or act.starts_at <= now()
     or public.is_blocked(me, req.requester_id) then
    raise exception 'no join request to answer';
  end if;

  if not accept then
    update public.activity_requests set status = 'declined', responded_at = now() where id = req.id;
    return null;
  end if;

  if public.activity_spots_left(act.id) <= 0 then
    raise exception 'no spots left';
  end if;
  update public.activity_requests set status = 'accepted', responded_at = now() where id = req.id;

  select * into conn from public.connections c
  where least(c.requester_id, c.addressee_id) = least(me, req.requester_id)
    and greatest(c.requester_id, c.addressee_id) = greatest(me, req.requester_id)
    and c.status in ('requested', 'accepted')
  for update;
  if not found then
    insert into public.connections (requester_id, addressee_id, mode, activity_id, status, responded_at)
    values (req.requester_id, me, 'activities', act.id, 'accepted', now())
    returning * into conn;
  elsif conn.status = 'requested' then
    update public.connections set status = 'accepted', responded_at = now() where id = conn.id;
  end if;
  return conn.id;
end;
$$;

revoke execute on function public.respond_activity_request(uuid, boolean) from public, anon;

-- The requester gives up before the start: a waiting request is cancelled, an accepted one withdrawn.
-- The Activity Connection stays.
create function public.withdraw_activity_request(request_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.activity_requests r
  set status = case when r.status = 'accepted' then 'withdrawn' else 'cancelled' end::public.request_status,
      withdrawn_at = case when r.status = 'accepted' then now() end
  from public.activities a
  where r.id = withdraw_activity_request.request_id and r.requester_id = auth.uid()
    and r.status in ('requested', 'accepted')
    and a.id = r.activity_id and a.starts_at > now();
  if not found then
    raise exception 'no join request to withdraw';
  end if;
end;
$$;

revoke execute on function public.withdraw_activity_request(uuid) from public, anon;

-- One Activity for the caller: as on the board, except that the host always reads their own and an
-- accepted joiner keeps it (even while Paused or after an Auto-hide) until it ends. Both read the venue.
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
  connection_id uuid
)
language sql stable security definer
set search_path = ''
as $$
  select a.id, a.host_id, h.display_name, a.title, a.type, a.area_id, a.starts_at, a.ends_at, a.capacity,
    public.activity_spots_left(a.id), a.description, public.activity_starts_when(a.starts_at),
    a.host_id = auth.uid(), a.status,
    case when a.host_id = auth.uid() or mine.status = 'accepted' then v.venue_detail end,
    public.activity_is_locked(a.id), mine.id, mine.status,
    case when mine.status = 'accepted' then public.accepted_connection_id(a.host_id, auth.uid()) end
  from public.activities a
  join public.profiles h on h.id = a.host_id
  left join public.activity_venues v on v.activity_id = a.id
  left join public.activity_requests mine on mine.activity_id = a.id and mine.requester_id = auth.uid()
  where a.id = get_activity.activity_id
    and (a.host_id = auth.uid()
         or (public.is_visible(auth.uid()) and public.can_see_activity(a, auth.uid()))
         or (mine.status = 'accepted' and a.status = 'open' and public.activity_ends_at(a) > now()));
$$;

revoke execute on function public.get_activity(uuid) from public, anon;

-- The host's waiting and accepted Join Requests, oldest first, without blocked (either way), banned,
-- deleted or Auto-hidden requesters. Empty for anyone else.
create function public.activity_join_requests(activity_id uuid) returns table (
  request_id uuid,
  requester_id uuid,
  requester_name varchar,
  requester_photo_id uuid,
  requester_area_id text,
  status public.request_status,
  created_at timestamptz,
  connection_id uuid
)
language sql stable security definer
set search_path = ''
as $$
  select r.id, p.id, p.display_name, public.cover_photo_id(p.id), p.area_id, r.status, r.created_at,
    case when r.status = 'accepted' then public.accepted_connection_id(a.host_id, p.id) end
  from public.activity_requests r
  join public.activities a on a.id = r.activity_id
  join public.profiles p on p.id = r.requester_id
  where r.activity_id = activity_join_requests.activity_id
    and a.host_id = auth.uid()
    and r.status in ('requested', 'accepted')
    and p.status <> 'banned' and p.deleted_at is null and p.hidden_at is null
    and not public.is_blocked(a.host_id, p.id)
  order by r.created_at, r.id;
$$;

revoke execute on function public.activity_join_requests(uuid) from public, anon;

-- Waiting Join Requests on open Activities not yet started: to my Activities (incoming) and mine
-- (outgoing), with the same exclusions for the other side, newest first.
create function public.my_join_requests() returns table (
  request_id uuid,
  activity_id uuid,
  activity_title varchar,
  activity_starts_at timestamptz,
  other_id uuid,
  other_name varchar,
  other_photo_id uuid,
  direction public.connection_direction,
  created_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select r.id, a.id, a.title, a.starts_at, o.id, o.display_name, public.cover_photo_id(o.id),
    side.direction, r.created_at
  from public.activity_requests r
  join public.activities a on a.id = r.activity_id
  cross join lateral (
    select case when r.requester_id = auth.uid() then a.host_id else r.requester_id end,
           case when r.requester_id = auth.uid() then 'outgoing' else 'incoming' end::public.connection_direction
  ) side (other_id, direction)
  join public.profiles o on o.id = side.other_id
  where auth.uid() in (r.requester_id, a.host_id)
    and r.status = 'requested'
    and a.status = 'open' and a.starts_at > now()
    and o.status <> 'banned' and o.deleted_at is null and o.hidden_at is null
    and not public.is_blocked(auth.uid(), o.id)
  order by r.created_at desc, r.id desc;
$$;

revoke execute on function public.my_join_requests() from public, anon;

-- The host changes their open Activity. Null keeps a field; an empty description or venue clears it.
-- Once anyone is accepted (Locked Activity) only the description and a higher number of spots change,
-- which is also how spots never drop below accepted joiners.
create or replace function public.update_activity(
  activity_id uuid,
  title varchar default null,
  description varchar default null,
  capacity smallint default null,
  starts_at timestamptz default null,
  ends_at timestamptz default null,
  area_id text default null,
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
  new_area text;
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
  new_area := coalesce(update_activity.area_id, old.area_id);

  if public.activity_is_locked(old.id)
     and (new_title <> old.title or new_start <> old.starts_at or new_end is distinct from old.ends_at
          or new_area <> old.area_id or new_venue is distinct from old_venue or new_capacity < old.capacity) then
    raise exception 'this activity is locked: only its description and a higher number of spots can change';
  end if;
  perform public.check_activity(coalesce(update_activity.title, old.title), new_start, new_end, new_capacity,
                                new_start <> old.starts_at);

  update public.activities a
  set title = new_title,
      description = case when update_activity.description is null then a.description
                         else nullif(btrim(update_activity.description), '') end,
      capacity = new_capacity,
      starts_at = new_start,
      ends_at = new_end,
      area_id = new_area
  where a.id = old.id;

  if new_venue is null then
    delete from public.activity_venues v where v.activity_id = old.id;
  else
    insert into public.activity_venues (activity_id, venue_detail) values (old.id, new_venue)
    on conflict on constraint activity_venues_pkey do update set venue_detail = excluded.venue_detail;
  end if;
end;
$$;

-- A Block also closes the pair's pending or accepted Connection and cancels or withdraws Join Requests
-- between them, either way round.
create or replace function public.block_user(member_id uuid) returns void
language sql security definer
set search_path = ''
as $$
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), member_id)
  on conflict do nothing;
  update public.connections
  set status = 'closed', closed_at = now(), closed_by = auth.uid()
  where least(requester_id, addressee_id) = least(auth.uid(), member_id)
    and greatest(requester_id, addressee_id) = greatest(auth.uid(), member_id)
    and status in ('requested', 'accepted');
  update public.activity_requests r
  set status = case when r.status = 'accepted' then 'withdrawn' else 'cancelled' end::public.request_status,
      withdrawn_at = case when r.status = 'accepted' then now() end
  from public.activities a
  where a.id = r.activity_id
    and r.status in ('requested', 'accepted')
    and ((r.requester_id = auth.uid() and a.host_id = member_id)
         or (r.requester_id = member_id and a.host_id = auth.uid()));
$$;

-- Activity Connections are made by the host's accept, not sent, so the Request Cap leaves them out.
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
