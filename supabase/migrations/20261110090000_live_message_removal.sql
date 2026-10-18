-- #163: a taken-down message leaves open chats at once. Both sides hear of it on their own topic
-- (decision 51); only ids travel, since the message itself is no longer readable.
create function public.broadcast_message_removed() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform realtime.send(jsonb_build_object('id', new.id, 'connection_id', new.connection_id),
                        'message-removed', 'member:' || m.user_id, true)
  from public.connection_members m
  where m.connection_id = new.connection_id
    and not exists (select 1 from public.connection_members o
                    where o.connection_id = m.connection_id and o.user_id <> m.user_id
                      and public.is_blocked(o.user_id, m.user_id));
  return null;
end;
$$;

revoke execute on function public.broadcast_message_removed() from public, anon, authenticated;

create trigger broadcast_on_message_removed after update of removed_at on public.messages
  for each row when (old.removed_at is null and new.removed_at is not null)
  execute function public.broadcast_message_removed();
