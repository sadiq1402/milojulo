begin;
\ir helpers/act_as.psql
select plan(11);

select pg_temp.create_member('00000000-0000-0000-0000-0000000000f1');
select pg_temp.create_member('00000000-0000-0000-0000-0000000000f2');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000f1');
select lives_ok(
  $$ insert into public.profile_prompts (user_id, position, question_id, answer)
     select auth.uid(), sort_order / 10, id, 'Misal at Bedekar, then a walk' from public.prompt_questions $$,
  'a Member can answer two prompts');
select throws_ok(
  $$ insert into public.profile_prompts (user_id, position, question_id, answer)
     values (auth.uid(), 3, (select min(id) from public.prompt_questions), 'One more') $$,
  '23514', null, 'a Member cannot answer a third prompt');
select throws_ok(
  $$ update public.profile_prompts set answer = repeat('a', 141) where position = 1 $$,
  '22001', null, 'a prompt answer is at most 140 characters');
select lives_ok(
  $$ insert into public.profile_tags (user_id, tag_id)
     select auth.uid(), id from public.tags where slug in ('badminton', 'books') $$,
  'a Member can pick tags');
select lives_ok($$ delete from public.profile_tags where tag_id = (select id from public.tags where slug = 'books') $$,
  'a Member can drop a tag');

reset role;
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000f2');
select is_empty('select 1 from public.profile_prompts', 'another Member cannot read someone''s prompts');
select is_empty('select 1 from public.profile_tags', 'another Member cannot read someone''s tags');
select throws_ok(
  $$ insert into public.profile_tags (user_id, tag_id)
     values ('00000000-0000-0000-0000-0000000000f1', (select id from public.tags where slug = 'yoga')) $$,
  '42501', null, 'a Member cannot add tags to someone else''s profile');
select throws_ok(
  $$ insert into public.profile_prompts (user_id, position, question_id, answer)
     values ('00000000-0000-0000-0000-0000000000f1', 2, (select min(id) from public.prompt_questions), 'Hijacked') $$,
  '42501', null, 'a Member cannot write a prompt on someone else''s profile');
update public.profile_prompts set answer = 'Hijacked';
delete from public.profile_prompts;
delete from public.profile_tags;
reset role;
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000f1');
select results_eq('select count(*)::int, count(*) filter (where answer = ''Hijacked'')::int from public.profile_prompts',
  $$ values (2, 0) $$, 'another Member cannot change or delete someone''s prompts');
select is((select count(*)::int from public.profile_tags), 1, 'another Member cannot delete someone''s tags');

select * from finish();
rollback;
