-- #167: a push FCM couldn't take for now (429, 5xx) or that never reached the push function
-- (no Vault secrets yet, pg_net down) is sent again, if still wanted; one an hour old is dropped.

-- When the push was last handed to the push function, so a push still in pg_net's backlog isn't sent twice.
alter table public.push_queue add column handed_over_at timestamptz;

-- Hands one queued push to the push function; without the Vault secrets, or if pg_net fails,
-- the row just waits for the retry job.
create function public.dispatch_push(queue_id bigint) returns void
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
    return;
  end if;
  begin
    perform net.http_post(
      url := project_url || '/functions/v1/push',
      body := jsonb_build_object('id', dispatch_push.queue_id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key));
    update public.push_queue q set handed_over_at = now() where q.id = dispatch_push.queue_id;
  exception when others then
    raise warning 'push dispatch failed: %', sqlerrm;
  end;
end;
$$;
revoke execute on function public.dispatch_push(bigint) from public, anon, authenticated;

create or replace function public.push_queue_dispatch() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.dispatch_push(new.id);
  return null;
end;
$$;

-- The push function deletes a row once sent, so a row still here was refused for now or never
-- handed over. enqueue_push's checks ran when it was queued; a retry checks again, since the
-- recipient may have been banned, turned that kind off, muted the chat or lost the Connection.
create function public.retry_queued_pushes() returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  queued bigint;
begin
  delete from public.push_queue q where q.created_at <= now() - interval '1 hour';
  delete from public.push_queue q
  using public.profiles p
  where p.id = q.recipient_id
    and (p.status <> 'active' or p.deleted_at is not null
         or not case when q.data->>'kind' in ('join_request', 'join_accepted') then p.notify_activities
                     else p.notify_messages end
         or exists (select 1 from public.connections c
                    where c.id = (q.data->>'connectionId')::uuid and c.status not in ('requested', 'accepted'))
         or (q.data->>'kind' = 'message'
             and exists (select 1 from public.connection_members m
                         where m.connection_id = (q.data->>'connectionId')::uuid
                           and m.user_id = q.recipient_id and m.muted)));
  for queued in
    select q.id from public.push_queue q
    where (q.handed_over_at is null and q.created_at <= now() - interval '1 minute')
       or q.handed_over_at <= now() - interval '5 minutes'
    order by q.id
  loop
    perform public.dispatch_push(queued);
  end loop;
end;
$$;
revoke execute on function public.retry_queued_pushes() from public, anon, authenticated;

create index on public.push_queue (created_at);

select cron.schedule('retry-queued-pushes', '*/5 * * * *', 'select public.retry_queued_pushes()');
