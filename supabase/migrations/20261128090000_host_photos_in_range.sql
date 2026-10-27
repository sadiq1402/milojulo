-- An Activity shares its host's photos only with the Members it is on the board for (within their
-- Discover Range of where it was posted) or, when posted to a Circle, with that Circle's Members, whose
-- feed shows it at any distance (founder, 2026-10-27). Before, any open Activity shared them.
create or replace function public.shares_photos_with(viewer uuid, member_id uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select exists (select 1 from public.discover_pair(viewer, member_id))
    or exists (select 1 from public.connections c
               where least(c.requester_id, c.addressee_id) = least(viewer, member_id)
                 and greatest(c.requester_id, c.addressee_id) = greatest(viewer, member_id)
                 and c.status <> 'declined')
    or exists (select 1 from public.activity_requests r
               join public.activities a on a.id = r.activity_id
               where r.status in ('requested', 'accepted')
                 and ((r.requester_id = viewer and a.host_id = member_id)
                      or (r.requester_id = member_id and a.host_id = viewer)))
    or exists (select 1 from public.activity_requests mine
               join public.activity_requests theirs on theirs.activity_id = mine.activity_id
               where mine.requester_id = viewer and mine.status = 'accepted'
                 and theirs.requester_id = member_id and theirs.status = 'accepted')
    or (public.is_visible(viewer) and public.is_visible(member_id)
        and exists (select 1 from public.circle_members mine
                    join public.circle_members theirs on theirs.circle_id = mine.circle_id
                    where mine.user_id = viewer and theirs.user_id = member_id))
    or (public.is_visible(viewer)
        and exists (select 1 from public.activities a
                    where a.host_id = member_id and public.can_see_activity(a, viewer)
                      and (extensions.st_dwithin(a.place, public.member_point(viewer),
                             (select p.discover_range_km * 1000 from public.profiles p where p.id = viewer))
                           or exists (select 1 from public.circle_members cm
                                      where cm.circle_id = a.circle_id and cm.user_id = viewer))));
$$;
