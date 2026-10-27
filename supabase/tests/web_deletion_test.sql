-- #98: the web deletion page signs a person in and calls delete_account(), with an optional reason.
begin;
\ir helpers/act_as.psql
select plan(12);

\set new_acct '00000000-0000-0000-0000-0000000098a1'
\set member '00000000-0000-0000-0000-0000000098a2'
\set other '00000000-0000-0000-0000-0000000098a3'
\set admin '00000000-0000-0000-0000-0000000098ad'
select pg_temp.create_account(:'new_acct');
select pg_temp.create_visible_member(:'member');
select pg_temp.create_visible_member(:'other');
select pg_temp.create_account(:'admin');

-- An account that signed up but never accepted the terms can still delete itself.
select pg_temp.act_as_member(:'new_acct');
select lives_ok($$ select public.delete_account() $$, 'an account with no profile can delete itself');
reset role;
select ok((select deleted_at is not null from public.profiles where id = :'new_acct'),
  'and it is marked deleted, so the purge picks it up');
select is((select count(*)::int from public.data_requests where user_id = :'new_acct' and kind = 'erasure'), 1,
  'with one erasure request');

-- A Member deletes with a reason and a note.
select pg_temp.act_as_member(:'member');
select lives_ok($$ select public.delete_account('no_one_nearby', '  Nobody in my town yet  ') $$,
  'a Member can give a reason when deleting');
reset role;
select results_eq($$ select reason, note from public.deletion_reasons $$,
  $$ values ('no_one_nearby', 'Nobody in my town yet'::varchar) $$,
  'the reason and the trimmed note are kept');
select hasnt_column('public', 'deletion_reasons', 'user_id', 'a reason names nobody');
select is((select count(*)::int from public.member_locations where user_id = :'member'), 0,
  'the location point goes at once');

select pg_temp.act_as_member(:'member');
select throws_ok($$ select public.delete_account() $$, 'P0001', 'your account is already being deleted',
  'deleting twice is refused');
reset role;

select pg_temp.act_as_member(:'other');
select throws_ok($$ select public.delete_account('bored') $$, '23514', null,
  'a reason outside the list is refused');
select is_empty($$ select * from public.deletion_reasons $$, 'a Member cannot read the reasons');
reset role;

select pg_temp.act_as_admin(:'admin');
select is((select count(*)::int from public.deletion_reasons), 1, 'an admin can read the reasons');
reset role;

select pg_temp.act_as_anon();
select throws_ok($$ select public.delete_account() $$, '42501', null, 'a signed-out visitor cannot delete anything');

select * from finish();
rollback;
