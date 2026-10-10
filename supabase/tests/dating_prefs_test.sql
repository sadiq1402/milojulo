begin;
\ir helpers/act_as.psql
select plan(14);

-- A visible Member holding the given Modes and Dating Preferences. Run as postgres.
create function pg_temp.create_dater(
  member_id uuid, member_modes public.mode[], member_gender public.gender,
  wants public.gender[], age_min integer default 25, age_max integer default 35,
  max_km integer default 10, member_age integer default 30, member_area text default 'baner'
) returns void
language plpgsql as $$
begin
  perform pg_temp.create_complete_member(member_id);
  update public.profiles
  set area_id = member_area, modes = member_modes, gender = member_gender, pref_genders = wants,
      pref_age_min = age_min, pref_age_max = age_max, pref_max_km = max_km,
      date_of_birth = (now() at time zone 'Asia/Kolkata')::date - make_interval(years => member_age)
  where id = member_id;
  perform pg_temp.act_as_member(member_id);
  perform public.submit_profile();
  reset role;
end;
$$;

-- The Modes the signed-in Member sees this Member under in Discover; null when absent.
create function pg_temp.feed_modes(member_id uuid) returns public.mode[]
language sql as $$
  select modes from public.discover_feed() where user_id = member_id;
$$;

select pg_temp.create_dater('00000000-0000-0000-0000-0000000000a1', '{dating}', 'woman', '{man}');
select pg_temp.create_dater('00000000-0000-0000-0000-0000000000a2', '{dating}', 'man', '{woman}');
-- a3 fits a1's genders, but a1 does not fit a3's.
select pg_temp.create_dater('00000000-0000-0000-0000-0000000000a3', '{dating}', 'man', '{man}');
-- a4 wants women, but a1 wants men.
select pg_temp.create_dater('00000000-0000-0000-0000-0000000000a4', '{dating}', 'woman', '{woman}');
-- a5 at 36 is past a1's range; a1 at 30 is below a6's; a7 at 35 sits on both edges.
select pg_temp.create_dater('00000000-0000-0000-0000-0000000000a5', '{dating}', 'man', '{woman}',
  25, 45, member_age => 36);
select pg_temp.create_dater('00000000-0000-0000-0000-0000000000a6', '{dating}', 'man', '{woman}', 31, 40);
select pg_temp.create_dater('00000000-0000-0000-0000-0000000000a7', '{dating}', 'man', '{woman}',
  30, 30, member_age => 35);
-- Centroids: Baner to Kharadi is about 15.7 km, Baner to Wakad about 5.2 km.
select pg_temp.create_dater('00000000-0000-0000-0000-0000000000a8', '{dating}', 'man', '{woman}',
  max_km => 50, member_area => 'kharadi');
select pg_temp.create_dater('00000000-0000-0000-0000-0000000000a9', '{dating}', 'man', '{woman}',
  max_km => 5, member_area => 'wakad');
select pg_temp.create_dater('00000000-0000-0000-0000-00000000a010', '{dating}', 'man', '{woman}',
  max_km => 6, member_area => 'wakad');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000a1');
select is(pg_temp.feed_modes('00000000-0000-0000-0000-0000000000a2'), '{dating}'::public.mode[],
  'two Members who fit each other''s Dating Preferences see each other in Dating');
select is(pg_temp.feed_modes('00000000-0000-0000-0000-0000000000a3'), null,
  'a Member does not see someone whose preferred genders exclude them');
select is(pg_temp.feed_modes('00000000-0000-0000-0000-0000000000a4'), null,
  'a Member does not see someone outside their own preferred genders');
select is(pg_temp.feed_modes('00000000-0000-0000-0000-0000000000a5'), null,
  'a Member does not see someone outside their own age range');
select is(pg_temp.feed_modes('00000000-0000-0000-0000-0000000000a6'), null,
  'a Member does not see someone whose age range excludes them');
select is(pg_temp.feed_modes('00000000-0000-0000-0000-0000000000a7'), '{dating}'::public.mode[],
  'age ranges include both ends');
select is(pg_temp.feed_modes('00000000-0000-0000-0000-0000000000a8'), null,
  'a Member does not see someone beyond their own max distance');
select is(pg_temp.feed_modes('00000000-0000-0000-0000-0000000000a9'), null,
  'a Member does not see someone whose max distance they are beyond');
select is(pg_temp.feed_modes('00000000-0000-0000-0000-00000000a010'), '{dating}'::public.mode[],
  'Members within each other''s max distance see each other');
reset role;

-- c2 is outside c1's preferred genders but shares Friends; c3 fits c1 in Casual.
select pg_temp.create_dater('00000000-0000-0000-0000-0000000000c1', '{friends,casual}', 'woman', '{man}');
select pg_temp.create_dater('00000000-0000-0000-0000-0000000000c2', '{friends,casual}', 'woman', '{man}');
select pg_temp.create_dater('00000000-0000-0000-0000-0000000000c3', '{friends,casual}', 'man', '{woman}');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select is(pg_temp.feed_modes('00000000-0000-0000-0000-0000000000c2'), '{friends}'::public.mode[],
  'a Member outside someone''s Dating Preferences still appears under a shared non-dating Mode');
select is(pg_temp.feed_modes('00000000-0000-0000-0000-0000000000c3'), '{friends,casual}'::public.mode[],
  'a Member who fits shows under both the shared non-dating and Dating Modes');
select is_empty(
  $$ select 1 from public.discover_feed('casual') where user_id = '00000000-0000-0000-0000-0000000000c2' $$,
  'the Casual feed leaves out Members outside the Dating Preferences');
select is(
  (select row(modes, why_you_match)::text from public.get_profile('00000000-0000-0000-0000-0000000000c2')),
  row('{friends}'::public.mode[], 'You both want friends.')::text,
  'the profile view shows only Eligible Modes, and so does why-you-match');
select is(
  (select why_you_match from public.get_profile('00000000-0000-0000-0000-0000000000c3')),
  'You both want friends and something casual.',
  'why-you-match names a Dating Mode the pair is eligible for');
reset role;

select * from finish();
rollback;
