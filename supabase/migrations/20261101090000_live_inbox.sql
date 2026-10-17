-- #147: Connection Requests and Join Requests reach the Inbox live (decision 51).

-- Definer: sends to whichever of a and b did not act, never across a Block between them.
create function public.send_to_pair(a uuid, b uuid, actor uuid, event text, payload jsonb) returns void
language sql security definer
set search_path = ''
as $$
  select realtime.send(payload, event, 'member:' || member, true)
  from unnest(array[a, b]) as member
  where member is distinct from actor and not public.is_blocked(a, b);
$$;

revoke execute on function public.send_to_pair(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;

create function public.broadcast_connection_change() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.send_to_pair(new.requester_id, new.addressee_id, auth.uid(), 'connection',
                              jsonb_build_object('connection_id', new.id));
  return null;
end;
$$;

revoke execute on function public.broadcast_connection_change() from public, anon, authenticated;

create trigger broadcast_on_connection_insert after insert on public.connections
  for each row execute function public.broadcast_connection_change();

create trigger broadcast_on_connection_status after update of status on public.connections
  for each row when (new.status is distinct from old.status)
  execute function public.broadcast_connection_change();

create function public.broadcast_join_request_change() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.send_to_pair(a.host_id, new.requester_id, auth.uid(), 'join-request',
                              jsonb_build_object('activity_id', new.activity_id))
  from public.activities a where a.id = new.activity_id;
  return null;
end;
$$;

revoke execute on function public.broadcast_join_request_change() from public, anon, authenticated;

create trigger broadcast_on_join_request_insert after insert on public.activity_requests
  for each row execute function public.broadcast_join_request_change();

create trigger broadcast_on_join_request_status after update of status on public.activity_requests
  for each row when (new.status is distinct from old.status)
  execute function public.broadcast_join_request_change();
