begin;
\ir helpers/act_as.psql
select plan(4);

select pg_temp.create_account('00000000-0000-0000-0000-0000000000ee');
select public.seed_reviewer('00000000-0000-0000-0000-0000000000ee');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000ee');
select isnt_empty('select 1 from public.profiles', 'the seeded reviewer has a profile without an invite');
select is(
  (select count(*)::int from public.consents), 3,
  'the seeded reviewer has accepted the current documents');
select is(public.check_invite('REVIEWER'), false, 'the reserved REVIEWER code still cannot be redeemed');

select throws_ok($$ select public.seed_reviewer('00000000-0000-0000-0000-0000000000ee') $$, '42501', null,
  'a Member cannot seed a reviewer account');

select * from finish();
rollback;
