begin;
\ir helpers/act_as.psql
select plan(41);

\set a '00000000-0000-0000-0000-0000000000d1'
\set b '00000000-0000-0000-0000-0000000000d2'
\set x '00000000-0000-0000-0000-0000000000d3'
\set d4 '00000000-0000-0000-0000-0000000000d4'
\set d5 '00000000-0000-0000-0000-0000000000d5'
select pg_temp.accepted_pair(:'a', :'b') as chat \gset
select pg_temp.accepted_pair(:'x', :'d4') as outsiders_chat \gset
select pg_temp.create_visible_member(:'d5');
select pg_temp.accepted_pair(:'a', :'d5', create_members => false) as second_chat \gset

-- Slots: staged first, live key only after confirming.
select pg_temp.act_as_service();
select upload_id as image_slot, upload_key as image_upload_key
from public.start_chat_upload(:'a', :'chat', 'image', 1000) \gset
select matches(:'image_upload_key'::text, '^uploads/chat/' || :'chat' || '/' || :'image_slot' || '\.jpg$',
  'an image upload is staged at uploads/chat/<connection>/<upload id>.jpg');
select results_eq(format($$ select upload_key, media_key, mime, size from public.pending_chat_upload(%L, %L) $$, :'a', :'image_slot'),
  format($$ values (%L, %L, 'image/jpeg', 1000) $$, :'image_upload_key', 'chat/' || :'chat' || '/' || :'image_slot' || '.jpg'),
  'the pending slot gives its staging key, live key, type and size');
select is_empty(format($$ select * from public.pending_chat_upload(%L, %L) $$, :'b', :'image_slot'),
  'another Member has no pending slot of mine');
select throws_ok(format($$ select public.confirm_chat_upload(%L, %L) $$, :'b', :'image_slot'),
  'P0001', 'no upload to confirm', 'another Member cannot confirm my slot');
reset role;
select pg_temp.act_as_member(:'a');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'image', 'chat/' || :'chat' || '/' || :'image_slot' || '.jpg'),
  'P0001', 'upload the media first', 'an unconfirmed slot cannot be sent');
select pg_temp.act_as_service();
select is(public.confirm_chat_upload(:'a', :'image_slot'), 'chat/' || :'chat' || '/' || :'image_slot' || '.jpg',
  'confirming returns the live key chat/<connection>/<upload id>.jpg');
select is_empty(format($$ select * from public.pending_chat_upload(%L, %L) $$, :'a', :'image_slot'),
  'a confirmed slot is no longer pending');
select throws_ok(format($$ select public.confirm_chat_upload(%L, %L) $$, :'a', :'image_slot'),
  'P0001', 'no upload to confirm', 'a slot is confirmed only once');
reset role;
select 'chat/' || :'chat' || '/' || :'image_slot' || '.jpg' as image_key \gset
select matches(pg_temp.chat_upload(:'a', :'chat', 'video'), '^chat/' || :'chat' || '/[0-9a-f-]{36}\.mp4$',
  'a video key ends in .mp4');
select matches(pg_temp.chat_upload(:'a', :'chat', 'voice'), '^chat/' || :'chat' || '/[0-9a-f-]{36}\.m4a$',
  'a voice key ends in .m4a');
select throws_ok(format($$ select pg_temp.chat_upload(%L, %L, 'image') $$, :'x', :'chat'),
  'P0001', 'no connection', 'a Member outside the Connection gets no slot');
select throws_ok(format($$ select pg_temp.chat_upload(%L, %L, 'text') $$, :'a', :'chat'),
  'P0001', 'choose image, video or voice', 'a slot is only for media');
select pg_temp.act_as_member(:'a');
select throws_ok(format($$ select public.start_chat_upload(%L, %L, 'image', 10) $$, :'a', :'chat'),
  '42501', null, 'Members cannot make slots themselves');
select throws_ok(format($$ select public.confirm_chat_upload(%L, %L) $$, :'a', :'image_slot'),
  '42501', null, 'Members cannot confirm slots themselves');
select throws_ok($$ select * from public.chat_uploads $$, '42501', null, 'Members cannot read slots');
select pg_temp.act_as_anon();
select throws_ok($$ select * from public.chat_uploads $$, '42501', null, 'visitors cannot read slots');

-- Message inserts need the sender's own confirmed, unused slot.
select pg_temp.act_as_member(:'a');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'image', 'chat/made/up.jpg'),
  'P0001', 'upload the media first', 'an image with a made-up key is refused');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'video', :'image_key', mime => 'image/jpeg'),
  'P0001', 'upload the media first', 'a slot of another kind is refused');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'image', :'image_key', mime => 'image/png'),
  'P0001', 'upload the media first', 'a different type than the slot is refused');
select pg_temp.act_as_member(:'b');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'b', :'chat', 'image', :'image_key'),
  'P0001', 'upload the media first', 'the other side cannot use my slot');
select pg_temp.act_as_member(:'a');
select lives_ok(pg_temp.media_insert('00000000-0000-0000-0000-00000000ee01', :'a', :'chat', 'image', :'image_key'),
  'an image using my confirmed slot is accepted');
select lives_ok(pg_temp.media_insert('00000000-0000-0000-0000-00000000ee01', :'a', :'chat', 'image', :'image_key'),
  'a retried send of the same message is a no-op');
