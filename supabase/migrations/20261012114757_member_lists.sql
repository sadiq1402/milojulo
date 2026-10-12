create type public.connection_direction as enum ('incoming', 'outgoing');

-- The caller's Connections (declined ones left out) with only the other side's first name,
-- cover photo id and Area, which keep coming back while that Member is Paused.
create function public.my_connections() returns table (
  connection_id uuid,
  other_id uuid,
  other_name varchar,
  other_photo_id uuid,
  other_area_id text,
  mode public.mode,
  status public.connection_status,
  direction public.connection_direction,
  note varchar,
  last_message_type public.message_type,
  last_message_body text,
  last_message_at timestamptz,
  unread_count integer
)
language sql stable security definer
set search_path = ''
as $$
  select c.id, o.id, o.display_name,
    -- A hidden or removed cover gives way to the next live photo; banned or Auto-hidden
    -- Members stay in history without one until restored.
    case when o.status = 'active' and o.hidden_at is null then
      (select ph.id from public.photos ph
       where ph.user_id = o.id and ph.uploaded_at is not null
         and ph.hidden_at is null and ph.removed_at is null
       order by ph.position limit 1)
    end,
    o.area_id, c.mode, c.status, side.direction, c.note,
    last.type, last.body, last.created_at,
    (select count(*) from public.messages m
     where m.connection_id = c.id and m.sender_id <> auth.uid() and m.removed_at is null
       and m.created_at > coalesce(me.last_read_at, '-infinity'))::integer
  from public.connections c
  cross join lateral (
    select case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end,
           case when c.requester_id = auth.uid() then 'outgoing' else 'incoming' end::public.connection_direction
  ) side (other_id, direction)
  join public.profiles o on o.id = side.other_id
  left join public.connection_members me on me.connection_id = c.id and me.user_id = auth.uid()
  left join lateral (
    select m.type, m.body, m.created_at from public.messages m
    where m.connection_id = c.id and m.removed_at is null
    order by m.created_at desc limit 1
  ) last on true
  where auth.uid() in (c.requester_id, c.addressee_id)
    and c.status <> 'declined'
  order by coalesce(last.created_at, c.responded_at, c.created_at) desc;
$$;

revoke execute on function public.my_connections() from public, anon;

-- Never lists who has blocked the caller.
create function public.my_blocks() returns table (
  member_id uuid,
  display_name varchar,
  blocked_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.display_name, b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

revoke execute on function public.my_blocks() from public, anon;
