begin;
\ir helpers/act_as.psql
select plan(38);

-- How many of the owner's photos the media Edge Function may sign for the viewer.
create function pg_temp.seen(viewer uuid, owner uuid) returns integer
language plpgsql as $$
declare
  ids uuid[] := array(select id from public.photos where user_id = owner);
  n integer;
begin
  perform pg_temp.act_as_service();
  select count(*) into n from public.photo_links(viewer, ids);
  reset role;
  return n;
end;
$$;

-- 01 Asha (Friends, Kharadi, so the Baner Members below are beyond Discover range) has photos 1 and 2 live, 3 Auto-hidden and 4 taken down.
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003601');
insert into public.photos (user_id, object_key, position, uploaded_at, hidden_at, removed_at) values
  ('00000000-0000-0000-0000-000000003601', 'asha/3.jpg', 3, now(), now(), null),
  ('00000000-0000-0000-0000-000000003601', 'asha/4.jpg', 4, now(), null, now());
select pg_temp.place('00000000-0000-0000-0000-000000003601', 18.5515, 73.9348);
select id as asha_cover from public.photos
where user_id = '00000000-0000-0000-0000-000000003601' and position = 1 \gset

-- The owner.
select is(pg_temp.seen('00000000-0000-0000-0000-000000003601', '00000000-0000-0000-0000-000000003601'), 3,
  'the owner gets their confirmed photos, Auto-hidden included, but not one taken down');
select pg_temp.act_as_service();
select photo_id as asha_pending from public.start_photo_upload('00000000-0000-0000-0000-000000003601', 4::smallint) \gset
select is_empty(format($$ select 1 from public.photo_links('00000000-0000-0000-0000-000000003601', array[%L]::uuid[]) $$,
  :'asha_pending'), 'a pending upload gets no link, even for its owner');
reset role;

-- Discover and profile view: 02 lives near Asha; 03 is 16 km away in Baner.
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003602');
select pg_temp.place('00000000-0000-0000-0000-000000003602', 18.5515, 73.9348);
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003603', '{networking}');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003602', '00000000-0000-0000-0000-000000003601'), 2,
  'a Member who may see Asha in Discover gets her live photos, not the hidden or taken-down ones');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003603', '00000000-0000-0000-0000-000000003601'), 0,
  'a Member who cannot see Asha anywhere gets none of her photos');
-- A photo row never confirmed (written outside the upload flow) is not live.
insert into public.photos (user_id, object_key, position) values
  ('00000000-0000-0000-0000-000000003602', 'never-confirmed.jpg', 3);
select is(pg_temp.seen('00000000-0000-0000-0000-000000003602', '00000000-0000-0000-0000-000000003602'), 2,
  'a photo row that was never confirmed gets no link');
select pg_temp.act_as_service();
select results_eq(
  format($$ select photo_id, object_key from public.photo_links('00000000-0000-0000-0000-000000003602',
            array[%L, (select id from public.photos where user_id = '00000000-0000-0000-0000-000000003603' limit 1)]::uuid[]) $$,
         :'asha_cover'),
  format($$ values (%L::uuid, '00000000-0000-0000-0000-000000003601/1.jpg') $$, :'asha_cover'),
  'only the asked-for photos the viewer may see come back, with their object keys');
select is_empty($$ select 1 from public.photo_links('00000000-0000-0000-0000-0000000036ff',
                    array(select id from public.photos where user_id = '00000000-0000-0000-0000-000000003601')) $$,
  'someone who is not a Member gets nothing');
reset role;

-- Connections: 04 had one with Asha (now closed); Asha declined 05.
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003604', '{networking}');
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003605', '{networking}');
insert into public.connections (requester_id, addressee_id, mode, status, closed_at) values
  ('00000000-0000-0000-0000-000000003604', '00000000-0000-0000-0000-000000003601', 'friends', 'closed', now()),
  ('00000000-0000-0000-0000-000000003605', '00000000-0000-0000-0000-000000003601', 'friends', 'declined', null);
select is(pg_temp.seen('00000000-0000-0000-0000-000000003604', '00000000-0000-0000-0000-000000003601'), 2,
  'a Member with a Connection to Asha, even a closed one, gets her photos');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003601', '00000000-0000-0000-0000-000000003604'), 2,
  'and so does Asha theirs');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003605', '00000000-0000-0000-0000-000000003601'), 0,
  'a declined Connection Request does not count');
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003618', '{networking}');
insert into public.connections (requester_id, addressee_id, mode, status) values
  ('00000000-0000-0000-0000-000000003618', '00000000-0000-0000-0000-000000003601', 'friends', 'requested');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003601', '00000000-0000-0000-0000-000000003618'), 2,
  'a waiting Connection Request lets the recipient see the sender''s photos');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003618', '00000000-0000-0000-0000-000000003601'), 2,
  'and the sender the recipient''s');

