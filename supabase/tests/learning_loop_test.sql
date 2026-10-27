begin;
\ir helpers/act_as.psql
select plan(45);

create function pg_temp.m(suffix text) returns uuid
language sql immutable as $$ select ('00000000-0000-0000-0000-0000000000' || suffix)::uuid $$;

create function pg_temp.as_member(suffix text) returns void
language sql as $$ select pg_temp.act_as_member(pg_temp.m(suffix)) $$;

create temp table ids (k text primary key, v uuid);
grant select, insert on ids to authenticated, anon;

create function pg_temp.id(key text) returns uuid
language sql stable as $$ select v from ids where k = $1 $$;

-- An Activity the host posts; each listed Member asks to join and the host accepts them. Run as postgres.
create function pg_temp.activity(key text, host text, joiners text[]) returns uuid
language plpgsql as $$
declare
  act uuid;
  j text;
  req uuid;
begin
  perform pg_temp.as_member(host);
  act := public.post_activity(key, 'sports', now() + interval '1 day', capacity => 10::smallint);
  insert into ids values (key, act);
  foreach j in array joiners loop
    perform pg_temp.as_member(j);
    req := public.join_activity_request(act);
    insert into ids values (j || ' ' || key, req);
    perform pg_temp.as_member(host);
    perform public.respond_activity_request(req, true);
  end loop;
  reset role;
  return act;
end;
$$;

-- No public path moves time, so the finished Activity is moved into the past directly. Run as postgres.
create function pg_temp.ended(key text, ago interval) returns void
language sql as $$
  update public.activities set starts_at = now() - ago - interval '2 hours', ends_at = now() - ago
  where id = pg_temp.id(key);
$$;

-- The current Member's answer, as SQL for lives_ok / throws_ok.
create function pg_temp.answer(other text, activity text, did_meet boolean default true, keep boolean default true)
returns text
language sql as $$
  select format('select public.submit_meetup_feedback(%L, %L, %L, %L)',
                pg_temp.m(other), did_meet, keep, pg_temp.id(activity));
$$;

select pg_temp.create_visible_member(pg_temp.m(s))
from unnest(array['f1', 'f2', 'f3', 'f4', 'f5']) s;

-- Activity A: f1 hosts, f2 and f3 are accepted, f4 is still waiting, f5 withdrew; it ended 3 hours ago.
select pg_temp.activity('A', 'f1', array['f2', 'f3', 'f5']);
select pg_temp.as_member('f4');
select public.join_activity_request(pg_temp.id('A'));
select pg_temp.as_member('f5');
select public.withdraw_activity_request(pg_temp.id('f5 A'));
reset role;
select pg_temp.ended('A', '3 hours');
-- Activity B: f1 hosts, f2 is accepted; it has not ended.
select pg_temp.activity('B', 'f1', array['f2']);

-- Activity C: f1 hosts, f2 is accepted again; it ended 3 hours ago.
select pg_temp.activity('C', 'f1', array['f2']);
select pg_temp.ended('C', '3 hours');
-- f1 hosts X (cancelled by the host), Y (removed by an admin) and E (expired), f2 accepted on each, all ended.
select pg_temp.activity(k, 'f1', array['f2']) from unnest(array['X', 'Y', 'E']) k;
select pg_temp.as_member('f1');
select public.cancel_activity(pg_temp.id('X'));
reset role;
-- No admin takedown function yet, and the expiry job would expire every Activity in this test, so set these directly.
update public.activities set status = 'removed' where id = pg_temp.id('Y');
update public.activities set status = 'expired' where id = pg_temp.id('E');
select pg_temp.ended(k, '3 hours') from unnest(array['X', 'Y', 'E']) k;

