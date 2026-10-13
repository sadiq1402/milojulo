begin;
\ir helpers/act_as.psql
select plan(10);

select pg_temp.create_account('00000000-0000-0000-0000-0000000000f1');

create temp table current_docs on commit drop as
  select array_agg(id) as ids from public.consent_documents where version = 'v1';
grant select on current_docs to authenticated, anon;

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000f1');
select lives_ok(
  $$ select public.accept_consents('1995-06-15', (select ids from current_docs)) $$,
  'a signed-in account with no profile can give its date of birth and consents');

select results_eq(
  'select id, date_of_birth from public.profiles',
  $$ values ('00000000-0000-0000-0000-0000000000f1'::uuid, '1995-06-15'::date) $$,
  'accepting creates the Member''s own profile with their date of birth');

select is(
  (select count(*)::int from public.consents), 3,
  'the new Member''s consents to the current documents are recorded');

select lives_ok(
  $$ select public.accept_consents('1996-07-20', (select ids from current_docs)) $$,
  'a Member who already has a profile can give consents again');

select results_eq(
  'select id, date_of_birth from public.profiles',
  $$ values ('00000000-0000-0000-0000-0000000000f1'::uuid, '1996-07-20'::date) $$,
  'giving consents again keeps the one profile and updates the date of birth');

select throws_ok($$ select public.current_consent_documents() $$, '42501', null,
  'a Member cannot call the internal current-documents helper');

-- Invite codes are gone (decision 27).
select throws_ok($$ select public.check_invite('REVIEWER') $$, '42883', null, 'there is no invite check');
select throws_ok($$ select public.redeem_invite('REVIEWER') $$, '42883', null, 'there is no invite to redeem');
select throws_ok('select 1 from public.invite_codes', '42P01', null, 'there are no invite codes');
select throws_ok('select 1 from public.invite_redemptions', '42P01', null, 'there are no invite redemptions');

select * from finish();
rollback;
