begin;
\ir helpers/act_as.psql
select plan(68);

-- d1 hosts; d2 browses. Both hold only Friends.
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000d1');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000d2');

-- Posts as the current Member a plain Activity starting at the given time.
create function pg_temp.post(title varchar default 'Badminton', starts timestamptz default now() + interval '2 days')
returns uuid
language sql as $$
  select public.post_activity(title, 'sports', starts);
$$;

create function pg_temp.board_ids() returns setof uuid
language sql as $$
  select id from public.activity_board();
$$;

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
create temp table posted as select pg_temp.post() as id;
grant select on posted to authenticated, anon;

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d2');
select results_eq('select pg_temp.board_ids()', 'select id from posted',
  'a Visible Member sees an open Activity on the board');

-- Posting
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
select lives_ok($$ select public.post_activity('Chai and chess', 'games', now() + interval '1 day',
                                                now() + interval '1 day 2 hours', 20::smallint,
                                                'Bring a board', 'Cafe Goodluck, upstairs') $$,
  'a Visible Member posts an Activity with every detail');
select lives_ok($$ select public.post_activity('Run', 'outdoors', now() + interval '1 day',
                                                capacity => 1::smallint) $$,
  'an Activity may have a single spot');
select throws_ok($$ select pg_temp.post('   ') $$, 'P0001', 'an activity needs a title',
  'a blank title is refused');
select throws_ok($$ select pg_temp.post(starts => now() - interval '1 minute') $$, 'P0001',
  'an activity must start in the future', 'a start in the past is refused');
select lives_ok($$ select pg_temp.post(starts => now() + interval '89 days') $$,
  'an Activity may start 89 days ahead');
select throws_ok($$ select pg_temp.post(starts => now() + interval '92 days') $$, 'P0001',
  'an activity can start at most 90 days ahead', 'a start more than 90 days ahead is refused');
select throws_ok($$ select public.post_activity('Run', 'outdoors', now() + interval '1 day',
                                                 now() + interval '1 day') $$, 'P0001',
  'an activity must end after it starts', 'an end that is not after the start is refused');
select throws_ok($$ select public.post_activity('Run', 'outdoors', now() + interval '1 day',
                                                 capacity => 0::smallint) $$, 'P0001',
  'spots must be between 1 and 20', 'zero spots are refused');
select throws_ok($$ select public.post_activity('Run', 'outdoors', now() + interval '1 day',
                                                 capacity => 21::smallint) $$, 'P0001',
  'spots must be between 1 and 20', 'more than 20 spots are refused');

select public.set_paused(true);
select throws_ok($$ select pg_temp.post() $$, 'P0001', 'unpause your profile to post activities',
  'a Paused Member cannot post');
select public.set_paused(false);

reset role;
select pg_temp.create_complete_member('00000000-0000-0000-0000-0000000000d9');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d9');
select throws_ok($$ select pg_temp.post() $$, 'P0001', 'your profile is not visible',
  'a Member without a Submitted Profile cannot post');

select pg_temp.act_as_anon();
select throws_ok($$ select pg_temp.post() $$, '42501', null, 'a signed-out visitor cannot post');

-- The board: d1 hosts a fresh set; d3 holds only Networking; d4 stands apart.
reset role;
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000d3', '{networking}');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000d4');
update public.activities set hidden_at = now() where hidden_at is null;

-- Inserted as postgres, so times in the past are possible.
create function pg_temp.seed(host uuid, starts interval, ends interval default null, title varchar default 'Seeded')
returns uuid
language sql as $$
  insert into public.activities (host_id, title, type, place, starts_at, ends_at, capacity)
  values (host, title, 'sports', 'SRID=4326;POINT(73.787 18.559)', now() + starts, now() + ends, 3)
  returning id;
$$;

create temp table seeded (name text primary key, id uuid);
grant select on seeded to authenticated, anon;
insert into seeded values
  ('later', pg_temp.seed('00000000-0000-0000-0000-0000000000d1', '3 days')),
  ('soon', pg_temp.seed('00000000-0000-0000-0000-0000000000d1', '1 day')),
  ('running', pg_temp.seed('00000000-0000-0000-0000-0000000000d1', '-2 hours')),
  ('long', pg_temp.seed('00000000-0000-0000-0000-0000000000d1', '-4 hours', '1 hour')),
  ('past default end', pg_temp.seed('00000000-0000-0000-0000-0000000000d1', '-4 hours')),
  ('past end', pg_temp.seed('00000000-0000-0000-0000-0000000000d1', '-1 hour', '-1 minute')),
  ('hidden', pg_temp.seed('00000000-0000-0000-0000-0000000000d1', '1 day'));
