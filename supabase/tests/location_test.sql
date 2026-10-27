begin;
\ir helpers/act_as.psql
select plan(32);

create function pg_temp.m(suffix text) returns uuid
language sql immutable as $$ select ('00000000-0000-0000-0000-0000000102' || suffix)::uuid $$;

create function pg_temp.pt(lat double precision, lng double precision) returns extensions.geography
language sql immutable as $$ select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography $$;

-- Where discover_feed will measure a Member from (the stored point if fresh, else null). Run as postgres.
create function pg_temp.at(member uuid) returns extensions.geography
language plpgsql stable as $$ begin return public.member_point(member); end $$;

-- Moves the Member's last accepted update back in time, as if the hour had passed. Run as postgres.
create function pg_temp.hours_ago(member uuid, h integer) returns void
language sql as $$ update public.member_locations set updated_at = now() - make_interval(hours => h) where user_id = member $$;

select pg_temp.create_visible_member(pg_temp.m('01'));
select pg_temp.create_visible_member(pg_temp.m('02'));
select pg_temp.create_visible_member(pg_temp.m('03'));
select pg_temp.create_account(pg_temp.m('09'));

-- Who may set a location
select pg_temp.act_as_member(pg_temp.m('01'));
select lives_ok($$ select public.set_location(18.5590, 73.7868) $$, 'a Member can set their location');

select pg_temp.act_as_anon();
select throws_ok($$ select public.set_location(18.5590, 73.7868) $$, '42501', null,
  'a signed-out visitor cannot set a location');

reset role;
select pg_temp.act_as_member(pg_temp.m('09'));
select throws_ok($$ select public.set_location(18.5590, 73.7868) $$, 'P0001', 'create your profile first',
  'an account with no profile cannot set a location');

-- Nobody reads member_locations, the owner included
select is_empty('select 1 from public.member_locations', 'another Member reads no locations');
reset role;
select pg_temp.act_as_member(pg_temp.m('01'));
select is_empty('select 1 from public.member_locations', 'the owner cannot read their own location');
reset role;
select pg_temp.act_as_admin(pg_temp.m('08'));
select is_empty('select 1 from public.member_locations', 'an admin cannot read locations');
reset role;
select pg_temp.act_as_member(pg_temp.m('01'));
select throws_ok($$ insert into public.member_locations (user_id, point) values (auth.uid(), 'SRID=4326;POINT(73.78 18.55)') $$,
  '42501', null, 'a Member cannot write the table directly');
select throws_ok($$ select public.member_point(auth.uid()) $$, '42501', null,
  'a Member cannot call the internal point helper');

-- At most one accepted update per hour
select throws_ok($$ select public.set_location(18.5600, 73.7900) $$, 'P0001', 'you can update your location once an hour',
  'a second update inside the hour is refused');
reset role;
select pg_temp.hours_ago(pg_temp.m('01'), 2);
select pg_temp.act_as_member(pg_temp.m('01'));
select lives_ok($$ select public.set_location(18.5515, 73.9348) $$, 'an update after the hour is accepted');

-- Anywhere in the world (no Service Region); a missing coordinate is refused
reset role;
select pg_temp.hours_ago(pg_temp.m('01'), 2);
select pg_temp.act_as_member(pg_temp.m('01'));
select lives_ok($$ select public.set_location(19.0760, 72.8777) $$, 'a point in Mumbai is accepted');
reset role;
select pg_temp.hours_ago(pg_temp.m('01'), 2);
select pg_temp.act_as_member(pg_temp.m('01'));
select lives_ok($$ select public.set_location(18.5204, 73.8567) $$, 'a point in central Pune is accepted');
select throws_ok($$ select public.set_location(null, 73.7868) $$, 'P0001', 'that location is not valid',
  'a missing coordinate is refused');
reset role;
select ok(extensions.st_distance(pg_temp.at(pg_temp.m('01')), pg_temp.pt(18.5204, 73.8567)) < 600,
  'a refused coordinate leaves the last accepted point in place');

-- The stored point carries a fixed per-Member offset of a few hundred metres
select ok(extensions.st_distance(pg_temp.at(pg_temp.m('01')), pg_temp.pt(18.5204, 73.8567)) between 200 and 500,
  'the stored point is 200 to 500 m from the phone''s point');
