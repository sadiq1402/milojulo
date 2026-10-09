begin;
\ir helpers/act_as.psql
select plan(6);

select pg_temp.create_complete_member('00000000-0000-0000-0000-0000000000d1');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
select public.submit_profile();

select public.set_paused(true);
select results_eq('select paused_at is not null, status::text from public.profiles',
  $$ values (true, 'active') $$, 'pausing sets the pause and leaves the Account Status active');
select public.set_paused(false);
select results_eq('select paused_at is null from public.profiles',
  $$ values (true) $$, 'unpausing clears the pause');

select throws_ok($$ update public.profiles set paused_at = now() $$, '42501', null,
  'a Member cannot write the pause column directly');

reset role;
update public.profiles set status = 'banned' where id = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
select public.set_paused(true);
select public.set_paused(false);
select is((select status::text from public.profiles), 'banned',
  'pausing and unpausing cannot lift a ban');

reset role;
select pg_temp.create_member('00000000-0000-0000-0000-0000000000d2');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d2');
select public.set_paused(true);
reset role;
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
select is((select paused_at from public.profiles), null,
  'pausing affects only the caller''s own profile');

reset role;
select pg_temp.act_as_anon();
select throws_ok('select public.set_paused(true)', '42501', null, 'a signed-out visitor cannot pause');

select * from finish();
rollback;
