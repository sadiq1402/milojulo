begin;
\ir helpers/act_as.psql
select plan(46);
-- Several media messages per chat here; the daily allowance has its own tests.
update public.chat_media_settings set daily_media_allowance = null;

create function pg_temp.m(suffix text) returns uuid
language sql immutable as $$ select ('00000000-0000-0000-0000-0000000000' || suffix)::uuid $$;

-- What the push function would send to a Member, oldest first. Run as postgres.
create function pg_temp.queued(suffix text) returns table (title text, body text, data jsonb)
language sql as $$
  select q.title, q.body, q.data from public.push_queue q where q.recipient_id = pg_temp.m(suffix) order by q.id
$$;

select pg_temp.create_visible_member(pg_temp.m('f1'));
select pg_temp.create_visible_member(pg_temp.m('f2'));
select pg_temp.create_visible_member(pg_temp.m('f3'));
select pg_temp.create_account(pg_temp.m('f9'));
update public.profiles set display_name = 'Asha' where id = pg_temp.m('f1');
update public.profiles set display_name = 'Ravi' where id = pg_temp.m('f2');
update public.profiles set display_name = 'Meera' where id = pg_temp.m('f3');

-- Device tokens

select pg_temp.act_as_member(pg_temp.m('f1'));
select lives_ok($$ select public.register_device_token('tok-a', 'android') $$, 'a Member registers a device token');
select results_eq($$ select token, platform from public.device_tokens $$, $$ values ('tok-a', 'android') $$,
  'the Member reads their own token');
select lives_ok($$ select public.register_device_token('tok-a', 'android') $$, 'registering the same token again is fine');
select is((select count(*) from public.device_tokens), 1::bigint, 'it is kept once');
select throws_ok($$ select public.register_device_token('tok-b', 'web') $$, 'choose android or ios',
  'a bad platform is refused');
select throws_ok($$ insert into public.device_tokens (token, user_id, platform) values ('x', auth.uid(), 'ios') $$,
  '42501', null, 'a Member cannot insert a token directly');
select throws_ok($$ update public.device_tokens set last_seen_at = now() $$,
  '42501', null, 'a Member cannot update a token directly');

select pg_temp.act_as_member(pg_temp.m('f2'));
select is_empty($$ select 1 from public.device_tokens $$, 'another Member cannot see the token');
delete from public.device_tokens where token = 'tok-a';
reset role;
select is((select count(*) from public.device_tokens where token = 'tok-a'), 1::bigint,
  'another Member cannot delete the token');

select pg_temp.act_as_member(pg_temp.m('f2'));
select public.register_device_token('tok-a', 'ios');
reset role;
select results_eq($$ select user_id, platform from public.device_tokens where token = 'tok-a' $$,
  format($$ values (%L::uuid, 'ios') $$, pg_temp.m('f2')),
  'the same phone signed in to a new account moves the token to it');

select pg_temp.act_as_member(pg_temp.m('f2'));
delete from public.device_tokens where token = 'tok-a';
select is_empty($$ select 1 from public.device_tokens $$, 'the owner deletes their token (sign out)');

select pg_temp.act_as_member(pg_temp.m('f9'));
select throws_ok($$ select public.register_device_token('tok-c', 'android') $$, 'create your profile first',
  'an account without a profile cannot register');
select pg_temp.act_as_anon();
select throws_ok($$ select public.register_device_token('tok-c', 'android') $$, '42501', null,
  'a signed-out visitor cannot register');
select throws_ok($$ select * from public.device_tokens $$, '42501', null, 'a signed-out visitor cannot read tokens');

-- Notification settings

select pg_temp.act_as_member(pg_temp.m('f1'));
update public.profiles set notify_messages = false, notify_activities = false where id = pg_temp.m('f1');
update public.profiles set notify_messages = false where id = pg_temp.m('f2');
reset role;
select results_eq($$ select notify_messages, notify_activities from public.profiles where id = pg_temp.m('f1') $$,
  $$ values (false, false) $$, 'a Member turns their notifications off');
select is((select notify_messages from public.profiles where id = pg_temp.m('f2')), true,
  'a Member cannot change another''s notifications');
update public.profiles set notify_messages = true, notify_activities = true where id = pg_temp.m('f1');

-- The queue is the function's alone

select pg_temp.act_as_member(pg_temp.m('f1'));
select throws_ok($$ select * from public.push_queue $$, '42501', null, 'a Member cannot read the push queue');
select throws_ok($$ insert into public.push_queue (recipient_id, title, body, data) values (auth.uid(), 'a', 'b', '{}') $$,
  '42501', null, 'a Member cannot write to the push queue');