create temp table first_fix as
  select extensions.st_distance(pg_temp.at(pg_temp.m('01')), pg_temp.pt(18.5204, 73.8567)) as d,
         extensions.st_azimuth(pg_temp.pt(18.5204, 73.8567), pg_temp.at(pg_temp.m('01'))) as az;
select pg_temp.hours_ago(pg_temp.m('01'), 2);
select pg_temp.act_as_member(pg_temp.m('01'));
select public.set_location(18.5913, 73.7389);
reset role;
select ok(abs(extensions.st_distance(pg_temp.at(pg_temp.m('01')), pg_temp.pt(18.5913, 73.7389)) - (select d from first_fix)) < 1
          and abs(extensions.st_azimuth(pg_temp.pt(18.5913, 73.7389), pg_temp.at(pg_temp.m('01'))) - (select az from first_fix)) < 0.001,
  'the offset is the same distance and direction on every update');
select pg_temp.act_as_member(pg_temp.m('02'));
select public.set_location(18.5204, 73.8567);
reset role;
select ok(extensions.st_distance(pg_temp.at(pg_temp.m('02')), pg_temp.at(pg_temp.m('01'))) > 1,
  'another Member at the same point is stored with their own offset');

-- No location, or one older than 30 days: no point at all (no Area fallback)
delete from public.member_locations where user_id = pg_temp.m('03');
select ok(pg_temp.at(pg_temp.m('03')) is null, 'a Member who never set a location has no point');
select pg_temp.place(pg_temp.m('03'), 18.559, 73.787);
select pg_temp.hours_ago(pg_temp.m('02'), 20 * 24);
select ok(pg_temp.at(pg_temp.m('02')) is not null, 'a location 20 days old still counts');
select pg_temp.hours_ago(pg_temp.m('02'), 31 * 24);
select ok(pg_temp.at(pg_temp.m('02')) is null, 'a location older than 30 days is ignored');

-- Discover range on the profile
select is((select discover_range_km from public.profiles where id = pg_temp.m('03')), 10::smallint,
  'the discover range defaults to 10 km');
select pg_temp.act_as_member(pg_temp.m('03'));
select lives_ok($$ update public.profiles set discover_range_km = 25 where id = auth.uid() $$,
  'a Member can set their discover range');
select lives_ok($$ update public.profiles set discover_range_km = 100 where id = auth.uid() $$,
  'a Member can choose 100 km');
select is((select discover_range_km from public.profiles where id = auth.uid()), 100::smallint,
  'the 100 km range is saved');
select throws_ok($$ update public.profiles set discover_range_km = 7 where id = auth.uid() $$, '23514', null,
  'a range other than 2, 5, 10, 25, 50 or 100 km is refused');
reset role;
select pg_temp.act_as_member(pg_temp.m('02'));
update public.profiles set discover_range_km = 50 where id = pg_temp.m('03');
reset role;
select is((select discover_range_km from public.profiles where id = pg_temp.m('03')), 100::smallint,
  'a Member cannot change someone else''s range');

-- Account deletion removes the location
select pg_temp.act_as_member(pg_temp.m('02'));
select public.delete_account();
reset role;
select is_empty(format('select 1 from public.member_locations where user_id = %L', pg_temp.m('02')),
  'deleting the account removes the location row');
select isnt_empty(format('select 1 from public.member_locations where user_id = %L', pg_temp.m('01')),
  'deleting one account leaves other Members'' locations');

-- Reconsent after the data notice changed
select pg_temp.act_as_member(pg_temp.m('01'));
select is(public.needs_reconsent(), false, 'a Member who accepted every current document needs no reconsent');
reset role;
update public.consents set document_id = (select id from public.consent_documents where kind = 'data_notice' and version = 'v2')
where user_id = pg_temp.m('03')
  and document_id = (select id from public.consent_documents where kind = 'data_notice' and version = 'v3');
select pg_temp.act_as_member(pg_temp.m('03'));
select is(public.needs_reconsent(), true, 'a Member who accepted only the old data notice needs to reconsent');
select pg_temp.act_as_member(pg_temp.m('01'));
select ok(not exists (select 1 from public.get_profile(pg_temp.m('03'))),
  'a Member on the old data notice is hidden until they accept the new one');
select pg_temp.act_as_anon();
select throws_ok($$ select public.needs_reconsent() $$, '42501', null, 'a signed-out visitor cannot ask');

select * from finish();
rollback;
