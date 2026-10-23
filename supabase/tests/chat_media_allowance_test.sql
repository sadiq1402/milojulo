begin;
\ir helpers/act_as.psql
select plan(17);

\set a '00000000-0000-0000-0000-0000000000a1'
\set b '00000000-0000-0000-0000-0000000000a2'
\set c '00000000-0000-0000-0000-0000000000a3'
\set x '00000000-0000-0000-0000-0000000000a4'
select pg_temp.accepted_pair(:'a', :'b') as chat \gset
select pg_temp.create_visible_member(:'c');
select pg_temp.create_visible_member(:'x');
select pg_temp.accepted_pair(:'a', :'c', create_members => false) as other_chat \gset

-- One media message per sender per Connection in any rolling 24 hours. Two uploads made
-- while the allowance was free: only one can be sent.
select pg_temp.chat_upload(:'a', :'chat', 'image') as first_key \gset
select pg_temp.chat_upload(:'a', :'chat', 'voice') as second_key \gset
select pg_temp.act_as_member(:'a');
select lives_ok(pg_temp.media_insert('00000000-0000-0000-0000-0000000a0001', :'a', :'chat', 'image', :'first_key'),
  'the first media message of the day goes in');
select pg_temp.act_as_service();
select throws_ok(format($$ select public.start_chat_upload(%L, %L, 'voice', 1000) $$, :'a', :'chat'),
  'P0001', 'media limit reached', 'a second upload, of any kind, gets no slot');
select pg_temp.act_as_member(:'a');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'voice', :'second_key'),
  'P0001', 'media limit reached', 'a second media message, even from an upload made earlier, is refused');
select lives_ok(format($$ insert into public.messages (id, connection_id, sender_id, type, body)
  values (gen_random_uuid(), %L, %L, 'text', 'still here') $$, :'chat', :'a'),
  'text messages are never limited');
select lives_ok(pg_temp.media_insert('00000000-0000-0000-0000-0000000a0001', :'a', :'chat', 'image', :'first_key'),
  'a retried send of the first message is not refused');
select is((select count(*)::int from public.messages where id = '00000000-0000-0000-0000-0000000a0001'), 1,
  'and is stored once');

-- What the Member reads: none left, and when the next one opens.
select results_eq(format($$ select remaining, next_at from public.chat_media_allowance(%L) $$, :'chat'),
  $$ values (0, now() + interval '24 hours') $$, 'used up: none left, the next one 24 hours after the first');
select results_eq(format($$ select remaining, next_at from public.chat_media_allowance(%L) $$, :'other_chat'),
  $$ values (1, null::timestamptz) $$, 'in another Connection the allowance is untouched');
select pg_temp.act_as_member(:'x');
select throws_ok(format($$ select * from public.chat_media_allowance(%L) $$, :'chat'),
  'P0001', 'no connection', 'a Member outside the Connection cannot read it');
select pg_temp.act_as_anon();
select throws_ok(format($$ select * from public.chat_media_allowance(%L) $$, :'chat'),
  '42501', null, 'visitors cannot read it');

-- Each side, and each Connection, has its own allowance; an upload never sent doesn't count.
reset role;
select pg_temp.chat_upload(:'b', :'chat', 'image') as b_unsent_key \gset
select pg_temp.chat_upload(:'b', :'chat', 'image') as b_key \gset
select pg_temp.chat_upload(:'a', :'other_chat', 'image') as a_other_key \gset
select pg_temp.act_as_member(:'b');
select lives_ok(pg_temp.media_insert(gen_random_uuid(), :'b', :'chat', 'image', :'b_key'),
  'the other side of the same Connection has their own allowance, unspent by an unsent upload');
select pg_temp.act_as_member(:'a');
select lives_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'other_chat', 'image', :'a_other_key'),
  'the same Member has a separate allowance in another Connection');

-- Taken down or expired, a sent message still counts.
reset role;
update public.messages set removed_at = now(), media_deleted_at = now()
where id = '00000000-0000-0000-0000-0000000a0001';
select pg_temp.act_as_service();
select throws_ok(format($$ select public.start_chat_upload(%L, %L, 'image', 1000) $$, :'a', :'chat'),
  'P0001', 'media limit reached', 'a taken-down, expired media message still counts');

-- 24 hours after the first, the next one is allowed.
reset role;
update public.messages set created_at = now() - interval '24 hours 1 second'
where id = '00000000-0000-0000-0000-0000000a0001';
select pg_temp.act_as_service();
select lives_ok(format($$ select public.start_chat_upload(%L, %L, 'image', 1000) $$, :'a', :'chat'),
  'once the first is 24 hours old, a new upload gets a slot');
select pg_temp.act_as_member(:'a');
select lives_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'voice', :'second_key'),
  'and the waiting upload can be sent');

-- An empty allowance means no daily limit.
reset role;
update public.chat_media_settings set daily_media_allowance = null;
select pg_temp.chat_upload(:'a', :'chat', 'image') as unlimited_key \gset
select pg_temp.act_as_member(:'a');
select lives_ok(pg_temp.media_insert(gen_random_uuid(), :'a', :'chat', 'image', :'unlimited_key'),
  'with the allowance empty, another media message goes in');
select results_eq(format($$ select remaining, next_at from public.chat_media_allowance(%L) $$, :'chat'),
  $$ values (null::integer, null::timestamptz) $$, 'and the Member reads no limit');

select * from finish();
rollback;
