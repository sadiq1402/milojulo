-- Anyone who can see an Activity reads its venue, not only the host and accepted joiners (decision 69).
create or replace function public.get_activity(activity_id uuid) returns table (
  id uuid,
  host_id uuid,
  host_name varchar,
  title varchar,
  type public.activity_type,
  distance_band text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity smallint,
  spots_left integer,
  description varchar,
  starts_when text,
  is_mine boolean,
  status public.activity_status,
  venue_detail varchar,
  is_locked boolean,
  my_request_id uuid,
  my_request_status public.request_status,
  connection_id uuid,
  circle_id uuid,
  circle_name varchar,
  host_photo_id uuid
)
language sql stable security definer
set search_path = ''
as $$
  select a.id, a.host_id, h.display_name, a.title, a.type, public.band_from_me(a.place), a.starts_at,
    a.ends_at, a.capacity,
    public.activity_spots_left(a.id), a.description, public.activity_starts_when(a.starts_at),
    a.host_id = auth.uid(), a.status,
    v.venue_detail,
    public.activity_is_locked(a.id), mine.id, mine.status,
    case when mine.status = 'accepted' then public.accepted_connection_id(a.host_id, auth.uid()) end,
    a.circle_id, cc.name, public.cover_photo_id(a.host_id)
  from public.activities a
  join public.profiles h on h.id = a.host_id
  left join public.activity_venues v on v.activity_id = a.id
  left join public.activity_requests mine on mine.activity_id = a.id and mine.requester_id = auth.uid()
  left join public.circles cc on cc.id = a.circle_id and cc.is_active
  where a.id = get_activity.activity_id
    and (a.host_id = auth.uid()
         or (public.is_visible(auth.uid()) and public.can_see_activity(a, auth.uid()))
         or (mine.status = 'accepted' and a.status = 'open' and public.activity_ends_at(a) > now()));
$$;

