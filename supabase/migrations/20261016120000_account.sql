-- Account (#20): consent withdrawal, data requests, account deletion, daily chat-media purge.

-- Has the Member withdrawn a current required consent? They stay out of sight until they accept again
-- (decision 37). Internal, so no client role can run it.
create function public.consent_withdrawn(member_id uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select exists (select 1 from public.consents c
                 where c.user_id = member_id and c.withdrawn_at is not null
                   and c.document_id in (select d.id from public.current_consent_documents() as d (id)));
$$;

revoke execute on function public.consent_withdrawn(uuid) from public, anon, authenticated;

create or replace function public.is_visible(member_id uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = member_id
      and p.status = 'active'
      and p.submitted_at is not null
      and p.paused_at is null
      and p.hidden_at is null
      and p.deleted_at is null
      and (select count(*) from public.photos ph
           where ph.user_id = p.id and ph.uploaded_at is not null
             and ph.hidden_at is null and ph.removed_at is null) >= 2
  ) and not public.consent_withdrawn(member_id);
$$;

create or replace function public.can_see_activity(activity public.activities, viewer uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select activity.status = 'open'
    and activity.hidden_at is null
    and public.activity_ends_at(activity) > now()
    and not public.is_blocked(viewer, activity.host_id)
    -- A Paused host's plans still stand; an Auto-hidden, banned, deleted or consent-withdrawn host's leave the board.
    and exists (select 1 from public.profiles h
                where h.id = activity.host_id and h.status <> 'banned' and h.deleted_at is null
                  and h.hidden_at is null)
    and not public.consent_withdrawn(activity.host_id);
$$;

-- The caller's own accepted, not yet withdrawn consent to that document.
create function public.withdraw_consent(document_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.consents c set withdrawn_at = now()
  where c.user_id = auth.uid() and c.document_id = withdraw_consent.document_id and c.withdrawn_at is null;
  if not found then
    raise exception 'no consent to withdraw';
  end if;
end;
$$;

revoke execute on function public.withdraw_consent(uuid) from public, anon;

create type public.data_request_kind as enum ('access', 'erasure');
create type public.data_request_status as enum ('pending', 'done');

create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.data_request_kind not null,
  status public.data_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index data_requests_user_id_idx on public.data_requests (user_id);
alter table public.data_requests enable row level security;

-- Read only: requests are made through the functions below and completed by the founder or the purge.
revoke all on public.data_requests from public, anon, authenticated;
grant select on public.data_requests to authenticated;

create policy "Members read their own data requests" on public.data_requests
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Admins read every data request" on public.data_requests
  for select to authenticated using ((select public.is_admin()));

create function public.request_data_copy() returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if exists (select 1 from public.data_requests
             where user_id = auth.uid() and kind = 'access' and status = 'pending') then
    raise exception 'you already have a data copy request in progress';
  end if;
  insert into public.data_requests (user_id, kind) values (auth.uid(), 'access') returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.request_data_copy() from public, anon;

-- Hides the Member everywhere at once (every visibility and reachability check reads deleted_at) and
-- queues the erasure the account-purge function carries out.
create function public.delete_account() returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.profiles set deleted_at = now() where id = auth.uid() and deleted_at is null;
  if not found then
    raise exception 'your account is already being deleted';
  end if;
  insert into public.data_requests (user_id, kind) values (auth.uid(), 'erasure');
end;
$$;

revoke execute on function public.delete_account() from public, anon;

-- Media Expiry: daily at 03:00 India time (21:30 UTC), the purge-chat-media Edge Function deletes chat media
-- older than 90 days. The founder stores the project URL and service role key in Vault (supabase/README.md).
select cron.schedule('purge-chat-media', '30 21 * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/purge-chat-media',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000)
$job$);

-- A deleted Member's Connections leave the other side's chat list at once.
create or replace function public.my_connections() returns table (
  connection_id uuid,
  other_id uuid,
  other_name varchar,
  other_photo_id uuid,
  other_area_id text,
  mode public.mode,
  status public.connection_status,
  direction public.connection_direction,
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
    -- A hidden or removed cover gives way to the next live photo; banned or Auto-hidden
    -- Members stay in history without one until restored.
    case when o.status = 'active' and o.hidden_at is null then
      (select ph.id from public.photos ph
       where ph.user_id = o.id and ph.uploaded_at is not null
         and ph.hidden_at is null and ph.removed_at is null
       order by ph.position limit 1)
    end,
    o.area_id, c.mode, c.status, side.direction, c.note,
    last.type, last.body, last.created_at,
    (select count(*) from public.messages m
     where m.connection_id = c.id and m.sender_id <> auth.uid() and m.removed_at is null
       and m.created_at > coalesce(me.last_read_at, '-infinity'))::integer
  from public.connections c
  cross join lateral (
    select case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end,
           case when c.requester_id = auth.uid() then 'outgoing' else 'incoming' end::public.connection_direction
  ) side (other_id, direction)
  join public.profiles o on o.id = side.other_id
  left join public.connection_members me on me.connection_id = c.id and me.user_id = auth.uid()
  left join lateral (
    select m.type, m.body, m.created_at from public.messages m
    where m.connection_id = c.id and m.removed_at is null
    order by m.created_at desc limit 1
  ) last on true
  where auth.uid() in (c.requester_id, c.addressee_id)
    and c.status <> 'declined'
    and o.deleted_at is null
  order by coalesce(last.created_at, c.responded_at, c.created_at) desc;
$$;
