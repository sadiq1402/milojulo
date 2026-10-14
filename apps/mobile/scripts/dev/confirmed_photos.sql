-- LOCAL DEVELOPMENT ONLY. Never run against a hosted project.
-- Gives the account with :'email' two confirmed photos (what the media Edge Function, #35, does
-- after an upload lands in R2), so profile setup can be finished locally without R2. The photos
-- step then shows them as placeholders, since there is no real file to sign a link for.
-- Run from the repo root:
--   docker exec -i supabase_db_milojulo psql -U postgres -v email=you@example.com < apps/mobile/scripts/dev/confirmed_photos.sql
\set ON_ERROR_STOP on
begin;

select coalesce((select id::text from auth.users where email = :'email'), '') as me \gset

-- The account must have given its date of birth and consents in the app first.
select exists (select 1 from public.profiles where id::text = :'me') as ready \gset
\if :ready
\else
  \echo 'Sign up in the app first: email, code, date of birth and consents.'
  rollback;
  \quit
\endif

-- Before #35 a row counts once uploaded_at is set; after it, the table holds only confirmed photos.
select exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'photos' and column_name = 'uploaded_at'
) as has_uploaded_at \gset

\if :has_uploaded_at
  insert into public.photos (user_id, position, object_key, uploaded_at)
  select :'me'::uuid, p, :'me' || '/dev-' || p || '.jpg', now()
  from generate_series(1, 2) p
  where not exists (select 1 from public.photos where user_id = :'me'::uuid and position = p);
\else
  insert into public.photos (user_id, position, object_key)
  select :'me'::uuid, p, :'me' || '/dev-' || p || '.jpg'
  from generate_series(1, 2) p
  where not exists (select 1 from public.photos where user_id = :'me'::uuid and position = p);
\endif

commit;
\echo 'Two confirmed photos added. Go back a step in the app and return to Photos to see them.'
