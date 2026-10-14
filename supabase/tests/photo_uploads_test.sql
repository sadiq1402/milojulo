begin;
\ir helpers/act_as.psql
select plan(40);

-- 01 Asha has a Submitted Profile with photos at positions 1 and 2; 02 has no profile yet; 03 is banned; 04 is
-- another Member.
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003501');
select pg_temp.create_account('00000000-0000-0000-0000-000000003502');
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003503');
update public.profiles set status = 'banned', banned_at = now() where id = '00000000-0000-0000-0000-000000003503';
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003504');
select id as asha_cover, object_key as asha_cover_key from public.photos
where user_id = '00000000-0000-0000-0000-000000003501' and position = 1 \gset

-- Upload slots: what the media Edge Function asks for before handing out an upload link.
select pg_temp.act_as_service();
select photo_id as slot_3, upload_key as slot_3_upload, object_key as slot_3_key, discarded_keys as slot_3_discarded
from public.start_photo_upload('00000000-0000-0000-0000-000000003501', 3::smallint) \gset
select is(:'slot_3_key'::text, '00000000-0000-0000-0000-000000003501/' || :'slot_3' || '.jpg',
  'an upload slot''s object key is <member id>/<photo id>.jpg');
select is(:'slot_3_upload'::text, 'uploads/' || :'slot_3_key',
  'the file is uploaded to a staging key, uploads/<member id>/<photo id>.jpg, never the live key');
select is(:'slot_3_discarded'::text, '{}'::text, 'a first slot discards nothing');
select is((select upload_key from public.pending_photo_upload('00000000-0000-0000-0000-000000003501', :'slot_3')), :'slot_3_upload'::text,
  'the Member''s pending upload gives its staging key');
select is((select object_key from public.pending_photo_upload('00000000-0000-0000-0000-000000003501', :'slot_3')),
  :'slot_3_key'::text, 'and the live key the file is copied to');
select is((select upload_key from public.pending_photo_upload('00000000-0000-0000-0000-000000003503', :'slot_3')), null::text,
  'another Member''s upload is not theirs to confirm');
select throws_ok($$ select * from public.start_photo_upload('00000000-0000-0000-0000-000000003502', 1::smallint) $$,
  'P0001', 'accept the terms first', 'someone without a profile cannot upload photos');
select throws_ok($$ select * from public.start_photo_upload('00000000-0000-0000-0000-000000003503', 1::smallint) $$,
  'P0001', 'your account cannot add photos', 'a banned Member cannot upload photos');
select throws_ok($$ select * from public.start_photo_upload('00000000-0000-0000-0000-000000003501', 5::smallint) $$,
  'P0001', 'choose a photo position from 1 to 4', 'there are only 4 photo positions');
select throws_ok($$ select * from public.start_photo_upload('00000000-0000-0000-0000-000000003501', null) $$,
  'P0001', 'choose a photo position from 1 to 4', 'a position is required');

-- A second slot for the same position replaces the first; other positions are left alone.
select photo_id as slot_4 from public.start_photo_upload('00000000-0000-0000-0000-000000003501', 4::smallint) \gset
select photo_id as slot_3b, discarded_keys as slot_3b_discarded
from public.start_photo_upload('00000000-0000-0000-0000-000000003501', 3::smallint) \gset
select is(:'slot_3b_discarded'::text, format('{%s}', :'slot_3_upload'),
  'a new slot for the same position discards the earlier one and returns its key');
select is((select upload_key from public.pending_photo_upload('00000000-0000-0000-0000-000000003501', :'slot_3')), null::text,
  'the discarded slot can no longer be confirmed');
select isnt((select upload_key from public.pending_photo_upload('00000000-0000-0000-0000-000000003501', :'slot_4')), null::text,
  'a slot for another position stays pending');

-- Slots left for more than an hour are discarded when the next one is made.
reset role;
update public.photo_uploads set created_at = now() - interval '61 minutes' where id = :'slot_4';
select pg_temp.act_as_service();
select is((select upload_key from public.pending_photo_upload('00000000-0000-0000-0000-000000003501', :'slot_4')), null::text,
  'a slot older than an hour can no longer be confirmed');
