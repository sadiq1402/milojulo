-- Does candidate fit seeker's Dating Preferences? Eligible Modes check it both ways.
create function public.fits_dating_preferences(seeker uuid, candidate uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(c.gender = any (s.pref_genders)
                  and public.age_of(c.date_of_birth) between s.pref_age_min and s.pref_age_max
                  and extensions.st_distance(sa.center, ca.center) <= s.pref_max_km * 1000, false)
  from public.profiles s
  join public.areas sa on sa.id = s.area_id
  cross join public.profiles c
  join public.areas ca on ca.id = c.area_id
  where s.id = seeker and c.id = candidate;
$$;

create or replace function public.eligible_modes(a uuid, b uuid) returns public.mode[]
language sql stable
set search_path = ''
as $$
  select array(
    select m from (select unnest(pa.modes) intersect select unnest(pb.modes)) shared (m)
    where m not in ('dating', 'serious', 'casual')
       or (public.fits_dating_preferences(a, b) and public.fits_dating_preferences(b, a))
    order by 1)
  from public.profiles pa, public.profiles pb
  where pa.id = a and pb.id = b;
$$;

revoke execute on function public.fits_dating_preferences(uuid, uuid) from public, anon, authenticated;

-- Cursor is rank:score:id. In the Networking feed, sharing Industry and Career Stage outranks sharing one, which outranks the usual score.
create or replace function public.discover_feed(
  mode_filter public.mode default null,
  page_size integer default 20,
  after text default null
) returns table (
  user_id uuid,
  display_name varchar,
  age integer,
  area_id text,
  modes public.mode[],
  cover_photo_id uuid,
  shared_tag_ids smallint[],
  why_you_match text,
  cursor text
)
language sql stable security definer
set search_path = ''
as $$
  with candidates as (
    select p.*, me.id as viewer_id, public.eligible_modes(me.id, p.id) as shared_modes,
      case when mode_filter = 'networking'
        then coalesce(p.industry_id = me.industry_id, false)::integer
             + coalesce(p.career_stage = me.career_stage, false)::integer
        else 0
      end as rank,
      (select count(*) from public.shared_tags(me.id, p.id))::integer
      + cardinality(array(select unnest(p.availability) intersect select unnest(me.availability)))
      + (p.area_id = me.area_id)::integer as score
    from public.profiles me
    join public.profiles p on p.id <> me.id
    where me.id = auth.uid()
      and public.is_visible(me.id)
      and public.is_visible(p.id)
  )
  select
    c.id,
    c.display_name,
    public.age_of(c.date_of_birth),
    c.area_id,
    c.shared_modes,
    (select ph.id from public.photos ph
     where ph.user_id = c.id and ph.uploaded_at is not null
       and ph.hidden_at is null and ph.removed_at is null
     order by ph.position limit 1),
    array(select id from public.shared_tags(c.viewer_id, c.id)),
    public.match_reason(c.viewer_id, c.id),
    c.rank || ':' || c.score || ':' || c.id
  from candidates c
  where cardinality(c.shared_modes) > 0
    and (mode_filter is null or mode_filter = any (c.shared_modes))
    and (after is null
         or (c.rank, c.score, c.id) < (split_part(after, ':', 1)::integer, split_part(after, ':', 2)::integer,
                                       split_part(after, ':', 3)::uuid))
  order by c.rank desc, c.score desc, c.id desc
  limit least(greatest(page_size, 1), 50);
$$;
