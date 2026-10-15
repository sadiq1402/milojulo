-- #117: discover_feed filters by a list of Modes (null or empty = every Mode), keeping a Member
-- whose visible Modes overlap it, so picking several Modes still returns full pages.
-- The Networking ranking applies only when the list is exactly Networking.
drop function public.discover_feed(public.mode, integer, text);
create function public.discover_feed(
  mode_filter public.mode[] default null,
  page_size integer default 20,
  after text default null
) returns table (
  user_id uuid,
  display_name varchar,
  age integer,
  area_id text,
  modes public.mode[],
  their_modes public.mode[],
  distance_band text,
  cover_photo_id uuid,
  shared_tag_ids smallint[],
  why_you_match text,
  cursor text
)
language sql stable security definer
set search_path = ''
as $$
  with candidates as (
    select p.*, me.id as viewer_id, d.their_modes, d.shared_modes, d.distance_m,
      case when mode_filter = '{networking}'::public.mode[]
        then coalesce(p.industry_id = me.industry_id, false)::integer
             + coalesce(p.career_stage = me.career_stage, false)::integer
        else 0
      end as rank,
      (select count(*) from public.shared_tags(me.id, p.id))::integer
      + cardinality(array(select unnest(p.availability) intersect select unnest(me.availability)))
      + cardinality(d.shared_modes)
      + case when d.distance_m < 2000 then 3 when d.distance_m < 5000 then 2 when d.distance_m <= 10000 then 1
             else 0 end as score
    from public.profiles me
    join public.profiles p on p.id <> me.id
    cross join lateral public.discover_pair(me.id, p.id) d
    where me.id = auth.uid()
  )
  select
    c.id,
    c.display_name,
    public.age_of(c.date_of_birth),
    c.area_id,
    c.shared_modes,
    c.their_modes,
    public.distance_band(c.distance_m),
    (select ph.id from public.photos ph
     where ph.user_id = c.id and ph.uploaded_at is not null
       and ph.hidden_at is null and ph.removed_at is null
     order by ph.position limit 1),
    array(select id from public.shared_tags(c.viewer_id, c.id)),
    public.match_reason(c.viewer_id, c.id),
    c.rank || ':' || c.score || ':' || c.id
  from candidates c
  where (coalesce(cardinality(mode_filter), 0) = 0 or mode_filter && c.their_modes)
    and (after is null
         or (c.rank, c.score, c.id) < (split_part(after, ':', 1)::integer, split_part(after, ':', 2)::integer,
                                       split_part(after, ':', 3)::uuid))
  order by c.rank desc, c.score desc, c.id desc
  limit least(greatest(page_size, 1), 50);
$$;
revoke execute on function public.discover_feed(public.mode[], integer, text) from public, anon;
