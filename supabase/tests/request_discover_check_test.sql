begin;
\ir helpers/act_as.psql
select plan(7);

create function pg_temp.m(suffix text) returns uuid
language sql immutable as $$ select ('00000000-0000-0000-0000-0000000118' || suffix)::uuid $$;

-- Sets the Member's location as the app would. Run as postgres; leaves the role reset.
create function pg_temp.locate(member uuid, lat double precision, lng double precision) returns void
language plpgsql as $$
begin
  perform pg_temp.act_as_member(member);
  perform public.set_location(lat, lng);
  reset role;
end;
$$;

-- s01 sends from Baner's centre with a 5 km range; n02 is about 3.5 km north, f03 about 16 km east (Kharadi).
select pg_temp.create_visible_member(pg_temp.m('01'));
select pg_temp.locate(pg_temp.m('01'), 18.5590, 73.7868);
update public.profiles set discover_range_km = 5 where id = pg_temp.m('01');
select pg_temp.create_visible_member(pg_temp.m('02'));
select pg_temp.locate(pg_temp.m('02'), 18.5905, 73.7868);
select pg_temp.create_visible_member(pg_temp.m('03'));
select pg_temp.locate(pg_temp.m('03'), 18.5515, 73.9348);

select pg_temp.act_as_member(pg_temp.m('01'));
select lives_ok(format('select public.send_request(%L, %L)', pg_temp.m('02'), 'friends'),
  'a request to a Member within the Discover Range is sent');
select throws_ok(format('select public.send_request(%L, %L)', pg_temp.m('03'), 'friends'),
  'P0001', 'that member is not in your Discover', 'a request to a Member beyond the Discover Range is refused');

-- f03 accepts a request s01 sent before narrowing the range: accepting is not re-checked.
reset role;
update public.profiles set discover_range_km = null where id = pg_temp.m('01');
select pg_temp.act_as_member(pg_temp.m('01'));
select public.send_request(pg_temp.m('03'), 'friends') as conn \gset
reset role;
update public.profiles set discover_range_km = 5 where id = pg_temp.m('01');
select pg_temp.act_as_member(pg_temp.m('03'));
select lives_ok(format('select public.respond_request(%L, true)', :'conn'),
  'a request sent in range can still be accepted after the range narrows');

-- A second Service Region (Mumbai): o04 is located there; s05 has no range, so sees all of Pune only.
reset role;
insert into public.service_regions (name, min_lat, max_lat, min_lng, max_lng)
values ('Mumbai', 18.85, 19.30, 72.75, 73.10);
select pg_temp.create_visible_member(pg_temp.m('04'));
select pg_temp.locate(pg_temp.m('04'), 19.0760, 72.8777);
select pg_temp.create_visible_member(pg_temp.m('05'));
select pg_temp.locate(pg_temp.m('05'), 18.5590, 73.7868);
update public.profiles set discover_range_km = null where id = pg_temp.m('05');
select pg_temp.act_as_member(pg_temp.m('05'));
select throws_ok(format('select public.send_request(%L, %L)', pg_temp.m('04'), 'friends'),
  'P0001', 'that member is not in your Discover', 'a request to a Member in another Service Region is refused');
select lives_ok(format('select public.send_request(%L, %L)', pg_temp.m('03'), 'friends'),
  'a request anywhere in the sender''s own Service Region is sent');

-- Hidden and Paused recipients near s01 stay refused.
reset role;
select pg_temp.create_visible_member(pg_temp.m('06'));
select pg_temp.create_visible_member(pg_temp.m('07'));
update public.profiles set paused_at = now() where id = pg_temp.m('06');
update public.profiles set hidden_at = now() where id = pg_temp.m('07');
select pg_temp.act_as_member(pg_temp.m('01'));
select throws_ok(format('select public.send_request(%L, %L)', pg_temp.m('06'), 'friends'),
  'P0001', 'you cannot send a request to this member', 'a request to a Paused Member is refused');
select throws_ok(format('select public.send_request(%L, %L)', pg_temp.m('07'), 'friends'),
  'P0001', 'you cannot send a request to this member', 'a request to a hidden Member is refused');

select * from finish();
rollback;
