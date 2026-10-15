begin;
\ir helpers/act_as.psql
select plan(33);

create function pg_temp.m(suffix text) returns uuid
language sql immutable as $$ select ('00000000-0000-0000-0000-0000000000' || suffix)::uuid $$;

create function pg_temp.as_member(suffix text) returns void
language sql as $$ select pg_temp.act_as_member(pg_temp.m(suffix)) $$;

create temp table ids (k text primary key, v uuid);
grant select, insert on ids to authenticated, anon;

create function pg_temp.id(key text) returns uuid
language sql stable as $$ select v from ids where k = $1 $$;

create function pg_temp.keep(key text, value uuid) returns uuid
language sql as $$ insert into ids values ($1, $2) returning v $$;

-- a1 and b1 chat; c1..c3 report b1's profile.
select pg_temp.create_visible_member(pg_temp.m(s))
from unnest(array['a1', 'b1', 'c1', 'c2', 'c3']) s;

select pg_temp.as_member('a1');
select pg_temp.keep('chat', public.send_request(pg_temp.m('b1'), 'friends'));
select pg_temp.as_member('b1');
select public.respond_request(pg_temp.id('chat'), true);
reset role;

-- ============ The catalog is admin-only ============

select pg_temp.act_as_admin(pg_temp.m('ad'));
select lives_ok(
  $$ insert into public.banned_terms (term) values ('rascal'), ('dirty word'), ('xtest') $$,
  'an admin adds banned terms');
select is((select count(*)::int from public.banned_terms), 3, 'an admin reads banned terms');
select lives_ok($$ delete from public.banned_terms where term = 'xtest' $$, 'an admin deletes a banned term');
select is((select count(*)::int from public.banned_terms), 2, 'the deleted term is gone');
select throws_ok($$ insert into public.banned_terms (term) values ('Rascal2') $$, '23514', null,
  'terms are stored lowercase');

select pg_temp.as_member('a1');
select is((select count(*)::int from public.banned_terms), 0, 'a Member cannot read banned terms');
select throws_ok($$ insert into public.banned_terms (term) values ('nice') $$, '42501', null,
  'a Member cannot add banned terms');
delete from public.banned_terms;
reset role;
select is((select count(*)::int from public.banned_terms), 2, 'a Member cannot delete banned terms');
select pg_temp.as_member('a1');
select throws_ok($$ select public.matches_banned_term('rascal') $$, '42501', null,
  'a Member cannot probe the catalog through the helper');
reset role;

select pg_temp.act_as_anon();
select throws_ok($$ select * from public.banned_terms $$, '42501', null, 'a signed-out visitor cannot read banned terms');
reset role;

-- ============ Profile text is rejected ============

select pg_temp.as_member('a1');
select throws_ok($$ update public.profiles set display_name = 'Rascal' where id = auth.uid() $$,
  'that wording isn''t allowed; please change it', 'a matching display name is rejected');
select throws_ok($$ update public.profiles set display_name = 'big RASCAL here' where id = auth.uid() $$,
  'that wording isn''t allowed; please change it', 'matching ignores case');
select lives_ok($$ update public.profiles set display_name = 'Rascally' where id = auth.uid() $$,
  'a term inside a longer word is accepted');
select lives_ok($$ update public.profiles set display_name = 'Asha' where id = auth.uid() $$,
  'a clean display name is accepted');

select throws_ok($$ update public.profile_prompts set answer = 'I say dirty   word a lot' where user_id = auth.uid() and position = 1 $$,
  'that wording isn''t allowed; please change it', 'a matching prompt answer is rejected on update');
select lives_ok($$ update public.profile_prompts set answer = 'A dirty kitchen, no words' where user_id = auth.uid() and position = 1 $$,
  'a phrase term only matches as a phrase');
-- e1 has no prompts yet.
reset role;
select pg_temp.create_member(pg_temp.m('e1'));
select pg_temp.as_member('e1');
select throws_ok(
  $$ insert into public.profile_prompts (user_id, position, question_id, answer)
     values (auth.uid(), 1, (select min(id) from public.prompt_questions), 'rascal!') $$,
  'that wording isn''t allowed; please change it', 'a matching prompt answer is rejected on insert');
select lives_ok(
  $$ insert into public.profile_prompts (user_id, position, question_id, answer)
     values (auth.uid(), 1, (select min(id) from public.prompt_questions), 'Trekking at dawn') $$,
  'a clean prompt answer is accepted on insert');
reset role;

