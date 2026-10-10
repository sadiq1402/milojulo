begin;
\ir helpers/act_as.psql
select plan(19);

-- c1 blocks c2; c3 stands apart. All share Friends.
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000c1');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000c2');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000c3');

create function pg_temp.feed_ids() returns setof uuid
language sql as $$
  select user_id from public.discover_feed();
$$;

create function pg_temp.sees_profile(member_id uuid) returns boolean
language sql as $$
  select exists (select 1 from public.get_profile(member_id));
$$;

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select public.block_user('00000000-0000-0000-0000-0000000000c2');
select set_eq('select pg_temp.feed_ids()', array['00000000-0000-0000-0000-0000000000c3']::uuid[],
  'the blocker no longer sees the blocked Member in Discover');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c2');
select set_eq('select pg_temp.feed_ids()', array['00000000-0000-0000-0000-0000000000c3']::uuid[],
  'the blocked Member no longer sees the blocker in Discover');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c3');
select set_eq('select pg_temp.feed_ids()',
  array['00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2']::uuid[],
  'a Block hides no one from anyone else');
select ok(pg_temp.sees_profile('00000000-0000-0000-0000-0000000000c1'),
  'a Block hides neither profile from anyone else');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select ok(not pg_temp.sees_profile('00000000-0000-0000-0000-0000000000c2'),
  'the blocker cannot view the blocked Member''s profile');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c2');
select ok(not pg_temp.sees_profile('00000000-0000-0000-0000-0000000000c1'),
  'the blocked Member cannot view the blocker''s profile');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select results_eq('select blocked_id from public.blocks',
  array['00000000-0000-0000-0000-0000000000c2']::uuid[], 'a Member lists their own Blocks');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c2');
select is_empty('select * from public.blocks', 'the blocked Member cannot see the Block');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c3');
select is_empty('select * from public.blocks', 'no one else can see the Block');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c2');
delete from public.blocks;
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select isnt_empty('select * from public.blocks', 'the blocked Member cannot remove the Block');

delete from public.blocks where blocked_id = '00000000-0000-0000-0000-0000000000c2';
select set_eq('select pg_temp.feed_ids()',
  array['00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3']::uuid[],
  'after unblocking, the blocker sees the Member again');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c2');
select ok(pg_temp.sees_profile('00000000-0000-0000-0000-0000000000c1'),
  'after unblocking, the Member sees the blocker again');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c3');
select throws_ok($$ insert into public.blocks (blocker_id, blocked_id)
                    values ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c1') $$,
  '42501', null, 'a Block cannot be inserted directly');
select public.block_user('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$ update public.blocks set blocked_id = '00000000-0000-0000-0000-0000000000c2' $$,
  '42501', null, 'a Block cannot be edited');
select lives_ok($$ select public.block_user('00000000-0000-0000-0000-0000000000c1') $$,
  'blocking the same Member twice is harmless');
select throws_ok($$ select public.block_user('00000000-0000-0000-0000-0000000000c3') $$,
  '23514', null, 'a Member cannot block themselves');

-- Two Blocks on one pair: lifting one leaves the other standing.
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select public.block_user('00000000-0000-0000-0000-0000000000c3');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c3');
delete from public.blocks;
select ok(not pg_temp.sees_profile('00000000-0000-0000-0000-0000000000c1'),
  'unblocking does not lift the other Member''s Block');
select throws_ok($$ select public.is_blocked('00000000-0000-0000-0000-0000000000c1',
                                             '00000000-0000-0000-0000-0000000000c2') $$, '42501', null,
  'a Member cannot ask whether any two Members have a Block');

select pg_temp.act_as_anon();
select throws_ok($$ select public.block_user('00000000-0000-0000-0000-0000000000c1') $$, '42501', null,
  'a signed-out visitor cannot block');

select * from finish();
rollback;
