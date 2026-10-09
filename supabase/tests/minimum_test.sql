begin;
\ir helpers/act_as.psql
select plan(13);

select pg_temp.create_complete_member('00000000-0000-0000-0000-0000000000c1');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select public.submit_profile();

select throws_ok($$ delete from public.photos where position = 1 $$, 'P0001', 'add at least 2 photos',
  'a submitted Member cannot delete below 2 live photos');
select throws_ok($$ delete from public.profile_prompts where position = 1 $$, 'P0001', 'answer 2 prompts',
  'a submitted Member cannot delete a prompt');
select throws_ok($$ update public.profiles set modes = '{}' $$, 'P0001', 'choose at least one mode',
  'a submitted Member cannot drop their last Mode');
select throws_ok($$ update public.profiles set area_id = null $$, 'P0001', 'choose your area',
  'a submitted Member cannot clear their Area');
select throws_ok($$ update public.profiles set display_name = null $$, 'P0001', 'add your first name',
  'a submitted Member cannot clear their name');

select lives_ok(
  $$ update public.profile_prompts set question_id = (select max(id) from public.prompt_questions),
       answer = 'Something new' where position = 1 $$,
  'a submitted Member can replace a prompt');
select lives_ok($$ update public.profiles set modes = '{activities}' $$,
  'a submitted Member can swap one Mode for another');

-- Replacing a photo: upload the new one, then delete the old.
reset role;
select pg_temp.act_as_service();
insert into public.photos (id, user_id, object_key, position) values
  ('00000000-0000-0000-0000-00000000c103', '00000000-0000-0000-0000-0000000000c1', 'c1/new.jpg', 3);
reset role;
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$ delete from public.photos where position = 1 $$, 'P0001', 'add at least 2 photos',
  'an unconfirmed upload cannot stand in for a live photo');
reset role;
select pg_temp.act_as_service();
select public.confirm_photo_upload('00000000-0000-0000-0000-00000000c103');
reset role;
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select lives_ok($$ delete from public.photos where position = 1 $$,
  'a submitted Member can replace a photo once the new one is live');

-- An admin Takedown may leave the Member below the minimum; they can still tidy up and edit.
reset role;
update public.photos set removed_at = now()
where user_id = '00000000-0000-0000-0000-0000000000c1' and position = 2;
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select lives_ok($$ delete from public.photos where position = 2 $$,
  'a Member can delete a photo that was taken down');
select lives_ok($$ update public.profiles set display_name = 'Asha' $$,
  'a Member below the photo minimum after a Takedown can still edit their profile');

reset role;
select pg_temp.create_complete_member('00000000-0000-0000-0000-0000000000c2');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c2');
select lives_ok($$ delete from public.profile_prompts where position = 2 $$,
  'before submission a Member can delete freely');

reset role;
select lives_ok($$ delete from auth.users where id = '00000000-0000-0000-0000-0000000000c1' $$,
  'deleting a submitted Member''s account removes everything they own');

select * from finish();
rollback;
