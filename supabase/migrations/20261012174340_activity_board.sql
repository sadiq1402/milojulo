create type public.activity_type as enum ('sports', 'food_chai', 'outdoors', 'games', 'learning');
create type public.activity_status as enum ('open', 'cancelled', 'expired', 'removed');

-- Rows reveal other Members, so no direct access: everything goes through the functions below.
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title varchar(60) not null,
  type public.activity_type not null,
  area_id text not null references public.areas (id),
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity smallint not null check (capacity between 1 and 20),
  description varchar(300),
  status public.activity_status not null default 'open',
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.activities (starts_at) where status = 'open';
create index on public.activities (host_id);
alter table public.activities enable row level security;
revoke all on public.activities from anon, authenticated;

-- Stored apart so the board never carries it; read only through get_activity().
create table public.activity_venues (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  venue_detail varchar(200) not null,
  created_at timestamptz not null default now()
);
alter table public.activity_venues enable row level security;
revoke all on public.activity_venues from anon, authenticated;

-- The rules post_activity() and update_activity() share; start_changed is false when the start is kept.
create or replace function public.check_activity(
  title varchar, starts_at timestamptz, ends_at timestamptz, capacity smallint, start_changed boolean
) returns void
language plpgsql stable
set search_path = ''
as $$
begin
  if coalesce(btrim(title), '') = '' then
    raise exception 'an activity needs a title';
  end if;
  if start_changed and starts_at <= now() then
    raise exception 'an activity must start in the future';
  end if;
  if ends_at <= starts_at then
    raise exception 'an activity must end after it starts';
  end if;
  if capacity is null or capacity not between 1 and 20 then
    raise exception 'spots must be between 1 and 20';
  end if;
end;
$$;

revoke execute on function public.check_activity(varchar, timestamptz, timestamptz, smallint, boolean)
  from public, anon, authenticated;