update public.activities set hidden_at = now() where id = (select id from seeded where name = 'hidden');

create function pg_temp.seeded_ids(variadic names text[]) returns setof uuid
language sql as $$
  select id from seeded where name = any (names);
$$;

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d2');
select results_eq('select pg_temp.board_ids()',
  $$ select id from seeded where name in ('running', 'long', 'soon', 'later')
     order by array_position(array['long', 'running', 'soon', 'later'], name) $$,
  'the board shows open Activities not yet ended, unhidden, soonest first');
select results_eq(
  $$ select host_id, host_name, capacity, spots_left, is_mine from public.activity_board()
     where id = (select id from seeded where name = 'soon') $$,
  $$ values ('00000000-0000-0000-0000-0000000000d1'::uuid, 'Test'::varchar, 3::smallint, 3, false) $$,
  'a board row carries the host''s first name, the spots and spots left');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d3');
select set_eq('select pg_temp.board_ids()', $$ select pg_temp.seeded_ids('running', 'long', 'soon', 'later') $$,
  'a Member sees the board whatever Modes they hold');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
select ok((select bool_and(is_mine) from public.activity_board()), 'the host sees their own Activities as theirs');

select public.set_paused(true);
select is_empty('select * from public.activity_board()', 'a Paused Member sees an empty board');
select public.set_paused(false);
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d9');
select is_empty('select * from public.activity_board()', 'a Member who is not visible sees an empty board');
select pg_temp.act_as_anon();
select throws_ok('select * from public.activity_board()', '42501', null,
  'a signed-out visitor cannot read the board');

-- Blocks, either way, hide the host's Activities.
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
select public.block_user('00000000-0000-0000-0000-0000000000d2');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d2');
select is_empty('select * from public.activity_board()', 'a Member blocked by the host does not see their Activities');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d4');
select isnt_empty('select * from public.activity_board()', 'a Block hides nothing from anyone else');
reset role;
delete from public.blocks;
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d2');
select public.block_user('00000000-0000-0000-0000-0000000000d1');
select is_empty('select * from public.activity_board()', 'a Member who blocked the host does not see their Activities');
reset role;
delete from public.blocks;

-- A banned or deleted host's Activities leave the board.
update public.profiles set status = 'banned' where id = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d4');
select is_empty('select * from public.activity_board()', 'a banned host''s Activities leave the board');
reset role;
update public.profiles set status = 'active', deleted_at = now() where id = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d4');
select is_empty('select * from public.activity_board()', 'a deleted host''s Activities leave the board');
reset role;
update public.profiles set deleted_at = null where id = '00000000-0000-0000-0000-0000000000d1';

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d4');
select set_eq('select pg_temp.board_ids()', $$ select pg_temp.seeded_ids('running', 'long', 'soon', 'later') $$,
  'a host who is active again is back on the board');

-- Tonight / This weekend / Later, by the calendar in India. On a Sunday the only weekend left is today.
create temp table india as
  select (now() at time zone 'Asia/Kolkata')::date as today,
         extract(isodow from (now() at time zone 'Asia/Kolkata')::date)::integer as dow;
create function pg_temp.india_noon(days integer) returns timestamptz
language sql as $$
  select ((select today from india) + days + time '12:00') at time zone 'Asia/Kolkata';
$$;

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d4');
create temp table labelled as
  select 'tonight' as expected, public.post_activity('Now', 'sports', now() + interval '1 second') as id
  union all
  select case when dow = 7 then 'later' else 'this_weekend' end,
         public.post_activity('Weekend', 'sports',
                              pg_temp.india_noon(case when dow = 7 then 6 else 7 - dow end))
  from india
  union all
  select case when dow < 6 then 'this_weekend' else 'later' end,
         public.post_activity('Saturday', 'sports',
                              pg_temp.india_noon(case when dow < 6 then 6 - dow else 14 end))
  from india
  union all
  select 'later', public.post_activity('Monday', 'sports', pg_temp.india_noon(8 - dow)) from india
  union all
  select 'later', public.post_activity('Fortnight', 'sports', pg_temp.india_noon(14));

select set_eq('select b.id, b.starts_when from public.activity_board() b join labelled l using (id)',
  'select id, expected from labelled',
  'the board labels Activities tonight, this weekend or later by the date in India');

-- One Activity: d1 hosts, with a venue that only the host reads.
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
create temp table mine as
  select public.post_activity('Trek', 'outdoors', pg_temp.india_noon(14),
                              venue_detail => 'Gate 2, Sinhagad base') as id;
grant select on mine to authenticated, anon;

create function pg_temp.mine() returns uuid
language sql as $$ select id from mine $$;

