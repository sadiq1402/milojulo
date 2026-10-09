begin;
\ir helpers/act_as.psql
select plan(12);

select pg_temp.create_member('00000000-0000-0000-0000-0000000000b1');
select pg_temp.create_member('00000000-0000-0000-0000-0000000000b2');

-- The upload Edge Function records each upload before the object exists.
select pg_temp.act_as_service();
insert into public.photos (id, user_id, object_key, position) values
  ('00000000-0000-0000-0000-00000000b101', '00000000-0000-0000-0000-0000000000b1', 'b1/one.jpg', 1),
  ('00000000-0000-0000-0000-00000000b102', '00000000-0000-0000-0000-0000000000b1', 'b1/two.jpg', 2);
select lives_ok($$ select public.confirm_photo_upload('00000000-0000-0000-0000-00000000b101') $$,
  'the upload Edge Function can confirm an upload');
select throws_ok(
  $$ insert into public.photos (user_id, object_key, position)
     values ('00000000-0000-0000-0000-0000000000b1', 'b1/five.jpg', 5) $$,
  '23514', null, 'a Member has at most 4 photo positions');
select throws_ok(
  $$ insert into public.photos (user_id, object_key, position)
     values ('00000000-0000-0000-0000-0000000000b1', 'b1/again.jpg', 1) $$,
  '23505', null, 'two photos cannot share a position');

reset role;
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000b1');
select results_eq(
  'select position, uploaded_at is not null from public.photos order by position',
  $$ values (1::smallint, true), (2::smallint, false) $$,
  'a photo is live only once its upload is confirmed');
select throws_ok($$ select public.confirm_photo_upload('00000000-0000-0000-0000-00000000b102') $$,
  '42501', null, 'a Member cannot confirm their own upload');
select throws_ok(
  $$ insert into public.photos (user_id, object_key, position) values (auth.uid(), 'b1/three.jpg', 3) $$,
  '42501', null, 'a Member cannot insert photo rows directly');
select throws_ok($$ update public.photos set hidden_at = null, removed_at = null $$, '42501', null,
  'a Member cannot change a photo''s moderation columns');
select lives_ok($$ update public.photos set position = 3 - position $$,
  'a Member can reorder photos, swapping the cover');
select results_eq(
  'select object_key from public.photos where position = 1',
  $$ values ('b1/two.jpg') $$,
  'position 1 is the cover after reordering');

reset role;
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000b2');
select is_empty('select 1 from public.photos', 'another Member cannot read someone''s photos');
delete from public.photos;
update public.photos set position = 3 - position;
reset role;
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.photos), 2, 'another Member cannot delete someone''s photos');
select results_eq('select object_key from public.photos where position = 1', $$ values ('b1/two.jpg') $$,
  'another Member cannot reorder someone''s photos');

select * from finish();
rollback;
