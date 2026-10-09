begin;
\ir helpers/act_as.psql
select plan(9);

select pg_temp.create_complete_member('00000000-0000-0000-0000-0000000000a1');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a1');
select lives_ok('select public.submit_profile()', 'a Member whose profile meets the minimum can submit it');
select isnt_empty('select 1 from public.profiles where submitted_at is not null',
  'the submitted profile is live at once, with no approval step');
reset role;

-- Each Member below is complete except for one thing.
select pg_temp.create_complete_member('00000000-0000-0000-0000-0000000000a2');
update public.photos set uploaded_at = null
where user_id = '00000000-0000-0000-0000-0000000000a2' and position = 2;
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a2');
select throws_ok('select public.submit_profile()', 'P0001', 'add at least 2 photos',
  'an unconfirmed upload does not count towards the photo minimum');
reset role;

select pg_temp.create_complete_member('00000000-0000-0000-0000-0000000000a3');
update public.photos set removed_at = now()
where user_id = '00000000-0000-0000-0000-0000000000a3' and position = 2;
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a3');
select throws_ok('select public.submit_profile()', 'P0001', 'add at least 2 photos',
  'a taken-down photo does not count towards the photo minimum');
reset role;

select pg_temp.create_complete_member('00000000-0000-0000-0000-0000000000a4');
delete from public.profile_prompts where user_id = '00000000-0000-0000-0000-0000000000a4' and position = 2;
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a4');
select throws_ok('select public.submit_profile()', 'P0001', 'answer 2 prompts',
  'submission is refused with fewer than 2 prompts');
reset role;

select pg_temp.create_complete_member('00000000-0000-0000-0000-0000000000a5');
update public.profiles set modes = '{}' where id = '00000000-0000-0000-0000-0000000000a5';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a5');
select throws_ok('select public.submit_profile()', 'P0001', 'choose at least one mode',
  'submission is refused without a Mode');
reset role;

select pg_temp.create_complete_member('00000000-0000-0000-0000-0000000000a6');
update public.profiles set area_id = null where id = '00000000-0000-0000-0000-0000000000a6';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a6');
select throws_ok('select public.submit_profile()', 'P0001', 'choose your area',
  'submission is refused without an Area');
reset role;

select pg_temp.create_complete_member('00000000-0000-0000-0000-0000000000a7');
update public.profiles set display_name = null where id = '00000000-0000-0000-0000-0000000000a7';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a7');
select throws_ok('select public.submit_profile()', 'P0001', 'add your first name',
  'submission is refused without a name');
reset role;

select pg_temp.create_complete_member('00000000-0000-0000-0000-0000000000a8');
update public.profiles set date_of_birth = null where id = '00000000-0000-0000-0000-0000000000a8';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a8');
select throws_ok('select public.submit_profile()', 'P0001', 'accept the terms first',
  'submission is refused until the age gate and consents are passed');

select * from finish();
rollback;
