begin;
\ir helpers/act_as.psql
select plan(14);

\set asha '00000000-0000-0000-0000-00000000c701'
\set ravi '00000000-0000-0000-0000-00000000c702'
select pg_temp.accepted_pair(:'asha', :'ravi') as chat \gset

-- Media messages: old, reported old, recent; and an old text message.
create function pg_temp.media_message(id uuid, age interval, kind public.message_type default 'image')
returns text
language plpgsql as $$
declare
  key text := pg_temp.chat_upload('00000000-0000-0000-0000-00000000c701', current_setting('t.chat')::uuid, kind);
begin
  execute pg_temp.media_insert(id, '00000000-0000-0000-0000-00000000c701', current_setting('t.chat')::uuid,
                               kind, key);
  update public.messages set created_at = now() - age where messages.id = media_message.id;
  return key;
end;
$$;
select set_config('t.chat', :'chat', true);
select pg_temp.media_message('00000000-0000-0000-0000-00000000c7a1', interval '91 days') as old_key \gset
select pg_temp.media_message('00000000-0000-0000-0000-00000000c7a2', interval '95 days') as evidence_key \gset
select pg_temp.media_message('00000000-0000-0000-0000-00000000c7a3', interval '30 days') as recent_key \gset
select pg_temp.media_message('00000000-0000-0000-0000-00000000c7a5', interval '92 days', 'video') as video_key \gset
select pg_temp.media_message('00000000-0000-0000-0000-00000000c7a6', interval '93 days', 'voice') as voice_key \gset
insert into public.messages (id, connection_id, sender_id, type, body, created_at)
values ('00000000-0000-0000-0000-00000000c7a4', :'chat', :'asha', 'text', 'Hi', now() - interval '100 days');
insert into public.reports (reporter_id, target_type, target_id, target_user_id, reason, evidence_media_key)
values (:'ravi', 'message', '00000000-0000-0000-0000-00000000c7a2', :'asha', 'harassment', :'evidence_key');

select pg_temp.act_as_service();
-- A file whose report evidence is still being copied is held back (#160) until the copy exists.
select results_eq($$ select message_id::text, media_key from public.expired_chat_media(10) $$,
  format($$ values ('00000000-0000-0000-0000-00000000c7a6', %L),
                   ('00000000-0000-0000-0000-00000000c7a5', %L), ('00000000-0000-0000-0000-00000000c7a1', %L) $$,
         :'voice_key', :'video_key', :'old_key'),
  'image, video and voice older than 90 days are due, oldest first; one still being copied waits');
select lives_ok($$ select public.mark_evidence_copied(array(select id from public.reports)) $$,
  'the copy job gets through its queue');
select results_eq($$ select message_id::text from public.expired_chat_media(10) limit 1 $$,
  array['00000000-0000-0000-0000-00000000c7a2'],
  'once the evidence copy exists the original is due like any other, oldest first');
select results_eq($$ select count(*)::int from public.expired_chat_media(1) $$, array[1], 'a batch has at most the size asked');
select results_eq($$ select message_id::text from public.expired_chat_media(1, array['00000000-0000-0000-0000-00000000c7a2']::uuid[]) $$,
  array['00000000-0000-0000-0000-00000000c7a6'], 'files the run failed on are skipped, so the next ones come through');

select lives_ok($$ select public.mark_chat_media_deleted(array['00000000-0000-0000-0000-00000000c7a1',
  '00000000-0000-0000-0000-00000000c7a2', '00000000-0000-0000-0000-00000000c7a5',
  '00000000-0000-0000-0000-00000000c7a6']::uuid[]) $$, 'the purge marks what it handled');
select is_empty($$ select 1 from public.expired_chat_media(10) $$, 'a rerun finds nothing left to do');
reset role;
select results_eq($$ select id::text from public.messages where media_deleted_at is not null order by 1 $$,
  $$ values ('00000000-0000-0000-0000-00000000c7a1'), ('00000000-0000-0000-0000-00000000c7a2'),
            ('00000000-0000-0000-0000-00000000c7a5'), ('00000000-0000-0000-0000-00000000c7a6') $$,
  'the messages stay, marked expired; the recent one and the text message are untouched');
select results_eq($$ select count(*)::int from public.reports where evidence_media_key is not null $$, array[1],
  'the report keeps its evidence key');

select pg_temp.act_as_member(:'asha');
select throws_ok($$ select * from public.expired_chat_media(10) $$, '42501', null, 'a Member cannot list expired media');
select throws_ok($$ select public.mark_chat_media_deleted(array[]::uuid[]) $$, '42501', null,
  'a Member cannot mark media expired');
select throws_ok($$ update public.messages set media_deleted_at = now() $$, '42501', null,
  'nor set it directly');

select pg_temp.act_as_anon();
select throws_ok($$ select * from public.expired_chat_media(10) $$, '42501', null, 'a signed-out visitor cannot either');
select throws_ok($$ select public.mark_chat_media_deleted(array[]::uuid[]) $$, '42501', null, 'nor mark any');

select * from finish();
rollback;
