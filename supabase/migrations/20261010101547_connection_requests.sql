create type public.connection_status as enum ('requested', 'accepted', 'declined', 'closed');

-- Per-pair history rows (ADR 0001); writes only through the functions below.
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  mode public.mode not null,
  note varchar(200),
  status public.connection_status not null default 'requested',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  closed_at timestamptz,
  closed_by uuid references public.profiles (id) on delete set null,
  check (requester_id <> addressee_id)
);
create unique index connections_one_active_per_pair on public.connections
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  where status in ('requested', 'accepted');
create index on public.connections (addressee_id);
create index on public.connections (requester_id, created_at);
alter table public.connections enable row level security;
revoke all on public.connections from anon, authenticated;
grant select on public.connections to authenticated;

create policy "the two Members read their Connection" on public.connections for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create function public.send_request(to_member uuid, mode public.mode, note varchar default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  -- One send at a time per sender, so concurrent calls cannot slip past the Request Cap.
  perform 1 from public.profiles where id = me for update;
  if (select paused_at is not null from public.profiles where id = me) then
    raise exception 'unpause your profile to send requests';
  end if;
  if not public.is_visible(me) then
    raise exception 'your profile is not visible';
  end if;
  if public.is_blocked(me, to_member) or not public.is_visible(to_member) then
    raise exception 'you cannot send a request to this member';
  end if;
  if not send_request.mode = any (public.eligible_modes(me, to_member)) then
    raise exception 'that mode is not open between you';
  end if;
  if exists (select 1 from public.connections c
             where least(c.requester_id, c.addressee_id) = least(me, to_member)
               and greatest(c.requester_id, c.addressee_id) = greatest(me, to_member)
               and c.status in ('requested', 'accepted')) then
    raise exception 'you already have a connection or request with this member';
  end if;
  if exists (select 1 from public.connections c
             where c.requester_id = me and c.addressee_id = to_member and c.status = 'declined'
               and c.responded_at > now() - interval '30 days') then
    raise exception 'this member declined your request recently';
  end if;
  if (select count(*) from public.connections
      where requester_id = me and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'you have sent 10 requests in the last 24 hours';
  end if;
  insert into public.connections (requester_id, addressee_id, mode, note)
  values (me, to_member, send_request.mode, send_request.note)
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.send_request(uuid, public.mode, varchar) from public, anon;

-- Only the recipient answers, and only while the request is pending.
create function public.respond_request(connection_id uuid, accept boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.connections
  set status = case when accept then 'accepted' else 'declined' end::public.connection_status,
      responded_at = now()
  where id = connection_id and addressee_id = auth.uid() and status = 'requested';
  if not found then
    raise exception 'no request to answer';
  end if;
end;
$$;

revoke execute on function public.respond_request(uuid, boolean) from public, anon;

-- Either side closes an accepted Connection; the row stays as history.
create function public.close_connection(connection_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.connections
  set status = 'closed', closed_at = now(), closed_by = auth.uid()
  where id = connection_id and auth.uid() in (requester_id, addressee_id) and status = 'accepted';
  if not found then
    raise exception 'no connection to close';
  end if;
end;
$$;

revoke execute on function public.close_connection(uuid) from public, anon;

-- A Block also closes the pair's pending or accepted Connection.
create or replace function public.block_user(member_id uuid) returns void
language sql security definer
set search_path = ''
as $$
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), member_id)
  on conflict do nothing;
  update public.connections
  set status = 'closed', closed_at = now(), closed_by = auth.uid()
  where least(requester_id, addressee_id) = least(auth.uid(), member_id)
    and greatest(requester_id, addressee_id) = greatest(auth.uid(), member_id)
    and status in ('requested', 'accepted');
$$;
