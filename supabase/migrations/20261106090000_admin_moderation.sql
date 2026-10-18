-- Admin moderation (#18): Takedown, Restore and Ban, each audited.

-- The audit log. No foreign keys, so deleting an account never has to change an entry.
create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  action text not null,
  target_type text not null,
  target_id uuid not null,
  note text,
  created_at timestamptz not null default now()
);
create index admin_actions_target on public.admin_actions (target_id);
alter table public.admin_actions enable row level security;
revoke all on public.admin_actions from public, anon, authenticated;
grant select on public.admin_actions to authenticated;
create policy "Admins read the audit log" on public.admin_actions
  for select to authenticated using ((select public.is_admin()));

-- Grants stop clients; this stops everyone else, the service role included.
create function public.refuse_audit_change() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'the audit log cannot be changed';
end;
$$;
create trigger admin_actions_append_only
  before update or delete on public.admin_actions
  for each row execute function public.refuse_audit_change();
create trigger admin_actions_no_truncate
  before truncate on public.admin_actions
  for each statement execute function public.refuse_audit_change();

create function public.audit(action text, target_type text, target_id uuid, note text) returns void
language sql
set search_path = ''
as $$
  insert into public.admin_actions (admin_id, action, target_type, target_id, note)
  values (auth.uid(), audit.action, audit.target_type, audit.target_id, audit.note);
$$;
revoke execute on function public.audit(text, text, uuid, text) from public, anon, authenticated;

-- Acting on a target settles the reports still open on it.
create function public.close_reports(target_type public.report_target, target_id uuid,
  outcome public.report_status) returns void
language sql
set search_path = ''
as $$
  update public.reports r set status = close_reports.outcome, handled_by = auth.uid(), handled_at = now()
  where r.target_type = close_reports.target_type and r.target_id = close_reports.target_id
    and r.status = 'open';
$$;
revoke execute on function public.close_reports(public.report_target, uuid, public.report_status)
  from public, anon, authenticated;

create function public.admin_takedown(target_type public.report_target, target_id uuid, note text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  case admin_takedown.target_type
    when 'photo' then
      update public.photos ph set removed_at = now(), removed_by = auth.uid()
      where ph.id = admin_takedown.target_id and ph.removed_at is null;
    when 'message' then
      update public.messages m set removed_at = now()
      where m.id = admin_takedown.target_id and m.removed_at is null;
    when 'activity' then
      update public.activities a set status = 'removed'
      where a.id = admin_takedown.target_id and a.status <> 'removed';
    else
      raise exception 'ban the member instead';
  end case;
  if not found then
    raise exception 'nothing to take down';
  end if;
  perform public.close_reports(admin_takedown.target_type, admin_takedown.target_id, 'actioned');
  perform public.audit('takedown', admin_takedown.target_type::text, admin_takedown.target_id, admin_takedown.note);
end;
$$;
revoke execute on function public.admin_takedown(public.report_target, uuid, text) from public, anon;

-- A taken-down message is gone for both sides; admins see it through its report's evidence.
drop policy "Members read messages in their Connections" on public.messages;
create policy "Members read messages in their Connections" on public.messages for select to authenticated
  using (connection_id in (select id from public.connections) and removed_at is null);

-- Reports a Restore dismissed no longer count toward Auto-hide, and a banned Member cannot report.
create or replace function public.report(
  target_type public.report_target,
  target_id uuid,
  reason public.report_reason,
  details text default null
) returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  owner uuid;
  snapshot jsonb;
  evidence_media text;
  clean_details text := nullif(trim(report.details), '');
begin
  if not exists (select 1 from public.profiles where id = me and deleted_at is null and status <> 'banned') then
    raise exception 'sign in first';
  end if;
  if report.reason is null or report.reason = 'word_filter' then
    raise exception 'choose a reason';
  end if;
  if char_length(clean_details) > 500 then
    raise exception 'keep details to 500 characters';
  end if;

  case report.target_type
    when 'profile' then
      select p.id,
             jsonb_build_object(
               'display_name', p.display_name,
               'prompts', coalesce((
                 select jsonb_agg(jsonb_build_object('question', q.text, 'answer', pp.answer)
                                  order by pp.position)
                 from public.profile_prompts pp
                 join public.prompt_questions q on q.id = pp.question_id
                 where pp.user_id = p.id), '[]'::jsonb))
        into owner, snapshot
      from public.profiles p
      where p.id = report.target_id and p.deleted_at is null;
    when 'photo' then
      select ph.user_id, jsonb_build_object('owner_id', ph.user_id, 'object_key', ph.object_key),
             ph.object_key
        into owner, snapshot, evidence_media
      from public.photos ph
      where ph.id = report.target_id and ph.uploaded_at is not null;
    when 'message' then
      select m.sender_id, public.message_evidence(m), m.media_key
        into owner, snapshot, evidence_media
      from public.messages m
      join public.connections c on c.id = m.connection_id
      where m.id = report.target_id and me in (c.requester_id, c.addressee_id);
    when 'activity' then
      select a.host_id,
             jsonb_build_object('title', a.title, 'description', a.description, 'type', a.type,
                                'area_id', a.area_id, 'starts_at', a.starts_at, 'host_id', a.host_id)
        into owner, snapshot
      from public.activities a
      where a.id = report.target_id;
    else
      null;  -- a null target_type falls through to 'nothing to report'
  end case;

  if owner is null or owner = me then
    raise exception 'nothing to report';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, target_user_id, reason, details,
                              evidence, evidence_media_key)
  values (me, report.target_type, report.target_id, owner, report.reason, clean_details, snapshot, evidence_media);

  if report.target_type = 'message' then
    return;
  end if;

  -- Serialise reports on one target so concurrent third reports can't both miss the count.
  perform pg_advisory_xact_lock(hashtextextended(report.target_id::text, 0));
  -- Word-filter flags have no reporter, and count(distinct) skips nulls.
  if (select count(distinct r.reporter_id) from public.reports r
      where r.target_type = report.target_type and r.target_id = report.target_id
        and r.created_at > now() - interval '7 days' and r.status <> 'dismissed') >= 3 then
    case report.target_type
      when 'profile' then
        update public.profiles set hidden_at = now() where id = report.target_id and hidden_at is null;
      when 'photo' then
        update public.photos set hidden_at = now() where id = report.target_id and hidden_at is null;
      when 'activity' then
        update public.activities set hidden_at = now() where id = report.target_id and hidden_at is null;
    end case;
  end if;
