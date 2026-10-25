-- #160 (decision 62): report evidence is a copy under `evidence/`, not the live file.
-- Before this, a report pointed at the original key, so the account purge (#96) and the chat
-- media purge (#97) had to skip it and nothing ever deleted it.

alter table public.reports
  add column evidence_source_key text,
  add column evidence_copied_at timestamptz;

comment on column public.reports.evidence_source_key is
  'The live media key the evidence was taken from; null once there is nothing left to copy from.';
comment on column public.reports.evidence_media_key is
  'Where the evidence copy lives in R2 (`evidence/<report id><ext>`), set before insert.';

create function public.evidence_key_for(report_id uuid, source_key text) returns text
language sql immutable
set search_path = ''
as $$
  select 'evidence/' || report_id::text
    || coalesce(substring(source_key from '\.[A-Za-z0-9]+$'), '');
$$;

-- Every report insert names a live media key; this turns it into the evidence copy's key and
-- keeps the original as the source, so report(), the word filter and admin takedown are unchanged.
create function public.set_report_evidence_key() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.evidence_media_key is null or new.evidence_media_key like 'evidence/%' then
    return new;
  end if;
  new.evidence_source_key := new.evidence_media_key;
  new.evidence_media_key := public.evidence_key_for(new.id, new.evidence_source_key);
  return new;
end;
$$;

create trigger set_report_evidence_key before insert on public.reports
for each row execute function public.set_report_evidence_key();

-- Reports made before this migration still point at the live file; bring them into the same
-- shape so one rule covers every report. Their copy is made by the same job.
update public.reports
set evidence_source_key = evidence_media_key,
    evidence_media_key = public.evidence_key_for(id, evidence_media_key)
where evidence_media_key is not null and evidence_media_key not like 'evidence/%';

-- Both purges used to skip any key a report held, for good: nothing ever deleted it. Now they
-- keep the original only until the evidence copy exists, and the copy has its own lifetime.
create or replace function public.evidence_pending_for(key text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.reports r
                 where r.evidence_source_key = key and r.evidence_copied_at is null);
$$;

create function public.erasure_media_keys_all(member uuid) returns setof text
language sql stable security definer
set search_path = ''
as $$
  with chats as (
    select c.id from public.connections c where member in (c.requester_id, c.addressee_id)
  ), keys as (
    select p.object_key from public.photos p where p.user_id = member
    -- Upload slots: the staged file, and the live one in case confirming stopped halfway.
    union select 'uploads/' || u.object_key from public.photo_uploads u where u.user_id = member
    union select u.object_key from public.photo_uploads u where u.user_id = member
    union select m.media_key from public.messages m where m.connection_id in (select id from chats)
      and m.media_key is not null and m.media_deleted_at is null
    union select u.media_key from public.chat_uploads u where u.connection_id in (select id from chats)
      and u.used_at is null
    union select 'uploads/' || u.media_key from public.chat_uploads u where u.connection_id in (select id from chats)
      and u.confirmed_at is null
  )
  select k.object_key from keys k order by 1;
$$;

create or replace function public.erasure_media_keys(member uuid) returns setof text
language sql stable security definer
set search_path = ''
as $$
  select k from public.erasure_media_keys_all(erasure_media_keys.member) k
  where not public.evidence_pending_for(k);
$$;

-- An erasure whose media still owes an evidence copy waits for the next hourly run: deleting the
-- account now would leave those files behind with nothing left to point at them.
create or replace function public.erasure_queue() returns table (member_id uuid, requested_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select r.user_id, min(r.created_at) from public.data_requests r
  where r.kind = 'erasure' and r.status = 'pending'
    and not exists (select 1 from public.erasure_media_keys_all(r.user_id) k
                    where public.evidence_pending_for(k))
  group by r.user_id order by 2;
$$;

revoke execute on function public.erasure_media_keys_all(uuid) from public, anon, authenticated;

-- A photo its owner deletes or replaces keeps its file while the evidence copy is pending, so a
-- report made moments earlier still gets its evidence. The copy job deletes the file afterwards.
create or replace function public.delete_photo(member_id uuid, photo_id uuid) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  gone public.photos;
begin
  delete from public.photos p where p.id = photo_id and p.user_id = member_id
  returning * into gone;
  if not found then
    raise exception 'no photo to delete';
  end if;
  return case when gone.removed_at is null and not public.evidence_pending_for(gone.object_key)
         then gone.object_key end;
end;
$$;


-- Chat media whose evidence copy is still pending is left out of this run rather than marked
-- expired: it comes back on a later run, once the copy exists, and is deleted then. Before, such a
-- file was marked expired and kept for ever (`keep_file`), which is the bug in #160.
drop function public.expired_chat_media(integer, uuid[]);
create function public.expired_chat_media(batch integer, skip uuid[] default '{}')
returns table (message_id uuid, media_key text)
language sql stable security definer
set search_path = ''
as $$
  select m.id, m.media_key
  from public.messages m
  where m.type in ('image', 'video', 'voice') and m.media_key is not null
    and m.media_deleted_at is null and m.created_at < now() - interval '90 days'
    and not (m.id = any (skip))
    and not public.evidence_pending_for(m.media_key)
  order by m.created_at, m.id
  limit least(greatest(batch, 1), 1000);
$$;

revoke execute on function public.expired_chat_media(integer, uuid[]) from public, anon, authenticated;
grant execute on function public.expired_chat_media(integer, uuid[]) to service_role;

revoke execute on function public.evidence_pending_for(text), public.evidence_key_for(uuid, text)
  from public, anon, authenticated, service_role;

-- The copy job and both purges look up a report by the key it was taken from.
create index reports_evidence_source_idx on public.reports (evidence_source_key)
  where evidence_source_key is not null and evidence_copied_at is null;

-- The copy job (the `copy-evidence` Edge Function). Oldest first, so a backlog clears in order;
-- `skip` is what this run failed on, so one stuck file doesn't hold back the reports behind it.
create function public.pending_evidence_copies(batch integer, skip uuid[] default '{}')
returns table (report_id uuid, source_key text, evidence_key text)
language sql stable security definer
set search_path = ''
as $$
  select r.id, r.evidence_source_key, r.evidence_media_key
  from public.reports r
  where r.evidence_source_key is not null and r.evidence_copied_at is null
    and not (r.id = any (skip))
  order by r.created_at, r.id
  limit least(greatest(batch, 1), 1000);
$$;

-- Stamps the copies that are through and hands back the originals nothing points at any more: a
-- photo deleted or replaced while the copy was pending, or media left behind by an account purge
-- that waited. The job deletes those files; everything else keeps its own lifecycle.
create function public.mark_evidence_copied(report_ids uuid[]) returns setof text
language sql security definer
set search_path = ''
as $$
  with copied as (
    update public.reports set evidence_copied_at = now()
    where id = any (report_ids) and evidence_copied_at is null
    returning evidence_source_key
  )
  select c.evidence_source_key from copied c
  where not exists (select 1 from public.photos p where p.object_key = c.evidence_source_key)
    and not exists (select 1 from public.photo_uploads u where u.object_key = c.evidence_source_key)
    and not exists (select 1 from public.messages m
                    where m.media_key = c.evidence_source_key and m.media_deleted_at is null);
$$;

revoke execute on function public.pending_evidence_copies(integer, uuid[]),
  public.mark_evidence_copied(uuid[]) from public, anon, authenticated;
grant execute on function public.pending_evidence_copies(integer, uuid[]),
  public.mark_evidence_copied(uuid[]) to service_role;

-- A report asks for its copy at once, and the job catches anything the call didn't get
-- through (the #167 lesson: a hand-over that fails must be retried, not lost). The function
-- takes its own batch, so the nudge carries no payload.
create function public.dispatch_evidence_copies() returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  project_url text;
  service_role_key text;
begin
  if not exists (select 1 from public.pending_evidence_copies(1)) then
    return;
  end if;
  select max(decrypted_secret) filter (where name = 'project_url'),
         max(decrypted_secret) filter (where name = 'service_role_key')
    into project_url, service_role_key
  from vault.decrypted_secrets where name in ('project_url', 'service_role_key');
  if project_url is null or service_role_key is null then
    return;
  end if;
  begin
    perform net.http_post(
      url := project_url || '/functions/v1/copy-evidence',
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'Authorization', 'Bearer ' || service_role_key),
      timeout_milliseconds := 120000);
  exception when others then
    raise warning 'evidence copy dispatch failed: %', sqlerrm;
  end;
end;
$$;

create function public.request_evidence_copy() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.evidence_source_key is not null and new.evidence_copied_at is null then
    perform public.dispatch_evidence_copies();
  end if;
  return null;
end;
$$;

create trigger request_evidence_copy after insert on public.reports
for each row execute function public.request_evidence_copy();

revoke execute on function public.dispatch_evidence_copies(),
  public.set_report_evidence_key(), public.request_evidence_copy()
  from public, anon, authenticated, service_role;

select cron.schedule('copy-report-evidence', '*/15 * * * *',
  'select public.dispatch_evidence_copies()');
