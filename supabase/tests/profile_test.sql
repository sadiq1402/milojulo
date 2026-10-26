begin;
\ir helpers/act_as.psql
select plan(5);

select pg_temp.create_member('00000000-0000-0000-0000-0000000000e1');
select pg_temp.create_member('00000000-0000-0000-0000-0000000000e2');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e1');
select lives_ok(
  $$ update public.profiles set display_name = 'Asha',
       modes = '{friends,activities}', availability = '{weekends}' $$,
  'a Member can set their name, Modes and availability');
select results_eq(
  'select display_name::text, modes::text[], availability::text[] from public.profiles',
  $$ values ('Asha', '{friends,activities}'::text[], '{weekends}'::text[]) $$,
  'the Member sees what they saved');

select throws_ok($$ update public.profiles set status = 'banned' $$, '42501', null,
  'a Member cannot change their Account Status');
select throws_ok($$ update public.profiles set submitted_at = now() $$, '42501', null,
  'a Member cannot mark their profile submitted directly');

reset role;
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e2');
update public.profiles set display_name = 'Mallory';
reset role;
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000e1');
select is((select display_name::text from public.profiles), 'Asha',
  'another Member cannot change someone''s profile');

select * from finish();
rollback;
