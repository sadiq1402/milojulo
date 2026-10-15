begin;
\ir helpers/act_as.psql
select plan(33);

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

-- A media message insert, to pass to lives_ok / throws_ok.
create function pg_temp.media_insert(msg_id uuid, sender uuid, conn uuid, kind text, key text, mime text,
  duration_ms integer default null) returns text
language sql as $$
  select format($q$ insert into public.messages
                      (id, connection_id, sender_id, type, media_key, media_mime, media_duration_ms)
                    values (%L, %L, %L, %L, %L, %L, %L) on conflict (id) do nothing $q$,
                msg_id, conn, sender, kind, key, mime, duration_ms);
$$;

-- What the media function asks for chat-urls.
create function pg_temp.links(viewer uuid, ids uuid[]) returns setof uuid
language plpgsql as $$
begin
  perform pg_temp.act_as_service();
  return query select message_id from public.chat_media_links(viewer, ids) order by 1;
end;
$$;

\set a '00000000-0000-0000-0000-0000000000d1'
\set b '00000000-0000-0000-0000-0000000000d2'
\set x '00000000-0000-0000-0000-0000000000d3'
select pg_temp.accepted_pair(:'a', :'b') as chat \gset
select pg_temp.create_visible_member(:'x');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000d4');
select pg_temp.act_as_member(:'x');
select public.send_request('00000000-0000-0000-0000-0000000000d4', 'friends') as other \gset
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d4');
select public.respond_request(:'other', true);
reset role;
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000d5');
select pg_temp.act_as_member(:'a');
select public.send_request('00000000-0000-0000-0000-0000000000d5', 'friends') as second \gset
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d5');
select public.respond_request(:'second', true);
reset role;

-- Slots
select pg_temp.chat_upload(:'a', :'chat', 'image') as img \gset
select matches(:'img'::text, '^chat/' || :'chat' || '/[0-9a-f-]{36}\.jpg$', 'an image slot key is chat/<connection>/<uuid>.jpg');
select matches(pg_temp.chat_upload(:'a', :'chat', 'video'), '^chat/' || :'chat' || '/[0-9a-f-]{36}\.mp4$',
  'a video slot key ends in .mp4');
select matches(pg_temp.chat_upload(:'a', :'chat', 'voice'), '^chat/' || :'chat' || '/[0-9a-f-]{36}\.m4a$',
  'a voice slot key ends in .m4a');
select throws_ok(format($$ select pg_temp.chat_upload(%L, %L, 'image') $$, :'x', :'chat'),
  'P0001', 'no connection', 'a Member outside the Connection gets no slot');
select throws_ok(format($$ select pg_temp.chat_upload(%L, %L, 'text') $$, :'a', :'chat'),
  'P0001', 'choose image, video or voice', 'a slot is only for media');
select pg_temp.act_as_member(:'a');
select throws_ok(format($$ select public.start_chat_upload(%L, %L, 'image', 'image/jpeg', 10) $$, :'a', :'chat'),
  '42501', null, 'Members cannot make slots themselves');
select throws_ok($$ select * from public.chat_uploads $$, '42501', null, 'Members cannot read slots');
select pg_temp.act_as_anon();
select throws_ok($$ select * from public.chat_uploads $$, '42501', null, 'visitors cannot read slots');

-- Message inserts need the sender's own unused slot.
select pg_temp.act_as_member(:'a');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'image', 'chat/made/up.jpg', 'image/jpeg'),
  'P0001', 'upload the media first', 'an image with a made-up key is refused');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'video', :'img', 'image/jpeg', 1000),
  'P0001', 'upload the media first', 'a slot of another kind is refused');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'image', :'img', 'image/png'),
  'P0001', 'upload the media first', 'a different mime than the slot is refused');
select pg_temp.act_as_member(:'b');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'b', :'chat', 'image', :'img', 'image/jpeg'),
  'P0001', 'upload the media first', 'the other side cannot use my slot');
select pg_temp.act_as_member(:'a');
select lives_ok(pg_temp.media_insert('00000000-0000-0000-0000-00000000ee01', :'a', :'chat', 'image', :'img', 'image/jpeg'),
  'an image using my unused slot is accepted');
select lives_ok(pg_temp.media_insert('00000000-0000-0000-0000-00000000ee01', :'a', :'chat', 'image', :'img', 'image/jpeg'),
  'a retried send of the same message is a no-op');
select is((select count(*)::int from public.messages where id = '00000000-0000-0000-0000-00000000ee01'), 1,
  'the retry stored nothing more');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'image', :'img', 'image/jpeg'),
  'P0001', 'upload the media first', 'a used slot cannot be used again');

