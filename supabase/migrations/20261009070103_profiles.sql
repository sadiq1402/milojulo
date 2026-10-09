create table public.areas (
  id text primary key,
  name text not null,
  center extensions.geography(Point, 4326) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.areas enable row level security;

create policy "Signed-in people read areas" on public.areas
  for select to authenticated using (true);

-- Approximate neighbourhood centroids; distance between Members is measured between these.
insert into public.areas (id, name, center) values
  ('baner', 'Baner', 'SRID=4326;POINT(73.7868 18.5590)'),
  ('wakad', 'Wakad', 'SRID=4326;POINT(73.7600 18.5989)'),
  ('hinjewadi', 'Hinjewadi', 'SRID=4326;POINT(73.7389 18.5913)'),
  ('balewadi', 'Balewadi', 'SRID=4326;POINT(73.7790 18.5760)'),
  ('kharadi', 'Kharadi', 'SRID=4326;POINT(73.9348 18.5515)');

create type public.tag_kind as enum ('interest', 'activity');

create table public.tags (
  id smallint primary key generated always as identity,
  slug text not null unique,
  label text not null,
  kind public.tag_kind not null,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.tags enable row level security;

create policy "Signed-in people read tags" on public.tags
  for select to authenticated using (true);

-- The tags shown in the mockups; the full list of about 40 is still to come.
insert into public.tags (slug, label, kind, sort_order) values
  ('badminton', 'Badminton', 'activity', 10),
  ('cafes', 'Cafes', 'interest', 20),
  ('trekking', 'Trekking', 'activity', 30),
  ('board-games', 'Board games', 'activity', 40),
  ('running', 'Running', 'activity', 50),
  ('cricket', 'Cricket', 'activity', 60),
  ('photography', 'Photography', 'interest', 70),
  ('live-music', 'Live music', 'interest', 80),
  ('cooking', 'Cooking', 'interest', 90),
  ('books', 'Books', 'interest', 100),
  ('cycling', 'Cycling', 'activity', 110),
  ('movies', 'Movies', 'interest', 120),
  ('yoga', 'Yoga', 'activity', 130),
  ('football', 'Football', 'activity', 140);

create table public.prompt_questions (
  id smallint primary key generated always as identity,
  text text not null,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.prompt_questions enable row level security;

create policy "Signed-in people read prompt questions" on public.prompt_questions
  for select to authenticated using (true);

insert into public.prompt_questions (text, sort_order) values
  ('A perfect Sunday in Pune is…', 10),
  ('I''m looking for people to…', 20);

create type public.mode as enum ('friends', 'activities', 'networking', 'dating', 'serious', 'casual');
create type public.availability_slot as enum ('weekday_evenings', 'weekends', 'early_mornings');
create type public.account_status as enum ('active', 'banned');

alter table public.profiles
  add column display_name varchar(30),
  add column area_id text references public.areas (id),
  add column modes public.mode[] not null default '{}',
  add column availability public.availability_slot[] not null default '{}',
  add column status public.account_status not null default 'active',
  add column submitted_at timestamptz,
  add column paused_at timestamptz,
  add column hidden_at timestamptz,
  add column banned_at timestamptz,
  add column banned_reason text,
  add column deleted_at timestamptz;

create index profiles_modes_idx on public.profiles using gin (modes);

-- Members edit only safe columns; status and moderation change through functions or admin.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, area_id, modes, availability) on public.profiles to authenticated;

create policy "Members update their own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create table public.profile_prompts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  position smallint not null check (position between 1 and 2),
  question_id smallint not null references public.prompt_questions (id),
  answer varchar(140) not null,
  created_at timestamptz not null default now(),
  primary key (user_id, position)
);
alter table public.profile_prompts enable row level security;

revoke update on public.profile_prompts from anon, authenticated;
grant update (question_id, answer) on public.profile_prompts to authenticated;

create policy "Members manage their own prompts" on public.profile_prompts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.profile_tags (
  user_id uuid not null references public.profiles (id) on delete cascade,
  tag_id smallint not null references public.tags (id),
  created_at timestamptz not null default now(),
  primary key (user_id, tag_id)
);
alter table public.profile_tags enable row level security;

revoke update on public.profile_tags from anon, authenticated;

create policy "Members manage their own tags" on public.profile_tags
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null default 'r2',
  object_key text not null,
  position smallint not null check (position between 1 and 4),
  width integer,
  height integer,
  uploaded_at timestamptz,
  hidden_at timestamptz,
  removed_at timestamptz,
  removed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Deferrable so a single statement can swap two positions.
  unique (user_id, position) deferrable initially immediate
);
alter table public.photos enable row level security;

