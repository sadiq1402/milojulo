begin;
\ir helpers/act_as.psql
select plan(10);

-- The events a Member can see on their own topic.
create function pg_temp.events_for(member uuid) returns setof text
language sql as $$
  select set_config('realtime.topic', 'member:' || member, true);
  select m.event from realtime.messages m where m.topic = 'member:' || member order by m.inserted_at;
$$;

\set host '00000000-0000-0000-0000-0000000000d1'
\set ravi '00000000-0000-0000-0000-0000000000d2'
\set kabir '00000000-0000-0000-0000-0000000000d3'
select pg_temp.create_visible_member(:'host');
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

select pg_temp.act_as_member(:'ravi');
select is_empty(format($$ select * from pg_temp.events_for(%L) $$, :'kabir'),
  'a Member cannot see another Member''s events');

-- A Block closes the pair's Connection and sends the blocked Member nothing.
select pg_temp.act_as_member(:'host');
select public.block_user(:'kabir');
select pg_temp.act_as_member(:'kabir');
select results_eq(format($$ select count(*)::int from pg_temp.events_for(%L) $$, :'kabir'), array[2],
  'nothing reaches a Member when they are blocked');

-- Nor anything later, even with no actor (a service or scheduled update).
reset role;
select set_config('request.jwt.claims', '', true);
update public.activity_requests set status = 'declined' where id = :'join_request';
update public.connections set status = 'declined', responded_at = now()
where status = 'requested' and requester_id = :'host';
select pg_temp.act_as_member(:'kabir');
select results_eq(format($$ select count(*)::int from pg_temp.events_for(%L) $$, :'kabir'), array[2],
  'nothing reaches a Member across a Block, even with no actor');

select * from finish();
rollback;
