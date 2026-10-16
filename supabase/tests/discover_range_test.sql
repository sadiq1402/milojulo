begin;
\ir helpers/act_as.psql
select plan(43);

create function pg_temp.m(suffix text) returns uuid
language sql immutable as $$ select ('00000000-0000-0000-0000-0000000103' || suffix)::uuid $$;

-- Sets the Member's location as the app would. Run as postgres; leaves the role reset.
create function pg_temp.locate(member uuid, lat double precision, lng double precision) returns void
language plpgsql as $$
begin
  perform pg_temp.act_as_member(member);
  perform public.set_location(lat, lng);
  reset role;
end;
$$;

-- A visible Member with a name, Modes and optional Dating Preferences. Run as postgres.
create function pg_temp.member(member uuid, name text, member_modes public.mode[],
  member_gender public.gender default null, wants public.gender[] default null) returns void
language plpgsql as $$
begin
  perform pg_temp.create_complete_member(member);
  update public.profiles
  set display_name = name, modes = member_modes, gender = member_gender, pref_genders = wants,
      pref_age_min = case when wants is not null then 18 end, pref_age_max = case when wants is not null then 60 end,
      pref_max_km = case when wants is not null then 50 end
  where id = member;
  perform pg_temp.act_as_member(member);
  perform public.submit_profile();
  reset role;
end;
$$;

-- As if every recent location update were two hours old. Run as postgres.
create function pg_temp.hours_ago_all() returns void
language sql as $$ update public.member_locations set updated_at = now() - interval '2 hours' where updated_at > now() - interval '1 hour' $$;

create function pg_temp.in_feed(member uuid, filter public.mode default null) returns boolean
language sql as $$ select exists (select 1 from public.discover_feed(array_remove(array[filter], null), 50) where user_id = member) $$;

create function pg_temp.card(member uuid) returns record
language sql as $$
  select row(f.modes, f.their_modes, f.distance_band, f.why_you_match)
  from public.discover_feed(null, 50) f where f.user_id = member;
$$;

-- v01 views from Baner's centre with the default 10 km range.
select pg_temp.member(pg_temp.m('01'), 'Vik', '{friends}');
select pg_temp.locate(pg_temp.m('01'), 18.5590, 73.7868);
-- m02 about 3.5 km north; m03 about 16 km east (Kharadi); m04 shares no Mode and has no location.
select pg_temp.member(pg_temp.m('02'), 'Asha', '{friends}');
select pg_temp.locate(pg_temp.m('02'), 18.5905, 73.7868);
select pg_temp.member(pg_temp.m('03'), 'Kiran', '{friends}');
select pg_temp.locate(pg_temp.m('03'), 18.5515, 73.9348);
select pg_temp.member(pg_temp.m('04'), 'Ravi', '{networking}');
-- m05 chose Friends and Casual; m06 chose them too.
select pg_temp.member(pg_temp.m('05'), 'Meera', '{friends,casual}', 'woman', '{man}');
select pg_temp.member(pg_temp.m('06'), 'Dev', '{friends,casual}', 'man', '{woman}');
-- m13 chose only Casual; m14 chose only Dating, fitting m06's Dating Preferences but not m01's (none).
select pg_temp.member(pg_temp.m('13'), 'Kabir', '{casual}', 'man', '{woman}');
select pg_temp.member(pg_temp.m('14'), 'Tara', '{dating}', 'woman', '{man}');
-- m07's last location (Kharadi) is 8 days old, so their Baner Area centre stands in.
select pg_temp.member(pg_temp.m('07'), 'Sana', '{friends}');
select pg_temp.locate(pg_temp.m('07'), 18.5515, 73.9348);
update public.member_locations set updated_at = now() - interval '8 days' where user_id = pg_temp.m('07');

-- Range: one-way, from the viewer's saved range
select pg_temp.act_as_member(pg_temp.m('01'));
select ok(pg_temp.in_feed(pg_temp.m('02')), 'a Member inside the viewer''s range appears');
select ok(not pg_temp.in_feed(pg_temp.m('03')), 'a Member beyond the viewer''s range does not appear');
select ok(pg_temp.in_feed(pg_temp.m('07')), 'a location older than 7 days is ignored for the Area centre');
select pg_temp.act_as_member(pg_temp.m('03'));
select ok(not pg_temp.in_feed(pg_temp.m('01')), 'the far Member does not see the viewer either at 10 km');
update public.profiles set discover_range_km = 25 where id = auth.uid();
select ok(pg_temp.in_feed(pg_temp.m('01')), 'a wider range brings the far Member in, whatever the other''s range');
select pg_temp.act_as_member(pg_temp.m('01'));
select ok(not pg_temp.in_feed(pg_temp.m('03')), 'the range is one-way: the other''s wider range changes nothing for me');
update public.profiles set discover_range_km = null where id = auth.uid();
select ok(pg_temp.in_feed(pg_temp.m('03')), 'anywhere in the region shows a Member across Pune');
update public.profiles set discover_range_km = 10 where id = auth.uid();

