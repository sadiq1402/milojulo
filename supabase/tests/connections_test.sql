begin;
\ir helpers/act_as.psql
select plan(34);

-- d1 and d2 share Friends; d3 stands apart.
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000d1');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000d2');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000d3');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
select public.send_request('00000000-0000-0000-0000-0000000000d2', 'friends', 'Badminton on Sunday?');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d2');
select results_eq($$ select requester_id, mode, note, status::text from public.connections $$,
  $$ values ('00000000-0000-0000-0000-0000000000d1'::uuid, 'friends'::public.mode,
             'Badminton on Sunday?'::varchar, 'requested') $$,
  'the recipient sees a Connection Request under the chosen Mode');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
select throws_ok($$ select public.send_request('00000000-0000-0000-0000-0000000000d3', 'networking') $$,
  'P0001', 'that mode is not open between you', 'a request under a Mode that is not Eligible is refused');

select throws_ok($$ select public.send_request('00000000-0000-0000-0000-0000000000d2', 'friends') $$,
  'P0001', 'you already have a connection or request with this member',
  'a second request to the same Member is refused while one is pending');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d2');
select throws_ok($$ select public.send_request('00000000-0000-0000-0000-0000000000d1', 'friends') $$,
  'P0001', 'you already have a connection or request with this member',
  'a request back to a pending sender is refused');

-- The pair's active row if any (now() is fixed inside the test transaction).
create function pg_temp.pair_request(a uuid, b uuid) returns uuid
language sql as $$
  select id from public.connections
  where requester_id = a and addressee_id = b
  order by status in ('requested', 'accepted') desc, responded_at desc nulls first limit 1;
$$;

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
select throws_ok($$ select public.respond_request(pg_temp.pair_request('00000000-0000-0000-0000-0000000000d1',
                    '00000000-0000-0000-0000-0000000000d2'), true) $$,
  'P0001', 'no request to answer', 'the sender cannot accept their own request');
select pg_temp.pair_request('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2')
  as d_request \gset
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d3');
select throws_ok(format('select public.respond_request(%L, true)', :'d_request'),
  'P0001', 'no request to answer', 'another Member cannot answer the request');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d2');
select public.respond_request(pg_temp.pair_request('00000000-0000-0000-0000-0000000000d1',
  '00000000-0000-0000-0000-0000000000d2'), true);
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
select results_eq($$ select status::text from public.connections $$, array['accepted'],
  'the sender sees the request accepted');
select throws_ok($$ select public.send_request('00000000-0000-0000-0000-0000000000d2', 'friends') $$,
  'P0001', 'you already have a connection or request with this member',
  'a request to an accepted Connection is refused');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d2');
select throws_ok($$ select public.respond_request(pg_temp.pair_request('00000000-0000-0000-0000-0000000000d1',
                    '00000000-0000-0000-0000-0000000000d2'), false) $$,
  'P0001', 'no request to answer', 'an accepted request cannot be answered again');

-- Decline: f2 turns down f1.
reset role;
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000f1');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000f2');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000f1');
select public.send_request('00000000-0000-0000-0000-0000000000f2', 'friends');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000f2');
select public.respond_request(pg_temp.pair_request('00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000f2'), false);

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000f1');
select throws_ok($$ select public.send_request('00000000-0000-0000-0000-0000000000f2', 'friends') $$,
  'P0001', 'this member declined your request recently',
  'after a decline the sender cannot request again within 30 days');

reset role;
update public.connections set responded_at = now() - interval '31 days'
where requester_id = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000f1');
select lives_ok($$ select public.send_request('00000000-0000-0000-0000-0000000000f2', 'friends') $$,
  'after 30 days the declined sender can request again');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000f2');
select public.respond_request(pg_temp.pair_request('00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000f2'), false);
select lives_ok($$ select public.send_request('00000000-0000-0000-0000-0000000000f1', 'friends') $$,
  'the Member who declined can still send a request themselves');

-- Close: d1 and d2 are accepted; f2's request to f1 is pending.
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d3');
select throws_ok(format('select public.close_connection(%L)', :'d_request'),
  'P0001', 'no connection to close', 'another Member cannot close the Connection');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000f1');
select throws_ok($$ select public.close_connection(pg_temp.pair_request('00000000-0000-0000-0000-0000000000f2',
                    '00000000-0000-0000-0000-0000000000f1')) $$,
  'P0001', 'no connection to close', 'a pending request cannot be closed');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d2');
select public.close_connection(:'d_request');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
select results_eq($$ select status::text from public.connections $$, array['closed'],
  'the other side sees the Connection closed');
select lives_ok($$ select public.send_request('00000000-0000-0000-0000-0000000000d2', 'friends') $$,
  'after a close the other side can request again');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d2');