-- Connections: f6 and f7 accepted.
select pg_temp.accepted_pair(pg_temp.m('f6'), pg_temp.m('f7'));
-- f8 and f9 accepted, then f8 closed it; fa asked fb, still waiting; fc and fd accepted, then fc blocked fd.
insert into ids values ('f8 f9', pg_temp.accepted_pair(pg_temp.m('f8'), pg_temp.m('f9')));
select pg_temp.as_member('f8');
select public.close_connection(pg_temp.id('f8 f9'));
reset role;
select pg_temp.create_visible_member(pg_temp.m(s)) from unnest(array['fa', 'fb']) s;
select pg_temp.as_member('fa');
select public.send_request(pg_temp.m('fb'), 'friends');
reset role;
select pg_temp.accepted_pair(pg_temp.m('fc'), pg_temp.m('fd'));
select pg_temp.as_member('fc');
select public.block_user(pg_temp.m('fd'));
reset role;

-- Pending list: b1 hosts P (ended 3 hours ago: b2), Q (1 hour ago: b6), R (15 days ago: b7), S (13 days ago: b8).
select pg_temp.create_visible_member(pg_temp.m(s))
from unnest(array['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9']) s;
-- A name of its own, so the list's display_name is checked against something other than the default.
update public.profiles set display_name = 'Bina' where id = pg_temp.m('b2');
insert into ids select s || ' cover', public.cover_photo_id(pg_temp.m(s)) from unnest(array['b1', 'b2', 'b8']) s;
select pg_temp.activity('P', 'b1', array['b2', 'b3', 'b4', 'b5', 'b9']);
select pg_temp.activity('Q', 'b1', array['b6']);
select pg_temp.activity('R', 'b1', array['b7']);
select pg_temp.activity('S', 'b1', array['b8']);
select pg_temp.ended('P', '3 hours');
select pg_temp.ended('Q', '1 hour');
select pg_temp.ended('R', '15 days');
select pg_temp.ended('S', '13 days');
-- b9 blocks the host. There is no ban or account deletion function yet, and Auto-hide needs three
-- reporters, so b3 is banned, b4 Auto-hidden and b5 deleted directly.
select pg_temp.as_member('b9');
select public.block_user(pg_temp.m('b1'));
reset role;
update public.profiles set status = 'banned' where id = pg_temp.m('b3');
update public.profiles set hidden_at = now() where id = pg_temp.m('b4');
update public.profiles set deleted_at = now() where id = pg_temp.m('b5');
-- c1 and c2 accepted a Connection, then c2 was banned (directly: no ban function yet).
select pg_temp.accepted_pair(pg_temp.m('c1'), pg_temp.m('c2'));
update public.profiles set status = 'banned' where id = pg_temp.m('c2');

-- Activity pairs
select pg_temp.as_member('f1');
select lives_ok(pg_temp.answer('f2', 'A'), 'the host answers about an accepted joiner once the Activity has ended');
select pg_temp.as_member('f2');
select lives_ok(pg_temp.answer('f1', 'A', true, false), 'an accepted joiner answers about the host');
select pg_temp.as_member('f2');
select throws_ok(pg_temp.answer('f3', 'A'), 'no one to give feedback about', 'a joiner is not asked about another joiner');
select pg_temp.as_member('f1');
select throws_ok(pg_temp.answer('f4', 'A'), 'no one to give feedback about', 'the host is not asked about a joiner never accepted');
select throws_ok(pg_temp.answer('f5', 'A'), 'no one to give feedback about', 'the host is not asked about a joiner who withdrew');
select throws_ok(pg_temp.answer('f2', 'B'), 'no one to give feedback about', 'nobody answers before the Activity ends');
select pg_temp.as_member('f4');
select throws_ok(pg_temp.answer('f1', 'A'), 'no one to give feedback about', 'a joiner never accepted is not asked about the host');
select pg_temp.as_member('f1');
select throws_ok(pg_temp.answer('f2', 'A'), 'you already answered', 'the host answers once per joiner and Activity');
select lives_ok(pg_temp.answer('f2', 'C'), 'the same pair answers again for another Activity');
select throws_ok(pg_temp.answer('f2', 'X'), 'no one to give feedback about', 'a cancelled Activity asks nobody');
select throws_ok(pg_temp.answer('f2', 'Y'), 'no one to give feedback about', 'nor a removed one');
select lives_ok(pg_temp.answer('f2', 'E'), 'an expired Activity ran, so its pairs answer');
select pg_temp.as_member('f2');
select bag_eq($$ select activity_id from public.pending_meetup_feedback() $$,
  $$ values (pg_temp.id('C')), (pg_temp.id('E')) $$, 'the pending list leaves out cancelled and removed Activities');

