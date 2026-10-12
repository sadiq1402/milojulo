create type public.mode_change_outcome as enum ('accepted', 'declined', 'lapsed');

-- Every proposal and its outcome; doubles as the log of a Connection's Mode history.
create table public.connection_mode_changes (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  proposed_by uuid references public.profiles (id) on delete set null,
  from_mode public.mode not null,
  to_mode public.mode not null,
  proposed_at timestamptz not null default now(),
  outcome public.mode_change_outcome,
  decided_at timestamptz,
  check (from_mode <> to_mode)
);
create unique index connection_mode_changes_one_open on public.connection_mode_changes (connection_id)
  where outcome is null;
alter table public.connection_mode_changes enable row level security;
revoke all on public.connection_mode_changes from anon, authenticated;
grant select on public.connection_mode_changes to authenticated;

create policy "the two Members read their Connection's Mode Changes" on public.connection_mode_changes
  for select to authenticated
  using (exists (select 1 from public.connections c
                 where c.id = connection_id and (select auth.uid()) in (c.requester_id, c.addressee_id)));

create function public.propose_mode_change(connection_id uuid, to_mode public.mode) returns uuid
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
  if not propose_mode_change.to_mode = any (public.eligible_modes(conn.requester_id, conn.addressee_id)) then
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

revoke execute on function public.propose_mode_change(uuid, public.mode) from public, anon;

create function public.respond_mode_change(change_id uuid, accept boolean) returns void
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
      and change.to_mode = any (public.eligible_modes(c.requester_id, c.addressee_id));
    if not found then
      raise exception 'that mode is no longer open between you';
    end if;
  end if;
end;
$$;

revoke execute on function public.respond_mode_change(uuid, boolean) from public, anon;
