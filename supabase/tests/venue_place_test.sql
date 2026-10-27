begin;
\ir helpers/act_as.psql
select plan(26);

-- The venue is a place chosen from Google's search (#248, decision 70): name, address, place id
-- and point. f1 hosts; f2 browses; f9 is not visible.
create function pg_temp.m(suffix text) returns uuid
language sql immutable as $$ select ('00000000-0000-0000-0000-0000000048' || suffix)::uuid $$;

create temp table ids (k text primary key, v uuid);
grant select, insert on ids to authenticated, anon;
create function pg_temp.id(key text) returns uuid
language sql stable as $$ select v from ids where k = $1 $$;
create function pg_temp.keep(key text, value uuid) returns uuid
language sql as $$ insert into ids values ($1, $2) returning v $$;

select pg_temp.create_visible_member(pg_temp.m(s)) from unnest(array['f1', 'f2']) s;
select pg_temp.create_complete_member(pg_temp.m('f9'));

-- Posting needs a place with a name and a point.
select pg_temp.act_as_member(pg_temp.m('f1'));
select throws_ok($$ select public.post_activity('Run', 'sports', now() + interval '1 day') $$, 'P0001',
  'an activity needs a place', 'posting without a place is refused');
select throws_ok($$ select public.post_activity('Run', 'sports', now() + interval '1 day',
                   place_name => ' ', place_lat => 18.5, place_lng => 73.8) $$, 'P0001',
  'an activity needs a place', 'a place with a blank name is refused');
select throws_ok($$ select public.post_activity('Run', 'sports', now() + interval '1 day',
                   place_name => 'Baner Hill') $$, 'P0001',
  'an activity needs a place', 'a place without a point is refused');
select throws_ok($$ select public.post_activity('Run', 'sports', now() + interval '1 day',
                   place_name => 'Nowhere', place_lat => 91, place_lng => 73.8) $$, 'P0001',
  'an activity needs a place', 'a point off the globe is refused');
select lives_ok($$ select pg_temp.keep('run', public.post_activity('Run', 'sports', now() + interval '1 day',
                   place_name => '  Baner Hill  ', place_address => 'Baner, Pune, Maharashtra',
                   place_google_id => 'ChIJbaner', place_lat => 18.5642, place_lng => 73.7769)) $$,
  'posting with a place is allowed');
select lives_ok($$ select pg_temp.keep('pin', public.post_activity('Picnic', 'outdoors', now() + interval '1 day',
                   place_name => 'By the lake', place_lat => 18.55, place_lng => 73.8)) $$,
  'a place needs no Google place id or address (a pin, #249)');

-- Everyone who may read the Activity reads the place (decision 69).
select results_eq($$ select venue_name, venue_address, venue_place_id, round(venue_lat::numeric, 4),
                     round(venue_lng::numeric, 4), venue_detail from public.get_activity(pg_temp.id('run')) $$,
  $$ values ('Baner Hill'::varchar, 'Baner, Pune, Maharashtra'::varchar, 'ChIJbaner'::varchar, 18.5642, 73.7769,
             null::varchar) $$,
  'the host reads the place, its name trimmed');
select pg_temp.act_as_member(pg_temp.m('f2'));
select results_eq($$ select venue_name, venue_place_id from public.get_activity(pg_temp.id('run')) $$,
  $$ values ('Baner Hill'::varchar, 'ChIJbaner'::varchar) $$, 'another Member reads the place');
select results_eq($$ select venue_name, venue_address, venue_place_id from public.get_activity(pg_temp.id('pin')) $$,
  $$ values ('By the lake'::varchar, null::varchar, null::varchar) $$, 'a pinned place has a name and no place id');
select pg_temp.act_as_member(pg_temp.m('f9'));
select is_empty($$ select * from public.get_activity(pg_temp.id('run')) $$,
  'a Member who is not visible reads no place');
select pg_temp.act_as_anon();
select throws_ok($$ select * from public.get_activity(pg_temp.id('run')) $$, '42501', null,
  'a signed-out visitor reads no place');
select pg_temp.act_as_member(pg_temp.m('f2'));
select throws_ok('select * from public.activity_venues', '42501', null, 'venues cannot be read directly');

-- Changing the place: null keeps it, a new one replaces it, it cannot be cleared.
select pg_temp.act_as_member(pg_temp.m('f1'));
select public.update_activity(pg_temp.id('run'), title => 'Hill run');
select results_eq($$ select venue_name from public.get_activity(pg_temp.id('run')) $$,
  $$ values ('Baner Hill'::varchar) $$, 'leaving the place out keeps it');
