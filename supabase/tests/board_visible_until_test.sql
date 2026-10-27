begin;
\ir helpers/act_as.psql
select plan(2);

select pg_temp.create_visible_member('00000000-0000-0000-0000-000000004801');
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000004802');

insert into public.activities (host_id, title, type, place, starts_at, ends_at, capacity) values
  ('00000000-0000-0000-0000-000000004801', 'with an end', 'sports', 'SRID=4326;POINT(73.787 18.559)',
   '2030-01-15 19:00+05:30', '2030-01-15 21:30+05:30', 4),
  ('00000000-0000-0000-0000-000000004801', 'no end given', 'sports', 'SRID=4326;POINT(73.787 18.559)',
   '2030-01-15 19:00+05:30', null, 4);

select pg_temp.act_as_member('00000000-0000-0000-0000-000000004802');
select is((select visible_until from public.activity_board() where title = 'with an end'),
  '2030-01-15 21:30+05:30'::timestamptz, 'the board says an Activity stays until its end');
select is((select visible_until from public.activity_board() where title = 'no end given'),
  '2030-01-15 22:00+05:30'::timestamptz, 'with no end given, until three hours after the start');

select * from finish();
rollback;
