-- #202: an admin can see whether pushes can be sent at all, without reading the secrets.
begin;
\ir helpers/act_as.psql
select plan(5);

\set admin '00000000-0000-0000-0000-00000000f101'
\set asha '00000000-0000-0000-0000-00000000f102'
select pg_temp.create_account(:'admin');
select pg_temp.create_visible_member(:'asha');

select pg_temp.act_as_member(:'asha');
select lives_ok($$ select public.register_device_token('token-asha', 'android') $$,
  'a Member registers their device');
select is_empty($$ select 1 from public.push_health() $$,
  'a Member sees nothing of it');
reset role;

select pg_temp.act_as_admin(:'admin');
select results_eq($$ select vault_ready, devices, queued from public.push_health() $$,
  $$ values (false, 1, 0) $$,
  'an admin sees the device count and that Vault is not set up on a local database');
select ok((select oldest_queued_minutes = 0 from public.push_health()),
  'with nothing queued, nothing is old');
reset role;

select pg_temp.act_as_anon();
select throws_ok($$ select public.push_health() $$, '42501', null,
  'a signed-out visitor cannot ask');

select * from finish();
rollback;