-- Rows are written by the upload Edge Function; Members only reorder and delete.
revoke insert, update on public.photos from anon, authenticated;
grant update (position) on public.photos to authenticated;

create policy "Members read their own photos" on public.photos
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Members reorder their own photos" on public.photos
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Members delete their own photos" on public.photos
  for delete to authenticated using (user_id = (select auth.uid()));

-- Service role only: the upload Edge Function calls this once the object exists in R2.
create function public.confirm_photo_upload(photo_id uuid) returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.photos set uploaded_at = now() where id = photo_id and uploaded_at is null;
  if not found then
    raise exception 'no unconfirmed photo with that id';
  end if;
end;
$$;

revoke execute on function public.confirm_photo_upload(uuid) from public, anon, authenticated;

-- What a profile still lacks to meet the minimum, or null when it meets it.
create function public.profile_minimum_gap(member_id uuid) returns text
language sql stable
set search_path = ''
as $$
  select case
    when p.display_name is null then 'add your first name'
    when p.area_id is null then 'choose your area'
    when cardinality(p.modes) = 0 then 'choose at least one mode'
    when (select count(*) from public.profile_prompts where user_id = p.id) < 2 then 'answer 2 prompts'
    when (select count(*) from public.photos
          where user_id = p.id and uploaded_at is not null
            and hidden_at is null and removed_at is null) < 2 then 'add at least 2 photos'
  end
  from public.profiles p
  where p.id = member_id;
$$;

revoke execute on function public.profile_minimum_gap(uuid) from public, anon, authenticated;

create function public.submit_profile() returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  gap text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and date_of_birth is not null) then
    raise exception 'accept the terms first';
  end if;

  gap := public.profile_minimum_gap(auth.uid());
  if gap is not null then
    raise exception '%', gap;
  end if;

  update public.profiles set submitted_at = coalesce(submitted_at, now()) where id = auth.uid();
end;
$$;

revoke execute on function public.submit_profile() from public, anon;

-- Once submitted, a Member's own changes cannot take the profile below the minimum.
-- Each table guards only what it holds, so an admin Takedown that already broke the
-- photo minimum does not lock the Member out of other edits.
create function public.enforce_profile_minimum() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'profiles' then
    if new.submitted_at is not null then
      if new.display_name is null then raise exception 'add your first name'; end if;
      if new.area_id is null then raise exception 'choose your area'; end if;
      if cardinality(new.modes) = 0 then raise exception 'choose at least one mode'; end if;
    end if;
    return new;
  end if;

  -- During account deletion the profile is already gone, so nothing is checked.
  if not exists (select 1 from public.profiles where id = old.user_id and submitted_at is not null) then
    return old;
  end if;

  if tg_table_name = 'profile_prompts' then
    raise exception 'answer 2 prompts';
  end if;

  if old.uploaded_at is not null and old.hidden_at is null and old.removed_at is null
     and (select count(*) from public.photos
          where user_id = old.user_id and uploaded_at is not null
            and hidden_at is null and removed_at is null) < 2 then
    raise exception 'add at least 2 photos';
  end if;
  return old;
end;
$$;

create trigger enforce_profile_minimum before update of display_name, area_id, modes on public.profiles
  for each row execute function public.enforce_profile_minimum();
create trigger enforce_profile_minimum after delete on public.profile_prompts
  for each row execute function public.enforce_profile_minimum();
create trigger enforce_profile_minimum after delete on public.photos
  for each row execute function public.enforce_profile_minimum();

-- Pausing is independent of Account Status; it only hides the Member from new people.
create function public.set_paused(paused boolean) returns void
language sql security definer
set search_path = ''
as $$
  update public.profiles
  set paused_at = case when paused then coalesce(paused_at, now()) end
  where id = auth.uid();
$$;

revoke execute on function public.set_paused(boolean) from public, anon;
