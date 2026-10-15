-- Why-you-match reads as in the Discover mockup: the distance first, then the other Member's
-- Modes (as named in the app) when none is shared, then 'You both ...' from what is shared.
create or replace function public.match_reason(a uuid, b uuid) returns text
language sql stable
set search_path = ''
as $$
  select concat_ws(' ',
    case when d.distance_m < 2000 then 'Less than 2 km away.'
      else 'About ' || round(d.distance_m / 1000)::integer || ' km away.' end,
    case when cardinality(d.shared_modes) = 0 then
      'They''re here for '
      || public.english_list(array(select initcap(m::text) from unnest(d.their_modes) m)) || '.'
    end,
    'You both ' || case cardinality(parts)
      when 1 then parts[1]
      else array_to_string(parts[1:cardinality(parts) - 1], ', ') || ', and ' || parts[cardinality(parts)]
    end || '.')
  from public.discover_pair(a, b) d
  join public.profiles pa on pa.id = a
  join public.profiles pb on pb.id = b
  cross join lateral (
    select array_remove(array[
      'want ' || public.english_list(array(select public.mode_phrase(m) from unnest(d.shared_modes) m)),
      'like ' || public.english_list(array(select lower(label) from public.shared_tags(a, b) limit 2)),
      'are free on ' || public.english_list(array(
        select replace(s::text, '_', ' ') from (
          select unnest(pa.availability) s intersect select unnest(pb.availability)
          order by 1) shared))
    ], null) parts) r;
$$;