-- A new profile row carrying a name is checked too (run as postgres, as the function would).
select pg_temp.create_account(pg_temp.m('e0'));
select throws_ok(
  format($$ insert into public.profiles (id, display_name) values (%L, 'Rascal') $$, pg_temp.m('e0')),
  'that wording isn''t allowed; please change it', 'a matching display name is rejected on insert');

-- ============ Activities are rejected ============

select pg_temp.as_member('a1');
select throws_ok(
  $$ select public.post_activity('Rascal run', 'sports', 'baner', now() + interval '2 days') $$,
  'that wording isn''t allowed; please change it', 'a matching Activity title is rejected');
select throws_ok(
  $$ select public.post_activity('Evening run', 'sports', 'baner', now() + interval '2 days',
                                 null, 4::smallint, 'No dirty word please') $$,
  'that wording isn''t allowed; please change it', 'a matching Activity description is rejected');
select lives_ok(
  $$ select pg_temp.keep('act', public.post_activity('Evening run', 'sports', 'baner',
       now() + interval '2 days', null, 4::smallint, 'Easy pace')) $$,
  'a clean Activity is accepted');
reset role;
select throws_ok(
  format($$ update public.activities set title = 'RASCAL run' where id = %L $$, pg_temp.id('act')),
  'that wording isn''t allowed; please change it', 'a matching Activity title is rejected on update');
select throws_ok(
  format($$ update public.activities set description = 'a rascal' where id = %L $$, pg_temp.id('act')),
  'that wording isn''t allowed; please change it', 'a matching Activity description is rejected on update');
select lives_ok(
  format($$ update public.activities set description = 'Bring water' where id = %L $$, pg_temp.id('act')),
  'a clean Activity edit is accepted');

-- ============ Messages are delivered and flagged ============

select pg_temp.as_member('a1');
insert into public.messages (id, connection_id, sender_id, type, body)
values (pg_temp.keep('bad', gen_random_uuid()), pg_temp.id('chat'), pg_temp.m('a1'), 'text', 'You RASCAL');
insert into public.messages (id, connection_id, sender_id, type, body)
values (pg_temp.keep('clean', gen_random_uuid()), pg_temp.id('chat'), pg_temp.m('a1'), 'text', 'Rascally fun');

select pg_temp.as_member('b1');
select is((select body from public.messages where id = pg_temp.id('bad')), 'You RASCAL',
  'a matching message is delivered unchanged');
select is((select count(*)::int from public.reports), 0, 'a Member cannot read reports');

select pg_temp.act_as_admin(pg_temp.m('ad'));
select results_eq(
  format($$ select reporter_id, target_type::text, target_user_id, reason::text, status::text
            from public.reports where target_id = %L $$, pg_temp.id('bad')),
  format($$ values (null::uuid, 'message', %L::uuid, 'word_filter', 'open') $$, pg_temp.m('a1')),
  'a matching message files an open word_filter report with no reporter, against the sender');
select is(
  (select evidence - 'sent_at' from public.reports where target_id = pg_temp.id('bad')),
  jsonb_build_object('body', 'You RASCAL', 'sender_id', pg_temp.m('a1'), 'type', 'text',
                     'media_key', null, 'media_mime', null),
  'the flag keeps the message snapshot');
select ok((select evidence ? 'sent_at' from public.reports where target_id = pg_temp.id('bad')),
  'the snapshot has the sent time');
select is((select count(*)::int from public.reports where target_id = pg_temp.id('clean')), 0,
  'a clean message files nothing');
reset role;

-- ============ Word-filter flags never count toward Auto-hide ============

-- Two Member reports plus three word-filter flags on b1's profile: still visible.
insert into public.reports (reporter_id, target_type, target_id, target_user_id, reason)
select null, 'profile', pg_temp.m('b1'), pg_temp.m('b1'), 'word_filter' from generate_series(1, 3);
select pg_temp.as_member('c1');
select public.report('profile', pg_temp.m('b1'), 'harassment');
select pg_temp.as_member('c2');
select public.report('profile', pg_temp.m('b1'), 'harassment');
reset role;
select is((select hidden_at from public.profiles where id = pg_temp.m('b1')), null,
  'word-filter flags do not count toward Auto-hide');
select pg_temp.as_member('c3');
select public.report('profile', pg_temp.m('b1'), 'harassment');
reset role;
select isnt((select hidden_at from public.profiles where id = pg_temp.m('b1')), null,
  'a third distinct reporter still Auto-hides');

select * from finish();
rollback;
