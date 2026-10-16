begin;
\ir helpers/act_as.psql
select plan(10);

-- A visible Member with Dating Preferences, aged 30 in Baner. Run as postgres.
create function pg_temp.create_dater(member_id uuid, member_modes public.mode[], member_gender public.gender,
  wants public.gender[]) returns void
language plpgsql as $$
begin
  perform pg_temp.create_complete_member(member_id);
  update public.profiles
  set area_id = 'baner', modes = member_modes, gender = member_gender, pref_genders = wants,
      pref_age_min = 25, pref_age_max = 35, pref_max_km = 10,
      date_of_birth = (now() at time zone 'Asia/Kolkata')::date - make_interval(years => 30)
  where id = member_id;
  perform pg_temp.act_as_member(member_id);
  perform public.submit_profile();
  reset role;
end;
$$;

-- f1 views; f2 to f4 each chose one Mode; f5 chose only Casual, which f1 did not but f6 did.
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000f1', '{friends,activities,networking}');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000f2', '{friends}');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000f3', '{activities}');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000f4', '{networking}');
select pg_temp.create_dater('00000000-0000-0000-0000-0000000000f5', '{casual}', 'woman', '{man}');
select pg_temp.create_dater('00000000-0000-0000-0000-0000000000f6', '{friends,casual}', 'man', '{woman}');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000f1');
select set_eq($$ select user_id from public.discover_feed('{friends}') $$,
  array['00000000-0000-0000-0000-0000000000f2'::uuid, '00000000-0000-0000-0000-0000000000f6'],
  'one Mode keeps only Members who chose it, Casual choosers included under their other Modes');
select set_eq($$ select user_id from public.discover_feed('{friends,activities}') $$,
  array['00000000-0000-0000-0000-0000000000f2'::uuid, '00000000-0000-0000-0000-0000000000f3',
        '00000000-0000-0000-0000-0000000000f6'],
  'several Modes keep Members who chose any of them');
select ok(not exists (select 1 from public.discover_feed('{friends,activities}')
                      where user_id = '00000000-0000-0000-0000-0000000000f4'),
  'several Modes leave out a Member who chose none of them');
select set_eq($$ select user_id from public.discover_feed('{}') $$,
  $$ select user_id from public.discover_feed(null) $$,
  'an empty list is the same as no filter');
select ok(exists (select 1 from public.discover_feed('{}')
                  where user_id = '00000000-0000-0000-0000-0000000000f4'),
  'an empty list keeps every Mode');
select is_empty($$ select 1 from public.discover_feed('{casual}') $$,
  'Casual shows nobody to a Member who did not choose Casual');
select set_eq($$ select user_id from public.discover_feed('{casual,friends}') $$,
  array['00000000-0000-0000-0000-0000000000f2'::uuid, '00000000-0000-0000-0000-0000000000f6'],
  'Casual in a list adds nobody for a Member who did not choose it');
select results_eq(
  $$ select count(*)::integer from public.discover_feed('{friends,activities}', 1)
     union all
     select count(*)::integer from public.discover_feed('{friends,activities}', 1,
       (select cursor from public.discover_feed('{friends,activities}', 1))) $$,
  $$ values (1), (1) $$,
  'with several Modes, each page comes back full');
reset role;

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000f6');
select set_eq($$ select user_id from public.discover_feed('{casual}') $$,
  array['00000000-0000-0000-0000-0000000000f5'::uuid],
  'Casual shows Casual choosers to a Member who chose Casual');
select set_eq($$ select user_id from public.discover_feed('{casual,friends}') $$,
  array['00000000-0000-0000-0000-0000000000f1'::uuid, '00000000-0000-0000-0000-0000000000f2',
        '00000000-0000-0000-0000-0000000000f5'],
  'Casual in a list adds Casual choosers for a Member who chose it');
reset role;

select * from finish();
rollback;
