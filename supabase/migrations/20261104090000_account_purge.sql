-- #96: the account-purge function finishes delete_account(): R2 media first, then the auth user (the cascade
-- erases the rest). The rules for what goes live here; the function only deletes what these return.

-- Survives the cascade (no foreign keys), so admins can show an erasure was carried out.
create table public.completed_erasures (
  member_id uuid primary key,
  requested_at timestamptz not null,
  completed_at timestamptz not null default now(),
  objects_deleted integer not null check (objects_deleted >= 0)
);
alter table public.completed_erasures enable row level security;
revoke all on public.completed_erasures from anon, authenticated;
grant select on public.completed_erasures to authenticated;
create policy "admins read completed erasures" on public.completed_erasures for select to authenticated
  using (public.is_admin());

create function public.erasure_queue() returns table (member_id uuid, requested_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select r.user_id, min(r.created_at) from public.data_requests r
  where r.kind = 'erasure' and r.status = 'pending'
  group by r.user_id order by 2;
$$;

-- Everything in R2 the cascade leaves without a row: the Member's photos and uploads, and the media on
-- both sides of their chats (both sides' messages go). Report evidence points at the original key, so it stays.
create function public.erasure_media_keys(member uuid) returns setof text
language sql stable security definer
set search_path = ''
as $$
  with chats as (
    select c.id from public.connections c where member in (c.requester_id, c.addressee_id)
  ), keys as (
    select p.object_key from public.photos p where p.user_id = member
    union select 'uploads/' || u.object_key from public.photo_uploads u where u.user_id = member
    union select m.media_key from public.messages m where m.connection_id in (select id from chats)
      and m.media_key is not null
    union select u.media_key from public.chat_uploads u where u.connection_id in (select id from chats)
      and u.confirmed_at is not null
    union select 'uploads/' || u.media_key from public.chat_uploads u where u.connection_id in (select id from chats)
      and u.confirmed_at is null
  )
  select k.object_key from keys k
  where not exists (select 1 from public.reports r where r.evidence_media_key = k.object_key)
  order by 1;
$$;

create function public.record_erasure(member uuid, requested_at timestamptz, objects_deleted integer) returns void
language sql security definer
set search_path = ''
as $$
  insert into public.completed_erasures (member_id, requested_at, objects_deleted)
  values (member, requested_at, objects_deleted)
  on conflict (member_id) do nothing;
$$;

revoke execute on function public.erasure_queue(), public.erasure_media_keys(uuid),
  public.record_erasure(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.erasure_queue(), public.erasure_media_keys(uuid),
  public.record_erasure(uuid, timestamptz, integer) to service_role;

-- Hourly; the founder stores the project URL and service role key in Vault (supabase/README.md).
select cron.schedule('account-purge', '15 * * * *', $job$
  with secrets as (
    select max(decrypted_secret) filter (where name = 'project_url') as project_url,
           max(decrypted_secret) filter (where name = 'service_role_key') as service_role_key
    from vault.decrypted_secrets where name in ('project_url', 'service_role_key')
  )
  select net.http_post(
    url := project_url || '/functions/v1/account-purge',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000)
  from secrets
$job$);
