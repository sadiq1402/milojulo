-- #145: one private Realtime topic per Member, member:<id>, replacing connection:<id>.
-- Realtime checks this policy on join and caches it for the connection, so a per-Member topic
-- means nothing reaches someone once the database stops sending to them (a Block, a closed
-- Connection), without waiting for their JWT to refresh.

drop policy "Members join their Connections' topics" on realtime.messages;

create policy "Members join their own topic" on realtime.messages for select to authenticated
  using (
    topic = (select realtime.topic())
    and topic = 'member:' || (select auth.uid())
  );

-- The sender's app already has the message, so only the other side is sent it.
create or replace function public.broadcast_message() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform realtime.send(to_jsonb(new), 'message', 'member:' || m.user_id, true)
  from public.connection_members m
  where m.connection_id = new.connection_id and m.user_id <> new.sender_id;
  return null;
end;
$$;
