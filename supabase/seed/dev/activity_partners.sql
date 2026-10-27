-- LOCAL DEVELOPMENT ONLY. Never run against a hosted project.
-- For checking Join Requests on the phone. Run chat_partner.sql first (it makes the account a Member
-- and connects it to Isha). This adds Rohan and Kabir, an Activity Rohan hosts for the phone to join,
-- and an Activity the phone's Member hosts with Join Requests waiting from Isha and Kabir.
-- Run from the repo root:
--   docker exec -i supabase_db_milojulo psql -U postgres -v email=you@example.com < supabase/seed/dev/activity_partners.sql
-- Then, after asking to join Rohan's Activity on the phone, have Rohan accept with rohan_accepts.sql.
\set ON_ERROR_STOP on
begin;

select id as me from auth.users where email = :'email' \gset
select '00000000-0000-0000-0000-0000000015ab' as isha, '00000000-0000-0000-0000-0000000015ac' as rohan,
  '00000000-0000-0000-0000-0000000015ad' as kabir \gset

select exists (select 1 from public.profiles where id = :'me' and submitted_at is not null)
  and exists (select 1 from public.profiles where id = :'isha') as ready \gset
\if :ready
\else
  \echo 'Run chat_partner.sql first.'
  rollback;
  \quit
\endif

-- Rohan and Kabir: auth accounts and Members with Submitted Profiles.
insert into auth.users (id, email, aud, role)
values (:'rohan', 'rohan@dev.milojulo', 'authenticated', 'authenticated'),
       (:'kabir', 'kabir@dev.milojulo', 'authenticated', 'authenticated')
on conflict (id) do nothing;
insert into public.profiles (id, date_of_birth) values (:'rohan', '1995-03-02'), (:'kabir', '1999-11-20')
on conflict (id) do nothing;
update public.profiles set display_name = coalesce(display_name, case when id = :'rohan' then 'Rohan' else 'Kabir' end),
  modes = '{friends,activities}'
where id in (:'rohan', :'kabir');
-- Rohan near Baner, Kabir near Wakad.
insert into public.member_locations (user_id, point)
values (:'rohan', 'SRID=4326;POINT(73.7868 18.5590)'), (:'kabir', 'SRID=4326;POINT(73.7600 18.5989)')
on conflict (user_id) do nothing;
insert into public.profile_prompts (user_id, position, question_id, answer)
select u, p, (select min(id) from public.prompt_questions), 'Weekend treks and cutting chai'
from unnest(array[:'rohan', :'kabir']::uuid[]) u, generate_series(1, 2) p
on conflict do nothing;
insert into public.photos (user_id, object_key, position, uploaded_at)
select u, u || '/' || p || '.jpg', p, now()
from unnest(array[:'rohan', :'kabir']::uuid[]) u, generate_series(1, 2) p
where not exists (select 1 from public.photos where user_id = u and position = p);
update public.profiles set submitted_at = coalesce(submitted_at, now()) where id in (:'rohan', :'kabir');

-- Tomorrow evening, India time.
select ((now() at time zone 'Asia/Kolkata')::date + 1 + time '19:00') at time zone 'Asia/Kolkata' as tomorrow_seven,
  ((now() at time zone 'Asia/Kolkata')::date + 1 + time '18:00') at time zone 'Asia/Kolkata' as tomorrow_six \gset

-- Rohan hosts badminton for the phone to join.
select not exists (select 1 from public.activities where host_id = :'rohan' and status = 'open') as post_rohan,
  not exists (select 1 from public.activities where host_id = :'me' and title = 'Chai and board games'
              and status = 'open') as post_mine \gset
select set_config('request.jwt.claims', json_build_object('sub', :'rohan', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.post_activity('Doubles badminton', 'sports', :'tomorrow_seven',
  :'tomorrow_seven'::timestamptz + interval '90 minutes', 3::smallint, 'Bring your own racquet, shuttles on me.',
  'Court 2, Baner Sports Club')
where :'post_rohan'::boolean;
reset role;

-- The phone's Member hosts chai and board games; Isha (already connected) and Kabir ask to join.
select set_config('request.jwt.claims', json_build_object('sub', :'me', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.post_activity('Chai and board games', 'games', :'tomorrow_six', null, 4::smallint,
  'Catan and Codenames, beginners welcome.', 'Table by the window, Chai Point Wakad')
where :'post_mine'::boolean;
reset role;
select id as mine from public.activities where host_id = :'me' and title = 'Chai and board games' and status = 'open' \gset

select set_config('request.jwt.claims', json_build_object('sub', :'isha', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.join_activity_request(:'mine')
where not exists (select 1 from public.activity_requests where activity_id = :'mine' and requester_id = :'isha');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :'kabir', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.join_activity_request(:'mine')
where not exists (select 1 from public.activity_requests where activity_id = :'mine' and requester_id = :'kabir');
reset role;

commit;
