begin;
\ir helpers/act_as.psql
select plan(15);

select pg_temp.create_complete_member('00000000-0000-0000-0000-0000000000e1');
update public.profiles set modes = '{dating}' where id = '00000000-0000-0000-0000-0000000000e1';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e1');
select throws_ok('select public.submit_profile()', 'P0001', 'add your gender',
  'submission in a Dating Mode is refused without the Member''s gender');
reset role;

select pg_temp.create_complete_member('00000000-0000-0000-0000-0000000000e2');
update public.profiles set modes = '{serious}', gender = 'woman'
where id = '00000000-0000-0000-0000-0000000000e2';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e2');
select throws_ok('select public.submit_profile()', 'P0001', 'set your dating preferences',
  'submission in a Dating Mode is refused without Dating Preferences');
select lives_ok(
  $$ update public.profiles set pref_genders = '{man}', pref_age_min = 24, pref_age_max = 34,
       pref_max_km = 15 $$,
  'a Member sets their own Dating Preferences');
select lives_ok('select public.submit_profile()',
  'a Member in a Dating Mode with gender and Dating Preferences can submit');
reset role;

select pg_temp.create_complete_member('00000000-0000-0000-0000-0000000000e3');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e3');
select public.submit_profile();
select throws_ok($$ update public.profiles set modes = '{friends,casual}' $$, 'P0001', 'add your gender',
  'a submitted Member cannot add a Dating Mode without their gender');
select throws_ok($$ update public.profiles set modes = '{friends,casual}', gender = 'man' $$,
  'P0001', 'set your dating preferences',
  'a submitted Member cannot add a Dating Mode without Dating Preferences');
select lives_ok(
  $$ update public.profiles set modes = '{friends,casual}', gender = 'man', pref_genders = '{woman,nonbinary}',
       pref_age_min = 21, pref_age_max = 30, pref_max_km = 10 $$,
  'a submitted Member can add a Dating Mode with gender and Dating Preferences');
select throws_ok($$ update public.profiles set gender = null $$, 'P0001', 'add your gender',
  'a Member in a Dating Mode cannot clear their gender');
select throws_ok($$ update public.profiles set pref_max_km = null $$, 'P0001', 'set your dating preferences',
  'a Member in a Dating Mode cannot clear their Dating Preferences');
select throws_ok($$ update public.profiles set pref_genders = '{}' $$, 'P0001', 'set your dating preferences',
  'a Member in a Dating Mode must accept at least one gender');
select lives_ok(
  $$ update public.profiles set modes = '{friends}', gender = null, pref_genders = null,
       pref_age_min = null, pref_age_max = null, pref_max_km = null $$,
  'a Member who drops their Dating Modes can clear gender and Dating Preferences');
reset role;

-- Dating Preferences checks hold whether or not a Dating Mode is held.
select pg_temp.create_member('00000000-0000-0000-0000-0000000000e4');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e4');
select throws_ok($$ update public.profiles set pref_age_min = 17, pref_age_max = 25 $$, '23514', null,
  'the youngest age a Member will accept is at least 18');
select throws_ok($$ update public.profiles set pref_age_min = 30, pref_age_max = 25 $$, '23514', null,
  'the age range cannot run backwards');
select lives_ok($$ update public.profiles set pref_age_min = 18, pref_age_max = 18 $$,
  'an age range of a single year from 18 is allowed');
select throws_ok($$ update public.profiles set pref_max_km = 0 $$, '23514', null,
  'the maximum distance must be positive');
reset role;

select * from finish();
rollback;
