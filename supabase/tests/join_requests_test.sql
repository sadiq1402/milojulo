begin;
\ir helpers/act_as.psql
select plan(106);

-- e1 hosts; the others join. All hold only Friends.
create function pg_temp.m(suffix text) returns uuid
language sql immutable as $$ select ('00000000-0000-0000-0000-0000000000' || suffix)::uuid $$;

create function pg_temp.as_member(suffix text) returns void
language sql as $$ select pg_temp.act_as_member(pg_temp.m(suffix)) $$;

-- Named ids shared across roles.
create temp table ids (k text primary key, v uuid);
grant select, insert on ids to authenticated, anon;

create function pg_temp.id(key text) returns uuid
language sql stable as $$ select v from ids where k = $1 $$;

create function pg_temp.keep(key text, value uuid) returns uuid
language sql as $$ insert into ids values ($1, $2) returning v $$;

-- An open Activity hosted by the given Member. Run as postgres, so a start in the past is possible.
create function pg_temp.seed(key text, host text, starts interval default '2 days', spots integer default 3,
  venue varchar default null) returns uuid
language plpgsql as $$
declare
  new_id uuid;
begin
  insert into public.activities (host_id, title, type, area_id, starts_at, capacity)
  values (pg_temp.m(host), key, 'sports', 'baner', now() + starts, spots)
  returning id into new_id;
  if venue is not null then
    insert into public.activity_venues (activity_id, venue_detail) values (new_id, venue);
  end if;
  return pg_temp.keep(key, new_id);
end;
$$;

-- The current Member asks to join; the request is kept as '<member> <activity>'.
create function pg_temp.join(member text, activity text) returns uuid
language sql as $$
  select pg_temp.keep(member || ' ' || activity, public.join_activity_request(pg_temp.id(activity)));
$$;

-- The same, as the given Member, then back to postgres.
create function pg_temp.join_as(member text, activity text) returns uuid
language plpgsql as $$
declare
  request uuid;
begin
  perform pg_temp.as_member(member);
  request := pg_temp.join(member, activity);
  reset role;
  return request;
end;
$$;

create function pg_temp.request_status(key text) returns public.request_status
language sql as $$ select status from public.activity_requests where id = pg_temp.id(key) $$;

