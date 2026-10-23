begin;
\ir helpers/act_as.psql
select plan(20);
-- Several media messages per chat here; the daily allowance has its own tests.
update public.chat_media_settings set daily_media_allowance = null;

\set a '00000000-0000-0000-0000-0000000000f1'
\set b '00000000-0000-0000-0000-0000000000f2'
select pg_temp.accepted_pair(:'a', :'b') as chat \gset

-- The limits a Member reads: the launch values from the settings row.
select pg_temp.act_as_member(:'a');
select results_eq($$ select video_max_ms, image_max_bytes, voice_max_ms from public.chat_media_limits() $$,
  $$ values (15000, 2097152, 120000) $$, 'a Member reads the launch limits: video 15 s, image 2 MB, voice 2 min');
select throws_ok($$ select * from public.chat_media_settings $$, '42501', null, 'Members cannot read the settings row');
select throws_ok($$ update public.chat_media_settings set video_max_ms = 30000 $$, '42501', null,
  'Members cannot change the settings row');
select pg_temp.act_as_anon();
select throws_ok($$ select * from public.chat_media_limits() $$, '42501', null, 'visitors cannot read the limits');
select throws_ok($$ select * from public.chat_media_settings $$, '42501', null, 'visitors cannot read the settings row');

-- Image size: refused before an upload link is issued.
select pg_temp.act_as_service();
select throws_ok(format($$ select public.start_chat_upload(%L, %L, 'image', 2097153) $$, :'a', :'chat'),
  'P0001', 'image is too large', 'an image over 2 MB gets no upload slot');
select lives_ok(format($$ select public.start_chat_upload(%L, %L, 'image', 2097152) $$, :'a', :'chat'),
  'an image of exactly 2 MB gets a slot');
select lives_ok(format($$ select public.start_chat_upload(%L, %L, 'video', 2097153) $$, :'a', :'chat'),
  'the image limit does not apply to video');

-- Video and voice length: refused when the message goes in.
reset role;
select pg_temp.chat_upload(:'a', :'chat', 'video') as video_key \gset
select pg_temp.chat_upload(:'a', :'chat', 'voice') as voice_key \gset
select pg_temp.act_as_member(:'a');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'video', :'video_key', 15001),
  'P0001', 'video is too long', 'a video over 15 seconds is refused');
select lives_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'video', :'video_key', 15000),
  'a 15-second video is accepted');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'voice', :'voice_key', 120001),
  'P0001', 'voice note is too long', 'a voice note over 2 minutes is refused');
select lives_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'voice', :'voice_key', 120000),
  'a 2-minute voice note is accepted');

-- The founder's SQL update applies at once; an empty value falls back to the fixed maximum.
reset role;
update public.chat_media_settings set video_max_ms = null, image_max_bytes = 1000000, voice_max_ms = null;
select pg_temp.act_as_member(:'a');
select results_eq($$ select video_max_ms, image_max_bytes, voice_max_ms from public.chat_media_limits() $$,
  $$ values (30000, 1000000, 120000) $$, 'a changed row shows straight away; empty values give the fixed maximums');
reset role;
select pg_temp.chat_upload(:'a', :'chat', 'video') as long_video_key \gset
select pg_temp.chat_upload(:'a', :'chat', 'video') as longer_video_key \gset
select pg_temp.act_as_member(:'a');
select lives_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'video', :'long_video_key', 30000),
  'with the video limit empty, a 30-second video is accepted');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'video', :'longer_video_key', 30001),
  'P0001', 'video is too long', 'with the video limit empty, a 31-second video is still refused');
select pg_temp.act_as_service();
select throws_ok(format($$ select public.start_chat_upload(%L, %L, 'image', 1000001) $$, :'a', :'chat'),
  'P0001', 'image is too large', 'a lowered image limit refuses at once');
reset role;
update public.chat_media_settings set image_max_bytes = null;
select pg_temp.act_as_service();
select lives_ok(format($$ select public.start_chat_upload(%L, %L, 'image', 5242880) $$, :'a', :'chat'),
  'with the image limit empty, a 5 MB image gets a slot');
select throws_ok(format($$ select public.start_chat_upload(%L, %L, 'image', 5242881) $$, :'a', :'chat'),
  'P0001', 'image is too large', 'with the image limit empty, an image over 5 MB is still refused');
reset role;
select throws_ok($$ update public.chat_media_settings set video_max_ms = 30001 $$, '23514', null,
  'a setting cannot loosen a fixed maximum');
select throws_ok($$ insert into public.chat_media_settings (id) values (false) $$, '23514', null,
  'there is only ever one settings row');

select * from finish();
rollback;
