-- The caller's Connections (requests both ways, accepted, and closed as read-only history)
-- with a safe subset of the other side, even while they are Paused: first name, cover photo id
-- and Area only.
create function public.my_connections() returns table (
  connection_id uuid,
  other_id uuid,
  other_name varchar,
  other_photo_id uuid,
  other_area_id text,
  mode public.mode,
  status public.connection_status,
  direction text,
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
    -- Cover: the first live photo (uploaded, not hidden, not removed).
    (select ph.id from public.photos ph
     where ph.user_id = o.id and ph.uploaded_at is not null
       and ph.hidden_at is null and ph.removed_at is null
     order by ph.position limit 1),
    o.area_id, c.mode, c.status,
    case when c.requester_id = auth.uid() then 'outgoing' else 'incoming' end,
    c.note,
    last.type, last.body, last.created_at,
    (select count(*) from public.messages m
     where m.connection_id = c.id and m.sender_id <> auth.uid() and m.removed_at is null
       and m.created_at > coalesce(me.last_read_at, '-infinity'))::integer
  from public.connections c
  join public.profiles o on o.id = case when c.requester_id = auth.uid() then c.addressee_id
                                        else c.requester_id end
  left join public.connection_members me on me.connection_id = c.id and me.user_id = auth.uid()
  -- Messages removed by moderation are never previewed.
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

-- Members the caller has blocked, by first name only, so they can be unblocked.
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