select lives_ok($$ select public.update_activity(pg_temp.id('run'), place_name => 'Pashan Lake',
                   place_address => 'Pashan, Pune', place_google_id => 'ChIJpashan',
                   place_lat => 18.5326, place_lng => 73.7836) $$, 'the host changes the place');
select results_eq($$ select venue_name, venue_address, venue_place_id, round(venue_lat::numeric, 4)
                     from public.get_activity(pg_temp.id('run')) $$,
  $$ values ('Pashan Lake'::varchar, 'Pashan, Pune'::varchar, 'ChIJpashan'::varchar, 18.5326) $$,
  'the new place replaces the old one');
select throws_ok($$ select public.update_activity(pg_temp.id('run'), place_name => '') $$, 'P0001',
  'an activity needs a place', 'the place cannot be cleared');
select throws_ok($$ select public.update_activity(pg_temp.id('run'), place_name => 'Somewhere') $$, 'P0001',
  'an activity needs a place', 'a new place needs a point');
select pg_temp.act_as_member(pg_temp.m('f2'));
select throws_ok($$ select public.update_activity(pg_temp.id('run'), place_name => 'Mine', place_lat => 18.5,
                   place_lng => 73.8) $$, 'P0001', 'no activity to change', 'another Member cannot change the place');

-- A Locked Activity keeps its place.
select public.join_activity_request(pg_temp.id('run'));
select pg_temp.act_as_member(pg_temp.m('f1'));
select public.respond_activity_request(
  (select r.request_id from public.activity_join_requests(pg_temp.id('run')) r), true);
select throws_ok($$ select public.update_activity(pg_temp.id('run'), place_name => 'Baner Hill', place_lat => 18.5642,
                   place_lng => 73.7769, place_google_id => 'ChIJbaner') $$, 'P0001',
  'this activity is locked: only its description and a higher number of spots can change',
  'a Locked Activity''s place cannot change');
select lives_ok($$ select public.update_activity(pg_temp.id('run'), place_name => 'Pashan Lake',
                   place_address => 'Pashan, Pune', place_google_id => 'ChIJpashan',
                   place_lat => 18.5326, place_lng => 73.7836) $$,
  'restating a Locked Activity''s place is not a change');

-- An older Activity with only a typed venue keeps it, and can move to a chosen place.
reset role;
with a as (
  insert into public.activities (host_id, title, type, place, starts_at, capacity)
  values (pg_temp.m('f1'), 'Old chai', 'food_chai', 'SRID=4326;POINT(73.787 18.559)', now() + interval '2 days', 4)
  returning id)
select pg_temp.keep('old', id) from a;
insert into public.activity_venues (activity_id, venue_detail) values (pg_temp.id('old'), 'Chai Point, Baner');
select pg_temp.act_as_member(pg_temp.m('f2'));
select results_eq($$ select venue_detail, venue_name, venue_place_id from public.get_activity(pg_temp.id('old')) $$,
  $$ values ('Chai Point, Baner'::varchar, null::varchar, null::varchar) $$,
  'an older Activity still shows its typed venue');
select pg_temp.act_as_member(pg_temp.m('f1'));
select lives_ok($$ select public.update_activity(pg_temp.id('old'), description => 'Masala chai') $$,
  'an older Activity with a typed venue can still change other details');
select results_eq($$ select venue_detail from public.get_activity(pg_temp.id('old')) $$,
  $$ values ('Chai Point, Baner'::varchar) $$, 'and keeps its typed venue');
select public.update_activity(pg_temp.id('old'), place_name => 'Chai Point', place_google_id => 'ChIJchai',
  place_lat => 18.559, place_lng => 73.787);
select results_eq($$ select venue_detail, venue_name, venue_place_id from public.get_activity(pg_temp.id('old')) $$,
  $$ values (null::varchar, 'Chai Point'::varchar, 'ChIJchai'::varchar) $$,
  'an older Activity takes a chosen place in place of its typed venue');

-- The search bias: the caller's fresh Member Location, for the places function only.
reset role;
select pg_temp.act_as_service();
select ok((select lat is not null and lng is not null from public.place_search_bias(pg_temp.m('f1'))),
  'the places function reads a Member''s search bias');
select pg_temp.act_as_member(pg_temp.m('f1'));
select throws_ok($$ select * from public.place_search_bias(pg_temp.m('f1')) $$, '42501', null,
  'a Member cannot read the search bias');

select * from finish();
rollback;
