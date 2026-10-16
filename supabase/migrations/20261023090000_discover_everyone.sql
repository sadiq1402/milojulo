-- #125, decision 45: Discover shows every Visible Member in range with all their Modes. The Casual and Dating
-- rules now apply only to Eligible Modes (Connection Requests and Mode Changes).
create or replace function public.eligible_modes(a uuid, b uuid) returns public.mode[]
language sql stable
set search_path = ''
as $$
  select array(
    select m from unnest(pb.modes) m
    where (m <> 'casual' or 'casual' = any (pa.modes))
      and (m not in ('dating', 'serious', 'casual')
           or (public.fits_dating_preferences(a, b) and public.fits_dating_preferences(b, a)
               and public.within_range(b, a)))
    order by m)
  from public.profiles pa, public.profiles pb
  where pa.id = a and pb.id = b;
$$;

create or replace function public.discover_modes(viewer uuid, member uuid) returns public.mode[]
language sql stable
set search_path = ''
as $$
  select array(select m from unnest(p.modes) m order by m) from public.profiles p where p.id = member;
$$;

-- The profile also lists the Modes the viewer may request under, so the app offers only those.
drop function public.get_profile(uuid);
create function public.get_profile(member_id uuid) returns table (
  user_id uuid,
  display_name varchar,
  age integer,
  area_id text,
  modes public.mode[],
  their_modes public.mode[],
  distance_band text,
  why_you_match text,
  photo_ids uuid[],
  prompts jsonb,
  tag_ids smallint[],
  availability public.availability_slot[],
  request_modes public.mode[]
)
language sql stable security definer
set search_path = ''
as $$
  select
    p.id,
    p.display_name,
    public.age_of(p.date_of_birth),
    p.area_id,
    d.shared_modes,
    d.their_modes,
    public.distance_band(d.distance_m),
    public.match_reason(auth.uid(), p.id),
    array(select ph.id from public.photos ph
          where ph.user_id = p.id and ph.uploaded_at is not null
            and ph.hidden_at is null and ph.removed_at is null
          order by ph.position),
    (select jsonb_agg(jsonb_build_object('position', pp.position, 'question_id', pp.question_id,
                                         'answer', pp.answer) order by pp.position)
     from public.profile_prompts pp where pp.user_id = p.id),
    array(select t.id from public.tags t
          join public.profile_tags pt on pt.tag_id = t.id and pt.user_id = p.id
          order by t.sort_order),
    p.availability,
    public.eligible_modes(auth.uid(), p.id)
  from public.profiles p
  cross join lateral public.discover_pair(auth.uid(), p.id) d
  where p.id = member_id;
$$;
revoke execute on function public.get_profile(uuid) from public, anon;
