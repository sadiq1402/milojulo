-- #50: a week after both sides of a chat have written, each is asked once whether they met.

create table public.meet_nudges (
  connection_id uuid not null references public.connections (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (connection_id, user_id)
);
alter table public.meet_nudges enable row level security;
revoke all on public.meet_nudges from anon, authenticated;

-- Activity Connections are left out: the Activity's own prompt asks after it ends.
create function public.send_meet_nudges() returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  due record;
begin
  for due in
    select c.id, m.user_id as member, o.user_id as other, public.display_name_of(o.user_id) as other_name
    from public.connections c
    join public.connection_members m on m.connection_id = c.id
    -- Only Members a push would reach are marked asked; the rest wait until it would.
    join public.profiles p on p.id = m.user_id
      and p.status = 'active' and p.deleted_at is null and p.notify_messages
    join public.connection_members o on o.connection_id = c.id and o.user_id <> m.user_id
    where c.status = 'accepted' and c.activity_id is null
      and c.responded_at <= now() - interval '7 days'
      and not m.muted
      and public.can_give_feedback_about(m.user_id, o.user_id)
      and exists (select 1 from public.messages x where x.connection_id = c.id and x.sender_id = m.user_id)
      and exists (select 1 from public.messages x where x.connection_id = c.id and x.sender_id = o.user_id)
      and not exists (select 1 from public.meetup_feedback f
                      where f.user_id = m.user_id and f.other_user_id = o.user_id and f.activity_id is null)
      and not exists (select 1 from public.meet_nudges n where n.connection_id = c.id and n.user_id = m.user_id)
  loop
    insert into public.meet_nudges (connection_id, user_id) values (due.id, due.member);
    perform public.enqueue_push(due.member, 'messages',
      'Did you meet ' || due.other_name || '?', 'Tell us how it went. It takes a moment.',
      jsonb_build_object('kind', 'meet_nudge', 'otherUserId', due.other, 'otherName', due.other_name));
  end loop;
end;
$$;

-- The daily check asks whether each side of a chat has written.
create index on public.messages (connection_id, sender_id);

revoke execute on function public.send_meet_nudges() from public, anon, authenticated;

-- 11:00 India time.
select cron.schedule('send-meet-nudges', '30 5 * * *', 'select public.send_meet_nudges()');
