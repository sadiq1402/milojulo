begin;
\ir helpers/act_as.psql
select plan(12);

create function pg_temp.m(suffix text) returns uuid
language sql immutable as $$ select ('00000000-0000-0000-0000-0000000045' || suffix)::uuid $$;

create temp table ids (k text primary key, v uuid);
grant select, insert on ids to authenticated, anon;

create function pg_temp.id(key text) returns uuid
language sql stable as $$ select v from ids where k = $1 $$;

create function pg_temp.keep(key text, value uuid) returns uuid
language sql as $$ insert into ids values ($1, $2) returning v $$;

-- b1 views from Baner (default 10 km range); c1 has no fresh point.
select pg_temp.create_visible_member(pg_temp.m(s)) from unnest(array['b1', 'c1']) s;
select pg_temp.place(pg_temp.m('c1'), 18.559, 73.787, interval '31 days');

-- ============ Admin create / edit ============
select pg_temp.act_as_admin(pg_temp.m('ad'));
select lives_ok($$ select pg_temp.keep('near', public.admin_create_circle('Baner Runners', 'Baner, Pune',
  18.559, 73.787, (select id from public.tags where slug = 'badminton'), 'Runs.')) $$,
  'an admin creates a Circle with a place name and centre');
select pg_temp.keep('mid', public.admin_create_circle('Aundh Walkers', 'Aundh, Pune', 18.604, 73.787,
  (select id from public.tags where slug = 'badminton'), null));
select pg_temp.keep('far', public.admin_create_circle('Kharadi Trekkers', 'Kharadi, Pune', 18.551, 73.941,
  (select id from public.tags where slug = 'trekking'), null));
select pg_temp.keep('joined far', public.admin_create_circle('Mumbai Cyclists', 'Bandra, Mumbai', 19.076, 72.878,
  (select id from public.tags where slug = 'cycling'), null));
select throws_ok($$ select public.admin_create_circle('Bad', 'Nowhere', 91, 73.787, 1::smallint, null) $$,
  'that location is not valid', 'a Circle with a bad latitude is refused');
select throws_ok($$ select public.admin_edit_circle(pg_temp.id('mid'), 'Bad', 'Nowhere', 18.6, 181, 1::smallint, null) $$,
  'that location is not valid', 'an edit with a bad longitude is refused');
select lives_ok($$ select public.admin_edit_circle(pg_temp.id('mid'), 'Aundh Walkers', 'Aundh West, Pune',
  null, null, (select id from public.tags where slug = 'badminton'), null) $$,
  'an admin edits a Circle keeping its centre');
reset role;
select results_eq($$ select place_name::text, round(extensions.st_y(center::extensions.geometry)::numeric, 3)
                     from public.circles where id = pg_temp.id('mid') $$,
  $$ values ('Aundh West, Pune'::text, 18.604::numeric) $$, 'the edit changed the place name and kept the centre');

select pg_temp.act_as_member(pg_temp.m('b1'));
select throws_ok($$ select public.admin_create_circle('Sneaky', 'Baner, Pune', 18.559, 73.787, 1::smallint, null) $$,
  'admins only', 'a Member cannot create a Circle');
select throws_ok($$ select public.admin_edit_circle(pg_temp.id('mid'), 'x', 'x', 18.5, 73.8, 1::smallint, null) $$,
  'admins only', 'a Member cannot edit a Circle');

-- ============ browse_circles ============
select public.join_circle(pg_temp.id('joined far'));
select results_eq($$ select circle_id, place_name::text, distance_band from public.browse_circles() $$,
  $$ values (pg_temp.id('joined far'), 'Bandra, Mumbai'::text, '~' || round(extensions.st_distance(
              extensions.st_makepoint(73.787, 18.559)::extensions.geography,
              extensions.st_makepoint(72.878, 19.076)::extensions.geography) / 1000)::integer || ' km'),
            (pg_temp.id('mid'), 'Aundh West, Pune', '~5 km'),
            (pg_temp.id('near'), 'Baner, Pune', '<2 km') $$,
  'browse shows Circles in range and joined ones (joined first) with place name and band');
select ok(pg_temp.id('far') not in (select circle_id from public.browse_circles()),
  'a Circle beyond the Discover Range is left out');
update public.profiles set discover_range_km = 25 where id = pg_temp.m('b1');
select ok(pg_temp.id('far') in (select circle_id from public.browse_circles()),
  'a wider Discover Range brings it in');

select pg_temp.act_as_member(pg_temp.m('c1'));
select public.join_circle(pg_temp.id('far'));
select results_eq($$ select circle_id, distance_band from public.browse_circles() $$,
  $$ values (pg_temp.id('far'), null::text) $$, 'without a fresh point only joined Circles show, with no band');

-- ============ get_circle ============
select pg_temp.act_as_member(pg_temp.m('b1'));
select results_eq($$ select place_name::text, distance_band from public.get_circle(pg_temp.id('near')) $$,
  $$ values ('Baner, Pune'::text, '<2 km'::text) $$, 'get_circle returns the place name and band');

select * from finish();
rollback;
