-- Open sign-up (decision 27): the age gate and consents are the way in.

-- The latest effective version of each consent kind; internal, so no client role can run it.
create function public.current_consent_documents() returns setof uuid
language sql stable
set search_path = ''
as $$
  select distinct on (kind) id from public.consent_documents
  where effective_at <= now()
  order by kind, effective_at desc;
$$;

revoke execute on function public.current_consent_documents() from public, anon, authenticated, service_role;

create or replace function public.accept_consents(birth_date date, document_ids uuid[]) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  -- Age is judged on the calendar date in India.
  if birth_date is null
     or birth_date > ((now() at time zone 'Asia/Kolkata')::date - interval '18 years')::date then
    raise exception 'members must be 18 or older';
  end if;

  -- Every kind must be accepted at its current version; a null list or entry never counts.
  if array_position(document_ids, null) is not null
     or exists (
       select 1 from public.current_consent_documents() as d (id)
       where not (d.id = any (coalesce(document_ids, '{}')))
     ) then
    raise exception 'accept the current terms, guidelines and data notice';
  end if;

  insert into public.profiles (id, date_of_birth) values (auth.uid(), birth_date)
  on conflict (id) do update set date_of_birth = excluded.date_of_birth;

  insert into public.consents (user_id, document_id)
  select auth.uid(), unnest(document_ids)
  on conflict (user_id, document_id) do update set accepted_at = now(), withdrawn_at = null;
end;
$$;

-- Service role only; called once per environment by supabase/seed/reviewer.sql.
create or replace function public.seed_reviewer(reviewer_id uuid) returns void
language sql security definer
set search_path = ''
as $$
  insert into public.profiles (id, date_of_birth) values (reviewer_id, '1990-01-01')
  on conflict (id) do nothing;

  insert into public.consents (user_id, document_id)
  select reviewer_id, d.id from public.current_consent_documents() as d (id)
  on conflict (user_id, document_id) do nothing;
$$;

drop function public.check_invite(text);
drop function public.redeem_invite(text);
drop table public.invite_redemptions;
drop table public.invite_codes;
