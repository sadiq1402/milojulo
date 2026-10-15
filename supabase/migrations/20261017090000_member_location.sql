-- Member location (decisions 38 to 41, docs/adr/0003-member-location.md): the latest point from the phone,
-- moved by a fixed per-Member offset, readable by no client role (owner included).

create table public.member_locations (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  point extensions.geography(Point, 4326) not null,
  -- The Member's fixed offset, drawn once on the first update: 200 to 500 m in a random direction.
  offset_m double precision not null default 200 + random() * 300,
  offset_azimuth double precision not null default random() * 2 * pi(),
  updated_at timestamptz not null default now()
);
alter table public.member_locations enable row level security;
-- No policies: nobody reads or writes it directly, the owner included; only security definer functions touch it.

-- Pune metropolitan box (about 18.40-18.75 N, 73.65-74.05 E). A point outside it is refused as an
-- implausible jump; at one update an hour, any two points inside are within ~60 km, so no speed check is needed.
create function public.set_location(lat double precision, lng double precision) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  raw extensions.geography;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and deleted_at is null) then
    raise exception 'create your profile first';
  end if;
  if lat is null or lng is null or lat not between 18.40 and 18.75 or lng not between 73.65 and 74.05 then
    raise exception 'that location is outside Pune';
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

revoke execute on function public.set_location(double precision, double precision) from public, anon;

-- Where Discover measures a Member from: their offset point, else their Area's centre. Internal.
create function public.member_point(member_id uuid) returns extensions.geography
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select l.point from public.member_locations l where l.user_id = member_id),
    (select a.center from public.profiles p join public.areas a on a.id = p.area_id where p.id = member_id));
$$;

revoke execute on function public.member_point(uuid) from public, anon, authenticated, service_role;

-- Discover range: 2, 5, 10, 25 or 50 km; null is anywhere in Pune. One-way: it limits only what you see.
alter table public.profiles
  add column discover_range_km smallint default 10 check (discover_range_km in (2, 5, 10, 25, 50));
grant update (discover_range_km) on public.profiles to authenticated;

create or replace function public.delete_account() returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.profiles set deleted_at = now() where id = auth.uid() and deleted_at is null;
  if not found then
    raise exception 'your account is already being deleted';
  end if;
  delete from public.member_locations where user_id = auth.uid();
  insert into public.data_requests (user_id, kind) values (auth.uid(), 'erasure');
end;
$$;

-- The data notice now covers location; existing Members accept v2 before they are visible again.
insert into public.consent_documents (kind, version) values ('data_notice', 'v2');

-- A current document the Member has not accepted, or has withdrawn, hides them (decision 37).
create or replace function public.consent_withdrawn(member_id uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select exists (select 1 from public.current_consent_documents() as d (id)
                 where not exists (select 1 from public.consents c
                                   where c.user_id = member_id and c.document_id = d.id
                                     and c.withdrawn_at is null));
$$;

-- For the app: send the Member to Reconsent when a current document is missing or withdrawn.
create function public.needs_reconsent() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.consent_withdrawn(auth.uid());
$$;

revoke execute on function public.needs_reconsent() from public, anon;
