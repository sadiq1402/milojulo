begin;
\ir helpers/act_as.psql
select plan(16);

-- v1 views v2, whose photos at positions 2 and 3 are Auto-hidden and taken down.
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000a1', '{friends,activities}');
update public.profiles set availability = '{weekends}', discover_range_km = 25 where id = '00000000-0000-0000-0000-0000000000a1';
insert into public.profile_tags (user_id, tag_id)
select '00000000-0000-0000-0000-0000000000a1', id from public.tags where slug = 'trekking';

select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000a2', '{friends,networking}');
update public.profiles
set display_name = 'Asha', area_id = 'kharadi', availability = '{weekends,early_mornings}',
    date_of_birth = (now() at time zone 'Asia/Kolkata')::date - interval '30 years'
where id = '00000000-0000-0000-0000-0000000000a2';
update public.profile_prompts set answer = 'Trek at dawn, misal after'
where user_id = '00000000-0000-0000-0000-0000000000a2' and position = 1;
insert into public.profile_tags (user_id, tag_id)
select '00000000-0000-0000-0000-0000000000a2', id from public.tags where slug in ('yoga', 'trekking');
update public.photos set id = '00000000-0000-0000-0000-0000000a2001'
where user_id = '00000000-0000-0000-0000-0000000000a2' and position = 1;
update public.photos set id = '00000000-0000-0000-0000-0000000a2002', hidden_at = now()
where user_id = '00000000-0000-0000-0000-0000000000a2' and position = 2;
insert into public.photos (id, user_id, object_key, position, uploaded_at, removed_at) values
  ('00000000-0000-0000-0000-0000000a2003', '00000000-0000-0000-0000-0000000000a2', 'p3.jpg', 3, now(), now()),
  ('00000000-0000-0000-0000-0000000a2004', '00000000-0000-0000-0000-0000000000a2', 'p4.jpg', 4, now(), null);

-- a3 has an unconfirmed upload; a4 to a10 each break one visibility rule. Run as postgres.
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000a3');
insert into public.photos (user_id, object_key, position)
values ('00000000-0000-0000-0000-0000000000a3', 'pending.jpg', 3);
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000a4');
update public.profiles set paused_at = now() where id = '00000000-0000-0000-0000-0000000000a4';
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000a5');
update public.profiles set hidden_at = now() where id = '00000000-0000-0000-0000-0000000000a5';
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000a6');
update public.profiles set status = 'banned', banned_at = now() where id = '00000000-0000-0000-0000-0000000000a6';
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000a7');
update public.profiles set deleted_at = now() where id = '00000000-0000-0000-0000-0000000000a7';
select pg_temp.create_complete_member('00000000-0000-0000-0000-0000000000a8');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000a9');
update public.photos set removed_at = now()
where user_id = '00000000-0000-0000-0000-0000000000a9' and position = 1;
-- a010 is about 30 km away, beyond a1's 25 km range.
select pg_temp.create_visible_member('00000000-0000-0000-0000-00000000a010');
select pg_temp.act_as_member('00000000-0000-0000-0000-00000000a010');
select public.set_location(18.45, 74.04);
reset role;

create function pg_temp.sees(member_id uuid) returns boolean
language sql as $$
  select exists (select 1 from public.get_profile(member_id));
$$;

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a1');
select is(
  (select row(display_name, age, area_id, modes, why_you_match)::text
   from public.get_profile('00000000-0000-0000-0000-0000000000a2')),
  row('Asha', 30, 'kharadi', '{friends}'::public.mode[],
      'About 16 km away. You both want friends, like trekking, and are free on weekends.')::text,
  'a profile shows name, age, Area, shared Modes and why-you-match');
select set_eq(
  $$ select jsonb_object_keys(to_jsonb(p)) from public.get_profile('00000000-0000-0000-0000-0000000000a2') p $$,
  array['user_id', 'display_name', 'age', 'area_id', 'modes', 'their_modes', 'distance_band', 'why_you_match', 'photo_ids', 'prompts',
        'tag_ids', 'availability'],
  'a profile carries only safe columns, never date of birth');
select is(
  (select photo_ids from public.get_profile('00000000-0000-0000-0000-0000000000a2')),
  array['00000000-0000-0000-0000-0000000a2001', '00000000-0000-0000-0000-0000000a2004']::uuid[],
  'a profile lists every live photo in order, without Auto-hidden or taken-down ones');
select is(
  (select prompts from public.get_profile('00000000-0000-0000-0000-0000000000a2')),
  jsonb_build_array(
    jsonb_build_object('position', 1, 'question_id', (select min(id) from public.prompt_questions),
                       'answer', 'Trek at dawn, misal after'),
    jsonb_build_object('position', 2, 'question_id', (select min(id) from public.prompt_questions),
                       'answer', 'An answer')),
  'a profile shows both prompts in order');
select is(
  (select tag_ids from public.get_profile('00000000-0000-0000-0000-0000000000a2')),
  (select array_agg(id order by sort_order) from public.tags where slug in ('trekking', 'yoga')),
  'a profile shows all the Member''s tags, not only shared ones');
select is(
  (select availability from public.get_profile('00000000-0000-0000-0000-0000000000a2')),
  '{weekends,early_mornings}'::public.availability_slot[],
  'a profile shows the Member''s availability');
select is(
  (select cardinality(photo_ids) from public.get_profile('00000000-0000-0000-0000-0000000000a3')),
  2, 'a profile leaves out photos whose upload is not confirmed');

select ok(not pg_temp.sees('00000000-0000-0000-0000-0000000000a4'), 'a Paused Member''s profile cannot be opened');
select ok(not pg_temp.sees('00000000-0000-0000-0000-0000000000a5'), 'an Auto-hidden Member''s profile cannot be opened');
select ok(not pg_temp.sees('00000000-0000-0000-0000-0000000000a6'), 'a Banned Member''s profile cannot be opened');
select ok(not pg_temp.sees('00000000-0000-0000-0000-0000000000a7'), 'a deleted Member''s profile cannot be opened');
select ok(not pg_temp.sees('00000000-0000-0000-0000-0000000000a8'), 'an unsubmitted profile cannot be opened');
select ok(not pg_temp.sees('00000000-0000-0000-0000-0000000000a9'),
  'a profile with fewer than 2 live photos cannot be opened');
select ok(not pg_temp.sees('00000000-0000-0000-0000-00000000a010'),
  'the profile of someone beyond the viewer''s range cannot be opened');
reset role;

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a4');
select ok(not pg_temp.sees('00000000-0000-0000-0000-0000000000a2'), 'a Paused Member cannot open profiles');
reset role;

select pg_temp.act_as_anon();
select throws_ok($$ select * from public.get_profile('00000000-0000-0000-0000-0000000000a2') $$, '42501', null,
  'a signed-out visitor cannot open a profile');
reset role;

select * from finish();
rollback;
