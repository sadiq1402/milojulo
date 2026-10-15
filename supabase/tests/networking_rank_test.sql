begin;
\ir helpers/act_as.psql
select plan(4);

-- A visible Networking Member with the given Industry and Career Stage, plus shared tags and availability
-- that raise their ordinary score. Run as postgres.
create function pg_temp.create_networker(
  member_id uuid, industry_slug text, stage public.career_stage, tag_slugs text[] default '{}',
  slots public.availability_slot[] default '{}'
) returns void
language plpgsql as $$
begin
  perform pg_temp.create_visible_member(member_id, '{networking}');
  update public.profiles
  set industry_id = (select id from public.industries where slug = industry_slug),
      career_stage = stage, availability = slots
  where id = member_id;
  insert into public.profile_tags (user_id, tag_id)
  select member_id, id from public.tags where slug = any (tag_slugs);
end;
$$;

select pg_temp.create_networker('00000000-0000-0000-0000-0000000000b1', 'software', 'mid',
  '{badminton,cafes,books}', '{weekends,weekday_evenings}');
-- b2 shares Industry and Career Stage, b3 only Industry, b4 only Career Stage, b5 neither.
-- b4 and b5 share every tag and slot with b1; b2 and b3 share none.
select pg_temp.create_networker('00000000-0000-0000-0000-0000000000b2', 'software', 'mid');
select pg_temp.create_networker('00000000-0000-0000-0000-0000000000b3', 'software', 'senior');
select pg_temp.create_networker('00000000-0000-0000-0000-0000000000b4', 'finance', 'mid',
  '{badminton,cafes,books}', '{weekends,weekday_evenings}');
select pg_temp.create_networker('00000000-0000-0000-0000-0000000000b5', 'finance', 'senior',
  '{badminton,cafes,books}', '{weekends,weekday_evenings}');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000b1');
select results_eq(
  $$ select user_id from public.discover_feed('{networking}') $$,
  $$ values ('00000000-0000-0000-0000-0000000000b2'::uuid), ('00000000-0000-0000-0000-0000000000b4'),
            ('00000000-0000-0000-0000-0000000000b3'), ('00000000-0000-0000-0000-0000000000b5') $$,
  'the Networking feed ranks by how many of Industry and Career Stage are shared, then the usual score');
select results_eq(
  $$ select user_id from public.discover_feed('{networking}', 2,
       (select cursor from public.discover_feed('{networking}', 2) offset 1 limit 1)) $$,
  $$ values ('00000000-0000-0000-0000-0000000000b3'::uuid), ('00000000-0000-0000-0000-0000000000b5') $$,
  'the next Networking page continues after the cursor with no gaps or repeats');
select results_eq(
  $$ select user_id from public.discover_feed() limit 2 $$,
  $$ values ('00000000-0000-0000-0000-0000000000b5'::uuid), ('00000000-0000-0000-0000-0000000000b4') $$,
  'feeds other than Networking ignore Industry and Career Stage');
reset role;

-- b6 and b7 gave no Industry or Career Stage; leaving both blank is not sharing them.
select pg_temp.create_networker('00000000-0000-0000-0000-0000000000b6', null, null,
  '{badminton}', '{weekends}');
select pg_temp.create_networker('00000000-0000-0000-0000-0000000000b7', null, null);
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000b6');
select is(
  (select user_id from public.discover_feed('{networking}') limit 1),
  '00000000-0000-0000-0000-0000000000b5'::uuid,
  'a blank Industry or Career Stage does not count as shared');
reset role;

select * from finish();
rollback;