-- No Mode rules: everyone in range appears
select ok(pg_temp.in_feed(pg_temp.m('04')), 'a Member who shares no Mode appears');
select ok(pg_temp.in_feed(pg_temp.m('05')), 'a Member who chose Casual and Friends appears to someone who did not choose Casual');
select ok(pg_temp.in_feed(pg_temp.m('13')), 'a Member who chose only Casual appears to someone who did not');
select ok(pg_temp.in_feed(pg_temp.m('14')), 'a Member who chose only Dating appears though Dating Preferences do not fit');
select pg_temp.act_as_member(pg_temp.m('06'));
select ok(pg_temp.in_feed(pg_temp.m('05')), 'a Member who chose Casual appears to another Casual Member');

-- Modes filter
select pg_temp.act_as_member(pg_temp.m('01'));
select set_eq($$ select user_id from public.discover_feed('{networking}', 50) $$, array[pg_temp.m('04')],
  'the Modes filter keeps only Members who chose that Mode');
select ok(not pg_temp.in_feed(pg_temp.m('04'), 'friends'), 'the Modes filter leaves out Members without it');
select set_eq($$ select user_id from public.discover_feed('{casual}', 50) $$,
  array[pg_temp.m('05'), pg_temp.m('06'), pg_temp.m('13')],
  'a Member who did not choose Casual finds Casual choosers under the Casual filter');

-- What the card says
select is(pg_temp.card(pg_temp.m('04'))::text,
  row('{}'::public.mode[], '{networking}'::public.mode[], '<2 km', 'Less than 2 km away. They''re here for Networking.')::text,
  'with no shared Mode, the card names the other Member''s Mode and the distance');
select matches((select distance_band from public.discover_feed(null, 50) where user_id = pg_temp.m('02')),
  '^~[345] km$', 'distance shows as a rounded band');
select matches((select why_you_match from public.discover_feed(null, 50) where user_id = pg_temp.m('02')),
  '^About [345] km away\. You both want friends\.$', 'why-you-match mentions the distance');
select set_eq($$ select jsonb_object_keys(to_jsonb(f)) from public.discover_feed() f $$,
  array['user_id', 'display_name', 'age', 'area_id', 'modes', 'their_modes', 'distance_band', 'cover_photo_id',
        'shared_tag_ids', 'why_you_match', 'cursor'],
  'a card carries a distance band, never coordinates');
select pg_temp.act_as_member(pg_temp.m('06'));
select is((select their_modes from public.discover_feed(null, 50) where user_id = pg_temp.m('05')),
  '{friends,casual}'::public.mode[], 'a Casual Member sees another''s Casual Mode');
select pg_temp.act_as_member(pg_temp.m('01'));
select is((select their_modes from public.discover_feed(null, 50) where user_id = pg_temp.m('06')),
  '{friends,casual}'::public.mode[], 'a Casual Member''s card shows all their Modes to everyone');
select pg_temp.act_as_member(pg_temp.m('14'));
select is((select their_modes from public.discover_feed(null, 50) where user_id = pg_temp.m('06')),
  '{friends,casual}'::public.mode[], 'a Dating viewer sees a Casual Member''s Modes too');
select pg_temp.act_as_member(pg_temp.m('01'));

-- Distance ranks: nearer first when nothing else differs (m08 about 8 km, m09 at the Area centre)
reset role;
select pg_temp.member(pg_temp.m('08'), 'Far', '{activities}');
select pg_temp.locate(pg_temp.m('08'), 18.6310, 73.7868);
select pg_temp.member(pg_temp.m('09'), 'Near', '{activities}');
select pg_temp.act_as_member(pg_temp.m('01'));
select ok((select array_position(array_agg(user_id), pg_temp.m('09')) < array_position(array_agg(user_id), pg_temp.m('08'))
           from public.discover_feed(null, 50)),
  'a nearer Member ranks before a farther one');

