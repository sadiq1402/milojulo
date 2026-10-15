-- Word filter: banned terms reject profile text and Activities, and flag messages to admins.

create table public.banned_terms (
  term text primary key check (term = lower(term) and term = trim(term) and term <> '')
);
alter table public.banned_terms enable row level security;
revoke all on public.banned_terms from anon, authenticated;
grant select, insert, delete on public.banned_terms to authenticated;

create policy "Admins read banned terms" on public.banned_terms for select to authenticated
  using ((select public.is_admin()));
create policy "Admins add banned terms" on public.banned_terms for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins delete banned terms" on public.banned_terms for delete to authenticated
  using ((select public.is_admin()));

-- Case-insensitive, whole words only; a multi-word term matches as a phrase across any spacing.
-- Word characters are letters, digits, underscore and all of Devanagari (U+0900 to U+097F), so a
-- matra or virama never acts as a boundary. One combined pattern per call, not one per term.
create function public.matches_banned_term(content text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  with w as (select '[:alnum:]_' || chr(2304) || '-' || chr(2431) as word)
  select coalesce(content ~* (
           '(^|[^' || w.word || '])('
           || (select string_agg(regexp_replace(regexp_replace(b.term, '([^[:space:]' || w.word || '])', '\\\1', 'g'),
                                                '\s+', '\\s+', 'g'), '|')
               from public.banned_terms b)
           || ')($|[^' || w.word || '])'), false)
  from w;
$$;
revoke execute on function public.matches_banned_term(text) from public, anon, authenticated;

-- Definer so Members' writes can run the filter without seeing the catalog.
create function public.reject_banned_terms() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  col text;
begin
  foreach col in array tg_argv loop
    if public.matches_banned_term(to_jsonb(new) ->> col) then
      raise exception 'that wording isn''t allowed; please change it';
    end if;
  end loop;
  return new;
end;
$$;
revoke execute on function public.reject_banned_terms() from public, anon, authenticated;

create trigger word_filter before insert or update of display_name on public.profiles
  for each row execute function public.reject_banned_terms('display_name');
create trigger word_filter before insert or update of answer on public.profile_prompts
  for each row execute function public.reject_banned_terms('answer');
create trigger word_filter before insert or update of title, description on public.activities
  for each row execute function public.reject_banned_terms('title', 'description');

-- The message snapshot kept as report evidence, shared by report() and the word filter.
create function public.message_evidence(m public.messages) returns jsonb
language sql immutable
set search_path = ''
as $$
  select jsonb_build_object('body', m.body, 'sender_id', m.sender_id, 'type', m.type,
                            'media_key', m.media_key, 'media_mime', m.media_mime,
                            'sent_at', m.created_at);
$$;
revoke execute on function public.message_evidence(public.messages) from public, anon, authenticated;

-- Messages are delivered; a match files a system report (no reporter) with report()'s snapshot.
create function public.flag_banned_message() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if public.matches_banned_term(new.body) then
    insert into public.reports (reporter_id, target_type, target_id, target_user_id, reason,
                                evidence, evidence_media_key)
    values (null, 'message', new.id, new.sender_id, 'word_filter', public.message_evidence(new),
            new.media_key);
  end if;
  return null;
end;
$$;
revoke execute on function public.flag_banned_message() from public, anon, authenticated;

create trigger word_filter after insert on public.messages
  for each row execute function public.flag_banned_message();

-- report() now takes its message snapshot from message_evidence(); otherwise unchanged.
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
