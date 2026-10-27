-- Circles by place (#203): a Circle is a place and an interest. An admin gives it a place name and a
-- centre point; Members see the active Circles within their Discover Range, plus the ones they joined.

alter table public.circles
  add column place_name varchar(60),
  add column center extensions.geography(Point, 4326);

-- Existing Circles take their Area's name and centre.
update public.circles c
set place_name = ar.name, center = ar.center
from public.areas ar
where ar.id = c.area_id;

alter table public.circles
  alter column place_name set not null,
  alter column center set not null;
create index circles_center_idx on public.circles using gist (center);

-- Functions that take or return the Area go first, then the column (its FK and index go with it).
drop function public.admin_create_circle(varchar, text, smallint, varchar);
drop function public.admin_edit_circle(uuid, varchar, text, smallint, varchar);
drop function public.browse_circles();
drop function public.get_circle(uuid);

alter table public.circles drop column area_id;

-- A point from coordinates, refused as set_location refuses them. Internal.
create function public.circle_point(lat double precision, lng double precision) returns extensions.geography
language plpgsql immutable
set search_path = ''
as $$
begin
  if lat is null or lng is null or lat not between -90 and 90 or lng not between -180 and 180 then
    raise exception 'that location is not valid';
  end if;
  return extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography;
end;
$$;

revoke execute on function public.circle_point(double precision, double precision) from public, anon, authenticated;

create function public.admin_create_circle(name varchar, place_name varchar, lat double precision,
  lng double precision, tag_id smallint, description varchar) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  insert into public.circles (name, place_name, center, tag_id, description, created_by)
  values (btrim(admin_create_circle.name), btrim(admin_create_circle.place_name),
          public.circle_point(admin_create_circle.lat, admin_create_circle.lng), admin_create_circle.tag_id,
          nullif(btrim(admin_create_circle.description), ''), auth.uid())
  returning id into new_id;
  perform public.audit('create_circle', 'circle', new_id, btrim(admin_create_circle.name));
  return new_id;
end;
$$;

revoke execute on function public.admin_create_circle(varchar, varchar, double precision, double precision,
  smallint, varchar) from public, anon;

-- Null lat and lng keep the centre.
create function public.admin_edit_circle(circle_id uuid, name varchar, place_name varchar, lat double precision,
  lng double precision, tag_id smallint, description varchar) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  new_center extensions.geography;
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  if admin_edit_circle.lat is not null or admin_edit_circle.lng is not null then
    new_center := public.circle_point(admin_edit_circle.lat, admin_edit_circle.lng);
  end if;
  update public.circles c
  set name = btrim(admin_edit_circle.name), place_name = btrim(admin_edit_circle.place_name),
      center = coalesce(new_center, c.center),
      tag_id = admin_edit_circle.tag_id, description = nullif(btrim(admin_edit_circle.description), '')
  where c.id = admin_edit_circle.circle_id;
  if not found then
    raise exception 'no circle to edit';
  end if;
  perform public.audit('edit_circle', 'circle', admin_edit_circle.circle_id, btrim(admin_edit_circle.name));
end;
$$;

revoke execute on function public.admin_edit_circle(uuid, varchar, varchar, double precision, double precision,
  smallint, varchar) from public, anon;

-- Active Circles for a visible caller: those within the Discover Range of the caller's fresh point, plus
-- the ones the caller joined (even without a point). Joined first, then by name.
create function public.browse_circles() returns table (
  circle_id uuid,
  name varchar,
  place_name varchar,
  tag_id smallint,
  description varchar,
  member_count integer,
  i_am_member boolean,
  distance_band text
)
language sql stable security definer
set search_path = ''
as $$
  select c.id, c.name, c.place_name, c.tag_id, c.description,
    (select count(*)::integer from public.circle_members m where m.circle_id = c.id),
    public.is_circle_member(c.id, auth.uid()),
    public.band_from_me(c.center)
  from public.circles c
  where c.is_active and public.is_visible(auth.uid())
    and (public.is_circle_member(c.id, auth.uid())
         or coalesce(extensions.st_dwithin(c.center, public.member_point(auth.uid()),
                       (select p.discover_range_km * 1000 from public.profiles p where p.id = auth.uid())),
                     false))
  order by public.is_circle_member(c.id, auth.uid()) desc, c.name, c.id;
$$;

revoke execute on function public.browse_circles() from public, anon;

-- One Circle: active ones for a visible caller, plus the caller's own Circles and admins; otherwise no row.
create function public.get_circle(circle_id uuid) returns table (
  circle_id uuid,
  name varchar,
  place_name varchar,
  tag_id smallint,
  description varchar,
  member_count integer,
  i_am_member boolean,
  distance_band text
)
language sql stable security definer
set search_path = ''
as $$
  select c.id, c.name, c.place_name, c.tag_id, c.description,
    (select count(*)::integer from public.circle_members m where m.circle_id = c.id),
    public.is_circle_member(c.id, auth.uid()),
    public.band_from_me(c.center)
  from public.circles c
  where c.id = get_circle.circle_id
    and ((c.is_active and public.is_visible(auth.uid()))
         or public.is_circle_member(c.id, auth.uid())
         or public.is_admin());
$$;

revoke execute on function public.get_circle(uuid) from public, anon;