-- A Paused Member leaves Discover but stays in their Connections' lists.
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003606');
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003607', '{networking}');
update public.profiles set paused_at = now() where id = '00000000-0000-0000-0000-000000003606';
insert into public.connections (requester_id, addressee_id, mode, status) values
  ('00000000-0000-0000-0000-000000003607', '00000000-0000-0000-0000-000000003606', 'friends', 'accepted');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003602', '00000000-0000-0000-0000-000000003606'), 0,
  'a Paused Member''s photos are not offered through Discover');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003607', '00000000-0000-0000-0000-000000003606'), 2,
  'a Paused Member''s Connection still gets their photos');

-- Blocks, either way, outweigh everything else.
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003608');
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003609');
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-000000003601', '00000000-0000-0000-0000-000000003608'),
  ('00000000-0000-0000-0000-000000003609', '00000000-0000-0000-0000-000000003601'),
  ('00000000-0000-0000-0000-000000003601', '00000000-0000-0000-0000-000000003604');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003608', '00000000-0000-0000-0000-000000003601'), 0,
  'a Member Asha blocked gets none of her photos');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003609', '00000000-0000-0000-0000-000000003601'), 0,
  'a Member who blocked Asha gets none of her photos');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003601', '00000000-0000-0000-0000-000000003604'), 0,
  'a Block outweighs a Connection');

-- Join Requests and Activities: Asha hosts one; 10 is waiting, 11 was declined, 12 and 13 are going.
-- 10 lives in Kharadi, beyond the Baner Members' Discover range.
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003610', '{networking}');
select pg_temp.place('00000000-0000-0000-0000-000000003610', 18.5515, 73.9348);
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003611', '{networking}');
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003612', '{activities}');
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003613', '{networking}');
insert into public.activities (id, host_id, title, type, area_id, starts_at, capacity) values
  ('00000000-0000-0000-0000-0000000036a1', '00000000-0000-0000-0000-000000003601', 'Badminton', 'sports', 'baner',
   now() + interval '1 day', 4);
insert into public.activity_requests (activity_id, requester_id, status) values
  ('00000000-0000-0000-0000-0000000036a1', '00000000-0000-0000-0000-000000003610', 'requested'),
  ('00000000-0000-0000-0000-0000000036a1', '00000000-0000-0000-0000-000000003611', 'declined'),
  ('00000000-0000-0000-0000-0000000036a1', '00000000-0000-0000-0000-000000003612', 'accepted'),
  ('00000000-0000-0000-0000-0000000036a1', '00000000-0000-0000-0000-000000003613', 'accepted');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003610', '00000000-0000-0000-0000-000000003601'), 2,
  'a Member waiting on a Join Request gets the host''s photos');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003601', '00000000-0000-0000-0000-000000003610'), 2,
  'the host gets the photos of a Member asking to join');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003612', '00000000-0000-0000-0000-000000003613'), 2,
  'two Members going to the same Activity get each other''s photos');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003612', '00000000-0000-0000-0000-000000003610'), 0,
  'a Member only waiting to join is not a fellow joiner');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003610', '00000000-0000-0000-0000-000000003612'), 0,
  'nor does a Member waiting to join see those going');
-- Join Requests stay as history once the Activity is cancelled or over.
update public.activities set status = 'cancelled' where id = '00000000-0000-0000-0000-0000000036a1';
select is(pg_temp.seen('00000000-0000-0000-0000-000000003610', '00000000-0000-0000-0000-000000003601'), 2,
  'a Join Request still counts after the Activity is cancelled');
-- Checked once the Activity is off the board, where everyone sees its host's photos (#134).
select is(pg_temp.seen('00000000-0000-0000-0000-000000003611', '00000000-0000-0000-0000-000000003601'), 0,
  'a declined Join Request does not count');
update public.activities set status = 'expired', starts_at = now() - interval '2 days'
where id = '00000000-0000-0000-0000-0000000036a1';
select is(pg_temp.seen('00000000-0000-0000-0000-000000003612', '00000000-0000-0000-0000-000000003613'), 2,
  'fellow joiners still count once the Activity is over');

