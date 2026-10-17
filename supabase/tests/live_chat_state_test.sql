begin;
\ir helpers/act_as.psql
select plan(8);

-- The events a Member can see on their own topic, as (event, Connection).
create function pg_temp.events_for(member uuid) returns table (event text, connection_id text)
language sql as $$
  select set_config('realtime.topic', 'member:' || member, true);
  select m.event, m.payload->>'connection_id' from realtime.messages m
  where m.topic = 'member:' || member order by m.inserted_at;
$$;

\set m1 '00000000-0000-0000-0000-0000000000f1'
\set m2 '00000000-0000-0000-0000-0000000000f2'
select pg_temp.create_visible_member(:'m1', '{friends,activities}');
select pg_temp.create_visible_member(:'m2', '{friends,activities}');
select pg_temp.accepted_pair(:'m1', :'m2', create_members => false) as chat \gset

select pg_temp.act_as_member(:'m1');
update public.connection_members set last_read_at = now()
where connection_id = :'chat' and user_id = :'m1';
select public.set_media_consent(:'chat', true);
select public.propose_mode_change(:'chat', 'activities') as change \gset

select pg_temp.act_as_member(:'m2');
select results_eq(format($$ select event, connection_id from pg_temp.events_for(%L) $$, :'m2'),
  format($$ values ('read', %1$L), ('media-consent', %1$L), ('mode-change', %1$L) $$, :'chat'),
  'reading, a media switch and a Mode Change proposal each reach the other side');
select pg_temp.act_as_member(:'m1');
select is_empty(format($$ select 1 from pg_temp.events_for(%L) $$, :'m1'),
  'the Member who acted is not sent their own changes');

select pg_temp.act_as_member(:'m2');
select public.respond_mode_change(:'change', true);
select pg_temp.act_as_member(:'m1');
select results_eq(format($$ select event, connection_id from pg_temp.events_for(%L) $$, :'m1'),
  format($$ values ('mode-change', %L) $$, :'chat'),
  'the answer to a Mode Change reaches the proposer');

select pg_temp.act_as_member(:'m2');
select is_empty(format($$ select 1 from pg_temp.events_for(%L) where event = 'mode-change'
                          offset 1 $$, :'m2'),
  'the Member who answered is not sent their own answer');

select pg_temp.act_as_member(:'m2');
select is_empty(format($$ select 1 from pg_temp.events_for(%L) $$, :'m1'),
  'a Member cannot see the other side''s events');

-- After a Block nothing reaches the other side, even for changes made past RLS.
select public.block_user(:'m1');
reset role;
update public.connection_members set last_read_at = now(), media_consent = false
where connection_id = :'chat' and user_id = :'m1';
select pg_temp.act_as_member(:'m2');
select results_eq(format($$ select count(*)::int from pg_temp.events_for(%L) $$, :'m2'), array[3],
  'nothing more reaches a Member across a Block');
reset role;
update public.connection_members set last_read_at = now()
where connection_id = :'chat' and user_id = :'m2';
select pg_temp.act_as_member(:'m1');
select results_eq(format($$ select count(*)::int from pg_temp.events_for(%L) $$, :'m1'), array[1],
  'nor to the blocked Member');

select pg_temp.act_as_anon();
select is_empty(format($$ select 1 from pg_temp.events_for(%L) $$, :'m2'),
  'a signed-out visitor sees no events');

select * from finish();
rollback;