-- Requests keep Dating's two-way check, with the other Member's range: d10 about 6 km from d11 and d12
reset role;
select pg_temp.member(pg_temp.m('10'), 'Riya', '{dating}', 'woman', '{man}');
update public.profiles set discover_range_km = 25 where id = pg_temp.m('10');
select pg_temp.member(pg_temp.m('11'), 'Arjun', '{dating}', 'man', '{woman}');
update public.profiles set discover_range_km = 2 where id = pg_temp.m('11');
select pg_temp.locate(pg_temp.m('11'), 18.6130, 73.7868);
select pg_temp.member(pg_temp.m('12'), 'Neel', '{dating}', 'man', '{woman}');
select pg_temp.locate(pg_temp.m('12'), 18.6130, 73.7868);
select pg_temp.act_as_member(pg_temp.m('10'));
select ok(pg_temp.in_feed(pg_temp.m('11'), 'dating'), 'a dater sees someone whose range leaves them out');
select throws_ok(format('select public.send_request(%L, %L)', pg_temp.m('11'), 'dating'),
  'P0001', 'that mode is not open between you', 'but cannot request Dating from someone whose range leaves them out');
select lives_ok(format('select public.send_request(%L, %L)', pg_temp.m('12'), 'dating'),
  'a dater can request Dating from someone whose range includes them');

-- get_profile follows the feed
select pg_temp.act_as_member(pg_temp.m('01'));
select ok(exists (select 1 from public.get_profile(pg_temp.m('04'))), 'a profile opens with no shared Mode');
select is((select modes from public.get_profile(pg_temp.m('13'))), '{}'::public.mode[],
  'a Casual-only Member''s profile opens for someone who did not choose Casual, sharing no Mode');
select is((select request_modes from public.get_profile(pg_temp.m('05'))), '{friends}'::public.mode[],
  'the profile lists only the Modes the viewer may request under');
select pg_temp.act_as_member(pg_temp.m('06'));
select is((select request_modes from public.get_profile(pg_temp.m('05'))), '{friends,casual}'::public.mode[],
  'Casual is requestable between two Casual choosers whose preferences fit');
select pg_temp.act_as_member(pg_temp.m('01'));
select ok(not exists (select 1 from public.get_profile(pg_temp.m('03'))), 'a profile beyond the range does not open');
select is((select distance_band from public.get_profile(pg_temp.m('04'))), '<2 km', 'a profile shows the distance band');

-- Photo links follow the feed (what the media function signs)
reset role;
create temp table m04_photos as select id from public.photos where user_id = pg_temp.m('04');
create temp table m03_photos as select id from public.photos where user_id = pg_temp.m('03');
grant select on m04_photos, m03_photos to service_role;
select pg_temp.act_as_service();
select isnt_empty($$ select 1 from public.photo_links(pg_temp.m('01'), array(select id from m04_photos)) $$,
  'photos of a Member who shares no Mode can be signed for the viewer');
select is_empty($$ select 1 from public.photo_links(pg_temp.m('01'), array(select id from m03_photos)) $$,
  'photos of a Member beyond the range cannot');
reset role;
select pg_temp.act_as_member(pg_temp.m('01'));

-- Service regions
select throws_ok($$ select 1 from public.service_regions $$, '42501', null, 'a Member cannot read service regions');
select is(public.in_service_region(), true, 'a Member in Pune is inside a service region');
reset role;
select pg_temp.hours_ago_all();
select pg_temp.act_as_member(pg_temp.m('02'));
select throws_ok($$ select public.set_location(19.0760, 72.8777) $$, 'P0001', 'MiloJulo isn''t in your city yet',
  'a point outside every active region is refused');
reset role;
insert into public.service_regions (name, min_lat, max_lat, min_lng, max_lng) values ('Mumbai', 18.85, 19.30, 72.75, 73.10);
select pg_temp.act_as_member(pg_temp.m('02'));
select lives_ok($$ select public.set_location(19.0760, 72.8777) $$, 'a new active region is a row, not a migration');
select pg_temp.act_as_member(pg_temp.m('01'));
update public.profiles set discover_range_km = null where id = auth.uid();
select ok(not pg_temp.in_feed(pg_temp.m('02')), 'anywhere in the region leaves out Members in another region');
reset role;
update public.service_regions set active = false where name = 'Mumbai';
select pg_temp.act_as_member(pg_temp.m('02'));
select is(public.in_service_region(), false, 'a Member whose point lies in no active region is told so');
select pg_temp.act_as_member(pg_temp.m('03'));
select throws_ok($$ select public.set_location(19.0760, 72.8777) $$, 'P0001', 'MiloJulo isn''t in your city yet',
  'an inactive region refuses locations');
select throws_ok($$ insert into public.service_regions (name, min_lat, max_lat, min_lng, max_lng) values ('X', 0, 1, 0, 1) $$,
  '42501', null, 'a Member cannot add a service region');
select pg_temp.act_as_anon();
select throws_ok($$ select public.in_service_region() $$, '42501', null, 'a signed-out visitor cannot ask');

select * from finish();
rollback;