-- Connection Requests

select pg_temp.act_as_member(pg_temp.m('f1'));
select public.send_request(pg_temp.m('f2'), 'friends') as c12 \gset
reset role;
select results_eq($$ select * from pg_temp.queued('f2') $$,
  format($$ values ('New Connection Request', 'Asha wants to connect.', '{"kind":"request","connectionId":"%s"}'::jsonb) $$, :'c12'),
  'the addressee is told of a Connection Request');

select pg_temp.act_as_member(pg_temp.m('f2'));
select public.respond_request(:'c12', true);
reset role;
select results_eq($$ select * from pg_temp.queued('f1') $$,
  format($$ values ('Ravi accepted your request', 'Say hello.', '{"kind":"accepted","connectionId":"%s"}'::jsonb) $$, :'c12'),
  'the requester is told their request was accepted');

update public.profiles set notify_messages = false where id = pg_temp.m('f3');
select pg_temp.act_as_member(pg_temp.m('f1'));
select public.send_request(pg_temp.m('f3'), 'friends') as c13 \gset
reset role;
select is_empty($$ select * from pg_temp.queued('f3') $$, 'no request push when message notifications are off');

update public.profiles set notify_messages = false where id = pg_temp.m('f1');
select pg_temp.act_as_member(pg_temp.m('f3'));
select public.respond_request(:'c13', true);
reset role;
select is((select count(*) from public.push_queue where recipient_id = pg_temp.m('f1')), 1::bigint,
  'no accepted push when message notifications are off');
update public.profiles set notify_messages = true where id in (pg_temp.m('f1'), pg_temp.m('f3'));

-- Messages

delete from public.push_queue;
select pg_temp.act_as_member(pg_temp.m('f1'));
insert into public.messages (id, connection_id, type, body) values (gen_random_uuid(), :'c12', 'text', 'Badminton at 7?');
reset role;
select results_eq($$ select * from pg_temp.queued('f2') $$,
  format($$ values ('Asha', 'Sent you a message.', '{"kind":"message","connectionId":"%s"}'::jsonb) $$, :'c12'),
  'the other participant is told of a text message, without its text');
select is_empty($$ select * from pg_temp.queued('f1') $$, 'the sender is not told of their own message');
delete from public.push_queue;
update public.profiles set deleted_at = now() where id = pg_temp.m('f2');
select pg_temp.act_as_member(pg_temp.m('f1'));
insert into public.messages (id, connection_id, type, body) values (gen_random_uuid(), :'c12', 'text', 'Still on?');
reset role;
select is_empty($$ select * from pg_temp.queued('f2') $$, 'a deleted Member gets no pushes');
update public.profiles set deleted_at = null, status = 'banned' where id = pg_temp.m('f2');
select pg_temp.act_as_member(pg_temp.m('f1'));
insert into public.messages (id, connection_id, type, body) values (gen_random_uuid(), :'c12', 'text', 'Hello?');
reset role;
select is_empty($$ select * from pg_temp.queued('f2') $$, 'a banned Member gets no pushes');
update public.profiles set status = 'active' where id = pg_temp.m('f2');

delete from public.push_queue;
select pg_temp.chat_upload(pg_temp.m('f1'), :'c12', 'image') as img \gset
select pg_temp.chat_upload(pg_temp.m('f1'), :'c12', 'video') as vid \gset
select pg_temp.chat_upload(pg_temp.m('f1'), :'c12', 'voice') as voi \gset
select pg_temp.act_as_member(pg_temp.m('f1'));
select lives_ok(pg_temp.media_insert(gen_random_uuid(), pg_temp.m('f1'), :'c12', 'image', :'img'), 'photo sent');
select lives_ok(pg_temp.media_insert(gen_random_uuid(), pg_temp.m('f1'), :'c12', 'video', :'vid'), 'video sent');
select lives_ok(pg_temp.media_insert(gen_random_uuid(), pg_temp.m('f1'), :'c12', 'voice', :'voi'), 'voice note sent');
reset role;
select results_eq($$ select body from pg_temp.queued('f2') $$,
  $$ values ('Sent a photo'), ('Sent a video'), ('Sent a voice note') $$, 'media messages say what was sent');

delete from public.push_queue;
select pg_temp.act_as_member(pg_temp.m('f2'));
update public.connection_members set muted = true where connection_id = :'c12' and user_id = pg_temp.m('f2');
select pg_temp.act_as_member(pg_temp.m('f1'));
insert into public.messages (id, connection_id, type, body) values (gen_random_uuid(), :'c12', 'text', 'Hello?');
reset role;
select is_empty($$ select * from pg_temp.queued('f2') $$, 'no message push to a Member who muted the chat');