select is((select discarded_keys::text from public.start_photo_upload('00000000-0000-0000-0000-000000003501', 1::smallint)),
  format('{uploads/00000000-0000-0000-0000-000000003501/%s.jpg}', :'slot_4'),
  'a slot older than an hour is discarded when the next slot is made');

-- A pending upload is upload state only: not a photo, and Members never read the slots.
reset role;
select pg_temp.act_as_member('00000000-0000-0000-0000-000000003501');
select is((select count(*)::int from public.photos), 2, 'a pending upload is not one of the Member''s photos');
select throws_ok($$ select * from public.photo_uploads $$, '42501', null, 'Members cannot read upload slots');

-- Confirming: the slot becomes the photo at its position.
reset role;
select pg_temp.act_as_service();
select is(public.confirm_photo_upload('00000000-0000-0000-0000-000000003501', :'slot_3b'), null::text,
  'confirming into an empty position replaces nothing');
reset role;
select pg_temp.act_as_member('00000000-0000-0000-0000-000000003501');
select results_eq(
  format($$ select position, uploaded_at is not null from public.photos where id = %L $$, :'slot_3b'),
  $$ values (3::smallint, true) $$,
  'a confirmed upload is a live photo at its position, under the slot''s id');
reset role;
select pg_temp.act_as_service();
select throws_ok(format($$ select public.confirm_photo_upload('00000000-0000-0000-0000-000000003501', %L) $$, :'slot_3b'),
  'P0001', 'no photo upload to confirm', 'an upload is confirmed only once');
select photo_id as slot_4b from public.start_photo_upload('00000000-0000-0000-0000-000000003501', 4::smallint) \gset
select throws_ok(format($$ select public.confirm_photo_upload('00000000-0000-0000-0000-000000003504', %L) $$, :'slot_4b'),
  'P0001', 'no photo upload to confirm', 'a Member cannot confirm another Member''s upload');
reset role;
update public.photo_uploads set created_at = now() - interval '61 minutes' where id = :'slot_4b';
select pg_temp.act_as_service();
select throws_ok(format($$ select public.confirm_photo_upload('00000000-0000-0000-0000-000000003501', %L) $$, :'slot_4b'),
  'P0001', 'no photo upload to confirm', 'a slot older than an hour cannot be confirmed');

-- Replacing the cover of a Submitted Profile with exactly 2 live photos keeps the minimum.
reset role;
delete from public.photos where user_id = '00000000-0000-0000-0000-000000003501' and position = 3;
select pg_temp.act_as_service();
select photo_id as new_cover from public.start_photo_upload('00000000-0000-0000-0000-000000003501', 1::smallint) \gset
select is(public.confirm_photo_upload('00000000-0000-0000-0000-000000003501', :'new_cover'), :'asha_cover_key'::text,
  'confirming over a photo returns the replaced object key, so its file can be deleted');
reset role;
select pg_temp.act_as_member('00000000-0000-0000-0000-000000003501');
select results_eq('select id from public.photos order by position',
  format($$ select unnest(array[%L, (select id from public.photos where position = 2)]::uuid[]) $$, :'new_cover'),
  'the new photo takes the position and the old one is gone');

-- A Member banned after asking for a slot cannot confirm it.
reset role;
update public.profiles set status = 'active', banned_at = null where id = '00000000-0000-0000-0000-000000003503';
select pg_temp.act_as_service();
select photo_id as banned_slot from public.start_photo_upload('00000000-0000-0000-0000-000000003503', 3::smallint) \gset
reset role;
update public.profiles set status = 'banned', banned_at = now() where id = '00000000-0000-0000-0000-000000003503';
select pg_temp.act_as_service();
select throws_ok(format($$ select public.confirm_photo_upload('00000000-0000-0000-0000-000000003503', %L) $$, :'banned_slot'),
  'P0001', 'your account cannot add photos', 'a banned Member cannot confirm an upload');

