-- Push notifications (#36, decision 47): device tokens, notification settings, and a queue the
-- push Edge Function drains. Triggers write the queue; a queue trigger calls the function.

create table public.device_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  last_seen_at timestamptz not null default now()
);
create index on public.device_tokens (user_id);
alter table public.device_tokens enable row level security;
revoke all on public.device_tokens from anon, authenticated;
grant select, delete on public.device_tokens to authenticated;

create policy "Members read their own device tokens" on public.device_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Members delete their own device tokens" on public.device_tokens
  for delete to authenticated using (user_id = (select auth.uid()));

-- A token belongs to whoever last signed in on that phone.
create function public.register_device_token(token text, platform text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if not exists (select 1 from public.profiles where id = me) then
    raise exception 'create your profile first';
  end if;
  if platform is null or platform not in ('android', 'ios') then
    raise exception 'choose android or ios';
  end if;
  insert into public.device_tokens as d (token, user_id, platform, last_seen_at)
  values (register_device_token.token, me, register_device_token.platform, now())
  on conflict on constraint device_tokens_pkey do update
    set user_id = excluded.user_id, platform = excluded.platform, last_seen_at = excluded.last_seen_at;
end;
$$;
revoke execute on function public.register_device_token(text, text) from public, anon;
grant execute on function public.register_device_token(text, text) to authenticated;

alter table public.profiles
  add column notify_messages boolean not null default true,
  add column notify_activities boolean not null default true;
grant update (notify_messages, notify_activities) on public.profiles to authenticated;

create table public.push_queue (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.push_queue enable row level security;
revoke all on public.push_queue from anon, authenticated;

-- Queues a push when the recipient wants that kind ('messages' or 'activities').
create function public.enqueue_push(recipient uuid, setting text, title text, body text, data jsonb) returns void
language sql security definer
set search_path = ''
as $$
  insert into public.push_queue (recipient_id, title, body, data)
  select p.id, enqueue_push.title, enqueue_push.body, enqueue_push.data
  from public.profiles p
  where p.id = recipient
    and p.status = 'active' and p.deleted_at is null
    and case setting when 'messages' then p.notify_messages when 'activities' then p.notify_activities end;
$$;

create function public.display_name_of(member_id uuid) returns text
language sql stable security definer
set search_path = ''
as $$ select coalesce(p.display_name, 'Someone') from public.profiles p where p.id = member_id $$;

revoke execute on function public.enqueue_push(uuid, text, text, text, jsonb), public.display_name_of(uuid)
  from public, anon, authenticated;

create function public.push_on_connection() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  -- Activity Connections are announced by the Join Request pushes.
  if new.activity_id is not null then
    return null;
  end if;
  if tg_op = 'INSERT' and new.status = 'requested' then
    perform public.enqueue_push(new.addressee_id, 'messages', 'New Connection Request',
      public.display_name_of(new.requester_id) || ' wants to connect.',
      jsonb_build_object('kind', 'request', 'connectionId', new.id));
  elsif tg_op = 'UPDATE' and old.status = 'requested' and new.status = 'accepted'
    -- A pending request accepted by the host accepting a join in this transaction.
    and not exists (select 1 from public.activity_requests r join public.activities a on a.id = r.activity_id
                    where r.status = 'accepted' and r.responded_at = now()
                      and least(r.requester_id, a.host_id) = least(new.requester_id, new.addressee_id)
                      and greatest(r.requester_id, a.host_id) = greatest(new.requester_id, new.addressee_id)) then
    perform public.enqueue_push(new.requester_id, 'messages',
      public.display_name_of(new.addressee_id) || ' accepted your request', 'Say hello.',
      jsonb_build_object('kind', 'accepted', 'connectionId', new.id));
  end if;
  return null;
end;
$$;
create trigger push_on_connection_insert after insert on public.connections
  for each row execute function public.push_on_connection();
create trigger push_on_connection_update after update of status on public.connections
  for each row execute function public.push_on_connection();

create function public.push_on_message() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  recipient uuid;
begin
  select m.user_id into recipient from public.connection_members m
  where m.connection_id = new.connection_id and m.user_id <> new.sender_id and not m.muted;
  if recipient is not null then
    perform public.enqueue_push(recipient, 'messages', public.display_name_of(new.sender_id),
      case new.type when 'text' then new.body when 'image' then 'Sent a photo' when 'video' then 'Sent a video'
                    when 'voice' then 'Sent a voice note' else 'Shared an activity' end,
      jsonb_build_object('kind', 'message', 'connectionId', new.connection_id));
  end if;
  return null;
end;
$$;
create trigger push_on_message after insert on public.messages
  for each row execute function public.push_on_message();

create function public.push_on_join_request() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  act public.activities;
begin
  select * into act from public.activities a where a.id = new.activity_id;
  if tg_op = 'INSERT' and new.status = 'requested' then
    perform public.enqueue_push(act.host_id, 'activities', 'New Join Request',
      public.display_name_of(new.requester_id) || ' asks to join ' || act.title || '.',
      jsonb_build_object('kind', 'join_request', 'activityId', act.id));
  elsif tg_op = 'UPDATE' and old.status = 'requested' and new.status = 'accepted' then
    perform public.enqueue_push(new.requester_id, 'activities', 'You''re going',
      public.display_name_of(act.host_id) || ' accepted you for ' || act.title || '.',
      jsonb_build_object('kind', 'join_accepted', 'activityId', act.id));
  end if;
  return null;
end;
$$;
create trigger push_on_join_request_insert after insert on public.activity_requests
  for each row execute function public.push_on_join_request();
create trigger push_on_join_request_update after update of status on public.activity_requests
  for each row execute function public.push_on_join_request();

-- Hands each queued push to the push function. The founder stores the project URL and service
-- role key in Vault (supabase/README.md); without them, or if pg_net fails, the row just waits.
create function public.push_queue_dispatch() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  project_url text;
  service_role_key text;
begin
  select max(decrypted_secret) filter (where name = 'project_url'),
         max(decrypted_secret) filter (where name = 'service_role_key')
    into project_url, service_role_key
  from vault.decrypted_secrets where name in ('project_url', 'service_role_key');
  if project_url is null or service_role_key is null then
    return null;
  end if;
  begin
    perform net.http_post(
      url := project_url || '/functions/v1/push',
      body := jsonb_build_object('id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key));
  exception when others then
    raise warning 'push dispatch failed: %', sqlerrm;
  end;
  return null;
end;
$$;
create trigger push_queue_dispatch after insert on public.push_queue
  for each row execute function public.push_queue_dispatch();

revoke execute on function public.push_on_connection(), public.push_on_message(), public.push_on_join_request(),
  public.push_queue_dispatch() from public, anon, authenticated;
