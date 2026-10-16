-- #128: fellow members of a Circle see each other's photos, like the Circle's member list (both visible;
-- photo_links already refuses a Block or an inactive account).
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
                    where mine.user_id = viewer and theirs.user_id = member_id));
$$;
