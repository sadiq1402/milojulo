begin;
\ir helpers/act_as.psql
select plan(33);

-- Is this Member in the signed-in Member's feed?
create function pg_temp.in_feed(member_id uuid) returns boolean
language sql as $$
  select exists (select 1 from public.discover_feed() where user_id = member_id);
$$;

select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000d1');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000d2');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000d3', '{networking}');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000d4');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d4');
select public.set_paused(true);
reset role;

-- Moderation and deletion are set directly until their functions exist.
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000d5');
update public.profiles set hidden_at = now() where id = '00000000-0000-0000-0000-0000000000d5';
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000d6');
update public.profiles set status = 'banned', banned_at = now()
where id = '00000000-0000-0000-0000-0000000000d6';
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000d7');
update public.profiles set deleted_at = now() where id = '00000000-0000-0000-0000-0000000000d7';
select pg_temp.create_complete_member('00000000-0000-0000-0000-0000000000d8');

-- d9 loses a photo to a Takedown and d10 to Auto-hide; d11 keeps 2 live of 3.
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000d9');
update public.photos set removed_at = now()
where user_id = '00000000-0000-0000-0000-0000000000d9' and position = 2;
select pg_temp.create_visible_member('00000000-0000-0000-0000-00000000d010');
insert into public.photos (user_id, object_key, position)
values ('00000000-0000-0000-0000-00000000d010', 'unconfirmed.jpg', 3);
update public.photos set hidden_at = now()
where user_id = '00000000-0000-0000-0000-00000000d010' and position = 1;
select pg_temp.create_visible_member('00000000-0000-0000-0000-00000000d011');
insert into public.photos (user_id, object_key, position, uploaded_at)
values ('00000000-0000-0000-0000-00000000d011', 'third.jpg', 3, now());
update public.photos set removed_at = now()
where user_id = '00000000-0000-0000-0000-00000000d011' and position = 1;

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');
select ok(pg_temp.in_feed('00000000-0000-0000-0000-0000000000d2'),
  'a Visible Member sees another Visible Member who shares a Mode');
select ok(not pg_temp.in_feed('00000000-0000-0000-0000-0000000000d1'),
  'a Member does not see themselves');
select ok(pg_temp.in_feed('00000000-0000-0000-0000-0000000000d3'),
  'a Member who shares no Mode appears too');
select ok(not pg_temp.in_feed('00000000-0000-0000-0000-0000000000d4'),
  'a Paused Member does not appear');
select ok(not pg_temp.in_feed('00000000-0000-0000-0000-0000000000d5'),
  'an Auto-hidden Member does not appear');
select ok(not pg_temp.in_feed('00000000-0000-0000-0000-0000000000d6'),
  'a Banned Member does not appear');
select ok(not pg_temp.in_feed('00000000-0000-0000-0000-0000000000d7'),
  'a deleted Member does not appear');
select ok(not pg_temp.in_feed('00000000-0000-0000-0000-0000000000d8'),
  'a Member who has not submitted their profile does not appear');
select ok(not pg_temp.in_feed('00000000-0000-0000-0000-0000000000d9'),
  'a Member left with 1 live photo after a Takedown does not appear');
select ok(not pg_temp.in_feed('00000000-0000-0000-0000-00000000d010'),
  'Auto-hidden and unconfirmed photos do not count as live');
select ok(pg_temp.in_feed('00000000-0000-0000-0000-00000000d011'),
  'a Member with 2 live photos left still appears');
reset role;

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d4');
select is_empty($$ select 1 from public.discover_feed() $$,
  'a Paused Member sees nobody');
reset role;
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d8');
select is_empty($$ select 1 from public.discover_feed() $$,
  'a Member who has not submitted their profile sees nobody');
reset role;

-- What a feed card shows. f1 views; f2 turns 25 today, f3 turns 25 tomorrow.
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000f1', '{friends,activities}');
update public.profiles set availability = '{weekends,weekday_evenings}'
where id = '00000000-0000-0000-0000-0000000000f1';
insert into public.profile_tags (user_id, tag_id)
select '00000000-0000-0000-0000-0000000000f1', id from public.tags where slug in ('badminton', 'cafes', 'books');

select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000f2', '{friends,networking}');
update public.profiles
set availability = '{weekends}', area_id = 'wakad',
    date_of_birth = (now() at time zone 'Asia/Kolkata')::date - interval '25 years'
where id = '00000000-0000-0000-0000-0000000000f2';
insert into public.profile_tags (user_id, tag_id)
select '00000000-0000-0000-0000-0000000000f2', id from public.tags where slug in ('cafes', 'badminton', 'cricket');
update public.photos set id = '00000000-0000-0000-0000-0000000f2001'
where user_id = '00000000-0000-0000-0000-0000000000f2' and position = 1;

-- f3's cover is Auto-hidden, so its next live photo stands in.
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000f3', '{activities}');
update public.profiles
set date_of_birth = (now() at time zone 'Asia/Kolkata')::date - interval '25 years' + interval '1 day'
where id = '00000000-0000-0000-0000-0000000000f3';
insert into public.photos (id, user_id, object_key, position, uploaded_at)
values ('00000000-0000-0000-0000-0000000f3003', '00000000-0000-0000-0000-0000000000f3', 'third.jpg', 3, now());
update public.photos set hidden_at = now()
where user_id = '00000000-0000-0000-0000-0000000000f3' and position = 1;
update public.photos set position = 4
where user_id = '00000000-0000-0000-0000-0000000000f3' and position = 2;

