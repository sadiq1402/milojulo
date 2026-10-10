begin;
\ir helpers/act_as.psql
select plan(7);

select pg_temp.create_member('00000000-0000-0000-0000-0000000000f1');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000f1');

select isnt_empty($$ select 1 from public.industries where slug = 'software' $$,
  'signed-in people see the Industry catalog');
select throws_ok($$ insert into public.industries (slug, label) values ('crypto', 'Crypto') $$,
  '42501', null, 'a Member cannot add to the Industry catalog');

select lives_ok(
  $$ update public.profiles set profession = 'Product designer', career_stage = 'mid',
       industry_id = (select id from public.industries where slug = 'design-media') $$,
  'a Member can give their profession, Industry and Career Stage');
select throws_ok($$ update public.profiles set career_stage = 'intern' $$, '22P02', null,
  'Career Stage comes only from the fixed list');
select throws_ok($$ update public.profiles set industry_id = 32000 $$, '23503', null,
  'Industry comes only from the catalog');
select throws_ok($$ update public.profiles set profession = repeat('x', 41) $$, '22001', null,
  'profession is at most 40 characters');

reset role;
select pg_temp.act_as_anon();
select is_empty('select 1 from public.industries', 'a signed-out visitor cannot read the Industry catalog');

select * from finish();
rollback;
