-- #203 follow-up: an Activity shares its host's photos only with Members it is on the board for (within
-- their Discover Range), or with Members of the Circle it was posted to (a Circle's feed has no range).
begin;
\ir helpers/act_as.psql
select plan(4);

create function pg_temp.m(suffix text) returns uuid
language sql immutable as $$ select ('00000000-0000-0000-0000-0000000204' || suffix)::uuid $$;

create function pg_temp.seen(viewer uuid, owner uuid) returns integer
language plpgsql as $$
declare
  ids uuid[] := array(select id from public.photos where user_id = owner);
  n integer;
begin
  perform pg_temp.act_as_service();
  select count(*) into n from public.photo_links(viewer, ids);
  reset role;
  return n;
end;
$$;

-- The host (a1) lives in Baner and posts an Activity there. b2 lives in Wakad (about 4 km away),
-- c3 in Hadapsar (about 20 km), beyond their 10 km Discover Range of both the host and the Activity.
select pg_temp.create_visible_member(pg_temp.m('a1'));
select pg_temp.create_visible_member(pg_temp.m('b2'));
select pg_temp.create_visible_member(pg_temp.m('c3'));
select pg_temp.place(pg_temp.m('b2'), 18.5975, 73.7898);
select pg_temp.place(pg_temp.m('c3'), 18.5089, 73.9259);
insert into public.activities (host_id, title, type, place, starts_at, capacity)
values (pg_temp.m('a1'), 'Badminton', 'sports', 'SRID=4326;POINT(73.787 18.559)', now() + interval '2 days', 3);

select is(pg_temp.seen(pg_temp.m('b2'), pg_temp.m('a1')), 2,
  'a Member the Activity is within range of gets its host''s photos');
select is(pg_temp.seen(pg_temp.m('c3'), pg_temp.m('a1')), 0,
  'a Member the Activity is beyond the range of gets none of them through it');

-- Posted to a Circle c3 has joined: the Circle's feed shows it at any distance, so the photos follow.
select pg_temp.create_account(pg_temp.m('ad'));
select pg_temp.act_as_admin(pg_temp.m('ad'));
select public.admin_create_circle('Badminton Baner', 'Baner, Pune', 18.559, 73.787,
  (select min(id) from public.tags), null) as circle \gset
reset role;
insert into public.circle_members (circle_id, user_id) values (:'circle', pg_temp.m('c3'));
update public.activities set circle_id = :'circle' where host_id = pg_temp.m('a1');
select is(pg_temp.seen(pg_temp.m('c3'), pg_temp.m('a1')), 2,
  'a Member of the Activity''s Circle gets the host''s photos at any distance');

-- Without a location of their own, the board is empty, and so is this way to the host's photos.
update public.activities set circle_id = null where host_id = pg_temp.m('a1');
delete from public.member_locations where user_id = pg_temp.m('b2');
select is(pg_temp.seen(pg_temp.m('b2'), pg_temp.m('a1')), 0,
  'a Member with no location gets no host photos through the board');

select * from finish();
rollback;
