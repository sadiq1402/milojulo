-- The only Members others can discover.
create function public.is_visible(member_id uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = member_id
      and p.status = 'active'
      and p.submitted_at is not null
      and p.paused_at is null
      and p.hidden_at is null
      and p.deleted_at is null
      and (select count(*) from public.photos ph
           where ph.user_id = p.id and ph.uploaded_at is not null
             and ph.hidden_at is null and ph.removed_at is null) >= 2
  );
$$;

create function public.eligible_modes(a uuid, b uuid) returns public.mode[]
language sql stable
set search_path = ''
as $$
  select array(select unnest(pa.modes) intersect select unnest(pb.modes) order by 1)
  from public.profiles pa, public.profiles pb
  where pa.id = a and pb.id = b;
$$;

create function public.shared_tags(a uuid, b uuid) returns setof public.tags
language sql stable
set search_path = ''
as $$
  select t.* from public.tags t
  where exists (select 1 from public.profile_tags where user_id = a and tag_id = t.id)
    and exists (select 1 from public.profile_tags where user_id = b and tag_id = t.id)
  order by t.sort_order;
$$;

-- 'a', 'a and b', 'a, b and c'; null for an empty list.
create function public.english_list(items text[]) returns text
language sql immutable
set search_path = ''
as $$
  select case cardinality(items)
    when 0 then null
    when 1 then items[1]
    else array_to_string(items[1:cardinality(items) - 1], ', ') || ' and ' || items[cardinality(items)]
  end;
$$;

create function public.match_reason(a uuid, b uuid) returns text
language sql stable
set search_path = ''
as $$
  select 'You both ' || case cardinality(parts)
    when 1 then parts[1]
    else array_to_string(parts[1:cardinality(parts) - 1], ', ') || ', and ' || parts[cardinality(parts)]
  end || '.'
  from (
    select array_remove(array[
      'want ' || public.english_list(array(
        select case m
          when 'friends' then 'friends'
          when 'activities' then 'activity partners'
          when 'networking' then 'professional contacts'
          when 'dating' then 'dates'
          when 'serious' then 'something serious'
          when 'casual' then 'something casual'
        end
        from unnest(public.eligible_modes(a, b)) m)),
      'like ' || public.english_list(array(select lower(label) from public.shared_tags(a, b) limit 2)),
      'are free on ' || public.english_list(array(
        select replace(s::text, '_', ' ') from (
          select unnest(pa.availability) s intersect select unnest(pb.availability)
          order by 1) shared))
    ], null) parts
    from public.profiles pa, public.profiles pb
    where pa.id = a and pb.id = b
  ) reason;
$$;

-- Age on today's calendar date in India; date of birth never leaves the server.
create function public.age_of(birth_date date) returns integer
language sql stable
set search_path = ''
as $$
  select extract(year from age((now() at time zone 'Asia/Kolkata')::date, birth_date))::integer;
$$;

revoke execute on function public.is_visible(uuid), public.eligible_modes(uuid, uuid),
  public.shared_tags(uuid, uuid), public.english_list(text[]), public.match_reason(uuid, uuid),
  public.age_of(date)
  from public, anon, authenticated;

-- Pages are keyset on (score, id); pass the last row's cursor to get the next page.
create function public.discover_feed(
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
    c.score || ':' || c.id
  from candidates c
  where cardinality(c.shared_modes) > 0
    and (mode_filter is null or mode_filter = any (c.shared_modes))
    and (after is null
         or (c.score, c.id) < (split_part(after, ':', 1)::integer, split_part(after, ':', 2)::uuid))
  order by c.score desc, c.id desc
  limit least(greatest(page_size, 1), 50);
$$;

revoke execute on function public.discover_feed(public.mode, integer, text) from public, anon;

-- The full profile, under the same rules as the feed: empty unless both Members are visible and share a Mode.
create function public.get_profile(member_id uuid) returns table (
  user_id uuid,
  display_name varchar,
  age integer,
  area_id text,
  modes public.mode[],
  why_you_match text,
  photo_ids uuid[],
  prompts jsonb,
  tag_ids smallint[],
  availability public.availability_slot[]
)
language sql stable security definer
set search_path = ''
as $$
  select
    p.id,
    p.display_name,
    public.age_of(p.date_of_birth),
    p.area_id,
    public.eligible_modes(me.id, p.id),
    public.match_reason(me.id, p.id),
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
    p.availability
  from public.profiles me
  join public.profiles p on p.id = member_id and p.id <> me.id
  where me.id = auth.uid()
    and public.is_visible(me.id)
    and public.is_visible(p.id)
    and cardinality(public.eligible_modes(me.id, p.id)) > 0;
$$;

revoke execute on function public.get_profile(uuid) from public, anon;
