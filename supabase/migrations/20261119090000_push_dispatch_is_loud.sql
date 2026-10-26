-- #202: pushes never arrived and nothing said why. `dispatch_push` reads the project URL and
-- service role key from Vault, and returned quietly when either was missing, so a project set up
-- without them queued pushes for ever in silence. The same silence hid the evidence copy job.
--
-- They now warn, which reaches the Postgres logs, and `push_health()` answers the question
-- "is this working?" from the dashboard without reading the secrets themselves.
create or replace function public.dispatch_push(queue_id bigint) returns void
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
    raise warning 'push not sent: project_url or service_role_key is missing from Vault';
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

create or replace function public.dispatch_evidence_copies() returns void
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
    raise warning 'evidence copy not started: project_url or service_role_key is missing from Vault';
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

-- Admins only: what to look at when someone says pushes aren't arriving. It says whether the two
-- secrets the dispatch needs are set, never what they are.
create function public.push_health() returns table (
  vault_ready boolean,
  devices integer,
  queued integer,
  never_handed_over integer,
  oldest_queued_minutes integer
)
language sql stable security definer
set search_path = ''
as $$
  select
    (select count(*) = 2 from vault.decrypted_secrets
     where name in ('project_url', 'service_role_key') and decrypted_secret is not null),
    (select count(*)::integer from public.device_tokens),
    (select count(*)::integer from public.push_queue),
    (select count(*)::integer from public.push_queue where handed_over_at is null),
    (select coalesce(max(extract(epoch from now() - created_at) / 60), 0)::integer
     from public.push_queue)
  where public.is_admin();
$$;

revoke execute on function public.push_health() from public, anon;
