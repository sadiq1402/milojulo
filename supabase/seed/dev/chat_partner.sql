-- LOCAL DEVELOPMENT ONLY. Never run against a hosted project.
-- Makes the account with :'email' a Member (fills the profile the setup screens will, #38)
-- and connects it to a test partner, Isha, with a short chat.
-- Run from the repo root:
--   docker exec -i supabase_db_milojulo psql -U postgres -v email=you@example.com < supabase/seed/dev/chat_partner.sql
-- Then, to have Isha send another message:
--   docker exec -i supabase_db_milojulo psql -U postgres -c "insert into public.messages (id, connection_id, sender_id, type, body) select gen_random_uuid(), id, requester_id, 'text', 'Are you free tonight?' from public.connections where requester_id = '00000000-0000-0000-0000-0000000015ab' and status = 'accepted';"
\set ON_ERROR_STOP on
begin;

select id as me from auth.users where email = :'email' \gset
select '00000000-0000-0000-0000-0000000015ab' as isha \gset

-- The account must have given its date of birth and consents in the app first.
select exists (select 1 from public.profiles where id = :'me' and date_of_birth is not null) as ready \gset
\if :ready
\else
  \echo 'Sign up in the app first: email, code, date of birth and consents.'
  rollback;
  \quit
\endif

-- Isha: an auth account and a Member with a Submitted Profile.
insert into auth.users (id, email, aud, role) values (:'isha', 'isha@dev.milojulo', 'authenticated', 'authenticated')
on conflict (id) do nothing;
insert into public.profiles (id, date_of_birth) values (:'isha', '1997-08-14') on conflict (id) do nothing;

-- Both profiles meet the minimum and are submitted.
update public.profiles set display_name = coalesce(display_name, case when id = :'isha' then 'Isha' else 'You' end),
  modes = '{friends,activities}'
where id in (:'me', :'isha');
-- Near Baner, Pune, so Discover can measure them; the phone's own location replaces its point.
insert into public.member_locations (user_id, point)
select u, 'SRID=4326;POINT(73.7868 18.5590)' from unnest(array[:'me', :'isha']::uuid[]) u
on conflict (user_id) do nothing;
insert into public.profile_prompts (user_id, position, question_id, answer)
select u, p, (select min(id) from public.prompt_questions), 'Badminton and filter coffee'
from unnest(array[:'me', :'isha']::uuid[]) u, generate_series(1, 2) p
on conflict do nothing;
insert into public.photos (user_id, object_key, position, uploaded_at)
select u, u || '/' || p || '.jpg', p, now()
from unnest(array[:'me', :'isha']::uuid[]) u, generate_series(1, 2) p
where not exists (select 1 from public.photos where user_id = u and position = p);
update public.profiles set submitted_at = coalesce(submitted_at, now()) where id in (:'me', :'isha');

-- An accepted Friends Connection, started by Isha, with a few messages.
insert into public.connections (requester_id, addressee_id, mode, note, status, responded_at)
select :'isha', :'me', 'friends', 'Badminton at Baner sometime?', 'accepted', now() - interval '1 hour'
where not exists (select 1 from public.connections where requester_id = :'isha' and addressee_id = :'me');
insert into public.messages (id, connection_id, sender_id, type, body, created_at)
select gen_random_uuid(), c.id, m.sender, 'text', m.body, now() - m.ago
from public.connections c,
  (values (:'isha'::uuid, 'Hey! Saw you play badminton at Baner too?', interval '50 minutes'),
          (:'me'::uuid, 'Yes, Tuesdays mostly.', interval '45 minutes'),
          (:'isha'::uuid, 'Count me in for next week. 7:30?', interval '40 minutes')) m (sender, body, ago)
where c.requester_id = :'isha' and c.addressee_id = :'me'
  and not exists (select 1 from public.messages where connection_id = c.id);

commit;
