begin;
\ir helpers/act_as.psql
select plan(8);

-- 01 hosts; 02 is the Member whose Joined screen we read; 03 is someone else asking to join.
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000004201');
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000004202');
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000004203');

-- Open Activities by 01 (and one by 02), named by what 02's request to them is.
insert into public.activities (id, host_id, title, type, area_id, starts_at, capacity) values
  ('00000000-0000-0000-0000-0000000042a1', '00000000-0000-0000-0000-000000004201', 'going soon', 'sports', 'baner', now() + interval '1 day', 4),
  ('00000000-0000-0000-0000-0000000042a2', '00000000-0000-0000-0000-000000004201', 'going later', 'sports', 'baner', now() + interval '3 days', 4),
  ('00000000-0000-0000-0000-0000000042a3', '00000000-0000-0000-0000-000000004201', 'waiting', 'sports', 'baner', now() + interval '2 days', 4),
  ('00000000-0000-0000-0000-0000000042a4', '00000000-0000-0000-0000-000000004201', 'declined', 'sports', 'baner', now() + interval '2 days', 4),
  ('00000000-0000-0000-0000-0000000042a5', '00000000-0000-0000-0000-000000004201', 'cancelled', 'sports', 'baner', now() + interval '2 days', 4),
  ('00000000-0000-0000-0000-0000000042a6', '00000000-0000-0000-0000-000000004202', 'hosted by 02', 'sports', 'baner', now() + interval '2 days', 4),
  ('00000000-0000-0000-0000-0000000042a7', '00000000-0000-0000-0000-000000004201', 'only 03 asked', 'sports', 'baner', now() + interval '2 days', 4);
insert into public.activity_requests (activity_id, requester_id, status) values
  ('00000000-0000-0000-0000-0000000042a1', '00000000-0000-0000-0000-000000004202', 'accepted'),
  ('00000000-0000-0000-0000-0000000042a2', '00000000-0000-0000-0000-000000004202', 'accepted'),
  ('00000000-0000-0000-0000-0000000042a3', '00000000-0000-0000-0000-000000004202', 'requested'),
  ('00000000-0000-0000-0000-0000000042a4', '00000000-0000-0000-0000-000000004202', 'declined'),
  ('00000000-0000-0000-0000-0000000042a5', '00000000-0000-0000-0000-000000004202', 'accepted'),
  ('00000000-0000-0000-0000-0000000042a6', '00000000-0000-0000-0000-000000004203', 'accepted'),
  ('00000000-0000-0000-0000-0000000042a7', '00000000-0000-0000-0000-000000004203', 'requested');
update public.activities set status = 'cancelled' where id = '00000000-0000-0000-0000-0000000042a5';

select id as host_cover from public.photos
where user_id = '00000000-0000-0000-0000-000000004201' and position = 1 \gset
select pg_temp.act_as_member('00000000-0000-0000-0000-000000004202');
select results_eq(
  $$ select title::text, request_status::text from public.joined_activities() $$,
  $$ values ('going soon', 'accepted'), ('waiting', 'requested'), ('going later', 'accepted') $$,
  'Activities I am going to and waiting on come back, soonest first, with my request''s status');
select is((select host_photo_id from public.joined_activities() limit 1), :'host_cover'::uuid,
  'each comes with its host''s cover photo');
select is_empty($$ select 1 from public.joined_activities() where title = 'declined' $$,
  'a declined Join Request is left out');
select is_empty($$ select 1 from public.joined_activities() where title = 'cancelled' $$,
  'a cancelled Activity is left out');
select is_empty($$ select 1 from public.joined_activities() where title = 'hosted by 02' $$,
  'my own hosted Activities are left out');
select is_empty($$ select 1 from public.joined_activities() where title = 'only 03 asked' $$,
  'another Member''s Join Requests are left out');
reset role;

-- A Block hides the host's Activities from my Joined screen.
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-000000004202', '00000000-0000-0000-0000-000000004201');
select pg_temp.act_as_member('00000000-0000-0000-0000-000000004202');
select is_empty($$ select 1 from public.joined_activities() $$,
  'Activities of a host I blocked are left out');
reset role;

select pg_temp.act_as_anon();
select throws_ok($$ select * from public.joined_activities() $$, '42501', null,
  'a signed-out visitor cannot read it');
reset role;

select * from finish();
rollback;
