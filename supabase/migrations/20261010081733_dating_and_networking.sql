create table public.industries (
  id smallint primary key generated always as identity,
  slug text not null unique,
  label text not null,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.industries enable row level security;

create policy "Signed-in people read industries" on public.industries
  for select to authenticated using (true);

-- Provisional starter list; the final industries are still to come.
insert into public.industries (slug, label, sort_order) values
  ('software', 'Software and IT', 10),
  ('it-services', 'IT services and consulting', 20),
  ('startups', 'Startups and product', 30),
  ('finance', 'Banking and finance', 40),
  ('consulting', 'Consulting', 50),
  ('manufacturing', 'Manufacturing and automotive', 60),
  ('healthcare', 'Healthcare', 70),
  ('education', 'Education', 80),
  ('design-media', 'Design and media', 90),
  ('marketing-sales', 'Marketing and sales', 100),
  ('public-sector', 'Government and public sector', 110),
  ('other', 'Other', 120);

create type public.career_stage as enum ('student', 'early', 'mid', 'senior', 'founder');
create type public.gender as enum ('woman', 'man', 'nonbinary');

alter table public.profiles
  add column profession varchar(40),
  add column industry_id smallint references public.industries (id),
  add column career_stage public.career_stage,
  add column gender public.gender,
  add column pref_genders public.gender[],
  add column pref_age_min smallint,
  add column pref_age_max smallint,
  add column pref_max_km smallint,
  add constraint profiles_pref_age_min_check check (pref_age_min >= 18),
  add constraint profiles_pref_age_range_check check (pref_age_min <= pref_age_max),
  add constraint profiles_pref_max_km_check check (pref_max_km > 0);

grant update (profession, industry_id, career_stage, gender, pref_genders, pref_age_min, pref_age_max, pref_max_km)
  on public.profiles to authenticated;

create or replace function public.profile_minimum_gap(member_id uuid) returns text
language sql stable
set search_path = ''
as $$
  select case
    when p.display_name is null then 'add your first name'
    when p.area_id is null then 'choose your area'
    when cardinality(p.modes) = 0 then 'choose at least one mode'
    when p.modes && '{dating,serious,casual}' and p.gender is null then 'add your gender'
    when p.modes && '{dating,serious,casual}'
      and (coalesce(cardinality(p.pref_genders), 0) = 0 or p.pref_age_min is null
           or p.pref_age_max is null or p.pref_max_km is null) then 'set your dating preferences'
    when (select count(*) from public.profile_prompts where user_id = p.id) < 2 then 'answer 2 prompts'
    when (select count(*) from public.photos
          where user_id = p.id and uploaded_at is not null
            and hidden_at is null and removed_at is null) < 2 then 'add at least 2 photos'
  end
  from public.profiles p
  where p.id = member_id;
$$;

create or replace function public.enforce_profile_minimum() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'profiles' then
    if new.submitted_at is not null then
      if new.display_name is null then raise exception 'add your first name'; end if;
      if new.area_id is null then raise exception 'choose your area'; end if;
      if cardinality(new.modes) = 0 then raise exception 'choose at least one mode'; end if;
      if new.modes && '{dating,serious,casual}' then
        if new.gender is null then raise exception 'add your gender'; end if;
        if coalesce(cardinality(new.pref_genders), 0) = 0 or new.pref_age_min is null
           or new.pref_age_max is null or new.pref_max_km is null then
          raise exception 'set your dating preferences';
        end if;
      end if;
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

drop trigger enforce_profile_minimum on public.profiles;
create trigger enforce_profile_minimum before update of display_name, area_id, modes, gender,
  pref_genders, pref_age_min, pref_age_max, pref_max_km on public.profiles
  for each row execute function public.enforce_profile_minimum();