select results_eq($$ select venue_detail, status, is_locked, is_mine, spots_left from public.get_activity(pg_temp.mine()) $$,
  $$ values ('Gate 2, Sinhagad base'::varchar, 'open'::public.activity_status, false, true, 4) $$,
  'the host reads their Activity with its venue');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d2');
select results_eq($$ select title, venue_detail, is_mine, starts_when from public.get_activity(pg_temp.mine()) $$,
  $$ values ('Trek'::varchar, null::varchar, false, 'later') $$,
  'another Member reads the Activity without its venue');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d9');
select is_empty('select * from public.get_activity(pg_temp.mine())',
  'a Member who is not visible cannot read an Activity');
select pg_temp.act_as_anon();
select throws_ok('select * from public.get_activity(pg_temp.mine())', '42501', null,
  'a signed-out visitor cannot read an Activity');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d2');
select public.block_user('00000000-0000-0000-0000-0000000000d1');
select is_empty('select * from public.get_activity(pg_temp.mine())',
  'a Member who blocked the host cannot read their Activity');
reset role;
delete from public.blocks;

update public.activities set hidden_at = now() where id = pg_temp.mine();
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d2');
select is_empty('select * from public.get_activity(pg_temp.mine())', 'another Member cannot read a hidden Activity');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
select public.set_paused(true);
select isnt_empty('select * from public.get_activity(pg_temp.mine())',
  'the host still reads their own hidden Activity, even while Paused');
select public.set_paused(false);
reset role;
update public.activities set hidden_at = null where id = pg_temp.mine();

-- No direct access to either table.
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
select throws_ok('select * from public.activities', '42501', null, 'a host cannot read Activities directly');
select throws_ok('select * from public.activity_venues', '42501', null, 'a host cannot read venues directly');
select throws_ok($$ insert into public.activities (host_id, title, type, place, starts_at, capacity)
                    values ('00000000-0000-0000-0000-0000000000d1', 'Sneaky', 'games', 'SRID=4326;POINT(73.787 18.559)', now() + interval '1 day', 2) $$,
  '42501', null, 'an Activity cannot be inserted directly');
select throws_ok($$ update public.activities set status = 'open' $$, '42501', null,
  'an Activity cannot be updated directly');
select throws_ok('delete from public.activities', '42501', null, 'an Activity cannot be deleted directly');
select throws_ok($$ insert into public.activity_venues (activity_id, venue_detail) values (pg_temp.mine(), 'Here') $$,
  '42501', null, 'a venue cannot be written directly');

-- A new Activity is unlocked with every spot free.
select results_eq('select is_locked, spots_left = capacity from public.get_activity(pg_temp.mine())',
  $$ values (false, true) $$, 'a new Activity is unlocked and has all its spots left');

-- An Auto-hidden host's Activities leave the board (Reports, decision 23); a Paused host's stay.
reset role;
update public.profiles set hidden_at = now() where id = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d2');
select ok(not exists (select 1 from public.activity_board() where host_id = '00000000-0000-0000-0000-0000000000d1'),
  'an Auto-hidden host''s Activities leave the board');
reset role;
update public.profiles set hidden_at = null, paused_at = now() where id = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d2');
select ok(exists (select 1 from public.activity_board() where host_id = '00000000-0000-0000-0000-0000000000d1'),
  'a Paused host''s Activities stay on the board');
reset role;
update public.profiles set paused_at = null where id = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');

-- Changing an Activity: nulls keep a field, an empty description or venue clears it.
create function pg_temp.change(
  title varchar default null, description varchar default null, capacity smallint default null,
  starts timestamptz default null, ends timestamptz default null,
  venue varchar default null, activity uuid default pg_temp.mine()
) returns void
language sql as $$
  select public.update_activity(activity, title, description, capacity, starts, ends, venue);
$$;

create function pg_temp.details() returns table (title varchar, description varchar, capacity smallint,
  starts_at timestamptz, ends_at timestamptz, venue_detail varchar)
language sql as $$
  select title, description, capacity, starts_at, ends_at, venue_detail from public.get_activity(pg_temp.mine());
$$;

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
select pg_temp.change('Night trek', 'Torches needed', 6::smallint, now() + interval '2 days',
                      now() + interval '2 days 5 hours', 'Gate 3');
select results_eq('select * from pg_temp.details()',
  $$ values ('Night trek'::varchar, 'Torches needed'::varchar, 6::smallint, now() + interval '2 days',
             now() + interval '2 days 5 hours', 'Gate 3'::varchar) $$,
  'the host changes every detail of an open Activity');
select pg_temp.change();
select results_eq('select * from pg_temp.details()',
  $$ values ('Night trek'::varchar, 'Torches needed'::varchar, 6::smallint, now() + interval '2 days',
             now() + interval '2 days 5 hours', 'Gate 3'::varchar) $$,
  'nulls leave every detail as it was');
