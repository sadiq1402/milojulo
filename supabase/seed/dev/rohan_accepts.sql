-- LOCAL DEVELOPMENT ONLY. Rohan (from activity_partners.sql) accepts every waiting Join Request on his open Activity.
--   docker exec -i supabase_db_milojulo psql -U postgres < supabase/seed/dev/rohan_accepts.sql
\set ON_ERROR_STOP on
begin;
-- Looked up before acting as Rohan: Members can't read activities directly.
select id as activity from public.activities
where host_id = '00000000-0000-0000-0000-0000000015ac' and status = 'open' limit 1 \gset
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000015ac","role":"authenticated"}', true);
set local role authenticated;
select public.respond_activity_request(r.request_id, true)
from public.activity_join_requests(:'activity') r where r.status = 'requested';
commit;
