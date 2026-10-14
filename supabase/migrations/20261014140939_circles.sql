-- Circles: admin-created local Circles Members join; Activities posted to a Circle keep their
-- place on the main board with the Circle's label, which drops once the Circle is archived.

-- Rows reveal other Members, so no direct access: everything goes through the functions below.
create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name varchar(50) not null,
  area_id text not null references public.areas (id),
  tag_id smallint not null references public.tags (id),
  description varchar(300),
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index on public.circles (area_id) where is_active;
alter table public.circles enable row level security;
revoke all on public.circles from anon, authenticated;

-- One membership per Member per Circle; writes only through join_circle()/leave_circle().
create table public.circle_members (
  circle_id uuid not null references public.circles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
create index on public.circle_members (user_id);
alter table public.circle_members enable row level security;
revoke all on public.circle_members from anon, authenticated;

-- A Circle an Activity was posted to; an archived Circle keeps the link but drops its label.
alter table public.activities
  add column circle_id uuid references public.circles (id) on delete set null;
create index on public.activities (circle_id) where circle_id is not null;

-- Members cannot read circle_members, so the gate asks a definer function about one pair only.
create function public.is_circle_member(circle_id uuid, member_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.circle_members cm
                 where cm.circle_id = is_circle_member.circle_id and cm.user_id = is_circle_member.member_id);
$$;

revoke execute on function public.is_circle_member(uuid, uuid) from public, anon, authenticated;

-- Active Circles for a visible caller (empty otherwise); the ones the caller joined come first, then by name.
create function public.browse_circles() returns table (
  circle_id uuid,
  name varchar,
  area_id text,
  tag_id smallint,
  description varchar,
  member_count integer,
  i_am_member boolean
)
language sql stable security definer
set search_path = ''
as $$
  select c.id, c.name, c.area_id, c.tag_id, c.description,
    (select count(*)::integer from public.circle_members m where m.circle_id = c.id),
    public.is_circle_member(c.id, auth.uid())
  from public.circles c
  where c.is_active and public.is_visible(auth.uid())
  order by public.is_circle_member(c.id, auth.uid()) desc, c.name, c.id;
$$;

revoke execute on function public.browse_circles() from public, anon;

-- One Circle: active ones for a visible caller, plus the caller's own Circles and admins; otherwise no row.
create function public.get_circle(circle_id uuid) returns table (
  circle_id uuid,
  name varchar,
  area_id text,
  tag_id smallint,
  description varchar,
  member_count integer,
  i_am_member boolean
)
language sql stable security definer
set search_path = ''
as $$
  select c.id, c.name, c.area_id, c.tag_id, c.description,
    (select count(*)::integer from public.circle_members m where m.circle_id = c.id),
    public.is_circle_member(c.id, auth.uid())
  from public.circles c
  where c.id = get_circle.circle_id
    and ((c.is_active and public.is_visible(auth.uid()))
         or public.is_circle_member(c.id, auth.uid())
         or public.is_admin());
$$;

revoke execute on function public.get_circle(uuid) from public, anon;

-- Fellow Circle members, only to a visible member of that Circle; visible and unblocked ones alone.
create function public.circle_members_of(circle_id uuid) returns table (
  member_id uuid,
  display_name varchar,
  cover_photo_id uuid,
  area_id text
)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.display_name, public.cover_photo_id(p.id), p.area_id
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

-- The Circle's upcoming Activities, as on the board (reuse can_see_activity), soonest first; visible caller.
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
  circle_name varchar
)
language sql stable security definer
set search_path = ''
as $$
  select a.id, a.host_id, h.display_name, a.title, a.type, a.area_id, a.starts_at, a.ends_at, a.capacity,
    public.activity_spots_left(a.id), a.description, public.activity_starts_when(a.starts_at),
    a.host_id = auth.uid(), a.circle_id, cc.name
  from public.activities a
  join public.profiles h on h.id = a.host_id
  left join public.circles cc on cc.id = a.circle_id and cc.is_active
  where a.circle_id = circle_activities.circle_id
    and public.is_visible(auth.uid())
    and public.can_see_activity(a, auth.uid())
  order by a.starts_at, a.id;
$$;

revoke execute on function public.circle_activities(uuid) from public, anon;