-- A photo an admin took down is replaced, but its file is kept as evidence.
reset role;
update public.photos set removed_at = now()
where user_id = '00000000-0000-0000-0000-000000003501' and position = 2;
select pg_temp.act_as_service();
select photo_id as over_removed from public.start_photo_upload('00000000-0000-0000-0000-000000003501', 2::smallint) \gset
select is(public.confirm_photo_upload('00000000-0000-0000-0000-000000003501', :'over_removed'), null::text,
  'replacing a photo that was taken down does not hand back its key, so its file is kept');

-- Deleting a photo through the media function: 01 now has 2 live photos (1 and 2) on a Submitted Profile.
select photo_id as third from public.start_photo_upload('00000000-0000-0000-0000-000000003501', 3::smallint) \gset
select public.confirm_photo_upload('00000000-0000-0000-0000-000000003501', :'third');
select is(public.delete_photo('00000000-0000-0000-0000-000000003501', :'third'),
  '00000000-0000-0000-0000-000000003501/' || :'third' || '.jpg',
  'a Member deletes their own photo and gets its key back, so its file can be deleted');
select throws_ok(format($$ select public.delete_photo('00000000-0000-0000-0000-000000003501', %L) $$, :'new_cover'),
  'P0001', 'add at least 2 photos', 'deleting keeps a Submitted Profile''s minimum');
select throws_ok(format($$ select public.delete_photo('00000000-0000-0000-0000-000000003504', %L) $$, :'new_cover'),
  'P0001', 'no photo to delete', 'a Member cannot delete another Member''s photo');
select throws_ok(format($$ select public.delete_photo('00000000-0000-0000-0000-000000003501', %L) $$, :'third'),
  'P0001', 'no photo to delete', 'a photo already deleted cannot be deleted again');
select throws_ok(format($$ select public.delete_photo('00000000-0000-0000-0000-000000003501', %L) $$, :'slot_4b'),
  'P0001', 'no photo to delete', 'a pending upload is not a photo to delete');
reset role;
update public.photos set removed_at = now(), position = 4
where user_id = '00000000-0000-0000-0000-000000003501' and position = 2;
insert into public.photos (user_id, object_key, position, uploaded_at)
values ('00000000-0000-0000-0000-000000003501', 'asha/extra.jpg', 2, now());
select id as taken_down from public.photos where user_id = '00000000-0000-0000-0000-000000003501' and position = 4 \gset
select pg_temp.act_as_service();
select is(public.delete_photo('00000000-0000-0000-0000-000000003501', :'taken_down'), null::text,
  'deleting a photo that was taken down keeps its file as evidence');

-- Only the Edge Function (service role) runs these.
reset role;
select pg_temp.act_as_member('00000000-0000-0000-0000-000000003501');
select throws_ok($$ select * from public.start_photo_upload(auth.uid(), 3::smallint) $$, '42501', null::text,
  'a Member cannot make upload slots directly');
select throws_ok(format($$ select public.confirm_photo_upload(auth.uid(), %L) $$, :'slot_4'), '42501', null::text,
  'a Member cannot confirm their own upload');
select throws_ok(format($$ select public.pending_photo_upload(auth.uid(), %L) $$, :'slot_4'), '42501', null::text,
  'a Member cannot look up upload slots');
select throws_ok(format($$ select public.delete_photo(auth.uid(), %L) $$, :'new_cover'), '42501', null::text,
  'a Member cannot call the photo delete function directly');
reset role;
select pg_temp.act_as_anon();
select throws_ok($$ select * from public.start_photo_upload('00000000-0000-0000-0000-000000003501', 3::smallint) $$,
  '42501', null, 'a signed-out visitor cannot make upload slots');
select throws_ok(format($$ select public.confirm_photo_upload('00000000-0000-0000-0000-000000003501', %L) $$, :'slot_4'),
  '42501', null, 'a signed-out visitor cannot confirm uploads');
select throws_ok(format($$ select public.pending_photo_upload('00000000-0000-0000-0000-000000003501', %L) $$, :'slot_4'),
  '42501', null, 'a signed-out visitor cannot look up upload slots');
select throws_ok(format($$ select public.delete_photo('00000000-0000-0000-0000-000000003501', %L) $$, :'new_cover'),
  '42501', null, 'a signed-out visitor cannot delete photos');

select * from finish();
rollback;
