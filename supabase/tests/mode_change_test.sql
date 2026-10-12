begin;
\ir helpers/act_as.psql
select plan(26);

-- m1 and m2 are connected under Friends and both hold Activities; m3 is unrelated.
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000e1', '{friends,activities}');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000e2', '{friends,activities,networking}');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000e3', '{friends,activities}');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e1');
select public.send_request('00000000-0000-0000-0000-0000000000e2', 'friends') as e_conn \gset
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e2');
select public.respond_request(:'e_conn', true);

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e1');
select public.propose_mode_change(:'e_conn', 'activities') as e_change \gset
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e2');
select public.respond_mode_change(:'e_change', true);
select results_eq($$ select mode from public.connections $$, array['activities'::public.mode],
  'accepting a Mode Change moves the Connection to the proposed Mode');

select results_eq($$ select proposed_by, from_mode, to_mode, outcome::text from public.connection_mode_changes $$,
  $$ values ('00000000-0000-0000-0000-0000000000e1'::uuid, 'friends'::public.mode, 'activities'::public.mode, 'accepted') $$,
  'the side who accepted reads the proposal and its outcome');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e1');
select is((select count(*)::int from public.connection_mode_changes where outcome = 'accepted'), 1,
  'the proposer reads the outcome');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e3');
select is_empty($$ select 1 from public.connection_mode_changes $$,
  'a Member outside the Connection reads none of its Mode Changes');
select throws_ok(format('select public.propose_mode_change(%L, %L)', :'e_conn', 'friends'),
  'P0001', 'no connection to change', 'a Member outside the Connection cannot propose a Mode Change');

-- e1 does not hold Networking; e2 does.
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e2');
select throws_ok(format('select public.propose_mode_change(%L, %L)', :'e_conn', 'networking'),
  'P0001', 'that mode is not open between you', 'a Mode that is not Eligible for the pair cannot be proposed');
select throws_ok(format('select public.propose_mode_change(%L, %L)', :'e_conn', 'activities'),
  'P0001', 'the connection is already in that mode', 'the Connection''s current Mode cannot be proposed');

-- e2 proposes going back to Friends; the proposal stays open.
select public.propose_mode_change(:'e_conn', 'friends') as e_open \gset
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e1');
select throws_ok(format('select public.propose_mode_change(%L, %L)', :'e_conn', 'friends'),
  'P0001', 'there is already an open mode change', 'a second proposal is refused while one is open');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e2');
select throws_ok(format('select public.respond_mode_change(%L, true)', :'e_open'),
  'P0001', 'no mode change to answer', 'the proposer cannot accept their own proposal');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e3');
select throws_ok(format('select public.respond_mode_change(%L, true)', :'e_open'),
  'P0001', 'no mode change to answer', 'a Member outside the Connection cannot answer a proposal');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e2');
select throws_ok(format('select public.respond_mode_change(%L, false)', :'e_change'),
  'P0001', 'no mode change to answer', 'an answered proposal cannot be answered again');

-- e2's open proposal is now 8 days old.
reset role;
update public.connection_mode_changes set proposed_at = now() - interval '8 days' where id = :'e_open';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e1');
select throws_ok(format('select public.respond_mode_change(%L, true)', :'e_open'),
  'P0001', 'no mode change to answer', 'a proposal older than 7 days has lapsed and cannot be accepted');
select lives_ok(format('select public.propose_mode_change(%L, %L)', :'e_conn', 'friends'),
  'a lapsed proposal does not block a new one');
select results_eq($$ select outcome::text from public.connection_mode_changes order by proposed_at, outcome nulls last $$,
  array['lapsed', 'accepted', null], 'the lapsed proposal is logged as lapsed');

-- e2 declines e1's new proposal.
select id as e_new from public.connection_mode_changes where outcome is null \gset
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e2');
select public.respond_mode_change(:'e_new', false);
select results_eq($$ select mode from public.connections $$, array['activities'::public.mode],
  'declining leaves the Connection''s Mode as it was');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e1');
select throws_ok(format('select public.propose_mode_change(%L, %L)', :'e_conn', 'friends'),
  'P0001', 'your last mode change was declined recently',
  'a declined proposer cannot propose again within 7 days');

reset role;
update public.connection_mode_changes set decided_at = now() - interval '8 days' where id = :'e_new';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e1');
select lives_ok(format('select public.propose_mode_change(%L, %L)', :'e_conn', 'friends'),
  'after 7 days the declined proposer can propose again');

-- e2 declines again; e2 may still propose themselves.
select id as e_again from public.connection_mode_changes where outcome is null \gset
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e2');
select public.respond_mode_change(:'e_again', false);
select lives_ok(format('select public.propose_mode_change(%L, %L)', :'e_conn', 'friends'),
  'the Member who declined can still propose a Mode Change');

-- g1 and g2: a pending request first, then an accepted Friends Connection.
reset role;
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000a7', '{friends,activities}');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000a8', '{friends,activities}');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a7');
select public.send_request('00000000-0000-0000-0000-0000000000a8', 'friends') as g_conn \gset
select throws_ok(format('select public.propose_mode_change(%L, %L)', :'g_conn', 'activities'),
  'P0001', 'no connection to change', 'a Mode Change cannot be proposed on a pending request');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a8');
select public.respond_request(:'g_conn', true);
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a7');
select public.propose_mode_change(:'g_conn', 'activities') as g_change \gset
update public.profiles set modes = '{activities}' where id = '00000000-0000-0000-0000-0000000000a7';
select results_eq($$ select mode, status::text from public.connections $$,
  $$ values ('friends'::public.mode, 'accepted') $$,
  'dropping a Mode from a profile leaves the Connection and its Mode untouched');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a8');
update public.profiles set modes = '{friends}' where id = '00000000-0000-0000-0000-0000000000a8';
select throws_ok(format('select public.respond_mode_change(%L, true)', :'g_change'),
  'P0001', 'that mode is no longer open between you',
  'a proposal cannot be accepted once its Mode is no longer Eligible');

update public.profiles set modes = '{friends,activities}' where id = '00000000-0000-0000-0000-0000000000a8';
select public.close_connection(:'g_conn');
select throws_ok(format('select public.respond_mode_change(%L, true)', :'g_change'),
  'P0001', 'no mode change to answer', 'a proposal on a closed Connection cannot be accepted');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a7');
select throws_ok(format('select public.propose_mode_change(%L, %L)', :'g_conn', 'activities'),
  'P0001', 'no connection to change', 'a Mode Change cannot be proposed on a closed Connection');

select throws_ok(format($$ insert into public.connection_mode_changes (connection_id, proposed_by, from_mode, to_mode)
                          values (%L, '00000000-0000-0000-0000-0000000000e1', 'activities', 'friends') $$, :'e_conn'),
  '42501', null, 'a Member cannot insert a Mode Change directly');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$ update public.connection_mode_changes set outcome = 'accepted' $$,
  '42501', null, 'a Member cannot answer a Mode Change by updating it directly');
select pg_temp.act_as_anon();
select throws_ok(format('select public.propose_mode_change(%L, %L)', :'e_conn', 'friends'),
  '42501', null, 'a signed-out visitor cannot propose a Mode Change');

select * from finish();
rollback;
