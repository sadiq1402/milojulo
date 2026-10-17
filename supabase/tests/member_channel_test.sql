begin;
\ir helpers/act_as.psql
select plan(7);

-- Realtime admits a subscriber to a topic only if they can select from it with that topic set.
create function pg_temp.broadcasts_on(topic text) returns setof jsonb
language sql as $$
  select set_config('realtime.topic', topic, true);
  select payload from realtime.messages where realtime.messages.topic = broadcasts_on.topic;
$$;

\set m1 '00000000-0000-0000-0000-0000000000e1'
\set m2 '00000000-0000-0000-0000-0000000000e2'
\set m3 '00000000-0000-0000-0000-0000000000e3'
select pg_temp.accepted_pair(:'m1', :'m2') as chat \gset
select pg_temp.create_visible_member(:'m3');

select pg_temp.act_as_member(:'m1');
insert into public.messages (id, connection_id, sender_id, type, body)
values ('00000000-0000-0000-0000-00000000ee01', :'chat', :'m1', 'text', 'Badminton at 7?');

select pg_temp.act_as_member(:'m2');
select results_eq(format($$ select p->>'id', p->>'body', p->>'connection_id'
                            from pg_temp.broadcasts_on('member:%s') p $$, :'m2'),
  format($$ values ('00000000-0000-0000-0000-00000000ee01', 'Badminton at 7?', %L) $$, :'chat'),
  'a message reaches the recipient on their own Member topic');

select pg_temp.act_as_member(:'m1');
select is_empty(format($$ select pg_temp.broadcasts_on('member:%s') $$, :'m1'),
  'the sender is not sent their own message');

select pg_temp.act_as_member(:'m3');
select is_empty(format($$ select pg_temp.broadcasts_on('member:%s') $$, :'m2'),
  'a Member cannot join another Member''s topic');
select is_empty(format($$ select pg_temp.broadcasts_on('connection:%s') $$, :'chat'),
  'Connection topics are no longer joinable, even by an outsider');

select pg_temp.act_as_member(:'m2');
select is_empty(format($$ select pg_temp.broadcasts_on('connection:%s') $$, :'chat'),
  'Connection topics are no longer joinable by its Members either');

select pg_temp.act_as_anon();
select is_empty(format($$ select pg_temp.broadcasts_on('member:%s') $$, :'m2'),
  'a signed-out visitor cannot join a Member topic');

-- After a Block, the blocked side's sends are refused, so nothing more reaches the blocker.
select pg_temp.act_as_member(:'m2');
select public.block_user(:'m1');
select pg_temp.act_as_member(:'m1');
select throws_ok(format($$ insert into public.messages (id, connection_id, sender_id, type, body)
    values (gen_random_uuid(), %L, %L, 'text', 'Still there?') $$, :'chat', :'m1'),
  '42501', null, 'after a Block no message is sent, so none is broadcast');

select * from finish();
rollback;
