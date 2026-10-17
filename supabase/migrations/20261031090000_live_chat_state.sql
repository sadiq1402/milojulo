-- #146: read position, Media Consent and Mode Changes reach the other side live (decision 51).

-- Definer: Members cannot write realtime.messages. Skips the actor and anyone across a Block.
create function public.send_to_other_members(connection_id uuid, actor uuid, event text) returns void
language sql security definer
set search_path = ''
as $$
  select realtime.send(jsonb_build_object('connection_id', connection_id), event,
                       'member:' || m.user_id, true)
  from public.connection_members m
  where m.connection_id = send_to_other_members.connection_id
    and m.user_id is distinct from actor
    and (actor is null or not public.is_blocked(actor, m.user_id));
$$;

revoke execute on function public.send_to_other_members(uuid, uuid, text) from public, anon, authenticated;

create function public.broadcast_member_change() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.last_read_at is distinct from old.last_read_at then
    perform public.send_to_other_members(new.connection_id, new.user_id, 'read');
  end if;
  if new.media_consent is distinct from old.media_consent then
    perform public.send_to_other_members(new.connection_id, new.user_id, 'media-consent');
  end if;
  return null;
end;
$$;

revoke execute on function public.broadcast_member_change() from public, anon, authenticated;

create trigger broadcast_on_member_change after update of last_read_at, media_consent
  on public.connection_members for each row execute function public.broadcast_member_change();

-- A proposal comes from its proposer, an answer from whoever answered (null: a lapse, both sides).
create function public.broadcast_mode_change() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.send_to_other_members(new.connection_id,
    case when tg_op = 'INSERT' then new.proposed_by else auth.uid() end, 'mode-change');
  return null;
end;
$$;

revoke execute on function public.broadcast_mode_change() from public, anon, authenticated;

create trigger broadcast_on_mode_change after insert or update of outcome
  on public.connection_mode_changes for each row execute function public.broadcast_mode_change();
