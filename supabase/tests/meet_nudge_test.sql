begin;
\ir helpers/act_as.psql
select plan(15);

-- The meet nudges queued for a Member, as (title, other Member).
create function pg_temp.nudges(member uuid) returns table (title text, other text)
language sql as $$
  select q.title, q.data->>'otherUserId' from public.push_queue q
  where q.recipient_id = member and q.data->>'kind' = 'meet_nudge' order by q.id;
$$;

-- An accepted chat between a and b, accepted `days` ago, where each side in `talkers` has written.
create function pg_temp.chat(a uuid, b uuid, days integer, talkers uuid[]) returns uuid
language plpgsql as $$
declare
  conn uuid;
  who uuid;
begin
  conn := pg_temp.accepted_pair(a, b,
    create_members => not exists (select 1 from public.profiles where id = a));
  update public.connections set responded_at = now() - make_interval(days => days) where id = conn;
  foreach who in array talkers loop
    insert into public.messages (id, connection_id, sender_id, type, body)
    values (gen_random_uuid(), conn, who, 'text', 'Hi');
  end loop;
  return conn;
end;
$$;

\set asha '00000000-0000-0000-0000-00000000a501'
\set ravi '00000000-0000-0000-0000-00000000a502'
\set isha '00000000-0000-0000-0000-00000000a503'
\set kabir '00000000-0000-0000-0000-00000000a504'
\set neha '00000000-0000-0000-0000-00000000a505'
\set meera '00000000-0000-0000-0000-00000000a506'
\set rohan '00000000-0000-0000-0000-00000000a507'
\set dev '00000000-0000-0000-0000-00000000a508'
\set tara '00000000-0000-0000-0000-00000000a509'
\set arjun '00000000-0000-0000-0000-00000000a50a'

select pg_temp.chat(:'asha', :'ravi', 8, array[:'asha', :'ravi']::uuid[]);
select pg_temp.chat(:'isha', :'kabir', 8, array[:'isha']::uuid[]);
select pg_temp.chat(:'neha', :'meera', 6, array[:'neha', :'meera']::uuid[]);
select pg_temp.chat(:'rohan', :'dev', 8, array[:'rohan', :'dev']::uuid[]);
update public.profiles set display_name = 'Asha' where id = :'asha';
update public.profiles set display_name = 'Ravi' where id = :'ravi';
delete from public.push_queue;

-- Rohan has answered already; Dev muted the chat.
insert into public.meetup_feedback (user_id, other_user_id, did_meet, keep) values (:'rohan', :'dev', true, true);
update public.connection_members set muted = true where user_id = :'dev';

select public.send_meet_nudges();
select results_eq(format($$ select * from pg_temp.nudges(%L) $$, :'asha'),
  format($$ values ('Did you meet Ravi?', %L) $$, :'ravi'),
  'a week after both have written, each side is asked whether they met');
select results_eq(format($$ select * from pg_temp.nudges(%L) $$, :'ravi'),
  format($$ values ('Did you meet Asha?', %L) $$, :'asha'), 'and the other side too');
select is_empty(format($$ select * from pg_temp.nudges(%L) $$, :'isha'),
  'not when only one side has written');
select is_empty(format($$ select * from pg_temp.nudges(%L) $$, :'neha'),
  'not before a week has passed');
select is_empty(format($$ select * from pg_temp.nudges(%L) $$, :'rohan'),
  'not for a Member who has answered');
select is_empty(format($$ select * from pg_temp.nudges(%L) $$, :'dev'),
  'not in a chat the Member muted');

select public.send_meet_nudges();
select results_eq(format($$ select count(*)::int from pg_temp.nudges(%L) $$, :'asha'), array[1],
  'each Member is nudged once per chat');

-- A Block closes the chat: nothing more.
select pg_temp.chat(:'isha', :'neha', 8, array[:'isha', :'neha']::uuid[]);
select pg_temp.act_as_member(:'isha');
select public.block_user(:'neha');
reset role;
select public.send_meet_nudges();
select is_empty(format($$ select * from pg_temp.nudges(%L) $$, :'neha'),
  'not across a Block');

-- Notifications off is a wait, not a skip: turned back on, the Member is asked.
select pg_temp.chat(:'meera', :'kabir', 8, array[:'meera', :'kabir']::uuid[]);
update public.profiles set notify_messages = false where id = :'meera';
select public.send_meet_nudges();
update public.profiles set notify_messages = true where id = :'meera';
select public.send_meet_nudges();
select results_eq(format($$ select count(*)::int from pg_temp.nudges(%L) $$, :'meera'), array[1],
  'a Member with message notifications off is asked once they turn them back on');

-- Paused is a wait too (decision 53): the Member is asked once they're back.
select pg_temp.chat(:'tara', :'arjun', 8, array[:'tara', :'arjun']::uuid[]);
select pg_temp.act_as_member(:'tara');
select public.set_paused(true);
reset role;
select public.send_meet_nudges();
select is_empty(format($$ select * from pg_temp.nudges(%L) $$, :'tara'),
  'a Paused Member is not nudged');
select results_eq(format($$ select count(*)::int from pg_temp.nudges(%L) $$, :'arjun'), array[1],
  'the other side of a Paused Member''s chat still is');
select pg_temp.act_as_member(:'tara');
select public.set_paused(false);
reset role;
select public.send_meet_nudges();
select results_eq(format($$ select count(*)::int from pg_temp.nudges(%L) $$, :'tara'), array[1],
  'a Member is asked once they unpause');

-- An Activity Connection is asked about by its Activity's prompt instead.
select pg_temp.chat(:'dev', :'asha', 8, array[:'dev', :'asha']::uuid[]) as activity_chat \gset
insert into public.activities (id, host_id, title, type, area_id, starts_at, capacity)
values ('00000000-0000-0000-0000-00000000a5a1', :'dev', 'Trek', 'outdoors', 'baner', now() - interval '9 days', 3);
update public.connections set activity_id = '00000000-0000-0000-0000-00000000a5a1' where id = :'activity_chat';
select public.send_meet_nudges();
select results_eq(format($$ select count(*)::int from pg_temp.nudges(%L) $$, :'asha'), array[1],
  'an Activity Connection gets no meet nudge');

select pg_temp.act_as_member(:'asha');
select throws_ok($$ select public.send_meet_nudges() $$, '42501', null, 'a Member cannot send nudges');
select throws_ok($$ select * from public.meet_nudges $$, '42501', null, 'a Member cannot read who was nudged');

select * from finish();
rollback;
