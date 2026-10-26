begin;
\ir helpers/act_as.psql
select plan(6);

select pg_temp.create_member('00000000-0000-0000-0000-0000000001a1');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000001a1');

select is((select count(*) from public.areas where is_active)::int, 55,
  'a signed-in Member sees 55 active Areas');
select is_empty(
  $$ select id from public.areas
     where zone is null or zone not in ('west', 'pimpri_chinchwad', 'central', 'east', 'south') $$,
  'every Area has a valid zone');
select results_eq(
  $$ select id, name, is_active, zone from public.areas where id in ('kothrud', 'kharadi', 'pimpri') order by id $$,
  $$ values ('kharadi', 'Kharadi', true, 'east'), ('kothrud', 'Kothrud', true, 'central'),
            ('pimpri', 'Pimpri', true, 'pimpri_chinchwad') $$,
  'a signed-in Member reads a new Area with its zone');
select results_eq(
  $$ select lat, lng from public.areas where id = 'kothrud' $$,
  $$ values (18.507::double precision, 73.808::double precision) $$,
  'a signed-in Member reads an Area''s lat and lng');
select is_empty(
  $$ select id from public.areas
     where abs(lat - extensions.st_y(center::extensions.geometry)) > 1e-9
        or abs(lng - extensions.st_x(center::extensions.geometry)) > 1e-9 $$,
  'every Area''s lat and lng match its centre');
reset role;
select pg_temp.act_as_anon();
select is_empty('select 1 from public.areas', 'a signed-out visitor cannot read Areas');

select * from finish();
rollback;
