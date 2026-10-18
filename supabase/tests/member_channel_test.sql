begin;
\ir helpers/act_as.psql
select plan(13);

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

-- An admin's takedown reaches both sides, so an open chat drops the message at once (#163).
reset role;
select pg_temp.create_account('00000000-0000-0000-0000-0000000000ad');
select pg_temp.act_as_admin('00000000-0000-0000-0000-0000000000ad');
select public.admin_takedown('message', '00000000-0000-0000-0000-00000000ee01', 'abuse');
select pg_temp.act_as_member(:'m2');
select results_eq(format($$ select p->>'id', p->>'connection_id'
                            from pg_temp.broadcasts_on('member:%s', 'message-removed') p $$, :'m2'),
  format($$ values ('00000000-0000-0000-0000-00000000ee01', %L) $$, :'chat'),
  'a taken-down message is announced to the recipient');
select pg_temp.act_as_member(:'m1');
select results_eq(format($$ select p->>'id' from pg_temp.broadcasts_on('member:%s', 'message-removed') p $$, :'m1'),
  $$ values ('00000000-0000-0000-0000-00000000ee01') $$,
  'and to the sender, whose chat shows it too');
select pg_temp.act_as_member(:'m3');
select is_empty(format($$ select pg_temp.broadcasts_on('member:%s', 'message-removed') $$, :'m3'),
  'and to no one else');

-- After a Block, the blocked side's sends are refused, so nothing more reaches the blocker.
select pg_temp.act_as_member(:'m2');
select public.block_user(:'m1');
select pg_temp.act_as_member(:'m1');
select throws_ok(format($$ insert into public.messages (id, connection_id, sender_id, type, body)
    values (gen_random_uuid(), %L, %L, 'text', 'Still there?') $$, :'chat', :'m1'),
  '42501', null, 'after a Block no message is sent, so none is broadcast');


-- Even a message written past RLS (a definer path) is not broadcast across a Block.
reset role;
insert into public.messages (id, connection_id, sender_id, type, body)
values ('00000000-0000-0000-0000-00000000ee02', :'chat', :'m1', 'text', 'Hello again');
select pg_temp.act_as_member(:'m2');
select is_empty(format($$ select 1 from pg_temp.broadcasts_on('member:%s') p
                          where p->>'id' = '00000000-0000-0000-0000-00000000ee02' $$, :'m2'),
  'a message is never broadcast to a Member across a Block');

-- Nor is a takedown in a Blocked pair's chat.
reset role;
select pg_temp.act_as_admin('00000000-0000-0000-0000-0000000000ad');
select public.admin_takedown('message', '00000000-0000-0000-0000-00000000ee02', 'abuse');
select pg_temp.act_as_member(:'m2');
select is_empty(format($$ select 1 from pg_temp.broadcasts_on('member:%s', 'message-removed') p
                          where p->>'id' = '00000000-0000-0000-0000-00000000ee02' $$, :'m2'),
  'a takedown is never announced across a Block');
select pg_temp.act_as_member(:'m1');
select is_empty(format($$ select 1 from pg_temp.broadcasts_on('member:%s', 'message-removed') p
                          where p->>'id' = '00000000-0000-0000-0000-00000000ee02' $$, :'m1'),
  'to either side');

select * from finish();
rollback;
