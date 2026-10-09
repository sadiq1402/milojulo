create table public.invite_codes (
  code text primary key,
  event_tag text,
  uses_left integer not null check (uses_left >= 0),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.invite_codes enable row level security;

-- Callable before sign-in; reveals only whether the code can be redeemed.
create function public.check_invite(invite_code text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.invite_codes
    where code = invite_code
      and uses_left > 0
      and (expires_at is null or expires_at > now())
  );
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Members read their own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create table public.invite_redemptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  code text not null references public.invite_codes (code),
  redeemed_at timestamptz not null default now()
);
alter table public.invite_redemptions enable row level security;

create function public.redeem_invite(invite_code text) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'invite already redeemed';
  end if;

  update public.invite_codes set uses_left = uses_left - 1
  where code = invite_code
    and uses_left > 0
    and (expires_at is null or expires_at > now());
  if not found then
    raise exception 'invite code is not valid';
  end if;

  insert into public.profiles (id) values (auth.uid());
  insert into public.invite_redemptions (user_id, code) values (auth.uid(), invite_code);
end;
$$;

revoke execute on function public.redeem_invite(text) from public, anon;

alter table public.profiles add column date_of_birth date;

create type public.consent_kind as enum ('terms', 'guidelines', 'data_notice');

create table public.consent_documents (
  id uuid primary key default gen_random_uuid(),
  kind public.consent_kind not null,
  version text not null,
  url text,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (kind, version)
);
alter table public.consent_documents enable row level security;

create policy "Signed-in people read consent documents" on public.consent_documents
  for select to authenticated using (true);

-- URLs are set once the domain and lawyer-reviewed texts exist.
insert into public.consent_documents (kind, version) values
  ('terms', 'v1'), ('guidelines', 'v1'), ('data_notice', 'v1');

create table public.consents (
  user_id uuid not null references public.profiles (id) on delete cascade,
  document_id uuid not null references public.consent_documents (id),
  accepted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, document_id)
);
alter table public.consents enable row level security;

create policy "Members read their own consents" on public.consents
  for select to authenticated using (user_id = (select auth.uid()));

create function public.accept_consents(birth_date date, document_ids uuid[]) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'redeem an invite first';
  end if;

  -- Age is judged on the calendar date in India.
  if birth_date > ((now() at time zone 'Asia/Kolkata')::date - interval '18 years')::date then
    raise exception 'members must be 18 or older';
  end if;

  -- Every kind must be accepted at its current version.
  if exists (
    select 1 from (
      select distinct on (kind) id from public.consent_documents
      where effective_at <= now()
      order by kind, effective_at desc
    ) current_docs
    where current_docs.id <> all (document_ids)
  ) then
    raise exception 'accept the current terms, guidelines and data notice';
  end if;

  update public.profiles set date_of_birth = birth_date where id = auth.uid();

  insert into public.consents (user_id, document_id)
  select auth.uid(), unnest(document_ids)
  on conflict (user_id, document_id) do update set accepted_at = now(), withdrawn_at = null;
end;
$$;

revoke execute on function public.accept_consents(date, uuid[]) from public, anon;

-- Reserved for the Reviewer Account seed; no uses, so the app can never redeem it.
insert into public.invite_codes (code, event_tag, uses_left) values ('REVIEWER', 'store-review', 0);

-- Service role only; called once per environment by supabase/seed/reviewer.sql.
create function public.seed_reviewer(reviewer_id uuid) returns void
language sql security definer
set search_path = ''
as $$
  insert into public.profiles (id, date_of_birth) values (reviewer_id, '1990-01-01')
  on conflict (id) do nothing;

  insert into public.invite_redemptions (user_id, code) values (reviewer_id, 'REVIEWER')
  on conflict (user_id) do nothing;

  insert into public.consents (user_id, document_id)
  select reviewer_id, d.id
  from (
    select distinct on (kind) id from public.consent_documents
    where effective_at <= now()
    order by kind, effective_at desc
  ) d
  on conflict (user_id, document_id) do nothing;
$$;

revoke execute on function public.seed_reviewer(uuid) from public, anon, authenticated;
