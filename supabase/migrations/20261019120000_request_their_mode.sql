-- Decision 39: a request goes under any Mode of the recipient that the sender may see in Discover
-- (Casual only when both chose it; a Dating Mode only when the dating checks pass). Directional now:
-- a is the sender (or proposer), b the recipient. Internal.
create or replace function public.eligible_modes(a uuid, b uuid) returns public.mode[]
language sql stable
set search_path = ''
as $$
  select public.discover_modes(a, b);
$$;

-- Mode Changes follow the same rule: the proposer sends, the other side receives.
create or replace function public.propose_mode_change(connection_id uuid, to_mode public.mode) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  conn public.connections;
  new_id uuid;
begin
  -- Locked so both sides proposing at once get a clear refusal rather than an index violation.
  select * into conn from public.connections c
  where c.id = propose_mode_change.connection_id and auth.uid() in (c.requester_id, c.addressee_id)
    and c.status = 'accepted'
  for update;
  if not found then
    raise exception 'no connection to change';
  end if;
  if propose_mode_change.to_mode = conn.mode then
    raise exception 'the connection is already in that mode';
  end if;
  if not propose_mode_change.to_mode = any (public.eligible_modes(auth.uid(),
      case when auth.uid() = conn.requester_id then conn.addressee_id else conn.requester_id end)) then
    raise exception 'that mode is not open between you';
  end if;
  if exists (select 1 from public.connection_mode_changes m
             where m.connection_id = conn.id and m.proposed_by = auth.uid() and m.outcome = 'declined'
               and m.decided_at > now() - interval '7 days') then
    raise exception 'your last mode change was declined recently';
  end if;
  -- An open proposal older than 7 days has lapsed; record that so it frees the slot.
  update public.connection_mode_changes m
  set outcome = 'lapsed', decided_at = now()
  where m.connection_id = conn.id and m.outcome is null and m.proposed_at <= now() - interval '7 days';
  if exists (select 1 from public.connection_mode_changes m
             where m.connection_id = conn.id and m.outcome is null) then
    raise exception 'there is already an open mode change';
  end if;
  insert into public.connection_mode_changes (connection_id, proposed_by, from_mode, to_mode)
  values (conn.id, auth.uid(), conn.mode, propose_mode_change.to_mode)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.respond_mode_change(change_id uuid, accept boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  change public.connection_mode_changes;
begin
  update public.connection_mode_changes
  set outcome = case when accept then 'accepted' else 'declined' end::public.mode_change_outcome,
      decided_at = now()
  where id = change_id and outcome is null and proposed_at > now() - interval '7 days'
    and proposed_by is distinct from auth.uid()
    and exists (select 1 from public.connections c
                where c.id = connection_id and auth.uid() in (c.requester_id, c.addressee_id)
                  and c.status = 'accepted')
  returning * into change;
  if not found then
    raise exception 'no mode change to answer';
  end if;
  if accept then
    update public.connections c set mode = change.to_mode
    where c.id = change.connection_id
      and change.to_mode = any (public.eligible_modes(change.proposed_by, auth.uid()));
    if not found then
      raise exception 'that mode is no longer open between you';
    end if;
  end if;
end;
$$;

