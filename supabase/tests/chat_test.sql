begin;
\ir helpers/act_as.psql
select plan(45);

-- An accepted Connection between two new visible Members. Run as postgres.
create function pg_temp.accepted_pair(a uuid, b uuid) returns uuid
language plpgsql as $$
declare
  conn uuid;
begin
  perform pg_temp.create_visible_member(a);
  perform pg_temp.create_visible_member(b);
  perform pg_temp.act_as_member(a);
  conn := public.send_request(b, 'friends');
  perform pg_temp.act_as_member(b);
  perform public.respond_request(conn, true);
  reset role;
  return conn;
end;
$$;

-- The sender's text insert, to pass to lives_ok / throws_ok.
create function pg_temp.text_from(sender uuid, conn uuid) returns text
language sql as $$
  select format($q$ insert into public.messages (id, connection_id, sender_id, type, body)
                   values (gen_random_uuid(), %L, %L, 'text', 'Hi') $q$, conn, sender);
$$;

-- Any message insert, to pass to lives_ok / throws_ok.
create function pg_temp.message_from(sender uuid, conn uuid, kind text, body text default null,
  media_key text default null, duration_ms integer default null, activity uuid default null) returns text
language sql as $$
  select format($q$ insert into public.messages
                     (id, connection_id, sender_id, type, body, media_key, media_duration_ms, activity_id)
                   values (gen_random_uuid(), %L, %L, %L, %L, %L, %L, %L) $q$,
                conn, sender, kind, body, media_key, duration_ms, activity);
$$;

-- c1 and c2 have an accepted Connection; c3 is outside it.
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000c1');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000c2');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000c3');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select public.send_request('00000000-0000-0000-0000-0000000000c2', 'friends') as chat \gset
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c2');
select public.respond_request(:'chat', true);

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
insert into public.messages (id, connection_id, sender_id, type, body)
values ('00000000-0000-0000-0000-00000000aa01', :'chat', '00000000-0000-0000-0000-0000000000c1',
        'text', 'Badminton at 7?');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c2');
select results_eq($$ select sender_id, type::text, body from public.messages $$,
  $$ values ('00000000-0000-0000-0000-0000000000c1'::uuid, 'text', 'Badminton at 7?') $$,
  'the other Member reads a text message in their Connection');

-- Realtime admits a subscriber to a topic only if they can select from it with that topic set.
create function pg_temp.broadcasts_on(topic text) returns setof jsonb
language sql as $$
  select set_config('realtime.topic', topic, true);
  select payload from realtime.messages where realtime.messages.topic = broadcasts_on.topic;
$$;

select results_eq(format($$ select p->>'id', p->>'body' from pg_temp.broadcasts_on('connection:%s') p $$, :'chat'),
  $$ values ('00000000-0000-0000-0000-00000000aa01', 'Badminton at 7?') $$,
  'the message is broadcast on the Connection''s private topic, which the other Member can join');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select isnt_empty(format($$ select pg_temp.broadcasts_on('connection:%s') $$, :'chat'),
  'the sender can join the Connection''s topic too');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c3');
select is_empty(format($$ select pg_temp.broadcasts_on('connection:%s') $$, :'chat'),
  'a Member outside the Connection cannot join its topic');
select is_empty($$ select 1 from realtime.messages $$,
  'a Member reads no broadcasts without joining a topic');

-- A retried send reuses the client-generated id.
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select lives_ok(format($$ insert into public.messages (id, connection_id, sender_id, type, body)
    values ('00000000-0000-0000-0000-00000000aa01', %L, '00000000-0000-0000-0000-0000000000c1',
            'text', 'Badminton at 7?') on conflict (id) do nothing $$, :'chat'),
  'retrying a send with the same id succeeds');
select results_eq($$ select count(*)::int from public.messages $$, array[1],
  'a retried send leaves one message');
select results_eq(format($$ select count(*)::int from pg_temp.broadcasts_on('connection:%s') $$, :'chat'), array[1],
  'a retried send is not broadcast again');

select throws_ok(format($$ insert into public.messages (id, connection_id, sender_id, type, body)
    values (gen_random_uuid(), %L, '00000000-0000-0000-0000-0000000000c2', 'text', 'Hi') $$, :'chat'),
  '42501', null, 'a Member cannot send as the other side');
