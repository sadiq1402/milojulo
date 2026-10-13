begin;
\ir helpers/act_as.psql
select plan(4);

select pg_temp.create_account('00000000-0000-0000-0000-0000000000ee');
select public.seed_reviewer('00000000-0000-0000-0000-0000000000ee');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000ee');
select results_eq(
  'select id, date_of_birth from public.profiles',
  $$ values ('00000000-0000-0000-0000-0000000000ee'::uuid, '1990-01-01'::date) $$,
  'the seeded reviewer has a profile with an adult date of birth');
select is(
  (select count(*)::int from public.consents), 3,
  'the seeded reviewer has accepted the current documents');
select lives_ok($$ update public.profiles set display_name = 'Reviewer' $$,
  'the seeded reviewer can go on to set up their profile');

select throws_ok($$ select public.seed_reviewer('00000000-0000-0000-0000-0000000000ee') $$, '42501', null,
  'a Member cannot seed a reviewer account');

select * from finish();
rollback;