-- Join an active Circle; idempotent. A visible Member only.
create function public.join_circle(circle_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if not public.is_visible(me) then
    raise exception 'your profile is not visible';
  end if;
  if not exists (select 1 from public.circles c where c.id = join_circle.circle_id and c.is_active) then
    raise exception 'no circle to join';
  end if;
  insert into public.circle_members (circle_id, user_id) values (join_circle.circle_id, me)
  on conflict do nothing;
end;
$$;

revoke execute on function public.join_circle(uuid) from public, anon;

-- Leave a Circle; the Member's posted Activities are left untouched.
create function public.leave_circle(circle_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.circle_members cm
  where cm.circle_id = leave_circle.circle_id and cm.user_id = auth.uid();
  if not found then
    raise exception 'you are not in this circle';
  end if;
end;
$$;

revoke execute on function public.leave_circle(uuid) from public, anon;

-- post_activity gains circle_id: posting to a Circle needs membership of that active Circle.
drop function public.post_activity(varchar, public.activity_type, text, timestamptz, timestamptz,
  smallint, varchar, varchar);
create function public.post_activity(
  title varchar,
  type public.activity_type,
  area_id text,
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
  new_id uuid;
begin
  if (select paused_at is not null from public.profiles where id = me) then
    raise exception 'unpause your profile to post activities';
  end if;
  if not public.is_visible(me) then
    raise exception 'your profile is not visible';
  end if;
  if post_activity.circle_id is not null
     and not exists (select 1 from public.circle_members cm
                     join public.circles c on c.id = cm.circle_id and c.is_active
                     where cm.circle_id = post_activity.circle_id and cm.user_id = me) then
    raise exception 'join the circle to post to it';
  end if;
  perform public.check_activity(post_activity.title, post_activity.starts_at, post_activity.ends_at,
                                post_activity.capacity, true);
  insert into public.activities (host_id, title, type, area_id, starts_at, ends_at, capacity, description, circle_id)
  values (me, btrim(post_activity.title), post_activity.type, post_activity.area_id, post_activity.starts_at,
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

revoke execute on function public.post_activity(varchar, public.activity_type, text, timestamptz, timestamptz,
  smallint, varchar, varchar, uuid) from public, anon;

-- The board gains the Circle label; circle_name is NULL once the Circle is archived, so the Activity stays
-- on the board without a label.
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
  circle_name varchar
)
language sql stable security definer
set search_path = ''
as $$
  select a.id, a.host_id, h.display_name, a.title, a.type, a.area_id, a.starts_at, a.ends_at, a.capacity,
    public.activity_spots_left(a.id), a.description, public.activity_starts_when(a.starts_at),
    a.host_id = auth.uid(), a.circle_id, cc.name
  from public.activities a
  join public.profiles h on h.id = a.host_id
  left join public.circles cc on cc.id = a.circle_id and cc.is_active
  where public.is_visible(auth.uid())
    and public.can_see_activity(a, auth.uid())
  order by a.starts_at, a.id;
$$;

revoke execute on function public.activity_board() from public, anon;

-- get_activity gains the same Circle label, keeping the Join Request columns from #14.
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
  circle_name varchar
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
    a.circle_id, cc.name
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

-- Admin tools (is_admin() only; the app never calls these, they are for the seed and the dashboard).
create function public.admin_create_circle(name varchar, area_id text, tag_id smallint, description varchar)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  insert into public.circles (name, area_id, tag_id, description, created_by)
  values (btrim(admin_create_circle.name), admin_create_circle.area_id, admin_create_circle.tag_id,
          nullif(btrim(admin_create_circle.description), ''), auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.admin_create_circle(varchar, text, smallint, varchar) from public, anon;

create function public.admin_edit_circle(circle_id uuid, name varchar, area_id text, tag_id smallint,
  description varchar) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  update public.circles c
  set name = btrim(admin_edit_circle.name), area_id = admin_edit_circle.area_id,
      tag_id = admin_edit_circle.tag_id, description = nullif(btrim(admin_edit_circle.description), '')
  where c.id = admin_edit_circle.circle_id;
  if not found then
    raise exception 'no circle to edit';
  end if;
end;
$$;

revoke execute on function public.admin_edit_circle(uuid, varchar, text, smallint, varchar) from public, anon;

create function public.admin_archive_circle(circle_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  update public.circles c set is_active = false
  where c.id = admin_archive_circle.circle_id and c.is_active;
  if not found then
    raise exception 'no circle to archive';
  end if;
end;
$$;

revoke execute on function public.admin_archive_circle(uuid) from public, anon;
