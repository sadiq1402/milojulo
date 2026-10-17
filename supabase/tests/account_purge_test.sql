begin;
\ir helpers/act_as.psql
select plan(18);

\set gone '00000000-0000-0000-0000-00000000b601'
\set ravi '00000000-0000-0000-0000-00000000b602'
\set isha '00000000-0000-0000-0000-00000000b603'
select pg_temp.accepted_pair(:'gone', :'ravi') as chat \gset
select pg_temp.create_visible_member(:'isha');

-- Photos: one live, one reported (its file is evidence), one still being uploaded; Ravi's own.
insert into public.photos (user_id, object_key, position, uploaded_at) values
  (:'gone', 'gone/live.jpg', 3, now()),
  (:'gone', 'gone/reported.jpg', 4, now()),
  (:'ravi', 'ravi/own.jpg', 3, now());
insert into public.photo_uploads (user_id, position, object_key) values (:'gone', 1, 'gone/new.jpg');

-- Chat media both ways, one message reported, and an upload slot never confirmed.
select pg_temp.chat_upload(:'gone', :'chat', 'image') as sent_key \gset
select pg_temp.chat_upload(:'ravi', :'chat', 'image') as received_key \gset
select pg_temp.chat_upload(:'ravi', :'chat', 'image') as reported_key \gset
select pg_temp.chat_slot(:'gone', :'chat', 'voice') as slot \gset
select media_key as unsent_key from public.chat_uploads where id = :'slot' \gset
select pg_temp.act_as_member(:'gone');
select lives_ok(pg_temp.media_insert(gen_random_uuid(), :'gone', :'chat', 'image', :'sent_key'), 'sends');
select pg_temp.act_as_member(:'ravi');
select lives_ok(pg_temp.media_insert(gen_random_uuid(), :'ravi', :'chat', 'image', :'received_key'), 'sends');
select lives_ok(pg_temp.media_insert('00000000-0000-0000-0000-00000000b6a1', :'ravi', :'chat', 'image',
  :'reported_key'), 'sends');
reset role;
insert into public.reports (reporter_id, target_type, target_id, target_user_id, reason, evidence_media_key) values
  (:'isha', 'photo', (select id from public.photos where object_key = 'gone/reported.jpg'), :'gone', 'fake_or_spam', 'gone/reported.jpg'),
  (:'gone', 'message', '00000000-0000-0000-0000-00000000b6a1', :'ravi', 'harassment', :'reported_key');

select pg_temp.act_as_member(:'gone');
select public.delete_account();

select pg_temp.act_as_service();
select results_eq($$ select member_id from public.erasure_queue() $$, array[:'gone'::uuid],
  'the queue holds the Member who asked to be deleted, and no one else');
create temp table keys as select public.erasure_media_keys(:'gone') as key;
select ok((select bool_and(k = any (array(select key from keys)))
           from unnest(array['gone/live.jpg', 'uploads/gone/new.jpg', :'sent_key', :'received_key',
                             'uploads/' || :'unsent_key']) k),
  'their photos and uploads, and the chat media on both sides of their chats, are erased');
select ok(not ('gone/reported.jpg' = any (array(select key from keys))), 'a reported photo''s file is kept as evidence');
select ok(not (:'reported_key' = any (array(select key from keys))), 'a reported message''s media is kept as evidence');
select ok(not ('ravi/own.jpg' = any (array(select key from keys))), 'the other Member''s photos are untouched');

select lives_ok(format($$ select public.record_erasure(%L, now() - interval '1 day', 7) $$, :'gone'),
  'the purge records the finished erasure');

select pg_temp.act_as_admin('00000000-0000-0000-0000-00000000b6ad');
select results_eq(format($$ select objects_deleted from public.completed_erasures where member_id = %L $$, :'gone'),
  array[7], 'an admin can see the erasure was finished');

select pg_temp.act_as_member(:'ravi');
select is_empty($$ select 1 from public.completed_erasures $$, 'a Member sees no erasure records');
select throws_ok($$ select * from public.erasure_queue() $$, '42501', null, 'a Member cannot read the queue');
select throws_ok(format($$ select public.erasure_media_keys(%L) $$, :'gone'), '42501', null,
  'a Member cannot list another Member''s media');
select throws_ok(format($$ select public.record_erasure(%L, now(), 0) $$, :'gone'), '42501', null,
  'a Member cannot record an erasure');

-- What the purge's admin API call does: delete the auth user, so the cascade erases the rest.
reset role;
select lives_ok(format($$ delete from auth.users where id = %L $$, :'gone'),
  'deleting the auth user cascades without being blocked');
select is_empty(format($$ select 1 from public.profiles where id = %L $$, :'gone'), 'the profile is gone');
select is_empty(format($$ select 1 from public.messages where connection_id = %L $$, :'chat'),
  'both sides'' messages in their chats are gone');
select results_eq($$ select count(*)::int from public.reports where evidence_media_key is not null $$, array[2],
  'reports stay with their evidence');

select * from finish();
rollback;
