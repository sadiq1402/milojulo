-- #123 amends decision 38: a Member who chose Casual still appears to non-Casual Members under their other
-- Modes; Casual itself stays only between Members who both chose it. A Casual-only Member stays hidden.
create or replace function public.discover_modes(viewer uuid, member uuid) returns public.mode[]
language sql stable
set search_path = ''
as $$
  select array(
    select m from unnest(pb.modes) m
    where (m <> 'casual' or 'casual' = any (pa.modes))
      and (m not in ('dating', 'serious', 'casual')
           or (public.fits_dating_preferences(viewer, member) and public.fits_dating_preferences(member, viewer)
               and public.within_range(member, viewer)))
    order by m)
  from public.profiles pa, public.profiles pb
  where pa.id = viewer and pb.id = member;
$$;
