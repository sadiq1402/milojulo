-- Reports with evidence snapshots, and Auto-hide after 3 distinct reporters in 7 days.

create type public.report_target as enum ('profile', 'message', 'activity', 'photo');
create type public.report_reason as enum (
  'fake_or_spam', 'harassment', 'inappropriate_content', 'underage', 'felt_unsafe', 'other', 'word_filter');
create type public.report_status as enum ('open', 'actioned', 'dismissed');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  -- Null for word-filter flags and after the reporter's deletion.
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type public.report_target not null,
  target_id uuid not null,
  target_user_id uuid references public.profiles (id) on delete set null,
  reason public.report_reason not null,
  details varchar(500),
  evidence jsonb,
  evidence_media_key text,
  status public.report_status not null default 'open',
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,
  internal_note text,
  created_at timestamptz not null default now()
);
create index on public.reports (target_type, target_id, created_at);
create index on public.reports (status, created_at);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;

-- No Member policy at all: reporters can't read their reports back.
create policy "Admins read reports" on public.reports for select to authenticated
  using ((select public.is_admin()));

create function public.report(
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
  if not exists (select 1 from public.profiles where id = me and deleted_at is null) then
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
      select m.sender_id,
             jsonb_build_object('body', m.body, 'sender_id', m.sender_id, 'type', m.type,
                                'media_key', m.media_key, 'media_mime', m.media_mime,
                                'sent_at', m.created_at),
             m.media_key
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
        and r.created_at > now() - interval '7 days') >= 3 then
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

revoke execute on function public.report(public.report_target, uuid, public.report_reason, text)
  from public, anon;
grant execute on function public.report(public.report_target, uuid, public.report_reason, text)
  to authenticated;
