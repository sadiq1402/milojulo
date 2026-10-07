begin;
\ir helpers/act_as.psql
select plan(8);

insert into public.invite_codes (code, uses_left) values ('ONE-LEFT', 1), ('PLENTY', 50);
select pg_temp.create_account('00000000-0000-0000-0000-0000000000a1');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.redeem_invite('ONE-LEFT') $$, 'a signed-in person can redeem a live code');
select results_eq(
  'select id from public.profiles',
  $$ values ('00000000-0000-0000-0000-0000000000a1'::uuid) $$,
  'redeeming creates the Member''s own profile');

select is_empty('select code from public.invite_redemptions', 'a Member cannot read redemption records, even their own');
select is(public.check_invite('ONE-LEFT'), false, 'redeeming uses up the code''s last use');
select throws_ok($$ select public.redeem_invite('PLENTY') $$, 'P0001', 'invite already redeemed',
  'a Member cannot redeem a second code');
reset role;
select pg_temp.create_account('00000000-0000-0000-0000-0000000000a2');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a2');
select throws_ok($$ select public.redeem_invite('REVIEWER') $$, 'P0001', 'invite code is not valid',
  'the reserved REVIEWER code cannot be redeemed from the app');
select throws_ok($$ select public.redeem_invite('NOPE') $$, 'P0001', 'invite code is not valid',
  'an invalid code cannot be redeemed');

reset role;
select pg_temp.act_as_anon();
select throws_ok($$ select public.redeem_invite('PLENTY') $$, '42501', null,
  'a signed-out visitor cannot redeem a code');

select * from finish();
rollback;
