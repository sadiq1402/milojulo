begin;
\ir helpers/act_as.psql
select plan(7);

select pg_temp.create_account('00000000-0000-0000-0000-0000000000d1');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000d1');

select hasnt_table('public', 'areas', 'there is no Area catalog');
select isnt_empty(
  $$ select 1 from public.tags where slug = 'badminton' and kind = 'activity' $$,
  'signed-in people see the tag catalog');
select isnt_empty(
  $$ select 1 from public.prompt_questions where text = 'A perfect Sunday is…' $$,
  'signed-in people see the prompt questions');
select is_empty(
  $$ select 1 from public.prompt_questions where text ilike '%pune%' $$,
  'no prompt question names a city');
select throws_ok(
  $$ insert into public.tags (slug, label, kind) values ('raves', 'Raves', 'interest') $$,
  '42501', null, 'a Member cannot add to a catalog');

reset role;
select pg_temp.act_as_anon();
select is_empty('select 1 from public.tags', 'a signed-out visitor cannot read tags');
select is_empty('select 1 from public.prompt_questions', 'a signed-out visitor cannot read prompt questions');

select * from finish();
rollback;