-- Connection pairs ("We met" in chat)
select pg_temp.as_member('f6');
select lives_ok(pg_temp.answer('f7', null), 'a side of an accepted Connection answers without an Activity');
select throws_ok(pg_temp.answer('f7', null), 'you already answered', 'a Connection pair answers once');
select pg_temp.as_member('f9');
select lives_ok(pg_temp.answer('f8', null), 'a side of a Connection closed after acceptance still answers');
select pg_temp.as_member('fa');
select throws_ok(pg_temp.answer('fb', null), 'no one to give feedback about', 'a Connection Request never accepted is not enough');
select pg_temp.as_member('fb');
select throws_ok(pg_temp.answer('fa', null), 'no one to give feedback about', 'nor for its recipient');
select pg_temp.as_member('f6');
select throws_ok(pg_temp.answer('f6', null), 'no one to give feedback about', 'nobody answers about themselves');
select pg_temp.as_member('fc');
select throws_ok(pg_temp.answer('fd', null), 'no one to give feedback about', 'a Member does not answer about someone they blocked');
select pg_temp.as_member('fd');
select throws_ok(pg_temp.answer('fc', null), 'no one to give feedback about', 'nor about someone who blocked them');

-- Pending answers
select pg_temp.as_member('b1');
select results_eq(
  $$ select other_user_id, display_name::text, cover_photo_id, activity_id, activity_title::text
     from public.pending_meetup_feedback() $$,
  $$ values (pg_temp.m('b2'), 'Bina', pg_temp.id('b2 cover'), pg_temp.id('P'), 'P'),
            (pg_temp.m('b8'), 'Test', pg_temp.id('b8 cover'), pg_temp.id('S'), 'S') $$,
  'the host is asked about joiners of Activities ended 2 hours to 14 days ago, newest first');
select throws_ok(pg_temp.answer('b3', 'P'), 'no one to give feedback about', 'nobody answers about a banned Member');
select throws_ok(pg_temp.answer('b4', 'P'), 'no one to give feedback about', 'nor an Auto-hidden one');
select throws_ok(pg_temp.answer('b5', 'P'), 'no one to give feedback about', 'nor a deleted one');
select pg_temp.as_member('c1');
select throws_ok(pg_temp.answer('c2', null), 'no one to give feedback about', 'nor a banned Member from a Connection');
select pg_temp.as_member('b2');
select results_eq($$ select other_user_id, cover_photo_id, activity_id, ends_at from public.pending_meetup_feedback() $$,
  $$ values (pg_temp.m('b1'), pg_temp.id('b1 cover'), pg_temp.id('P'), now() - interval '3 hours') $$,
  'a joiner is asked about the host only, not the other joiners');
select pg_temp.as_member('b1');
select public.submit_meetup_feedback(pg_temp.m('b2'), true, true, pg_temp.id('P'));
select results_eq($$ select other_user_id from public.pending_meetup_feedback() $$, $$ values (pg_temp.m('b8')) $$,
  'an answered pair leaves the list');
select pg_temp.as_member('b2');
select is((select count(*) from public.pending_meetup_feedback()), 1::bigint, 'until the other side answers too, it stays on theirs');
select pg_temp.as_member('f3');
select results_eq($$ select other_user_id, activity_id from public.pending_meetup_feedback() $$,
  $$ values (pg_temp.m('f1'), pg_temp.id('A')) $$, 'another joiner''s answer about the host leaves it on mine');
select pg_temp.as_member('f1');
select throws_ok(format('select public.submit_meetup_feedback(%L, null, true, %L)', pg_temp.m('f3'), pg_temp.id('A')),
  '23502', null, 'an answer without "did you meet" is refused');
select throws_ok(format('select public.submit_meetup_feedback(%L, true, null, %L)', pg_temp.m('f3'), pg_temp.id('A')),
  '23502', null, 'an answer without "keep the connection" is refused');