select pg_temp.create_visible_member(pg_temp.m(s))
from unnest(array['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'ea', 'eb', 'ec', 'ed']) s;
select pg_temp.create_complete_member(pg_temp.m('e9'));
update public.profiles set display_name = 'Host' where id = pg_temp.m('e1');
update public.profiles set display_name = 'Mira', area_id = 'wakad' where id = pg_temp.m('e3');
update public.profiles set display_name = 'Kabir', area_id = 'kharadi' where id = pg_temp.m('e4');
select pg_temp.keep(s || ' cover', (select id from public.photos where user_id = pg_temp.m(s) and position = 1))
from unnest(array['e1', 'e3', 'e4']) s;

-- Asking to join
select pg_temp.seed('trek', 'e1', venue => 'Gate 2, Sinhagad base');
select pg_temp.as_member('e2');
select lives_ok($$ select pg_temp.join('e2', 'trek') $$, 'a Visible Member asks to join an Activity on the board');
select results_eq(
  'select activity_id, requester_id, status, responded_at, withdrawn_at from public.activity_requests',
  $$ values (pg_temp.id('trek'), pg_temp.m('e2'), 'requested'::public.request_status, null::timestamptz,
             null::timestamptz) $$,
  'the requester reads their Join Request, waiting for the host');
select results_eq(
  $$ select my_request_id, my_request_status, connection_id, venue_detail from public.get_activity(pg_temp.id('trek')) $$,
  $$ values (pg_temp.id('e2 trek'), 'requested'::public.request_status, null::uuid, null::varchar) $$,
  'a waiting requester sees their request on the Activity, but not the venue');
select results_eq($$ select spots_left from public.activity_board() where id = pg_temp.id('trek') $$,
  $$ values (3) $$, 'a waiting request takes no spot');

select pg_temp.as_member('e1');
select results_eq('select id from public.activity_requests', $$ values (pg_temp.id('e2 trek')) $$,
  'the host reads Join Requests to their Activity');
select results_eq(
  $$ select my_request_id, my_request_status, connection_id, venue_detail from public.get_activity(pg_temp.id('trek')) $$,
  $$ values (null::uuid, null::public.request_status, null::uuid, 'Gate 2, Sinhagad base'::varchar) $$,
  'the host reads the venue and has no request of their own');
select pg_temp.as_member('e4');
select is_empty('select * from public.activity_requests', 'another Member reads no Join Request');
select results_eq(
  $$ select my_request_id, my_request_status, connection_id, venue_detail from public.get_activity(pg_temp.id('trek')) $$,
  $$ values (null::uuid, null::public.request_status, null::uuid, null::varchar) $$,
  'a Member who has not asked sees no request and no venue');
select pg_temp.act_as_anon();
select throws_ok('select * from public.activity_requests', '42501', null,
  'a signed-out visitor cannot read Join Requests');
select throws_ok($$ select public.join_activity_request(pg_temp.id('trek')) $$, '42501', null,
  'a signed-out visitor cannot ask to join');

-- No direct writes.
select pg_temp.as_member('e3');
select throws_ok($$ insert into public.activity_requests (activity_id, requester_id)
                    values (pg_temp.id('trek'), pg_temp.m('e3')) $$,
  '42501', null, 'a Join Request cannot be inserted directly');
select pg_temp.as_member('e1');
select throws_ok($$ update public.activity_requests set status = 'accepted' $$, '42501', null,
  'a Join Request cannot be answered directly');
select pg_temp.as_member('e2');
select throws_ok('delete from public.activity_requests', '42501', null, 'a Join Request cannot be deleted directly');

-- Refusals, in the contract's order.
select pg_temp.as_member('e2');
select throws_ok($$ select public.join_activity_request(pg_temp.id('trek')) $$, 'P0001',
  'you already asked to join this activity', 'a Member cannot ask to join the same Activity twice');
select pg_temp.as_member('e1');
select throws_ok($$ select public.join_activity_request(pg_temp.id('trek')) $$, 'P0001',
  'you cannot join your own activity', 'the host cannot join their own Activity');
select pg_temp.as_member('e3');
select public.set_paused(true);
select throws_ok($$ select public.join_activity_request(pg_temp.id('trek')) $$, 'P0001',
  'unpause your profile to join activities', 'a Paused Member cannot ask to join');
select public.set_paused(false);
select pg_temp.as_member('e9');
select throws_ok($$ select public.join_activity_request(pg_temp.id('trek')) $$, 'P0001',
  'your profile is not visible', 'a Member who is not visible cannot ask to join');
select pg_temp.as_member('e3');
select throws_ok($$ select public.join_activity_request(gen_random_uuid()) $$, 'P0001',
  'no activity to join', 'an unknown Activity cannot be joined');

reset role;
select pg_temp.seed('called off', 'e1');
update public.activities set status = 'cancelled' where id = pg_temp.id('called off');
select pg_temp.seed('hidden', 'e1');
update public.activities set hidden_at = now() where id = pg_temp.id('hidden');
select pg_temp.seed('over', 'e1', '-4 hours');
select pg_temp.seed('started', 'e1', '-1 hour');
select pg_temp.as_member('e3');
select throws_ok($$ select public.join_activity_request(pg_temp.id('called off')) $$, 'P0001',
  'no activity to join', 'a cancelled Activity cannot be joined');
select throws_ok($$ select public.join_activity_request(pg_temp.id('hidden')) $$, 'P0001',
  'no activity to join', 'a hidden Activity cannot be joined');
select throws_ok($$ select public.join_activity_request(pg_temp.id('over')) $$, 'P0001',
  'no activity to join', 'an Activity that is over cannot be joined');
select throws_ok($$ select public.join_activity_request(pg_temp.id('started')) $$, 'P0001',
  'this activity has already started', 'an Activity under way cannot be joined');

select pg_temp.as_member('e1');
select public.block_user(pg_temp.m('e3'));
select pg_temp.as_member('e3');
select throws_ok($$ select public.join_activity_request(pg_temp.id('trek')) $$, 'P0001',
  'no activity to join', 'a Member blocked by the host cannot ask to join');
reset role;
delete from public.blocks;
select pg_temp.as_member('e3');
select public.block_user(pg_temp.m('e1'));
select throws_ok($$ select public.join_activity_request(pg_temp.id('trek')) $$, 'P0001',
  'no activity to join', 'a Member who blocked the host cannot ask to join');
reset role;
delete from public.blocks;

-- Spots count joiners only; a full Activity takes no more.
select pg_temp.seed('solo', 'e1', spots => 1);
select pg_temp.as_member('e2');
select pg_temp.join('e2', 'solo');
select pg_temp.as_member('e3');
select pg_temp.join('e3', 'solo');
select pg_temp.as_member('e1');
select results_eq($$ select spots_left, is_locked from public.get_activity(pg_temp.id('solo')) $$,
  $$ values (1, false) $$, 'the host does not take one of the spots');
select lives_ok($$ select pg_temp.keep('e2 solo connection', public.respond_activity_request(pg_temp.id('e2 solo'), true)) $$,
  'the host accepts a Join Request');
select results_eq($$ select spots_left, is_locked from public.get_activity(pg_temp.id('solo')) $$,
  $$ values (0, true) $$, 'an accepted joiner takes a spot and locks the Activity');
select throws_ok($$ select public.respond_activity_request(pg_temp.id('e3 solo'), true) $$, 'P0001',
  'no spots left', 'the host cannot accept a joiner once every spot is taken');
select pg_temp.as_member('e4');
select throws_ok($$ select public.join_activity_request(pg_temp.id('solo')) $$, 'P0001',
  'no spots left', 'a Member cannot ask to join when no spots are left');
select results_eq($$ select spots_left from public.activity_board() where id = pg_temp.id('solo') $$,
  $$ values (0) $$, 'the board shows spots left after accepted joiners');

-- The Activity Connection
select pg_temp.as_member('e2');
select results_eq(
  $$ select requester_id, addressee_id, mode, activity_id, status from public.connections
     where id = pg_temp.id('e2 solo connection') $$,
  $$ values (pg_temp.m('e2'), pg_temp.m('e1'), 'activities'::public.mode, pg_temp.id('solo'),
             'accepted'::public.connection_status) $$,
  'accepting creates an accepted Activity Connection under Activities, linked to the Activity');
select results_eq(
  $$ select user_id from public.connection_members where connection_id = pg_temp.id('e2 solo connection')
     order by user_id $$,
  $$ values (pg_temp.m('e1')), (pg_temp.m('e2')) $$, 'host and joiner are both members of the Activity Connection');
select lives_ok(
  $$ insert into public.messages (id, connection_id, type, body)
     values (gen_random_uuid(), pg_temp.id('e2 solo connection'), 'text', 'See you there') $$,
  'the joiner chats with the host');
select results_eq($$ select status, responded_at is not null from public.activity_requests where id = pg_temp.id('e2 solo') $$,
  $$ values ('accepted'::public.request_status, true) $$, 'the joiner sees their Join Request accepted');
select results_eq(
  $$ select my_request_status, connection_id from public.get_activity(pg_temp.id('solo')) $$,
  $$ values ('accepted'::public.request_status, pg_temp.id('e2 solo connection')) $$,
  'an accepted joiner gets their Activity Connection with the Activity');

-- Answering: only the host, only a waiting request, only before the start, never across a Block.
select pg_temp.as_member('e3');
select throws_ok($$ select public.respond_activity_request(pg_temp.id('e3 solo'), true) $$, 'P0001',
  'no join request to answer', 'the requester cannot answer their own Join Request');
select pg_temp.as_member('e4');
select throws_ok($$ select public.respond_activity_request(pg_temp.id('e3 solo'), false) $$, 'P0001',
  'no join request to answer', 'another Member cannot answer a Join Request');
select pg_temp.as_member('e1');
select throws_ok($$ select public.respond_activity_request(pg_temp.id('e2 solo'), false) $$, 'P0001',
  'no join request to answer', 'an answered Join Request cannot be answered again');
select pg_temp.act_as_anon();
select throws_ok($$ select public.respond_activity_request(pg_temp.id('e3 solo'), true) $$, '42501', null,
  'a signed-out visitor cannot answer a Join Request');

reset role;
select pg_temp.seed('started later', 'e1');
select pg_temp.seed('feud', 'e1');
select pg_temp.seed('scrapped', 'e1');
select pg_temp.as_member('e3');
select pg_temp.join('e3', 'started later');
select pg_temp.join('e3', 'scrapped');
select pg_temp.as_member('e4');
select pg_temp.join('e4', 'feud');
reset role;
update public.activities set starts_at = now() - interval '1 hour' where id = pg_temp.id('started later');
update public.activities set status = 'cancelled' where id = pg_temp.id('scrapped');
insert into public.blocks (blocker_id, blocked_id) values (pg_temp.m('e4'), pg_temp.m('e1'));
select pg_temp.as_member('e1');
select throws_ok($$ select public.respond_activity_request(pg_temp.id('e3 started later'), true) $$, 'P0001',
  'no join request to answer', 'the host cannot answer once the Activity has started');
select throws_ok($$ select public.respond_activity_request(pg_temp.id('e3 scrapped'), true) $$, 'P0001',
  'no join request to answer', 'the host cannot answer on a cancelled Activity');
select throws_ok($$ select public.respond_activity_request(pg_temp.id('e4 feud'), true) $$, 'P0001',
  'no join request to answer', 'the host cannot answer across a Block');
reset role;
delete from public.blocks;
select pg_temp.as_member('e1');
select lives_ok($$ select public.respond_activity_request(pg_temp.id('e4 feud'), false) $$,
  'once the Block is lifted the host can answer');

-- Declining
select pg_temp.as_member('e3');
select pg_temp.join('e3', 'trek');
select pg_temp.as_member('e1');
select results_eq($$ select public.respond_activity_request(pg_temp.id('e3 trek'), false) $$,
  $$ values (null::uuid) $$, 'declining returns no Connection');
select pg_temp.as_member('e3');
select results_eq($$ select status, responded_at is not null from public.activity_requests where id = pg_temp.id('e3 trek') $$,
  $$ values ('declined'::public.request_status, true) $$, 'the requester sees their Join Request declined');
select is_empty('select * from public.connections', 'declining creates no Connection');
select throws_ok($$ select public.join_activity_request(pg_temp.id('trek')) $$, 'P0001',
  'you already asked to join this activity', 'a declined Member cannot ask again');

-- Reusing the pair's Connection: e5 is already connected to the host, e6 has a request waiting.
select pg_temp.as_member('e5');
select pg_temp.keep('e5 friendship', public.send_request(pg_temp.m('e1'), 'friends'));
select pg_temp.as_member('e1');
select public.respond_request(pg_temp.id('e5 friendship'), true);
select pg_temp.as_member('e6');
select pg_temp.keep('e6 friendship', public.send_request(pg_temp.m('e1'), 'friends', 'Badminton?'));
select pg_temp.as_member('e5');
select pg_temp.join('e5', 'trek');
select pg_temp.as_member('e6');
select pg_temp.join('e6', 'trek');

select pg_temp.as_member('e1');
select results_eq($$ select public.respond_activity_request(pg_temp.id('e5 trek'), true) $$,
  $$ values (pg_temp.id('e5 friendship')) $$, 'accepting reuses the pair''s accepted Connection');
select results_eq($$ select public.respond_activity_request(pg_temp.id('e6 trek'), true) $$,
  $$ values (pg_temp.id('e6 friendship')) $$, 'accepting a Join Request accepts the pair''s waiting Connection Request');
select pg_temp.as_member('e5');
select results_eq($$ select id, mode, activity_id, status from public.connections $$,
  $$ values (pg_temp.id('e5 friendship'), 'friends'::public.mode, null::uuid, 'accepted'::public.connection_status) $$,
  'the reused Connection keeps its Mode and no second Connection is made');
select pg_temp.as_member('e6');
select results_eq($$ select id, mode, note, status from public.connections $$,
  $$ values (pg_temp.id('e6 friendship'), 'friends'::public.mode, 'Badminton?'::varchar,
             'accepted'::public.connection_status) $$,
  'the waiting Connection Request is accepted as it stands');
select results_eq($$ select count(*)::integer from public.connection_members where user_id = pg_temp.m('e6') $$,
  $$ values (1) $$, 'the accepted Connection Request opens a chat');

-- The venue goes to the host and accepted joiners only.
select pg_temp.as_member('e5');
select results_eq(
  $$ select venue_detail, my_request_status, connection_id from public.get_activity(pg_temp.id('trek')) $$,
  $$ values ('Gate 2, Sinhagad base'::varchar, 'accepted'::public.request_status, pg_temp.id('e5 friendship')) $$,
  'an accepted joiner reads the venue and their Connection with the host');
select pg_temp.as_member('e2');
select results_eq($$ select venue_detail from public.get_activity(pg_temp.id('trek')) $$,
  $$ values (null::varchar) $$, 'a waiting requester still cannot read the venue');
select pg_temp.as_member('e3');
select results_eq($$ select venue_detail from public.get_activity(pg_temp.id('trek')) $$,
  $$ values (null::varchar) $$, 'a declined requester cannot read the venue');

-- An accepted joiner keeps the Activity while Paused or after an Auto-hide, until it ends.
select pg_temp.as_member('e5');
select public.set_paused(true);
select isnt_empty($$ select * from public.get_activity(pg_temp.id('trek')) $$,
  'an accepted joiner still reads the Activity while Paused');
select public.set_paused(false);
select pg_temp.as_member('e4');
select public.set_paused(true);
select is_empty($$ select * from public.get_activity(pg_temp.id('trek')) $$,
  'a Paused Member who has not joined cannot read the Activity');
select public.set_paused(false);
reset role;
update public.activities set hidden_at = now() where id = pg_temp.id('trek');
select pg_temp.as_member('e5');
select isnt_empty($$ select * from public.get_activity(pg_temp.id('trek')) $$,
  'an accepted joiner still reads a hidden Activity');
select pg_temp.as_member('e2');
select is_empty($$ select * from public.get_activity(pg_temp.id('trek')) $$,
  'a waiting requester cannot read a hidden Activity');
reset role;
update public.activities set hidden_at = null, status = 'cancelled' where id = pg_temp.id('trek');
select pg_temp.as_member('e5');
select is_empty($$ select * from public.get_activity(pg_temp.id('trek')) $$,
  'an accepted joiner cannot read a cancelled Activity');
reset role;
update public.activities set status = 'open' where id = pg_temp.id('trek');

-- A Locked Activity: time, end, Area, venue and title stay; description and more spots may change.
select pg_temp.as_member('e1');
select results_eq($$ select is_locked from public.get_activity(pg_temp.id('trek')) $$, $$ values (true) $$,
  'an Activity with an accepted joiner is locked');
select throws_ok($$ select public.update_activity(pg_temp.id('trek'), starts_at => now() + interval '3 days') $$,
  'P0001', 'this activity is locked: only its description and a higher number of spots can change',
  'a Locked Activity''s start cannot change');
select throws_ok($$ select public.update_activity(pg_temp.id('trek'), ends_at => now() + interval '2 days 4 hours') $$,
  'P0001', 'this activity is locked: only its description and a higher number of spots can change',
  'a Locked Activity''s end cannot change');
select throws_ok($$ select public.update_activity(pg_temp.id('trek'), area_id => 'wakad') $$,
  'P0001', 'this activity is locked: only its description and a higher number of spots can change',
  'a Locked Activity''s Area cannot change');
select throws_ok($$ select public.update_activity(pg_temp.id('trek'), venue_detail => 'Gate 5') $$,
  'P0001', 'this activity is locked: only its description and a higher number of spots can change',
  'a Locked Activity''s venue cannot change');
select throws_ok($$ select public.update_activity(pg_temp.id('trek'), venue_detail => '') $$,
  'P0001', 'this activity is locked: only its description and a higher number of spots can change',
  'a Locked Activity''s venue cannot be cleared');
select throws_ok($$ select public.update_activity(pg_temp.id('trek'), title => 'Night trek') $$,
  'P0001', 'this activity is locked: only its description and a higher number of spots can change',
  'a Locked Activity''s title cannot change');
select throws_ok($$ select public.update_activity(pg_temp.id('trek'), capacity => 2::smallint) $$,
  'P0001', 'this activity is locked: only its description and a higher number of spots can change',
  'a Locked Activity''s spots cannot drop');
select lives_ok($$ select public.update_activity(pg_temp.id('trek'), description => 'Bring water') $$,
  'a Locked Activity''s description can change');
select lives_ok($$ select public.update_activity(pg_temp.id('trek'), capacity => 5::smallint) $$,
  'a Locked Activity can take more spots');
select lives_ok($$ select public.update_activity(pg_temp.id('trek'), area_id => 'baner', title => 'trek',
                                                 venue_detail => 'Gate 2, Sinhagad base') $$,
  'restating a Locked Activity''s details is not a change');
select results_eq($$ select description, capacity, spots_left from public.get_activity(pg_temp.id('trek')) $$,
  $$ values ('Bring water'::varchar, 5::smallint, 3) $$, 'the Locked Activity keeps the allowed changes');

-- Cancelling while waiting, Withdrawal once accepted.
select pg_temp.as_member('e1');
select throws_ok($$ select public.withdraw_activity_request(pg_temp.id('e2 trek')) $$, 'P0001',
  'no join request to withdraw', 'the host cannot withdraw a Join Request');
select pg_temp.as_member('e4');
select throws_ok($$ select public.withdraw_activity_request(pg_temp.id('e2 trek')) $$, 'P0001',
  'no join request to withdraw', 'another Member cannot withdraw a Join Request');
select pg_temp.act_as_anon();
select throws_ok($$ select public.withdraw_activity_request(pg_temp.id('e2 trek')) $$, '42501', null,
  'a signed-out visitor cannot withdraw a Join Request');

select pg_temp.as_member('e2');
select lives_ok($$ select public.withdraw_activity_request(pg_temp.id('e2 trek')) $$,
  'the requester cancels a waiting Join Request');
select results_eq($$ select status, withdrawn_at from public.activity_requests where id = pg_temp.id('e2 trek') $$,
  $$ values ('cancelled'::public.request_status, null::timestamptz) $$, 'a waiting Join Request is cancelled');
select throws_ok($$ select public.withdraw_activity_request(pg_temp.id('e2 trek')) $$, 'P0001',
  'no join request to withdraw', 'a cancelled Join Request cannot be withdrawn again');
select throws_ok($$ select public.join_activity_request(pg_temp.id('trek')) $$, 'P0001',
  'you already asked to join this activity', 'a Member who cancelled cannot ask again');

select lives_ok($$ select public.withdraw_activity_request(pg_temp.id('e2 solo')) $$,
  'an accepted joiner withdraws');
select results_eq($$ select status, withdrawn_at is not null from public.activity_requests where id = pg_temp.id('e2 solo') $$,
  $$ values ('withdrawn'::public.request_status, true) $$, 'the accepted Join Request is withdrawn');
select results_eq($$ select status from public.connections where id = pg_temp.id('e2 solo connection') $$,
  $$ values ('accepted'::public.connection_status) $$, 'the Activity Connection stays after a Withdrawal');
select results_eq($$ select spots_left, is_locked, my_request_status, connection_id from public.get_activity(pg_temp.id('solo')) $$,
  $$ values (1, false, 'withdrawn'::public.request_status, null::uuid) $$,
  'a Withdrawal frees the spot and unlocks the Activity');
select throws_ok($$ select public.join_activity_request(pg_temp.id('solo')) $$, 'P0001',
  'you already asked to join this activity', 'a Member who withdrew cannot ask again');

select pg_temp.as_member('e5');
select public.withdraw_activity_request(pg_temp.id('e5 trek'));
select results_eq($$ select venue_detail from public.get_activity(pg_temp.id('trek')) $$,
  $$ values (null::varchar) $$, 'a joiner who withdrew no longer reads the venue');
select pg_temp.as_member('e6');
select public.withdraw_activity_request(pg_temp.id('e6 trek'));
select pg_temp.as_member('e1');
select lives_ok($$ select public.update_activity(pg_temp.id('trek'), starts_at => now() + interval '3 days') $$,
  'once every joiner withdraws the Activity unlocks');

reset role;
select pg_temp.seed('soon', 'e1');
select pg_temp.as_member('e3');
select pg_temp.join('e3', 'soon');
select pg_temp.as_member('e1');
select public.respond_activity_request(pg_temp.id('e3 soon'), true);
reset role;
update public.activities set starts_at = now() - interval '1 minute' where id = pg_temp.id('soon');
select pg_temp.as_member('e3');
select throws_ok($$ select public.withdraw_activity_request(pg_temp.id('e3 soon')) $$, 'P0001',
  'no join request to withdraw', 'a joiner cannot withdraw once the Activity has started');
select throws_ok($$ select public.withdraw_activity_request(pg_temp.id('e3 started later')) $$, 'P0001',
  'no join request to withdraw', 'a waiting request cannot be cancelled once the Activity has started');

-- Join Cap: 10 in a rolling 24 hours, cancelled ones included.
reset role;
select pg_temp.seed('cap ' || n, 'e1') from generate_series(1, 11) n;
select pg_temp.as_member('e7');
select pg_temp.join('e7', 'cap ' || n) from generate_series(1, 9) n;
select public.withdraw_activity_request(pg_temp.id('e7 cap ' || n)) from generate_series(1, 2) n;
select lives_ok($$ select pg_temp.join('e7', 'cap 10') $$, 'the tenth Join Request in 24 hours is allowed');
select throws_ok($$ select public.join_activity_request(pg_temp.id('cap 11')) $$, 'P0001',
  'you have sent 10 join requests in the last 24 hours',
  'the eleventh Join Request in a rolling 24 hours is refused, cancelled ones included');
reset role;
update public.activity_requests set created_at = now() - interval '25 hours' where id = pg_temp.id('e7 cap 1');
select pg_temp.as_member('e7');
select lives_ok($$ select pg_temp.join('e7', 'cap 11') $$, 'a Join Request older than 24 hours no longer counts');

-- Activity Connections are not Connection Requests, so they don't count towards the Request Cap.
reset role;
insert into public.connections (requester_id, addressee_id, mode, activity_id, status, responded_at)
select pg_temp.m('e8'), pg_temp.m('e1'), 'activities', pg_temp.id('cap 1'), 'closed', now()
from generate_series(1, 10);
select pg_temp.as_member('e8');
select lives_ok($$ select public.send_request(pg_temp.m('e4'), 'friends') $$,
  'Activity Connections do not count towards the Request Cap');

-- The host's list of Join Requests: e3 waits, e4 is accepted, the rest are left out.
reset role;
select pg_temp.seed('brunch', 'e1', spots => 10);
select pg_temp.join_as(s, 'brunch')
from unnest(array['e3', 'e4', 'e5', 'e6', 'ea', 'eb', 'ec', 'ed']) s;
select pg_temp.as_member('e1');
select pg_temp.keep('e4 brunch connection', public.respond_activity_request(pg_temp.id('e4 brunch'), true));
select public.respond_activity_request(pg_temp.id('e6 brunch'), false);
select pg_temp.as_member('e5');
select public.withdraw_activity_request(pg_temp.id('e5 brunch'));
reset role;
update public.activity_requests set created_at = now() - interval '5 minutes' where id = pg_temp.id('e3 brunch');
update public.activity_requests set created_at = now() - interval '10 minutes' where id = pg_temp.id('e4 brunch');
update public.activity_requests set created_at = now() - interval '20 minutes' where id = pg_temp.id('e3 solo');
update public.profiles set status = 'banned' where id = pg_temp.m('ea');
update public.profiles set deleted_at = now() where id = pg_temp.m('eb');
update public.profiles set hidden_at = now() where id = pg_temp.m('ec');
insert into public.blocks (blocker_id, blocked_id) values (pg_temp.m('ed'), pg_temp.m('e1'));

select pg_temp.as_member('e1');
select results_eq(
  $$ select request_id, requester_id, requester_name, requester_photo_id, requester_area_id, status, connection_id
     from public.activity_join_requests(pg_temp.id('brunch')) $$,
  $$ values (pg_temp.id('e4 brunch'), pg_temp.m('e4'), 'Kabir'::varchar, pg_temp.id('e4 cover'), 'kharadi'::text,
             'accepted'::public.request_status, pg_temp.id('e4 brunch connection')),
            (pg_temp.id('e3 brunch'), pg_temp.m('e3'), 'Mira'::varchar, pg_temp.id('e3 cover'), 'wakad'::text,
             'requested'::public.request_status, null::uuid) $$,
  'the host lists waiting and accepted Join Requests, oldest first, without declined, cancelled, banned, deleted, Auto-hidden or blocked requesters');
select ok((select created_at = now() - interval '5 minutes' from public.activity_join_requests(pg_temp.id('brunch'))
           where request_id = pg_temp.id('e3 brunch')), 'each listed Join Request carries when it was made');
select pg_temp.as_member('e3');
select is_empty($$ select * from public.activity_join_requests(pg_temp.id('brunch')) $$,
  'only the host lists an Activity''s Join Requests');
select pg_temp.act_as_anon();
select throws_ok($$ select * from public.activity_join_requests(pg_temp.id('brunch')) $$, '42501', null,
  'a signed-out visitor cannot list Join Requests');

-- Waiting Join Requests both ways, newest first.
select pg_temp.as_member('e3');
select results_eq(
  $$ select request_id, activity_id, activity_title, activity_starts_at, other_id, other_name, other_photo_id,
            direction, created_at
     from public.my_join_requests() $$,
  $$ values (pg_temp.id('e3 brunch'), pg_temp.id('brunch'), 'brunch'::varchar, now() + interval '2 days',
             pg_temp.m('e1'), 'Host'::varchar, pg_temp.id('e1 cover'), 'outgoing'::public.connection_direction,
             now() - interval '5 minutes'),
            (pg_temp.id('e3 solo'), pg_temp.id('solo'), 'solo'::varchar, now() + interval '2 days',
             pg_temp.m('e1'), 'Host'::varchar, pg_temp.id('e1 cover'), 'outgoing'::public.connection_direction,
             now() - interval '20 minutes') $$,
  'a requester lists their waiting Join Requests with the host, newest first, leaving out started and cancelled Activities');
select pg_temp.as_member('e1');
select results_eq(
  $$ select request_id, other_id, other_name, other_photo_id, direction from public.my_join_requests()
     where activity_id = pg_temp.id('brunch') $$,
  $$ values (pg_temp.id('e3 brunch'), pg_temp.m('e3'), 'Mira'::varchar, pg_temp.id('e3 cover'),
             'incoming'::public.connection_direction) $$,
  'the host lists waiting Join Requests to their Activities, without answered, banned, deleted, Auto-hidden or blocked requesters');
select ok(not exists (select 1 from public.my_join_requests() where activity_id = pg_temp.id('started later')),
  'a waiting Join Request on a started Activity is not listed');
select ok(not exists (select 1 from public.my_join_requests() where activity_id = pg_temp.id('scrapped')),
  'a waiting Join Request on a cancelled Activity is not listed');
select pg_temp.as_member('e4');
select ok(not exists (select 1 from public.my_join_requests() where activity_id = pg_temp.id('brunch')),
  'an accepted Join Request is not listed as waiting');
select pg_temp.act_as_anon();
select throws_ok('select * from public.my_join_requests()', '42501', null,
  'a signed-out visitor cannot list Join Requests');

-- A Block cancels waiting and withdraws accepted Join Requests between the pair, either way round.
reset role;
delete from public.blocks;
select pg_temp.seed('picnic', 'e1', spots => 5);
select pg_temp.seed('chess', 'e2');
select pg_temp.join_as(s, 'picnic') from unnest(array['e2', 'e3', 'e4']) s;
select pg_temp.as_member('e1');
select pg_temp.join('e1', 'chess');
select public.respond_activity_request(pg_temp.id(s || ' picnic'), true) from unnest(array['e2', 'e4']) s;

select pg_temp.as_member('e2');
select public.block_user(pg_temp.m('e1'));
select results_eq($$ select status, withdrawn_at is not null from public.activity_requests where id = pg_temp.id('e2 picnic') $$,
  $$ values ('withdrawn'::public.request_status, true) $$,
  'blocking the host withdraws the blocker''s accepted Join Request');
select results_eq($$ select pg_temp.request_status('e1 chess') $$, $$ values ('cancelled'::public.request_status) $$,
  'blocking a requester cancels their waiting Join Request to the blocker''s Activity');
select pg_temp.as_member('e1');
select public.block_user(pg_temp.m('e3'));
select results_eq($$ select pg_temp.request_status('e3 picnic') $$, $$ values ('cancelled'::public.request_status) $$,
  'the host blocking a requester cancels their waiting Join Request');
select results_eq($$ select pg_temp.request_status('e4 picnic') $$, $$ values ('accepted'::public.request_status) $$,
  'a Block leaves other Members'' Join Requests alone');

select * from finish();
rollback;
