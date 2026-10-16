begin;
\ir helpers/act_as.psql
select plan(13);

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

-- Whether the signed-in Member may send a request under this Mode; the request is undone either way.
create function pg_temp.can_request(member_id uuid, under public.mode) returns boolean
language plpgsql as $$
begin
  begin
    perform public.send_request(member_id, under);
    raise exception 'undo';
  exception
    when others then
      if sqlerrm = 'undo' then return true; end if;
      if sqlerrm = 'that mode is not open between you' then return false; end if;
      raise;
  end;
end;
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
-- Anywhere in Pune, so only the Dating Preferences decide.
update public.profiles set discover_range_km = null where id = auth.uid();
select ok(pg_temp.can_request('00000000-0000-0000-0000-0000000000a2', 'dating'),
  'two Members who fit each other''s Dating Preferences may request each other in Dating');
select ok(not pg_temp.can_request('00000000-0000-0000-0000-0000000000a3', 'dating'),
  'a Member may not request someone whose preferred genders exclude them');
select ok(not pg_temp.can_request('00000000-0000-0000-0000-0000000000a4', 'dating'),
  'a Member may not request someone outside their own preferred genders');
select ok(not pg_temp.can_request('00000000-0000-0000-0000-0000000000a5', 'dating'),
  'a Member may not request someone outside their own age range');
select ok(not pg_temp.can_request('00000000-0000-0000-0000-0000000000a6', 'dating'),
  'a Member may not request someone whose age range excludes them');
select ok(pg_temp.can_request('00000000-0000-0000-0000-0000000000a7', 'dating'),
  'age ranges include both ends for requests');
select ok(not pg_temp.can_request('00000000-0000-0000-0000-0000000000a8', 'dating'),
  'a Member may not request someone beyond their own max distance');
select ok(not pg_temp.can_request('00000000-0000-0000-0000-0000000000a9', 'dating'),
  'a Member may not request someone whose max distance they are beyond');
select ok(pg_temp.can_request('00000000-0000-0000-0000-00000000a010', 'dating'),
  'Members within each other''s max distance may request each other');
reset role;

-- c2 is outside c1's preferred genders but shares Friends; c3 fits c1 in Casual.
select pg_temp.create_dater('00000000-0000-0000-0000-0000000000c1', '{friends,casual}', 'woman', '{man}');
select pg_temp.create_dater('00000000-0000-0000-0000-0000000000c2', '{friends,casual}', 'woman', '{man}');
select pg_temp.create_dater('00000000-0000-0000-0000-0000000000c3', '{friends,casual}', 'man', '{woman}');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select is((select their_modes from public.discover_feed() where user_id = '00000000-0000-0000-0000-0000000000c2'),
  '{friends,casual}'::public.mode[], 'Discover shows every Mode, whatever the Dating Preferences');
select ok(not pg_temp.can_request('00000000-0000-0000-0000-0000000000c2', 'casual'),
  'a Casual request is refused outside the Dating Preferences');
select ok(pg_temp.can_request('00000000-0000-0000-0000-0000000000c2', 'friends'),
  'a non-dating request still goes outside the Dating Preferences');
select ok(pg_temp.can_request('00000000-0000-0000-0000-0000000000c3', 'casual'),
  'a Casual request goes when both chose Casual and the preferences fit');
reset role;

select * from finish();
rollback;
