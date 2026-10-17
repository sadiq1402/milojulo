begin;
\ir helpers/act_as.psql
select plan(17);

-- The events a Member can see on their own topic.
create function pg_temp.events_for(member uuid) returns setof text
language sql as $$
  select set_config('realtime.topic', 'member:' || member, true);
  select m.event from realtime.messages m where m.topic = 'member:' || member order by m.inserted_at;
$$;

\set host '00000000-0000-0000-0000-0000000000d1'
\set ravi '00000000-0000-0000-0000-0000000000d2'
\set kabir '00000000-0000-0000-0000-0000000000d3'
\set neha '00000000-0000-0000-0000-0000000000d4'
select pg_temp.create_visible_member(:'host');
select pg_temp.create_visible_member(:'neha');
select pg_temp.create_visible_member(:'ravi');
select pg_temp.create_visible_member(:'kabir');

-- Connection Requests.
select pg_temp.act_as_member(:'ravi');
select public.send_request(:'host', 'friends') as request \gset
select pg_temp.act_as_member(:'host');
select results_eq(format($$ select * from pg_temp.events_for(%L) $$, :'host'),
  array['connection'], 'a Connection Request reaches the recipient');
select pg_temp.act_as_member(:'ravi');
select is_empty(format($$ select * from pg_temp.events_for(%L) $$, :'ravi'),
  'the sender is not sent their own request');

select pg_temp.act_as_member(:'host');
select public.respond_request(:'request', true);
select pg_temp.act_as_member(:'ravi');
select results_eq(format($$ select * from pg_temp.events_for(%L) $$, :'ravi'),
  array['connection'], 'the answer reaches the sender');
select pg_temp.act_as_member(:'host');
select results_eq(format($$ select count(*)::int from pg_temp.events_for(%L) $$, :'host'), array[1],
  'the Member who answered is not sent their own answer');

-- Join Requests.
reset role;
insert into public.activities (host_id, title, type, area_id, starts_at, capacity)
values (:'host', 'Badminton', 'sports', 'baner', now() + interval '2 days', 3)
returning id as activity \gset
select pg_temp.act_as_member(:'kabir');
select public.join_activity_request(:'activity') as join_request \gset
select pg_temp.act_as_member(:'host');
select results_eq(format($$ select * from pg_temp.events_for(%L) offset 1 $$, :'host'),
  array['join-request'], 'a Join Request reaches the host');

select public.respond_activity_request(:'join_request', true);
select pg_temp.act_as_member(:'kabir');
select bag_eq(format($$ select * from pg_temp.events_for(%L) $$, :'kabir'),
  array['join-request', 'connection'],
  'the answer reaches the joiner, with the Activity Connection it opens');
select pg_temp.act_as_member(:'host');
select results_eq(format($$ select count(*)::int from pg_temp.events_for(%L) $$, :'host'), array[2],
  'the host is not sent their own answer');

-- Declines reach the sender too.
select pg_temp.act_as_member(:'neha');
select public.send_request(:'ravi', 'friends') as declined \gset
select public.join_activity_request(:'activity') as neha_joins \gset
select pg_temp.act_as_member(:'ravi');
select public.respond_request(:'declined', false);
select pg_temp.act_as_member(:'host');
select public.respond_activity_request(:'neha_joins', false);
select pg_temp.act_as_member(:'neha');
select results_eq(format($$ select * from pg_temp.events_for(%L) $$, :'neha'),
  array['connection', 'join-request'], 'a declined request and a declined Join Request reach the sender');

select pg_temp.act_as_member(:'ravi');
select is_empty(format($$ select * from pg_temp.events_for(%L) $$, :'kabir'),
  'a Member cannot see another Member''s events');

-- A Block closes the pair's Connection and sends the blocked Member nothing.
select pg_temp.act_as_member(:'host');
select public.block_user(:'kabir');
select pg_temp.act_as_member(:'kabir');
select results_eq(format($$ select count(*)::int from pg_temp.events_for(%L) $$, :'kabir'), array[2],
  'nothing reaches a Member when they are blocked');

-- Nor anything later: changes by the host, written past RLS, stay on their side of the Block.
reset role;
select set_config('request.jwt.claims', json_build_object('sub', :'host')::text, true);
update public.activity_requests set status = 'declined' where id = :'join_request';
select pg_temp.act_as_member(:'kabir');
select results_eq(format($$ select count(*)::int from pg_temp.events_for(%L) $$, :'kabir'), array[2],
  'a host''s change to a Join Request does not reach a Member they blocked');
select pg_temp.act_as_member(:'host');
select results_eq(format($$ select count(*)::int from pg_temp.events_for(%L) $$, :'host'), array[3],
  'nor does it come back to the host');

reset role;
select set_config('request.jwt.claims', '', true);
update public.activity_requests set status = 'accepted' where id = :'join_request';
update public.connections set status = 'declined'
where :'kabir' in (requester_id, addressee_id) and status = 'closed';
select pg_temp.act_as_member(:'kabir');
select results_eq(format($$ select count(*)::int from pg_temp.events_for(%L) $$, :'kabir'), array[2],
  'nothing reaches a Member across a Block, even with no actor');

-- Withdrawing a Join Request and closing a Connection reach the other side; a no-op change sends nothing.
select pg_temp.act_as_member(:'ravi');
select public.join_activity_request(:'activity') as ravi_joins \gset
select public.withdraw_activity_request(:'ravi_joins');
select public.close_connection(:'request');
select pg_temp.act_as_member(:'host');
select results_eq(format($$ select * from pg_temp.events_for(%L) offset 3 $$, :'host'),
  array['join-request', 'join-request', 'connection'],
  'a Join Request withdrawn and a Connection closed reach the other side');
select pg_temp.act_as_member(:'ravi');
select results_eq(format($$ select count(*)::int from pg_temp.events_for(%L) $$, :'ravi'), array[2],
  'the Member who withdrew and closed is not sent their own changes');
reset role;
update public.activity_requests set status = status where id = :'ravi_joins';
select pg_temp.act_as_member(:'host');
select results_eq(format($$ select count(*)::int from pg_temp.events_for(%L) $$, :'host'), array[6],
  'an update that changes no status sends nothing');

select throws_ok(format($$ select public.send_to_pair(%L, %L, null, 'connection', '{}') $$, :'host', :'ravi'),
  '42501', null, 'a Member cannot send events themselves');

select * from finish();
rollback;