update public.connection_members set muted = false where connection_id = :'c12';
update public.profiles set notify_messages = false where id = pg_temp.m('f2');
select pg_temp.act_as_member(pg_temp.m('f1'));
insert into public.messages (id, connection_id, type, body) values (gen_random_uuid(), :'c12', 'text', 'Hello??');
reset role;
select is_empty($$ select * from pg_temp.queued('f2') $$, 'no message push when message notifications are off');
update public.profiles set notify_messages = true where id = pg_temp.m('f2');

-- Join Requests

delete from public.push_queue;
insert into public.activities (host_id, title, type, area_id, starts_at, capacity)
values (pg_temp.m('f3'), 'Sunday trek', 'sports', 'baner', now() + interval '2 days', 3)
returning id as act \gset
select pg_temp.act_as_member(pg_temp.m('f2'));
select public.join_activity_request(:'act') as req \gset
reset role;
select results_eq($$ select * from pg_temp.queued('f3') $$,
  format($$ values ('New Join Request', 'Ravi asks to join Sunday trek.', '{"kind":"join_request","activityId":"%s"}'::jsonb) $$, :'act'),
  'the host is told of a Join Request');

select pg_temp.act_as_member(pg_temp.m('f3'));
select public.respond_activity_request(:'req', true);
reset role;
select results_eq($$ select * from pg_temp.queued('f2') $$,
  format($$ values ('You''re going', 'Meera accepted you for Sunday trek.', '{"kind":"join_accepted","activityId":"%s"}'::jsonb) $$, :'act'),
  'the joiner is told they were accepted, and not also of the Activity Connection');

-- A pending Connection Request flipped to accepted by a join gets only the join push.
delete from public.push_queue;
select pg_temp.create_visible_member(pg_temp.m('f4'));
update public.profiles set display_name = 'Kabir' where id = pg_temp.m('f4');
select pg_temp.act_as_member(pg_temp.m('f4'));
select public.send_request(pg_temp.m('f3'), 'friends') as c43 \gset
select public.join_activity_request(:'act') as req4 \gset
select pg_temp.act_as_member(pg_temp.m('f3'));
select public.respond_activity_request(:'req4', true);
reset role;
select results_eq($$ select data->>'kind' from pg_temp.queued('f4') $$, $$ values ('join_accepted') $$,
  'a Connection Request accepted through a join sends only the join push');

delete from public.push_queue;
update public.profiles set notify_activities = false where id = pg_temp.m('f3');
select pg_temp.act_as_member(pg_temp.m('f1'));
select public.join_activity_request(:'act') as req1 \gset
reset role;
select is((select count(*) from pg_temp.queued('f3') where data->>'kind' = 'join_request'), 0::bigint,
  'no Join Request push when activity notifications are off');
update public.profiles set notify_activities = false where id = pg_temp.m('f1');
select pg_temp.act_as_member(pg_temp.m('f3'));
select public.respond_activity_request(:'req1', true);
reset role;
select is_empty($$ select * from pg_temp.queued('f1') $$, 'no accepted push when activity notifications are off');

-- Handing rows to the push function

delete from vault.secrets where name in ('project_url', 'service_role_key');
select count(*) as before from net.http_request_queue \gset
select lives_ok($$ insert into public.push_queue (recipient_id, title, body, data) values (pg_temp.m('f1'), 't', 'b', '{}') $$,
  'without the Vault secrets a queued push still saves');
select is((select count(*) from net.http_request_queue), :'before'::bigint, 'and nothing is called');

select vault.create_secret('https://example.test', 'project_url');
select vault.create_secret('service-key', 'service_role_key');
insert into public.push_queue (recipient_id, title, body, data) values (pg_temp.m('f1'), 't', 'b', '{}')
returning id as qid \gset
select results_eq(
  $$ select url, headers->>'Authorization', convert_from(body, 'utf8')::jsonb from net.http_request_queue order by id desc limit 1 $$,
  format($$ values ('https://example.test/functions/v1/push', 'Bearer service-key', '{"id": %s}'::jsonb) $$, :'qid'),
  'with them each queued push calls the push function with its id');

