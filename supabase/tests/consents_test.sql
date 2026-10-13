begin;
\ir helpers/act_as.psql
select plan(9);

select pg_temp.create_account('00000000-0000-0000-0000-0000000000c1');
select pg_temp.create_account('00000000-0000-0000-0000-0000000000c2');

create temp table current_docs on commit drop as
  select array_agg(id) as ids from public.consent_documents where version = 'v1';
grant select on current_docs to authenticated, anon;

-- 18 today in Pune, and one day short of 18.
create temp table ages on commit drop as select
  ((now() at time zone 'Asia/Kolkata')::date - interval '18 years')::date as just_18,
  ((now() at time zone 'Asia/Kolkata')::date - interval '18 years' + interval '1 day')::date as almost_18;
grant select on ages to authenticated, anon;

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');

select throws_ok(
  $$ select public.accept_consents((select almost_18 from ages), (select ids from current_docs)) $$,
  'P0001', 'members must be 18 or older', 'someone one day short of 18 is refused');
select is_empty('select 1 from public.profiles', 'an under-18 refusal leaves no profile behind');

select throws_ok(
  $$ select public.accept_consents((select just_18 from ages),
       (select array_agg(id) from public.consent_documents where kind <> 'data_notice')) $$,
  'P0001', 'accept the current terms, guidelines and data notice',
  'consent is refused unless every current document is accepted');
select is_empty('select 1 from public.profiles', 'a missing-document refusal leaves no profile behind');

select lives_ok(
  $$ select public.accept_consents((select just_18 from ages), (select ids from current_docs)) $$,
  'someone who turns 18 today (Pune time) is accepted');

select results_eq(
  $$ select d.kind::text, d.version from public.consents c join public.consent_documents d on d.id = c.document_id order by 1 $$,
  $$ values ('data_notice', 'v1'), ('guidelines', 'v1'), ('terms', 'v1') $$,
  'the Member''s consent to each current document and version is recorded');

reset role;
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c2');
select is_empty(
  $$ select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000c1' $$,
  'another Member cannot read someone''s profile row (and so their date of birth)');

select is_empty(
  $$ select 1 from public.consents where user_id = '00000000-0000-0000-0000-0000000000c1' $$,
  'another Member cannot read someone''s consents');

reset role;
select pg_temp.act_as_anon();
select throws_ok(
  $$ select public.accept_consents('1995-06-15', (select ids from current_docs)) $$,
  '42501', null, 'a signed-out visitor cannot give consents');

select * from finish();
rollback;
