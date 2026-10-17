begin;
\ir helpers/act_as.psql
select plan(3);

-- 01 hosts; 02 reads the board; 03 asks to join one Activity 02 has not.
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000004301');
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000004302');
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000004303');

insert into public.activities (id, host_id, title, type, area_id, starts_at, capacity) values
  ('00000000-0000-0000-0000-0000000043a1', '00000000-0000-0000-0000-000000004301', 'waiting', 'sports', 'baner', now() + interval '1 day', 4),
  ('00000000-0000-0000-0000-0000000043a2', '00000000-0000-0000-0000-000000004301', 'going', 'sports', 'baner', now() + interval '1 day', 4),
  ('00000000-0000-0000-0000-0000000043a3', '00000000-0000-0000-0000-000000004301', 'declined', 'sports', 'baner', now() + interval '1 day', 4),
  ('00000000-0000-0000-0000-0000000043a4', '00000000-0000-0000-0000-000000004301', 'only 03 asked', 'sports', 'baner', now() + interval '1 day', 4),
  ('00000000-0000-0000-0000-0000000043a5', '00000000-0000-0000-0000-000000004301', 'not asked', 'sports', 'baner', now() + interval '1 day', 4);
insert into public.activity_requests (activity_id, requester_id, status) values
  ('00000000-0000-0000-0000-0000000043a1', '00000000-0000-0000-0000-000000004302', 'requested'),
  ('00000000-0000-0000-0000-0000000043a2', '00000000-0000-0000-0000-000000004302', 'accepted'),
  ('00000000-0000-0000-0000-0000000043a3', '00000000-0000-0000-0000-000000004302', 'declined'),
  ('00000000-0000-0000-0000-0000000043a4', '00000000-0000-0000-0000-000000004303', 'requested');

select pg_temp.act_as_member('00000000-0000-0000-0000-000000004302');
select is_empty(
  $$ select 1 from public.activity_board() where title in ('waiting', 'going', 'declined') $$,
  'Activities I already asked to join leave the board (they live on Joined)');
select results_eq(
  $$ select title::text from public.activity_board() where host_id = '00000000-0000-0000-0000-000000004301' order by title $$,
  $$ values ('not asked'), ('only 03 asked') $$,
  'Activities I have not asked to join stay, whoever else asked');
reset role;

select pg_temp.act_as_member('00000000-0000-0000-0000-000000004303');
select ok(exists (select 1 from public.activity_board() where title = 'waiting'),
  'another Member still sees an Activity I asked to join');
reset role;

select * from finish();
rollback;