select throws_ok(format($$ insert into public.messages (id, connection_id, type, body, created_at)
    values (gen_random_uuid(), %L, 'text', 'Hi', now() - interval '1 day') $$, :'chat'),
  '42501', null, 'a Member cannot backdate a message');
select throws_ok(format($$ insert into public.messages (id, connection_id, type, body, removed_at)
    values (gen_random_uuid(), %L, 'text', 'Hi', now()) $$, :'chat'),
  '42501', null, 'a Member cannot set moderation columns');
select throws_ok($$ update public.messages set body = 'Edited' $$,
  '42501', null, 'a Member cannot edit a message');
select throws_ok($$ delete from public.messages $$,
  '42501', null, 'a Member cannot delete a message');

-- Read position and Mute.
select results_eq($$ select user_id::text, muted, last_read_at from public.connection_members order by 1 $$,
  $$ values ('00000000-0000-0000-0000-0000000000c1', false, null::timestamptz),
            ('00000000-0000-0000-0000-0000000000c2', false, null) $$,
  'accepting a request gives both Members a read position and Mute switch');
select lives_ok($$ update public.connection_members
                   set last_read_at = '2026-10-10 12:00+05:30', muted = true
                   where user_id = '00000000-0000-0000-0000-0000000000c1' $$,
  'a Member updates their own read position and Mute');
select results_eq($$ select muted, last_read_at from public.connection_members
                    where user_id = '00000000-0000-0000-0000-0000000000c1' $$,
  $$ values (true, '2026-10-10 12:00+05:30'::timestamptz) $$,
  'the update is kept');
update public.connection_members set muted = true;
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c2');
select results_eq($$ select muted from public.connection_members
                    where user_id = '00000000-0000-0000-0000-0000000000c2' $$, array[false],
  'a Member cannot Mute for the other side');
select throws_ok($$ update public.connection_members set connection_id = gen_random_uuid() $$,
  '42501', null, 'a Member cannot move their membership to another Connection');
select throws_ok($$ delete from public.connection_members $$,
  '42501', null, 'a Member cannot leave a Connection by deleting membership');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c3');
select is_empty($$ select 1 from public.connection_members
                   where user_id <> '00000000-0000-0000-0000-0000000000c3' $$,
  'a Member outside the Connection sees none of its read positions');
select is_empty($$ select 1 from public.messages $$, 'a Member outside the Connection reads none of its messages');
select throws_ok(format($$ insert into public.messages (id, connection_id, sender_id, type, body)
    values (gen_random_uuid(), %L, '00000000-0000-0000-0000-0000000000c3', 'text', 'Hi') $$, :'chat'),
  '42501', null, 'a Member outside the Connection cannot send in it');

-- c3 has only a pending request to c1.
select public.send_request('00000000-0000-0000-0000-0000000000c1', 'friends') as pending \gset
select throws_ok(format($$ insert into public.messages (id, connection_id, sender_id, type, body)
    values (gen_random_uuid(), %L, '00000000-0000-0000-0000-0000000000c3', 'text', 'Hi') $$, :'pending'),
  '42501', null, 'sending in a Connection that was never accepted is refused');
select set_config('realtime.topic', 'connection:' || :'pending', true);
select is_empty(format($$ select 1 from realtime.messages where topic = 'connection:%s' $$, :'chat'),
  'joining one''s own topic does not reveal another Connection''s broadcasts');

-- Per-type checks, as c1 in the c1–c2 chat.
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
\set c1 '00000000-0000-0000-0000-0000000000c1'
select throws_ok(pg_temp.message_from(:'c1', :'chat', 'text'),
  '23514', null, 'a text message needs a body');
select throws_ok(pg_temp.message_from(:'c1', :'chat', 'text', '   '),
  '23514', null, 'a text message needs more than blanks');
select lives_ok(pg_temp.message_from(:'c1', :'chat', 'image', media_key => 'chat/x/1.jpg'),
  'an image with its media is accepted');
select throws_ok(pg_temp.message_from(:'c1', :'chat', 'image'),
  '23514', null, 'an image needs its media');
