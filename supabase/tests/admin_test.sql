begin;
\ir helpers/act_as.psql
select plan(4);

select pg_temp.act_as_member('00000000-0000-0000-0000-00000000000a');
select is(public.is_admin(), false, 'a Member is not an admin');

reset role;
select pg_temp.act_as_admin('00000000-0000-0000-0000-0000000000ad');
select is(public.is_admin(), true, 'a Member with the admin role claim is an admin');

reset role;
select pg_temp.act_as_member('00000000-0000-0000-0000-00000000000b', '{"role":"admin"}');
select is(public.is_admin(), false, 'a Member cannot become admin through their own user metadata');

reset role;
select pg_temp.act_as_anon();
select is(public.is_admin(), false, 'a signed-out visitor is not an admin');

select * from finish();
rollback;
