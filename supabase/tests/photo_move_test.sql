begin;
\ir helpers/act_as.psql
select plan(9);

-- 01 Asha has photos at positions 1 to 4; 02 is another Member with 2 photos.
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003701');
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000003702');
insert into public.photos (user_id, object_key, position, uploaded_at)
select '00000000-0000-0000-0000-000000003701', 'asha/' || p || '.jpg', p, now() from generate_series(3, 4) p;
select id as p1 from public.photos where user_id = '00000000-0000-0000-0000-000000003701' and position = 1 \gset
select id as p4 from public.photos where user_id = '00000000-0000-0000-0000-000000003701' and position = 4 \gset
select id as ravi1 from public.photos where user_id = '00000000-0000-0000-0000-000000003702' and position = 1 \gset

select pg_temp.act_as_member('00000000-0000-0000-0000-000000003701');
select lives_ok(format($$ select public.move_photo(%L, 1::smallint) $$, :'p4'),
  'a Member moves a photo to a taken position');
select results_eq('select object_key from public.photos order by position',
  $$ values ('asha/4.jpg'), ('00000000-0000-0000-0000-000000003701/2.jpg'), ('asha/3.jpg'),
            ('00000000-0000-0000-0000-000000003701/1.jpg') $$,
  'the two photos swap positions and the others stay put');

delete from public.photos where object_key = 'asha/3.jpg';
select lives_ok(format($$ select public.move_photo(%L, 3::smallint) $$, :'p1'),
  'a Member moves a photo to a free position');
select is((select position from public.photos where id = :'p1'), 3::smallint, 'the photo now sits in the free position');
select is((select count(*)::int from public.photos where position = 4), 0, 'and its old position is free');

select throws_ok(format($$ select public.move_photo(%L, 5::smallint) $$, :'p1'),
  'P0001', 'choose a photo position from 1 to 4', 'there are only 4 positions');
select throws_ok(format($$ select public.move_photo(%L, 2::smallint) $$, :'ravi1'),
  'P0001', 'no photo to move', 'a Member cannot move another Member''s photo');
reset role;
select is((select position from public.photos where id = :'ravi1'), 1::smallint, 'the other Member''s photo stays put');

select pg_temp.act_as_anon();
select throws_ok(format($$ select public.move_photo(%L, 2::smallint) $$, :'ravi1'),
  '42501', null, 'a signed-out visitor cannot move photos');

select * from finish();
rollback;