select lives_ok(pg_temp.message_from(:'c1', :'chat', 'video', media_key => 'chat/x/2.mp4', duration_ms => 30000),
  'a 30-second video is accepted');
select throws_ok(pg_temp.message_from(:'c1', :'chat', 'video', media_key => 'chat/x/3.mp4', duration_ms => 30001),
  '23514', null, 'a video longer than 30 seconds is refused');
select throws_ok(pg_temp.message_from(:'c1', :'chat', 'video', media_key => 'chat/x/4.mp4'),
  '23514', null, 'a video needs its duration');
select throws_ok(pg_temp.message_from(:'c1', :'chat', 'video', duration_ms => 1000),
  '23514', null, 'a video needs its media');
select lives_ok(pg_temp.message_from(:'c1', :'chat', 'voice', media_key => 'chat/x/5.m4a', duration_ms => 120000),
  'a 2-minute voice note is accepted');
select throws_ok(pg_temp.message_from(:'c1', :'chat', 'voice', media_key => 'chat/x/6.m4a', duration_ms => 120001),
  '23514', null, 'a voice note longer than 2 minutes is refused');
select throws_ok(pg_temp.message_from(:'c1', :'chat', 'voice', media_key => 'chat/x/7.m4a'),
  '23514', null, 'a voice note needs its duration');
select lives_ok(pg_temp.message_from(:'c1', :'chat', 'activity_card', activity => public.post_activity('Card', 'sports', 'baner', now() + interval '1 day')),
  'an Activity card naming its Activity is accepted');
select throws_ok(pg_temp.message_from(:'c1', :'chat', 'activity_card'),
  '23514', null, 'an Activity card needs its Activity');

-- Catch-up after a reconnect: messages newer than the last one seen.
reset role;
update public.messages set created_at = now() - interval '1 hour'
where id = '00000000-0000-0000-0000-00000000aa01';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c2');
select results_eq(format($$ select type::text from public.messages
                            where connection_id = %L and created_at > now() - interval '30 minutes'
                            order by 1 $$, :'chat'),
  array['activity_card', 'image', 'video', 'voice'], 'catching up returns only the messages newer than the given point');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c3');
select is_empty(format($$ select 1 from public.messages
                         where connection_id = %L and created_at > now() - interval '30 minutes' $$, :'chat'),
  'a Member outside the Connection catches up on nothing');

reset role;
select pg_temp.accepted_pair('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2') as closed \gset
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e2');
select public.close_connection(:'closed');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e1');
select throws_ok(pg_temp.text_from('00000000-0000-0000-0000-0000000000e1', :'closed'),
  '42501', null, 'sending after the Connection is closed is refused');

reset role;
select pg_temp.accepted_pair('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2') as blocked \gset
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000b2');
select public.block_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000b1');
select throws_ok(pg_temp.text_from('00000000-0000-0000-0000-0000000000b1', :'blocked'),
  '42501', null, 'sending after a Block is refused');

-- A Block standing on a still-accepted Connection (block_user would close it) still stops sends.
reset role;
select pg_temp.accepted_pair('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b4') as standing \gset
insert into public.blocks (blocker_id, blocked_id)
values ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000b3');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000b3');
select throws_ok(pg_temp.text_from('00000000-0000-0000-0000-0000000000b3', :'standing'),
  '42501', null, 'sending while a Block stands is refused even on an accepted Connection');

reset role;
select pg_temp.accepted_pair('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2') as status \gset
update public.profiles set paused_at = now() where id = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a1');
select lives_ok(pg_temp.text_from('00000000-0000-0000-0000-0000000000a1', :'status'),
  'a Paused Member still chats in existing Connections');
reset role;
update public.profiles set paused_at = null, status = 'banned' where id = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a1');
select throws_ok(pg_temp.text_from('00000000-0000-0000-0000-0000000000a1', :'status'),
  '42501', null, 'a Banned Member cannot send');
reset role;
update public.profiles set status = 'active', deleted_at = now() where id = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a1');
select throws_ok(pg_temp.text_from('00000000-0000-0000-0000-0000000000a1', :'status'),
  '42501', null, 'a deleted Member cannot send');

select * from finish();
rollback;
