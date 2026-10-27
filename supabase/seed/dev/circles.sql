-- LOCAL DEVELOPMENT ONLY. Never run against a hosted project.
-- Creates two active Circles through the admin path so #48 and the phone can browse them.
-- Run from the repo root:
--   docker exec -i supabase_db_milojulo psql -U postgres < supabase/seed/dev/circles.sql
-- Idempotent: it skips a Circle whose name already exists.
\set ON_ERROR_STOP on
begin;

-- Which Circles are missing (checked as postgres, before dropping to the admin role).
select not exists (select 1 from public.circles where name = 'Baner Badminton') as make_badminton,
  not exists (select 1 from public.circles where name = 'Kharadi Trekkers') as make_trekkers \gset
select (select id from public.tags where slug = 'badminton') as badminton_tag,
  (select id from public.tags where slug = 'trekking') as trekking_tag \gset

-- Act as an admin (the claim carries app_metadata.role = admin, which is what is_admin() checks).
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000ad', 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin'))::text, true);
set local role authenticated;

select public.admin_create_circle('Baner Badminton', 'Baner, Pune', 18.559, 73.787, :'badminton_tag'::smallint,
  'Doubles and singles at courts around Baner. All levels welcome.')
where :'make_badminton'::boolean;

select public.admin_create_circle('Kharadi Trekkers', 'Kharadi, Pune', 18.551, 73.941, :'trekking_tag'::smallint,
  'Weekend treks and Sahyadri day hikes out of Kharadi.')
where :'make_trekkers'::boolean;

reset role;
commit;