select pg_temp.change(description => '', venue => '');
select results_eq('select description, venue_detail from pg_temp.details()',
  $$ values (null::varchar, null::varchar) $$, 'an empty description or venue clears it');
select pg_temp.change(venue => 'Gate 4');
select results_eq('select venue_detail from pg_temp.details()', $$ values ('Gate 4'::varchar) $$,
  'the host adds a venue later');

select pg_temp.change(title => '  Night trek  ');
select results_eq('select title from pg_temp.details()', $$ values ('Night trek'::varchar) $$,
  'a changed title is stored trimmed');
select throws_ok($$ select pg_temp.change(title => ' ') $$, 'P0001', 'an activity needs a title',
  'a change to a blank title is refused');
select throws_ok($$ select pg_temp.change(starts => now() - interval '1 hour') $$, 'P0001',
  'an activity must start in the future', 'moving the start into the past is refused');
select throws_ok($$ select pg_temp.change(starts => now() + interval '92 days') $$, 'P0001',
  'an activity can start at most 90 days ahead', 'moving the start more than 90 days ahead is refused');
select throws_ok($$ select pg_temp.change(ends => now() + interval '1 day') $$, 'P0001',
  'an activity must end after it starts', 'an end before the kept start is refused');
select throws_ok($$ select pg_temp.change(capacity => 21::smallint) $$, 'P0001',
  'spots must be between 1 and 20', 'more than 20 spots are refused on a change');
select lives_ok($$ select pg_temp.change(description => 'Still going', activity => (select id from seeded where name = 'running')) $$,
  'an Activity already under way keeps its start while its description changes');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d2');
select throws_ok($$ select pg_temp.change(title => 'Mine now') $$, 'P0001', 'no activity to change',
  'another Member cannot change the Activity');
reset role;
update public.activities set status = 'expired' where id = (select id from seeded where name = 'soon');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
select throws_ok($$ select pg_temp.change(title => 'Again', activity => (select id from seeded where name = 'soon')) $$,
  'P0001', 'no activity to change', 'an Activity that is no longer open cannot change');
select pg_temp.act_as_anon();
select throws_ok($$ select public.update_activity(pg_temp.mine(), 'x', null, null, null, null, null) $$,
  '42501', null, 'a signed-out visitor cannot change an Activity');

-- Cancelling
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d2');
select throws_ok($$ select public.cancel_activity(pg_temp.mine()) $$, 'P0001', 'no activity to cancel',
  'another Member cannot cancel the Activity');
select pg_temp.act_as_anon();
select throws_ok($$ select public.cancel_activity(pg_temp.mine()) $$, '42501', null,
  'a signed-out visitor cannot cancel an Activity');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
select public.cancel_activity(pg_temp.mine());
select results_eq('select status from public.get_activity(pg_temp.mine())',
  $$ values ('cancelled'::public.activity_status) $$, 'the host cancels their Activity');
select throws_ok($$ select public.cancel_activity(pg_temp.mine()) $$, 'P0001', 'no activity to cancel',
  'a cancelled Activity cannot be cancelled again');
select throws_ok($$ select pg_temp.change(title => 'Back on') $$, 'P0001', 'no activity to change',
  'a cancelled Activity cannot change');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d2');
select ok(pg_temp.mine() not in (select pg_temp.board_ids()), 'a cancelled Activity leaves the board');
select is_empty('select * from public.get_activity(pg_temp.mine())', 'another Member cannot read a cancelled Activity');

-- Expiry, run by pg_cron every 15 minutes.
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
select throws_ok('select public.expire_activities()', '42501', null, 'a Member cannot run the expiry job');
reset role;
select public.expire_activities();
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
select results_eq(
  $$ select s.name, a.status from seeded s cross join lateral public.get_activity(s.id) a
     where s.name in ('past default end', 'past end', 'running', 'long') order by s.name $$,
  $$ values ('long', 'open'::public.activity_status), ('past default end', 'expired'), ('past end', 'expired'),
            ('running', 'open') $$,
  'expiry closes Activities past their end, or 3 hours after a start with no end, and leaves the rest open');
select results_eq('select status from public.get_activity(pg_temp.mine())',
  $$ values ('cancelled'::public.activity_status) $$, 'expiry leaves a cancelled Activity cancelled');
reset role;
select results_eq($$ select schedule, command from cron.job where jobname = 'expire-activities' $$,
  $$ values ('*/15 * * * *'::text, 'select public.expire_activities()'::text) $$,
  'the expiry job runs every 15 minutes');

select * from finish();
rollback;
