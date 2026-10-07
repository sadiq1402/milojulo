-- Reviewer Account for store review. Not a migration: run once per environment
-- after creating the reviewer's auth user (email OTP) in Supabase Auth:
--   psql "$DB_URL" -v reviewer_id=<auth user id> -f supabase/seed/reviewer.sql
select public.seed_reviewer(:'reviewer_id');
