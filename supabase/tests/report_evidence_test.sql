-- #160: report evidence is a copy under `evidence/`, kept 90 days (decision 62).
begin;
\ir helpers/act_as.psql
select plan(17);

\set asha '00000000-0000-0000-0000-0000000000e1'
\set ravi '00000000-0000-0000-0000-0000000000e2'
select pg_temp.create_visible_member(:'asha');
select pg_temp.create_visible_member(:'ravi');
-- A third photo, so Asha can delete the reported one and still meet the profile minimum.
insert into public.photos (user_id, object_key, position, uploaded_at)
values (:'asha', :'asha' || '/3.jpg', 3, now());
select id as photo_id, object_key as photo_key
from public.photos where user_id = :'asha' and position = 1 \gset

-- Ravi reports one of Asha's photos.
select pg_temp.act_as_member(:'ravi');
select lives_ok(format($$ select public.report('photo', %L, 'inappropriate_content') $$, :'photo_id'),
  'a Member can report a photo');
reset role;

select results_eq(
  $$ select evidence_source_key, evidence_media_key = 'evidence/' || id::text || '.jpg', evidence_copied_at is null
     from public.reports where target_type = 'photo' $$,
  format($$ values (%L, true, true) $$, :'photo_key'),
  'the report points at an evidence copy, keeps the original as its source, and is not copied yet');

select results_eq(
  $$ select count(*)::int from public.reports where evidence_media_key like '%/%/%' $$, array[0],
  'no evidence key is still a live media key');

-- The copy job: what still needs copying, and what happens once R2 has the copy.
select pg_temp.act_as_service();
select results_eq(
  $$ select source_key, evidence_key = 'evidence/' || report_id::text || '.jpg'
     from public.pending_evidence_copies(10) $$,
  format($$ values (%L, true) $$, :'photo_key'),
  'the copy job is given the original to copy and where to put it');

-- Nothing that deletes R2 files may touch the original until the copy exists.
select is_empty(
  format($$ select 1 from public.erasure_media_keys(%L) k where k = %L $$, :'asha', :'photo_key'),
  'the account purge leaves the original alone while the copy is pending');
reset role;
insert into public.data_requests (user_id, kind) values (:'asha', 'erasure');
select pg_temp.act_as_service();
select is_empty(format($$ select 1 from public.erasure_queue() q where q.member_id = %L $$, :'asha'),
  'an erasure waits for the copy, so the account is not deleted out from under it');

-- A photo its owner deletes meanwhile keeps its file, so the evidence is still there to copy.
select is((select public.delete_photo(:'asha', :'photo_id')), null,
  'a reported photo whose evidence is still pending keeps its file');

-- Once the copy is safe the job is handed the original, which nothing points at any more.
select results_eq(
  $$ select public.mark_evidence_copied(array(select report_id from public.pending_evidence_copies(10))) $$,
  format($$ values (%L) $$, :'photo_key'),
  'the job stamps the copy and is told to delete the original nothing points at');
select is_empty($$ select 1 from public.pending_evidence_copies(10) $$,
  'a copied report is no longer pending');
select isnt_empty(format($$ select 1 from public.erasure_queue() q where q.member_id = %L $$, :'asha'),
  'the erasure goes ahead once the copy exists');
reset role;

select pg_temp.act_as_member(:'ravi');
select throws_ok($$ select public.pending_evidence_copies(10) $$, '42501',
  null, 'a Member cannot read the copy queue');
select throws_ok($$ select public.mark_evidence_copied('{}'::uuid[]) $$, '42501',
  null, 'a Member cannot mark evidence copied');
select throws_ok($$ select public.dispatch_evidence_copies() $$, '42501',
  null, 'a Member cannot set the copy job going');
reset role;

-- The hold rule is internal: it runs inside the purges, and nothing calls it from outside.
select pg_temp.act_as_service();
select throws_ok($$ select public.evidence_pending_for('any/key.jpg') $$, '42501',
  null, 'not even the service role calls the hold rule directly');
select throws_ok($$ select public.evidence_key_for(gen_random_uuid(), 'any/key.jpg') $$, '42501',
  null, 'nor builds an evidence key itself');
reset role;

-- The copy runs straight after the report, and again on a schedule for anything left over.
select results_eq($$ select schedule, active from cron.job where jobname = 'copy-report-evidence' $$,
  $$ values ('*/15 * * * *', true) $$, 'leftover copies are retried every 15 minutes');
select isnt_empty($$ select 1 from pg_trigger
  where tgrelid = 'public.reports'::regclass and tgname = 'request_evidence_copy' $$,
  'a new report asks for its copy at once');

select * from finish();
rollback;