end;
$$;

-- Clears Auto-hide. Messages are never Auto-hidden.
create function public.admin_restore(target_type public.report_target, target_id uuid, note text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  -- The lock report() takes, so a report counted before the restore can't hide the target after it.
  perform pg_advisory_xact_lock(hashtextextended(admin_restore.target_id::text, 0));
  case admin_restore.target_type
    when 'profile' then
      update public.profiles p set hidden_at = null
      where p.id = admin_restore.target_id and p.hidden_at is not null;
    when 'photo' then
      update public.photos ph set hidden_at = null
      where ph.id = admin_restore.target_id and ph.hidden_at is not null;
    when 'activity' then
      update public.activities a set hidden_at = null
      where a.id = admin_restore.target_id and a.hidden_at is not null;
    else
      raise exception 'nothing to restore';
  end case;
  if not found then
    raise exception 'nothing to restore';
  end if;
  perform public.close_reports(admin_restore.target_type, admin_restore.target_id, 'dismissed');
  perform public.audit('restore', admin_restore.target_type::text, admin_restore.target_id, admin_restore.note);
end;
$$;
revoke execute on function public.admin_restore(public.report_target, uuid, text) from public, anon;

-- Bans a Member: their Connections close (chats turn read-only for the other side), their Join
-- Requests are withdrawn, their open Activities cancelled and their Circle memberships removed.
create function public.admin_ban(member_id uuid, reason text) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  if nullif(btrim(admin_ban.reason), '') is null then
    raise exception 'give a reason for the ban';
  end if;
  update public.profiles p set status = 'banned', banned_at = now(), banned_reason = admin_ban.reason
  where p.id = admin_ban.member_id and p.status <> 'banned';
  if not found then
    raise exception 'nothing to ban';
  end if;

  -- closed_by references profiles, which an admin may not have; the banned side closes it.
  update public.connections c set status = 'closed', closed_at = now(), closed_by = admin_ban.member_id
  where admin_ban.member_id in (c.requester_id, c.addressee_id) and c.status in ('requested', 'accepted');

  -- Only what hasn't started: an Activity that already happened keeps its history (decision 35).
  update public.activity_requests r
  set status = case when r.status = 'accepted' then 'withdrawn' else 'cancelled' end::public.request_status,
      withdrawn_at = case when r.status = 'accepted' then now() end
  from public.activities a
  where a.id = r.activity_id and a.starts_at > now()
    and r.requester_id = admin_ban.member_id and r.status in ('requested', 'accepted');

  update public.activities a set status = 'cancelled'
  where a.host_id = admin_ban.member_id and a.status = 'open' and a.starts_at > now();

  delete from public.circle_members cm where cm.user_id = admin_ban.member_id;

  -- Everything reported about the Member is settled: their profile, photos, messages and Activities.
  update public.reports r set status = 'actioned', handled_by = auth.uid(), handled_at = now()
  where r.target_user_id = admin_ban.member_id and r.status = 'open';
  perform public.audit('ban', 'profile', admin_ban.member_id, admin_ban.reason);
end;
$$;
revoke execute on function public.admin_ban(uuid, text) from public, anon;