reset role;
select pg_temp.chat_upload(:'x', :'other', 'image') as elsewhere \gset
select pg_temp.act_as_member(:'x');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'x', :'chat', 'image', :'elsewhere', 'image/jpeg'),
  '42501', null, 'a slot for another Connection does not let an outsider in');
reset role;
select pg_temp.chat_upload(:'a', :'chat', 'image') as img2 \gset
select pg_temp.act_as_member(:'a');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'second', 'image', :'img2', 'image/jpeg'),
  'P0001', 'upload the media first', 'my slot is tied to its Connection');

-- Durations
reset role;
select pg_temp.chat_upload(:'a', :'chat', 'video') as vid \gset
select pg_temp.chat_upload(:'a', :'chat', 'voice') as voc \gset
select pg_temp.act_as_member(:'a');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'video', :'vid', 'video/mp4', 30001),
  'P0001', 'video can be at most 30 seconds', 'a video over 30 seconds is refused');
select lives_ok(pg_temp.media_insert('00000000-0000-0000-0000-00000000ee02', :'a', :'chat', 'video', :'vid', 'video/mp4', 30000),
  'a 30-second video is accepted');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'voice', :'voc', 'audio/mp4', 120001),
  'P0001', 'voice notes can be at most 2 minutes', 'a voice note over 2 minutes is refused');
select lives_ok(pg_temp.media_insert('00000000-0000-0000-0000-00000000ee03', :'a', :'chat', 'voice', :'voc', 'audio/mp4', 120000),
  'a 2-minute voice note is accepted');
insert into public.messages (id, connection_id, sender_id, type, body)
values ('00000000-0000-0000-0000-00000000ee04', :'chat', :'a', 'text', 'plain');

-- Links
reset role;
select results_eq(format($$ select pg_temp.links(%L, '{00000000-0000-0000-0000-00000000ee01,00000000-0000-0000-0000-00000000ee03,00000000-0000-0000-0000-00000000ee04}') $$, :'b'),
  $$ values ('00000000-0000-0000-0000-00000000ee01'::uuid), ('00000000-0000-0000-0000-00000000ee03'::uuid) $$,
  'the other side gets links to media messages, not to text');
reset role;
select results_eq(format($$ select pg_temp.links(%L, '{00000000-0000-0000-0000-00000000ee02}') $$, :'a'),
  $$ values ('00000000-0000-0000-0000-00000000ee02'::uuid) $$, 'the sender gets links to their own media');
reset role;
select results_eq($$ select object_key from (select media_key as object_key from public.chat_media_links(
    '00000000-0000-0000-0000-0000000000d2', '{00000000-0000-0000-0000-00000000ee01}')) k $$,
  array[:'img'], 'the link carries the message''s media key');
reset role;
select is_empty(format($$ select pg_temp.links(%L, '{00000000-0000-0000-0000-00000000ee01}') $$, :'x'),
  'an outsider gets no links');
reset role;
update public.messages set removed_at = now() where id = '00000000-0000-0000-0000-00000000ee01'; -- admin takedown
update public.messages set media_deleted_at = now() where id = '00000000-0000-0000-0000-00000000ee02'; -- Media Expiry
select is_empty(format($$ select pg_temp.links(%L, '{00000000-0000-0000-0000-00000000ee01}') $$, :'b'),
  'a removed message gets no link');
reset role;
select is_empty(format($$ select pg_temp.links(%L, '{00000000-0000-0000-0000-00000000ee02}') $$, :'b'),
  'an expired media message gets no link');
reset role;
select pg_temp.act_as_member(:'b');
select throws_ok($$ select * from public.chat_media_links('00000000-0000-0000-0000-0000000000d2', '{}') $$,
  '42501', null, 'Members cannot call chat_media_links');
-- A Block standing on a still-accepted Connection (block_user would close it) stops slots too.
reset role;
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-0000000000d5', :'a');
select throws_ok(format($$ select pg_temp.chat_upload(%L, %L, 'voice') $$, :'a', :'second'),
  'P0001', 'no connection', 'a Block standing on an accepted Connection gets no slot');
select pg_temp.act_as_member(:'b');
select public.block_user(:'a');
reset role;
select is_empty(format($$ select pg_temp.links(%L, '{00000000-0000-0000-0000-00000000ee03}') $$, :'b'),
  'after a Block, no links either way');
reset role;
select throws_ok(format($$ select pg_temp.chat_upload(%L, %L, 'voice') $$, :'a', :'chat'),
  'P0001', 'no connection', 'a blocked (closed) Connection gets no slot');
select pg_temp.act_as_member(:'a');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'image', :'img2', 'image/jpeg'),
  '42501', null, 'a slot made before the Block cannot be used after it');

select * from finish();
rollback;
