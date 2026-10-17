-- #97: Media Expiry (decision 17). The purge-chat-media function deletes what these return; the rules live here.

-- Oldest first; a file a report keeps as evidence is marked expired in the chat but stays in R2.
-- `skip`: files this run failed to delete, so they don't hold back the media behind them.
create function public.expired_chat_media(batch integer, skip uuid[] default '{}')
returns table (message_id uuid, media_key text, keep_file boolean)
language sql stable security definer
set search_path = ''
as $$
  select m.id, m.media_key,
         exists (select 1 from public.reports r where r.evidence_media_key = m.media_key)
  from public.messages m
  where m.type in ('image', 'video', 'voice') and m.media_key is not null
    and m.media_deleted_at is null and m.created_at < now() - interval '90 days'
    and not (m.id = any (skip))
  order by m.created_at, m.id
  limit least(greatest(batch, 1), 1000);
$$;

create function public.mark_chat_media_deleted(message_ids uuid[]) returns void
language sql security definer
set search_path = ''
as $$
  update public.messages set media_deleted_at = now()
  where id = any (message_ids) and media_deleted_at is null;
$$;

revoke execute on function public.expired_chat_media(integer, uuid[]), public.mark_chat_media_deleted(uuid[])
  from public, anon, authenticated;
grant execute on function public.expired_chat_media(integer, uuid[]), public.mark_chat_media_deleted(uuid[]) to service_role;

-- The daily scan only looks at media not yet expired.
create index messages_live_media_idx on public.messages (created_at)
  where media_key is not null and media_deleted_at is null;

-- The function works for up to 100 s, so the job waits 120 s (the job from #20 waited 60 s).
select cron.schedule('purge-chat-media', '30 21 * * *', $job$
  with secrets as (
    select max(decrypted_secret) filter (where name = 'project_url') as project_url,
           max(decrypted_secret) filter (where name = 'service_role_key') as service_role_key
    from vault.decrypted_secrets where name in ('project_url', 'service_role_key')
  )
  select net.http_post(
    url := project_url || '/functions/v1/purge-chat-media',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000)
  from secrets
$job$);