select public.respond_request(pg_temp.pair_request('00000000-0000-0000-0000-0000000000d1',
  '00000000-0000-0000-0000-0000000000d2'), true);
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
select public.close_connection(pg_temp.pair_request('00000000-0000-0000-0000-0000000000d1',
  '00000000-0000-0000-0000-0000000000d2'));
select lives_ok($$ select public.send_request('00000000-0000-0000-0000-0000000000d2', 'friends') $$,
  'after a close the side who closed can request again');
select results_eq($$ select status::text from public.connections order by 1 $$,
  array['closed', 'closed', 'requested'], 'earlier Connections stay as history');

-- Block: a1 blocks a2; a1 and a3 are accepted, then a3 blocks a1.
reset role;
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000a1');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000a2');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000a3');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a1');
select public.block_user('00000000-0000-0000-0000-0000000000a2');
select throws_ok($$ select public.send_request('00000000-0000-0000-0000-0000000000a2', 'friends') $$,
  'P0001', 'you cannot send a request to this member', 'the blocker cannot request the blocked Member');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a2');
select throws_ok($$ select public.send_request('00000000-0000-0000-0000-0000000000a1', 'friends') $$,
  'P0001', 'you cannot send a request to this member', 'the blocked Member cannot request the blocker');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a1');
select public.send_request('00000000-0000-0000-0000-0000000000a3', 'friends');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a3');
select public.respond_request(pg_temp.pair_request('00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000a3'), true);
select public.block_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a1');
select results_eq($$ select status::text from public.connections $$, array['closed'],
  'blocking closes an accepted Connection');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000f1');
select public.block_user('00000000-0000-0000-0000-0000000000f2');
select results_eq($$ select status::text from public.connections where requester_id = '00000000-0000-0000-0000-0000000000f2' $$,
  array['closed'], 'blocking closes a pending request');

-- Pause: b1 pauses, then b2 pauses.
reset role;
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000b1');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000b2');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000b1');
select public.set_paused(true);
select throws_ok($$ select public.send_request('00000000-0000-0000-0000-0000000000b2', 'friends') $$,
  'P0001', 'unpause your profile to send requests', 'a Paused Member cannot send requests');
select public.set_paused(false);
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000b2');
select public.set_paused(true);
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$ select public.send_request('00000000-0000-0000-0000-0000000000b2', 'friends') $$,
  'P0001', 'you cannot send a request to this member', 'a Paused Member cannot be sent requests');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000b2');
select public.set_paused(false);
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000b1');
select lives_ok($$ select public.send_request('00000000-0000-0000-0000-0000000000b2', 'friends') $$,
  'once both are unpaused the request goes through');

reset role;
select pg_temp.create_complete_member('00000000-0000-0000-0000-0000000000b3');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000b3');
select throws_ok($$ select public.send_request('00000000-0000-0000-0000-0000000000b2', 'friends') $$,
  'P0001', 'your profile is not visible', 'a Member without a Submitted Profile cannot send requests');

-- Reads and writes only through the functions.
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d3');
select is_empty('select * from public.connections', 'another Member cannot read the Connection');
select throws_ok($$ insert into public.connections (requester_id, addressee_id, mode)
                    values ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000d1', 'friends') $$,
  '42501', null, 'a Connection cannot be inserted directly');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d2');
select throws_ok($$ update public.connections set status = 'accepted' $$,
  '42501', null, 'a Connection cannot be updated directly');
select throws_ok($$ delete from public.connections $$,
  '42501', null, 'a Connection cannot be deleted');
select pg_temp.act_as_anon();
select throws_ok($$ select public.send_request('00000000-0000-0000-0000-0000000000d1', 'friends') $$,
  '42501', null, 'a signed-out visitor cannot send requests');

-- Request Cap: e0 sends to e1 .. eb.
reset role;
select pg_temp.create_visible_member(('00000000-0000-0000-0000-0000000000e' || to_hex(n))::uuid)
from generate_series(0, 11) n;

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e0');
select lives_ok($$ select public.send_request(('00000000-0000-0000-0000-0000000000e' || to_hex(n))::uuid, 'friends')
                   from generate_series(1, 10) n $$,
  'a Member can send 10 requests within 24 hours');
select throws_ok($$ select public.send_request('00000000-0000-0000-0000-0000000000eb', 'friends') $$,
  'P0001', 'you have sent 10 requests in the last 24 hours', 'the 11th request within 24 hours is refused');

reset role;
update public.connections set created_at = now() - interval '25 hours'
where addressee_id = '00000000-0000-0000-0000-0000000000e1';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e0');
select lives_ok($$ select public.send_request('00000000-0000-0000-0000-0000000000eb', 'friends') $$,
  'a request older than 24 hours no longer counts towards the Request Cap');

select * from finish();
rollback;
