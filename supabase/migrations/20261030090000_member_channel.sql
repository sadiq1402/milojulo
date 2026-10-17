-- #145: one private topic per Member (member:<id>) replaces connection:<id>; see docs/08 decision 51.

drop policy "Members join their Connections' topics" on realtime.messages;

create policy "Members join their own topic" on realtime.messages for select to authenticated
  using (
    topic = (select realtime.topic())
    and topic = 'member:' || (select auth.uid())
  );

-- Only the other side: the sender's app already has the message.
create or replace function public.broadcast_message() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform realtime.send(to_jsonb(new), 'message', 'member:' || m.user_id, true)
  from public.connection_members m
  where m.connection_id = new.connection_id and m.user_id <> new.sender_id
    and not public.is_blocked(new.sender_id, m.user_id);
  return null;
end;
$$;