select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000f4');
update public.profiles set availability = '{weekends,weekday_evenings,early_mornings}'
where id = '00000000-0000-0000-0000-0000000000f4';
insert into public.profile_tags (user_id, tag_id)
select '00000000-0000-0000-0000-0000000000f4', id from public.tags where slug in ('books', 'cafes', 'badminton');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000f1');
select set_eq(
  $$ select jsonb_object_keys(to_jsonb(f)) from public.discover_feed() f $$,
  array['user_id', 'display_name', 'age', 'area_id', 'modes', 'their_modes', 'distance_band', 'cover_photo_id', 'shared_tag_ids',
        'why_you_match', 'cursor'],
  'a feed card carries only safe columns, never date of birth');
select is(
  (select row(display_name, age, area_id, modes)::text from public.discover_feed()
   where user_id = '00000000-0000-0000-0000-0000000000f2'),
  row('Test', 25, 'wakad', '{friends}'::public.mode[])::text,
  'a feed card shows name, age, Area and only the Modes both Members hold');
select is(
  (select age from public.discover_feed() where user_id = '00000000-0000-0000-0000-0000000000f3'),
  24, 'age counts only birthdays already reached');
select is(
  (select cover_photo_id from public.discover_feed() where user_id = '00000000-0000-0000-0000-0000000000f2'),
  '00000000-0000-0000-0000-0000000f2001'::uuid, 'the cover photo is the first live photo');
select is(
  (select cover_photo_id from public.discover_feed() where user_id = '00000000-0000-0000-0000-0000000000f3'),
  '00000000-0000-0000-0000-0000000f3003'::uuid, 'an Auto-hidden cover gives way to the next live photo');
select is(
  (select shared_tag_ids from public.discover_feed() where user_id = '00000000-0000-0000-0000-0000000000f2'),
  (select array_agg(id order by sort_order) from public.tags where slug in ('badminton', 'cafes')),
  'a feed card lists only the tags both Members picked');
select is(
  (select why_you_match from public.discover_feed() where user_id = '00000000-0000-0000-0000-0000000000f2'),
  'You both want friends, like badminton and cafes, and are free on weekends. About 5 km away.',
  'why-you-match names only the shared Modes, tags and availability');
select is(
  (select why_you_match from public.discover_feed() where user_id = '00000000-0000-0000-0000-0000000000f3'),
  'You both want activity partners. Less than 2 km away.',
  'why-you-match leaves out tags and availability when none are shared');
select is(
  (select why_you_match from public.discover_feed() where user_id = '00000000-0000-0000-0000-0000000000f4'),
  'You both want friends, like badminton and cafes, and are free on weekday evenings and weekends. Less than 2 km away.',
  'why-you-match names at most 2 shared tags');

select set_eq($$ select user_id from public.discover_feed('activities') $$,
  array['00000000-0000-0000-0000-0000000000f3'::uuid],
  'filtering by a Mode shows only Members who chose that Mode');
select ok(not exists (select 1 from public.discover_feed('friends')
                      where user_id = '00000000-0000-0000-0000-0000000000f3'),
  'filtering by a Mode hides Members who chose only another Mode');
select results_eq($$ select user_id from public.discover_feed() limit 2 $$,
  array['00000000-0000-0000-0000-0000000000f4'::uuid, '00000000-0000-0000-0000-0000000000f2'],
  'Members sharing more tags, availability and nearness come first');
select is((select count(*)::integer from public.discover_feed(null, 2)), 2,
  'a page holds at most the requested number of Members');
select results_eq(
  $$ select user_id from public.discover_feed(null, 4)
     union all
     select user_id from public.discover_feed(null, 4,
       (select cursor from public.discover_feed(null, 4) offset 3 limit 1)) $$,
  $$ select user_id from public.discover_feed(null, 50) $$,
  'the next page continues after the cursor with no gaps or repeats');
select is_empty(
  $$ select 1 from public.discover_feed(null, 50,
       (select cursor from public.discover_feed(null, 50)
        offset (select count(*) - 1 from public.discover_feed(null, 50)))) $$,
  'paging after the last Member returns nobody');

-- Helpers read other Members' rows, so only discover_feed and get_profile may call them.
select throws_ok($$ select public.is_visible('00000000-0000-0000-0000-0000000000f2') $$, '42501', null,
  'a Member cannot ask whether someone is visible');
select throws_ok(
  $$ select public.eligible_modes('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f3') $$,
  '42501', null, 'a Member cannot read the Modes of another pair');
select throws_ok(
  $$ select * from public.shared_tags('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f3') $$,
  '42501', null, 'a Member cannot read the shared tags of another pair');
select throws_ok(
  $$ select public.match_reason('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f3') $$,
  '42501', null, 'a Member cannot read why another pair matches');
reset role;

select pg_temp.act_as_anon();
select throws_ok($$ select * from public.discover_feed() $$, '42501', null,
  'a signed-out visitor cannot read the feed');
reset role;

select * from finish();
rollback;
