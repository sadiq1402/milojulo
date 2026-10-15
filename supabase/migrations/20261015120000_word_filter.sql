-- Word filter: banned terms reject profile text and Activities, and flag messages to admins.

create table public.banned_terms (
  term text primary key check (term = lower(term) and trim(term) <> '')
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
create function public.matches_banned_term(content text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.banned_terms b
    where content ~* ('(^|[^[:alnum:]_])'
                      || regexp_replace(regexp_replace(b.term, '([^[:alnum:][:space:]])', '\\\1', 'g'),
                                        '\s+', '\\s+', 'g')
                      || '($|[^[:alnum:]_])'));
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

-- Messages are delivered; a match files a system report (no reporter) with report()'s snapshot.
create function public.flag_banned_message() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if public.matches_banned_term(new.body) then
    insert into public.reports (reporter_id, target_type, target_id, target_user_id, reason,
                                evidence, evidence_media_key)
    values (null, 'message', new.id, new.sender_id, 'word_filter',
            jsonb_build_object('body', new.body, 'sender_id', new.sender_id, 'type', new.type,
                               'media_key', new.media_key, 'media_mime', new.media_mime,
                               'sent_at', new.created_at),
            new.media_key);
  end if;
  return null;
end;
$$;
revoke execute on function public.flag_banned_message() from public, anon, authenticated;

create trigger word_filter after insert on public.messages
  for each row execute function public.flag_banned_message();
