-- #148: the board says when each Activity leaves it, so the app drops it then without asking again.
drop function public.activity_board();

create function public.activity_board() returns table (
  id uuid,
  host_id uuid,
  host_name varchar,
  title varchar,
  type public.activity_type,
  area_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity smallint,
  spots_left integer,
  description varchar,
  starts_when text,
  is_mine boolean,
  circle_id uuid,
  circle_name varchar,
  host_photo_id uuid,
  visible_until timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select a.id, a.host_id, h.display_name, a.title, a.type, a.area_id, a.starts_at, a.ends_at, a.capacity,
    public.activity_spots_left(a.id), a.description, public.activity_starts_when(a.starts_at),
    a.host_id = auth.uid(), a.circle_id, cc.name, public.cover_photo_id(a.host_id),
    public.activity_ends_at(a)
  from public.activities a
  join public.profiles h on h.id = a.host_id
  left join public.circles cc on cc.id = a.circle_id and cc.is_active
  where public.is_visible(auth.uid())
    and public.can_see_activity(a, auth.uid())
    and not exists (select 1 from public.activity_requests r
                    where r.activity_id = a.id and r.requester_id = auth.uid())
  order by a.starts_at, a.id;
$$;

revoke execute on function public.activity_board() from public, anon;