select is((select count(*)::int from public.messages where id = '00000000-0000-0000-0000-00000000ee01'), 1,
  'the retry stored nothing more');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'image', :'image_key'),
  'P0001', 'upload the media first', 'a used slot cannot be used again');

reset role;
select pg_temp.chat_upload(:'x', :'outsiders_chat', 'image') as outsider_key \gset
select pg_temp.act_as_member(:'x');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'x', :'chat', 'image', :'outsider_key'),
  '42501', null, 'a slot for another Connection does not let an outsider in');
reset role;
select pg_temp.chat_upload(:'a', :'chat', 'image') as unsent_image_key \gset
select pg_temp.act_as_member(:'a');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'second_chat', 'image', :'unsent_image_key'),
  'P0001', 'upload the media first', 'my slot is tied to its Connection');

-- Durations: friendly refusals ahead of the table's checks.
reset role;
select pg_temp.chat_upload(:'a', :'chat', 'video') as video_key \gset
select pg_temp.chat_upload(:'a', :'chat', 'voice') as voice_key \gset
select pg_temp.act_as_member(:'a');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'video', :'video_key', 30001),
  'P0001', 'video can be at most 30 seconds', 'a video over 30 seconds is refused');
select lives_ok(pg_temp.media_insert('00000000-0000-0000-0000-00000000ee02', :'a', :'chat', 'video', :'video_key', 30000),
  'a 30-second video is accepted');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'voice', :'voice_key', 120001),
  'P0001', 'voice notes can be at most 2 minutes', 'a voice note over 2 minutes is refused');
select lives_ok(pg_temp.media_insert('00000000-0000-0000-0000-00000000ee03', :'a', :'chat', 'voice', :'voice_key', 120000),
  'a 2-minute voice note is accepted');
insert into public.messages (id, connection_id, sender_id, type, body)
values ('00000000-0000-0000-0000-00000000ee04', :'chat', :'a', 'text', 'plain');

-- Links
reset role;
select results_eq(format($$ select pg_temp.media_links(%L, '{00000000-0000-0000-0000-00000000ee01,00000000-0000-0000-0000-00000000ee03,00000000-0000-0000-0000-00000000ee04}') $$, :'b'),
  $$ values ('00000000-0000-0000-0000-00000000ee01'::uuid), ('00000000-0000-0000-0000-00000000ee03'::uuid) $$,
  'the other side gets links to media messages, not to text');
reset role;
select results_eq(format($$ select pg_temp.media_links(%L, '{00000000-0000-0000-0000-00000000ee02}') $$, :'a'),
  $$ values ('00000000-0000-0000-0000-00000000ee02'::uuid) $$, 'the sender gets links to their own media');
reset role;
select pg_temp.act_as_service();
select results_eq($$ select media_key from public.chat_media_links('00000000-0000-0000-0000-0000000000d2',
    '{00000000-0000-0000-0000-00000000ee01}') $$,
  array[:'image_key'], 'the link carries the message''s media key');
reset role;
select is_empty(format($$ select pg_temp.media_links(%L, '{00000000-0000-0000-0000-00000000ee01}') $$, :'x'),
  'an outsider gets no links');
reset role;
-- No admin takedown function or Media Expiry job exists yet, so these two are set directly.
update public.messages set removed_at = now() where id = '00000000-0000-0000-0000-00000000ee01';
update public.messages set media_deleted_at = now() where id = '00000000-0000-0000-0000-00000000ee02';
select is_empty(format($$ select pg_temp.media_links(%L, '{00000000-0000-0000-0000-00000000ee01}') $$, :'b'),
  'a removed message gets no link');
reset role;
select is_empty(format($$ select pg_temp.media_links(%L, '{00000000-0000-0000-0000-00000000ee02}') $$, :'b'),
  'an expired media message gets no link');
reset role;
select pg_temp.act_as_member(:'b');
select throws_ok($$ select * from public.chat_media_links('00000000-0000-0000-0000-0000000000d2', '{}') $$,
  '42501', null, 'Members cannot call chat_media_links');

-- A Block standing on a still-accepted Connection stops slots too. block_user always closes the
-- Connection, so no public path leaves one standing; the row is written directly.
reset role;
insert into public.blocks (blocker_id, blocked_id) values (:'d5', :'a');
select throws_ok(format($$ select pg_temp.chat_upload(%L, %L, 'voice') $$, :'a', :'second_chat'),
  'P0001', 'no connection', 'a Block standing on an accepted Connection gets no slot');
select pg_temp.act_as_member(:'b');
select public.block_user(:'a');
reset role;
select is_empty(format($$ select pg_temp.media_links(%L, '{00000000-0000-0000-0000-00000000ee03}') $$, :'b'),
  'after a Block, no links either way');
reset role;
select throws_ok(format($$ select pg_temp.chat_upload(%L, %L, 'voice') $$, :'a', :'chat'),
  'P0001', 'no connection', 'a blocked (closed) Connection gets no slot');
select pg_temp.act_as_member(:'a');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'image', :'unsent_image_key'),
  '42501', null, 'a slot made before the Block cannot be used after it');

select * from finish();
rollback;
