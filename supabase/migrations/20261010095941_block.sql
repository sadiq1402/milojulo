create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index on public.blocks (blocked_id);
alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;
grant select, delete on public.blocks to authenticated;

create policy "blocker reads own blocks" on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy "blocker unblocks" on public.blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- The single source of truth for Blocks, in either direction.
create function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

revoke execute on function public.is_blocked(uuid, uuid) from public, anon, authenticated;

-- Blocking will also close the pair's Connection once Connections exist (#9).
create function public.block_user(member_id uuid) returns void
language sql security definer
set search_path = ''
as $$
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), member_id)
  on conflict do nothing;
$$;

revoke execute on function public.block_user(uuid) from public, anon;

-- Discover and profile view leave out both sides of a Block.
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
      and not public.is_blocked(me.id, p.id)
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

-- Empty unless both Members are visible, share a Mode and no Block stands between them.
create or replace function public.get_profile(member_id uuid) returns table (
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
    and not public.is_blocked(me.id, p.id)
    and cardinality(public.eligible_modes(me.id, p.id)) > 0;
$$;