-- Retrying what FCM couldn't take: the job re-sends a push still queued after a minute that was
-- never handed over, or handed over more than 5 minutes ago, and drops ones over an hour old.
delete from public.push_queue;
insert into public.push_queue (recipient_id, title, body, data, created_at) values
  (pg_temp.m('f1'), 'fresh', 'b', '{}', now()),
  (pg_temp.m('f1'), 'in flight', 'b', '{}', now() - interval '10 minutes'),
  (pg_temp.m('f1'), 'waiting', 'b', '{}', now() - interval '10 minutes'),
  (pg_temp.m('f1'), 'stale', 'b', '{}', now() - interval '61 minutes');
-- Postgres fixture: when each was handed to the push function (the insert trigger just did all four).
update public.push_queue set handed_over_at = now() - interval '2 minutes' where title = 'in flight';
update public.push_queue set handed_over_at = now() - interval '6 minutes' where title = 'waiting';
select id as waiting from public.push_queue where title = 'waiting' \gset
select max(id) as last_call from net.http_request_queue \gset
select public.retry_queued_pushes();
select results_eq(
  format($$ select convert_from(body, 'utf8')::jsonb from net.http_request_queue where id > %s $$, :'last_call'),
  format($$ values ('{"id": %s}'::jsonb) $$, :'waiting'),
  'a push handed over 5 minutes ago and still queued is sent again; a fresh or in-flight one is not');
select results_eq($$ select title from public.push_queue order by title $$,
  $$ values ('fresh'), ('in flight'), ('waiting') $$, 'a push queued over an hour ago is dropped');

-- Never handed over (no Vault secrets at the time): sent once it has waited a minute.
delete from public.push_queue;
delete from vault.secrets where name in ('project_url', 'service_role_key');
insert into public.push_queue (recipient_id, title, body, data, created_at)
values (pg_temp.m('f1'), 'unsent', 'b', '{}', now() - interval '2 minutes') returning id as unsent \gset
select vault.create_secret('https://example.test', 'project_url');
select vault.create_secret('service-key', 'service_role_key');
select max(id) as last_call from net.http_request_queue \gset
select public.retry_queued_pushes();
select results_eq(
  format($$ select convert_from(body, 'utf8')::jsonb from net.http_request_queue where id > %s $$, :'last_call'),
  format($$ values ('{"id": %s}'::jsonb) $$, :'unsent'),
  'a push never handed over is sent once it has waited a minute');

-- A retry is dropped when the recipient no longer wants it.
select pg_temp.create_visible_member(pg_temp.m(s)) from unnest(array['e1', 'e2', 'e3', 'e4', 'e5', 'e6']) s;
select pg_temp.accepted_pair(pg_temp.m('e5'), pg_temp.m('e6'), create_members => false) as chat \gset
delete from public.push_queue;
insert into public.push_queue (recipient_id, title, body, data, created_at) values
  (pg_temp.m('e1'), 'banned', 'b', '{"kind": "message"}', now() - interval '10 minutes'),
  (pg_temp.m('e2'), 'messages off', 'b', '{"kind": "message"}', now() - interval '10 minutes'),
  (pg_temp.m('e3'), 'activities off', 'b', '{"kind": "join_request"}', now() - interval '10 minutes'),
  (pg_temp.m('e4'), 'still wanted', 'b', '{"kind": "join_request"}', now() - interval '10 minutes'),
  (pg_temp.m('e5'), 'muted chat', 'b', jsonb_build_object('kind', 'message', 'connectionId', :'chat'), now() - interval '10 minutes'),
  (pg_temp.m('e6'), 'closed chat', 'b', jsonb_build_object('kind', 'message', 'connectionId', :'chat'), now() - interval '10 minutes');
update public.push_queue set handed_over_at = now() - interval '6 minutes';
update public.profiles set status = 'banned' where id = pg_temp.m('e1');
update public.profiles set notify_messages = false where id = pg_temp.m('e2');
update public.profiles set notify_activities = false where id = pg_temp.m('e3');
update public.profiles set notify_messages = false where id = pg_temp.m('e4');
update public.connection_members set muted = true where user_id = pg_temp.m('e5');
select public.retry_queued_pushes();
select results_eq($$ select title from public.push_queue order by title $$,
  $$ values ('closed chat'), ('still wanted') $$,
  'a retry is dropped for a banned recipient, a setting turned off or a muted chat');
select pg_temp.act_as_member(pg_temp.m('e6'));
select public.close_connection(:'chat');
reset role;
select public.retry_queued_pushes();
select results_eq($$ select title from public.push_queue order by title $$,
  $$ values ('still wanted') $$, 'and once its Connection has closed');

select pg_temp.act_as_member(pg_temp.m('f1'));
select throws_ok($$ select public.retry_queued_pushes() $$, '42501', null, 'a Member cannot retry pushes');
reset role;

select * from finish();
rollback;