-- Reading answers
select pg_temp.as_member('f1');
select bag_eq($$ select user_id, other_user_id, activity_id from public.meetup_feedback $$,
  $$ values (pg_temp.m('f1'), pg_temp.m('f2'), pg_temp.id('A')), (pg_temp.m('f1'), pg_temp.m('f2'), pg_temp.id('C')),
            (pg_temp.m('f1'), pg_temp.m('f2'), pg_temp.id('E')) $$, 'a Member reads their own answers only');
select pg_temp.as_member('f3');
select is((select count(*) from public.meetup_feedback), 0::bigint, 'another Member reads none of them');
select pg_temp.act_as_admin(pg_temp.m('ad'));
select is((select count(*) from public.meetup_feedback where user_id in (pg_temp.m('f1'), pg_temp.m('f2'), pg_temp.m('b1'))), 5::bigint,
  'an admin reads every answer');

-- No other way in
select pg_temp.as_member('f6');
select throws_ok(format('insert into public.meetup_feedback (user_id, other_user_id, did_meet, keep) values (%L, %L, true, true)',
  pg_temp.m('f6'), pg_temp.m('f9')), '42501', null, 'a Member cannot write answers directly');
select throws_ok('update public.meetup_feedback set keep = false', '42501', null, 'nor change them');
select throws_ok('delete from public.meetup_feedback', '42501', null, 'nor delete them');
select pg_temp.act_as_anon();
select throws_ok(pg_temp.answer('f7', null), '42501', null, 'signed out, no answers');
select throws_ok('select * from public.pending_meetup_feedback()', '42501', null, 'signed out, no pending list');

-- Kept Connections: f6/f7 (chat) and b1/b2 (Activity P, then chat too) both said yes to both; f1/f2 (A) and
-- f1/f3 (A) did not.
select pg_temp.as_member('f7');
select public.submit_meetup_feedback(pg_temp.m('f6'), true, true, null);
select pg_temp.as_member('b2');
select public.submit_meetup_feedback(pg_temp.m('b1'), true, true, pg_temp.id('P'));
-- Accepting b2 on P made the pair's Activity Connection, so they can also answer from chat.
select pg_temp.as_member('b1');
select public.submit_meetup_feedback(pg_temp.m('b2'), true, true);
select pg_temp.as_member('b2');
select public.submit_meetup_feedback(pg_temp.m('b1'), true, true);
select pg_temp.as_member('f1');
select public.submit_meetup_feedback(pg_temp.m('f3'), true, true, pg_temp.id('A'));
select pg_temp.as_member('f3');
select public.submit_meetup_feedback(pg_temp.m('f1'), false, true, pg_temp.id('A'));
reset role;
-- now() is fixed in a test, so the P answers are dated a day back directly to tell the routes apart.
update public.meetup_feedback set created_at = now() - interval '1 day' where activity_id = pg_temp.id('P');
select pg_temp.act_as_admin(pg_temp.m('ad'));
select results_eq(
  $$ select user_a, user_b, kept_at from public.kept_connections(now() - interval '2 days')
     where user_a = any (array[pg_temp.m('f1'), pg_temp.m('f6'), pg_temp.m('b1'), pg_temp.m('f2'), pg_temp.m('f3'),
                               pg_temp.m('f7'), pg_temp.m('b2')])
     order by user_a $$,
  $$ values (pg_temp.m('b1'), pg_temp.m('b2'), now() - interval '1 day'), (pg_temp.m('f6'), pg_temp.m('f7'), now()) $$,
  'an admin sees each pair where both met and want to keep it once, by any route, from when it was first kept');
select results_eq($$ select user_a from public.kept_connections(now() - interval '1 hour') where user_a = pg_temp.m('b1') $$,
  $$ select null::uuid where false $$, 'a pair first kept before the given time is not counted again');
select is((select count(*) from public.kept_connections(now() + interval '1 minute')), 0::bigint,
  'only pairs kept since the given time');
select pg_temp.as_member('f6');
select is((select count(*) from public.kept_connections(now() - interval '1 day')), 0::bigint,
  'a Member gets no Kept Connections');
select pg_temp.act_as_anon();
select throws_ok($$ select * from public.kept_connections(now()) $$, '42501', null, 'signed out, nothing');

select * from finish();
rollback;
