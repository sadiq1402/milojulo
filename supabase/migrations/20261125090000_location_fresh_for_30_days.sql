-- A Member Location now counts for 30 days, not 7 (founder, 2026-10-27): with no Area fallback, a stale
-- point takes a Member out of Discover entirely, and in a small beta people open the app now and then.
create or replace function public.member_point(member_id uuid) returns extensions.geography
language sql stable security definer
set search_path = ''
as $$
  select l.point from public.member_locations l
  where l.user_id = member_id and l.updated_at > now() - interval '30 days';
$$;