create or replace function public.post_activity(
  title varchar,
  type public.activity_type,
  area_id text,
  starts_at timestamptz,
  ends_at timestamptz default null,
  capacity smallint default 4,
  description varchar default null,
  venue_detail varchar default null
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if (select paused_at is not null from public.profiles where id = me) then
    raise exception 'unpause your profile to post activities';
  end if;
  if not public.is_visible(me) then
    raise exception 'your profile is not visible';
  end if;
  perform public.check_activity(post_activity.title, post_activity.starts_at, post_activity.ends_at,
                                post_activity.capacity, true);
  insert into public.activities (host_id, title, type, area_id, starts_at, ends_at, capacity, description)
  values (me, btrim(post_activity.title), post_activity.type, post_activity.area_id, post_activity.starts_at,
          post_activity.ends_at, post_activity.capacity, nullif(btrim(post_activity.description), ''))
  returning id into new_id;
  if nullif(btrim(post_activity.venue_detail), '') is not null then
    insert into public.activity_venues (activity_id, venue_detail)
    values (new_id, btrim(post_activity.venue_detail));
  end if;
  return new_id;
end;
$$;

revoke execute on function public.post_activity(varchar, public.activity_type, text, timestamptz, timestamptz,
  smallint, varchar, varchar) from public, anon;

-- When an Activity counts as over: its end, or 3 hours after its start when it has none.
create or replace function public.activity_ends_at(activity public.activities) returns timestamptz
language sql immutable
set search_path = ''
as $$
  select coalesce(activity.ends_at, activity.starts_at + interval '3 hours');
$$;

-- On the board for this viewer: open, unhidden, not yet over, host neither blocked nor banned nor deleted.
create or replace function public.can_see_activity(activity public.activities, viewer uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select activity.status = 'open'
    and activity.hidden_at is null
    and public.activity_ends_at(activity) > now()
    and not public.is_blocked(viewer, activity.host_id)
    -- A Paused host's plans still stand; an Auto-hidden or banned host's leave the board.
    and exists (select 1 from public.profiles h
                where h.id = activity.host_id and h.status <> 'banned' and h.deleted_at is null
                  and h.hidden_at is null);
$$;

-- The board's tabs, by the calendar in India. One that began before today and is still running counts as tonight.
create or replace function public.activity_starts_when(starts_at timestamptz) returns text
language sql stable
set search_path = ''
as $$
  select case
    when day <= today then 'tonight'
    -- The weekend ending on the coming Sunday (today, if today is Sunday).
    when day between today + (6 - extract(isodow from today)::integer)
                 and today + (7 - extract(isodow from today)::integer) then 'this_weekend'
    else 'later'
  end
  from (select (starts_at at time zone 'Asia/Kolkata')::date as day,
               (now() at time zone 'Asia/Kolkata')::date as today) d;
$$;

-- Capacity less accepted Join Requests; Join Requests arrive in #14.
create or replace function public.activity_spots_left(activity_id uuid) returns integer
language sql stable
set search_path = ''
as $$
  select capacity::integer from public.activities where id = activity_id;
$$;

-- An Activity with at least one accepted joiner; Join Requests arrive in #14.
create or replace function public.activity_is_locked(activity_id uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select false;
$$;

revoke execute on function public.activity_ends_at(public.activities),
  public.can_see_activity(public.activities, uuid), public.activity_starts_when(timestamptz),
  public.activity_spots_left(uuid), public.activity_is_locked(uuid) from public, anon, authenticated;

create or replace function public.activity_board() returns table (
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
  is_mine boolean
)
language sql stable security definer
set search_path = ''
as $$
  select a.id, a.host_id, h.display_name, a.title, a.type, a.area_id, a.starts_at, a.ends_at, a.capacity,
    public.activity_spots_left(a.id), a.description, public.activity_starts_when(a.starts_at),
    a.host_id = auth.uid()
  from public.activities a
  join public.profiles h on h.id = a.host_id
  where public.is_visible(auth.uid())
    and public.can_see_activity(a, auth.uid())
  order by a.starts_at, a.id;
$$;

revoke execute on function public.activity_board() from public, anon;

-- One Activity for the caller: as on the board, except that the host always reads their own, venue included.
create or replace function public.get_activity(activity_id uuid) returns table (
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
  is_locked boolean
)
language sql stable security definer
set search_path = ''
as $$
  select a.id, a.host_id, h.display_name, a.title, a.type, a.area_id, a.starts_at, a.ends_at, a.capacity,
    public.activity_spots_left(a.id), a.description, public.activity_starts_when(a.starts_at),
    a.host_id = auth.uid(), a.status,
    case when a.host_id = auth.uid() then v.venue_detail end,
    public.activity_is_locked(a.id)
  from public.activities a
  join public.profiles h on h.id = a.host_id
  left join public.activity_venues v on v.activity_id = a.id
  where a.id = get_activity.activity_id
    and (a.host_id = auth.uid()
         or (public.is_visible(auth.uid()) and public.can_see_activity(a, auth.uid())));
$$;

revoke execute on function public.get_activity(uuid) from public, anon;

-- The host changes their open Activity. Null keeps a field; an empty description or venue clears it.
-- Spots can't drop below accepted joiners: any accepted joiner locks the Activity, and a locked one only grows.
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
  new_start := coalesce(update_activity.starts_at, old.starts_at);
  new_end := coalesce(update_activity.ends_at, old.ends_at);
  new_capacity := coalesce(update_activity.capacity, old.capacity);
  new_area := coalesce(update_activity.area_id, old.area_id);

  -- Locked Activity rules arrive with Join Requests (#14), the first way an Activity can lock.
  perform public.check_activity(coalesce(update_activity.title, old.title), new_start, new_end, new_capacity,
                                new_start <> old.starts_at);

  update public.activities a
  set title = coalesce(btrim(update_activity.title), a.title),
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

revoke execute on function public.update_activity(uuid, varchar, varchar, smallint, timestamptz, timestamptz,
  text, varchar) from public, anon;

-- Notifying accepted joiners arrives with Join Requests (#14).
create or replace function public.cancel_activity(activity_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.activities a
  set status = 'cancelled'
  where a.id = cancel_activity.activity_id and a.host_id = auth.uid() and a.status = 'open';
  if not found then
    raise exception 'no activity to cancel';
  end if;
end;
$$;

revoke execute on function public.cancel_activity(uuid) from public, anon;

-- Run by pg_cron, never by clients.
create or replace function public.expire_activities() returns void
language sql
set search_path = ''
as $$
  update public.activities a
  set status = 'expired'
  where a.status = 'open' and public.activity_ends_at(a) <= now();
$$;

revoke execute on function public.expire_activities() from public, anon, authenticated;

select cron.schedule('expire-activities', '*/15 * * * *', 'select public.expire_activities()');

-- Activity cards in chat (#10) now point at a real Activity.
alter table public.messages
  add constraint messages_activity_id_fkey foreign key (activity_id) references public.activities (id) on delete cascade;
create index messages_activity_id_idx on public.messages (activity_id) where activity_id is not null;
