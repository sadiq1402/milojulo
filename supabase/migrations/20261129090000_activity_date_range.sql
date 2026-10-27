-- Hosts may pick any day up to 90 ahead by the calendar in India (#242).
create or replace function public.check_activity(
  title varchar, starts_at timestamptz, ends_at timestamptz, capacity smallint, start_changed boolean
) returns void
language plpgsql stable
set search_path = ''
as $$
begin
  if coalesce(btrim(title), '') = '' then
    raise exception 'an activity needs a title';
  end if;
  if start_changed and starts_at <= now() then
    raise exception 'an activity must start in the future';
  end if;
  if start_changed and (starts_at at time zone 'Asia/Kolkata')::date
                       > (now() at time zone 'Asia/Kolkata')::date + 90 then
    raise exception 'an activity can start at most 90 days ahead';
  end if;
  if ends_at <= starts_at then
    raise exception 'an activity must end after it starts';
  end if;
  if capacity is null or capacity not between 1 and 20 then
    raise exception 'spots must be between 1 and 20';
  end if;
end;
$$;
