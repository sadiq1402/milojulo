begin;
\ir helpers/act_as.psql
select plan(25);

create function pg_temp.m(suffix text) returns uuid
language sql immutable as $$ select ('00000000-0000-0000-0000-0000000203' || suffix)::uuid $$;

create function pg_temp.in_feed(member uuid) returns boolean
language sql as $$ select exists (select 1 from public.discover_feed(null, 50) where user_id = member) $$;

-- v01 and n02 sit near Baner with fresh points; s03's point is 31 days old; x04 has none.
select pg_temp.create_visible_member(pg_temp.m('01'));
select pg_temp.create_visible_member(pg_temp.m('02'));
select pg_temp.create_visible_member(pg_temp.m('03'));
select pg_temp.place(pg_temp.m('03'), 18.559, 73.787, interval '31 days');
select pg_temp.create_visible_member(pg_temp.m('04'));
delete from public.member_locations where user_id = pg_temp.m('04');

-- A fresh location is what makes a Member discoverable
select pg_temp.act_as_member(pg_temp.m('01'));
select ok(pg_temp.in_feed(pg_temp.m('02')), 'a Member with a fresh location appears nearby');
select ok(not pg_temp.in_feed(pg_temp.m('03')), 'a Member whose location is 31 days old does not appear');
select ok(not pg_temp.in_feed(pg_temp.m('04')), 'a Member with no location does not appear');
select ok(not exists (select 1 from public.get_profile(pg_temp.m('04'))),
  'a Member with no location cannot be opened either');
select pg_temp.act_as_member(pg_temp.m('03'));
select is_empty($$ select 1 from public.discover_feed(null, 50) $$, 'a Member with a stale location sees nobody');
select pg_temp.act_as_member(pg_temp.m('04'));
select is_empty($$ select 1 from public.discover_feed(null, 50) $$, 'a Member with no location sees nobody');
select throws_ok(format('select public.send_request(%L, %L)', pg_temp.m('02'), 'friends'),
  'P0001', 'that member is not in your Discover', 'a Member with no location cannot send a Connection Request');

-- has_fresh_location() tells the app which screen to show
select pg_temp.act_as_member(pg_temp.m('01'));
select is(public.has_fresh_location(), true, 'a Member with a fresh location has one');
select pg_temp.act_as_member(pg_temp.m('03'));
select is(public.has_fresh_location(), false, 'a location 31 days old is not fresh');
select pg_temp.act_as_member(pg_temp.m('04'));
select is(public.has_fresh_location(), false, 'a Member with no location has no fresh one');
select pg_temp.act_as_anon();
select throws_ok($$ select public.has_fresh_location() $$, '42501', null, 'a signed-out visitor cannot ask');
reset role;

-- Anywhere in the world: no Service Region refuses a point
select pg_temp.act_as_member(pg_temp.m('04'));
select lives_ok($$ select public.set_location(51.5072, -0.1276) $$, 'a point in London is accepted');
select is(public.has_fresh_location(), true, 'the London point is fresh');
select throws_ok($$ select public.set_location(null, -0.1276) $$, 'P0001', 'that location is not valid',
  'a missing coordinate is refused');
select throws_ok($$ select public.set_location(91, 10) $$, 'P0001', 'that location is not valid',
  'a coordinate off the globe is refused');
reset role;
select pg_temp.create_visible_member(pg_temp.m('05'));
select pg_temp.place(pg_temp.m('05'), 51.52, -0.10);
select pg_temp.act_as_member(pg_temp.m('04'));
select ok(pg_temp.in_feed(pg_temp.m('05')), 'two Members in London discover each other');
select ok(not pg_temp.in_feed(pg_temp.m('02')), 'a Member in London does not see Pune');

-- Discover Range: 2 to 100 km, never empty
select pg_temp.act_as_member(pg_temp.m('01'));
select lives_ok($$ update public.profiles set discover_range_km = 100 where id = auth.uid() $$,
  'a Member can choose 100 km');
select throws_ok($$ update public.profiles set discover_range_km = null where id = auth.uid() $$, '23502', null,
  'a Member cannot choose no range');
select throws_ok($$ update public.profiles set discover_range_km = 75 where id = auth.uid() $$, '23514', null,
  'a range other than 2, 5, 10, 25, 50 or 100 km is refused');
-- t06 is about 90 km away (Mumbai side): in at 100 km, out at 50.
reset role;
select pg_temp.create_visible_member(pg_temp.m('06'));
select pg_temp.place(pg_temp.m('06'), 18.95, 73.20);
select pg_temp.act_as_member(pg_temp.m('01'));
select ok(pg_temp.in_feed(pg_temp.m('06')), 'a Member 90 km away appears at a 100 km range');
update public.profiles set discover_range_km = 50 where id = auth.uid();
select ok(not pg_temp.in_feed(pg_temp.m('06')), 'but not at 50 km');

-- The profile minimum needs no Area
reset role;
select pg_temp.create_member(pg_temp.m('07'));
update public.profiles set display_name = 'Lina', modes = '{friends}' where id = pg_temp.m('07');
insert into public.profile_prompts (user_id, position, question_id, answer)
select pg_temp.m('07'), p, (select min(id) from public.prompt_questions), 'An answer' from generate_series(1, 2) p;
insert into public.photos (user_id, object_key, position, uploaded_at)
select pg_temp.m('07'), pg_temp.m('07') || '/' || p || '.jpg', p, now() from generate_series(1, 2) p;
select pg_temp.act_as_member(pg_temp.m('07'));
select lives_ok($$ select public.submit_profile() $$, 'a profile is submitted without an Area');
select hasnt_column('public', 'profiles', 'area_id', 'profiles carry no Area');
select hasnt_table('public', 'service_regions', 'there are no Service Regions');

select * from finish();
rollback;
