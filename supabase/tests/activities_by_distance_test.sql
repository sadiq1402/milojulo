begin;
\ir helpers/act_as.psql
select plan(15);

create function pg_temp.m(suffix text) returns uuid
language sql immutable as $$ select ('00000000-0000-0000-0000-0000000044' || suffix)::uuid $$;

create temp table ids (k text primary key, v uuid);
grant select, insert on ids to authenticated, anon;

create function pg_temp.id(key text) returns uuid
language sql stable as $$ select v from ids where k = $1 $$;

create function pg_temp.keep(key text, value uuid) returns uuid
language sql as $$ insert into ids values ($1, $2) returning v $$;

-- Noon-ish in India, days ahead, at the given hour.
create function pg_temp.india(days integer, hour integer) returns timestamptz
language sql stable as $$
  select (((now() at time zone 'Asia/Kolkata')::date + days)::timestamp + make_interval(hours => hour))
         at time zone 'Asia/Kolkata';
$$;

-- Hosts: a1 near Baner (the viewer's spot), a2 about 5 km north, a3 in Mumbai. b1 views, c1 has no fresh point.
select pg_temp.create_visible_member(pg_temp.m(s)) from unnest(array['a1', 'a2', 'a3', 'b1', 'c1']) s;
select pg_temp.place(pg_temp.m('a2'), 18.604, 73.787);
select pg_temp.place(pg_temp.m('a3'), 19.076, 72.878);
select pg_temp.place(pg_temp.m('c1'), 18.559, 73.787, interval '8 days');

-- Posting needs a fresh Member Location.
select pg_temp.act_as_member(pg_temp.m('c1'));
select throws_ok($$ select public.post_activity('Run', 'sports', now() + interval '1 day') $$, 'P0001',
  'turn on location to post an activity', 'a Member without a fresh location cannot post');

select pg_temp.act_as_member(pg_temp.m('a1'));
select lives_ok($$ select pg_temp.keep('near late', public.post_activity('Near late', 'sports', pg_temp.india(2, 18))) $$,
  'a Member with a fresh location posts');
select pg_temp.keep('near next', public.post_activity('Near next day', 'sports', pg_temp.india(3, 10)));
select pg_temp.act_as_member(pg_temp.m('a2'));
select pg_temp.keep('mid early', public.post_activity('Mid early', 'sports', pg_temp.india(2, 12)));
select pg_temp.act_as_member(pg_temp.m('a3'));
select pg_temp.keep('far', public.post_activity('Far', 'sports', pg_temp.india(2, 12)));

-- The board: within range only, by day, then nearest, then start.
select pg_temp.act_as_member(pg_temp.m('b1'));
select results_eq($$ select id from public.activity_board() $$,
  $$ values (pg_temp.id('near late')), (pg_temp.id('mid early')), (pg_temp.id('near next')) $$,
  'the board shows Activities within range, by day and then nearest first');
select is_empty($$ select 1 from public.activity_board() where id = pg_temp.id('far') $$,
  'an Activity beyond the Discover Range is not on the board');
select results_eq($$ select distance_band from public.activity_board() where id in (pg_temp.id('near late'), pg_temp.id('mid early')) order by title $$,
  $$ values ('~5 km'::text), ('<2 km') $$, 'the board shows a distance band from the viewer');

reset role;
update public.profiles set discover_range_km = 2 where id = pg_temp.m('b1');
select pg_temp.act_as_member(pg_temp.m('b1'));
select results_eq($$ select id from public.activity_board() $$,
  $$ values (pg_temp.id('near late')), (pg_temp.id('near next')) $$,
  'a smaller Discover Range leaves the farther Activity out');
reset role;
update public.profiles set discover_range_km = 10 where id = pg_temp.m('b1');

select pg_temp.act_as_member(pg_temp.m('c1'));
select is_empty($$ select 1 from public.activity_board() $$, 'a viewer without a fresh location sees an empty board');

-- The place is the host's location at posting; moving the host or changing the Activity leaves it.
reset role;
select pg_temp.place(pg_temp.m('a1'), 19.076, 72.878);
select pg_temp.act_as_member(pg_temp.m('a1'));
select public.update_activity(pg_temp.id('near late'), title => 'Near later', description => 'Bring water');
select pg_temp.act_as_member(pg_temp.m('b1'));
select results_eq($$ select distance_band from public.get_activity(pg_temp.id('near late')) $$,
  $$ values ('<2 km'::text) $$, 'the Activity keeps the place it was posted from');

-- get_activity, joined_activities and circle_activities carry the band, null without a fresh location.
select results_eq($$ select distance_band from public.get_activity(pg_temp.id('mid early')) $$,
  $$ values ('~5 km'::text) $$, 'get_activity gives the distance band');
select pg_temp.keep('request', public.join_activity_request(pg_temp.id('mid early')));
select results_eq($$ select distance_band from public.joined_activities() $$,
  $$ values ('~5 km'::text) $$, 'joined_activities gives the distance band');

reset role;
select pg_temp.act_as_admin(pg_temp.m('ad'));
select pg_temp.keep('circle', public.admin_create_circle('Runners', 'baner',
  (select id from public.tags where slug = 'badminton'), 'A local circle.'));
reset role;
select pg_temp.act_as_member(pg_temp.m('a2'));
select public.join_circle(pg_temp.id('circle'));
select pg_temp.keep('circle act', public.post_activity('Circle run', 'sports', pg_temp.india(4, 8),
  circle_id => pg_temp.id('circle')));
select pg_temp.act_as_member(pg_temp.m('b1'));
select public.join_circle(pg_temp.id('circle'));
select results_eq($$ select distance_band from public.circle_activities(pg_temp.id('circle')) $$,
  $$ values ('~5 km'::text) $$, 'circle_activities gives the distance band');

reset role;
select pg_temp.place(pg_temp.m('b1'), 18.559, 73.787, interval '8 days');
select pg_temp.act_as_member(pg_temp.m('b1'));
select results_eq($$ select distance_band from public.get_activity(pg_temp.id('mid early')) $$,
  $$ values (null::text) $$, 'get_activity gives no band without a fresh location');
select results_eq($$ select id, distance_band from public.joined_activities() $$,
  $$ values (pg_temp.id('mid early'), null::text) $$,
  'joined_activities still lists the Activity, without a band');
select results_eq($$ select id, distance_band from public.circle_activities(pg_temp.id('circle')) $$,
  $$ values (pg_temp.id('circle act'), null::text) $$,
  'circle_activities still lists the Activity, without a band');

select pg_temp.act_as_anon();
select throws_ok($$ select public.post_activity('Run', 'sports', now() + interval '1 day') $$, '42501', null,
  'a signed-out visitor cannot post');

select * from finish();
rollback;