-- Banned, Auto-hidden and deleted Members keep their Connections' history but lose their photos.
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003614', '{networking}');
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003615', '{networking}');
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003616', '{networking}');
update public.profiles set status = 'banned', banned_at = now() where id = '00000000-0000-0000-0000-000000003614';
update public.profiles set hidden_at = now() where id = '00000000-0000-0000-0000-000000003615';
update public.profiles set deleted_at = now() where id = '00000000-0000-0000-0000-000000003616';
insert into public.connections (requester_id, addressee_id, mode, status) values
  ('00000000-0000-0000-0000-000000003614', '00000000-0000-0000-0000-000000003601', 'friends', 'accepted'),
  ('00000000-0000-0000-0000-000000003615', '00000000-0000-0000-0000-000000003601', 'friends', 'accepted'),
  ('00000000-0000-0000-0000-000000003616', '00000000-0000-0000-0000-000000003601', 'friends', 'accepted');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003601', '00000000-0000-0000-0000-000000003614'), 0,
  'a banned Member''s photos get no links');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003601', '00000000-0000-0000-0000-000000003615'), 0,
  'an Auto-hidden Member''s photos get no links');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003601', '00000000-0000-0000-0000-000000003616'), 0,
  'a deleted Member''s photos get no links');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003614', '00000000-0000-0000-0000-000000003601'), 0,
  'a banned Member gets no links to others'' photos');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003614', '00000000-0000-0000-0000-000000003614'), 2,
  'a banned Member still gets their own photos');

-- Only the Edge Function (service role) runs it.
select pg_temp.act_as_member('00000000-0000-0000-0000-000000003602');
select throws_ok(format($$ select * from public.photo_links(auth.uid(), array[%L]::uuid[]) $$, :'asha_cover'),
  '42501', null, 'a Member cannot ask for photo keys directly');
reset role;
select pg_temp.act_as_anon();
select throws_ok(format($$ select * from public.photo_links('00000000-0000-0000-0000-000000003602', array[%L]::uuid[]) $$,
  :'asha_cover'), '42501', null, 'a signed-out visitor cannot ask for photo keys');

reset role;

-- 36c1 chose only Casual, in Kharadi beside Asha, who did not choose Casual.
select pg_temp.create_complete_member('00000000-0000-0000-0000-0000000036c1');
update public.profiles set modes = '{casual}', gender = 'man', pref_genders = '{woman}',
  pref_age_min = 18, pref_age_max = 60, pref_max_km = 50
where id = '00000000-0000-0000-0000-0000000036c1';
select pg_temp.place('00000000-0000-0000-0000-0000000036c1', 18.5515, 73.9348);
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000036c1');
select public.submit_profile();
reset role;
select is(pg_temp.seen('00000000-0000-0000-0000-000000003601', '00000000-0000-0000-0000-0000000036c1'), 2,
  'photos of a Casual-only Member are linked for a viewer who did not choose Casual');

-- A Circle shares photos: Asha and Baner Members beyond her Discover range. 36d1 is in her Circle,
-- 36d2 is in another Circle, 36d3 is in hers but paused.
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000036d1');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000036d2');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000036d3');
select pg_temp.act_as_admin('00000000-0000-0000-0000-0000000036ad');
select public.admin_create_circle('Trekkers', 'baner', (select id from public.tags where slug = 'trekking'),
  'A local circle.') as circle \gset
select public.admin_create_circle('Cyclists', 'baner', (select id from public.tags where slug = 'cycling'),
  'A local circle.') as other_circle \gset
reset role;
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000036d2');
select public.join_circle(:'other_circle');
select pg_temp.act_as_member('00000000-0000-0000-0000-000000003601');
select public.join_circle(:'circle');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000036d1');
select public.join_circle(:'circle');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000036d3');
select public.join_circle(:'circle');
select public.set_paused(true);
reset role;
select is(pg_temp.seen('00000000-0000-0000-0000-000000003601', '00000000-0000-0000-0000-0000000036d1'), 2,
  'a fellow Circle member''s photos are linked, even beyond Discover range');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003601', '00000000-0000-0000-0000-0000000036d2'), 0,
  'a member of another Circle, beyond Discover range, gets no links');
select is(pg_temp.seen('00000000-0000-0000-0000-000000003601', '00000000-0000-0000-0000-0000000036d3'), 0,
  'a paused fellow Circle member''s photos are not linked');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000036d1');
select public.block_user('00000000-0000-0000-0000-000000003601');
reset role;
select is(pg_temp.seen('00000000-0000-0000-0000-000000003601', '00000000-0000-0000-0000-0000000036d1'), 0,
  'a Block between fellow Circle members withholds the photos');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000036d3');
select public.set_paused(false);
select pg_temp.act_as_member('00000000-0000-0000-0000-000000003601');
select public.set_paused(true);
reset role;
select is(pg_temp.seen('00000000-0000-0000-0000-000000003601', '00000000-0000-0000-0000-0000000036d3'), 0,
  'a paused viewer gets no links to fellow Circle members');

select * from finish();
rollback;
