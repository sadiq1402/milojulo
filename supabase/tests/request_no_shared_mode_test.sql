-- #200: a request may be sent when nothing overlaps, under one of the sender's own Modes.
-- Casual keeps its rule (decision 39): both sides must have chosen it.
begin;
\ir helpers/act_as.psql
select plan(9);

\set asha '00000000-0000-0000-0000-00000000d001'
\set ravi '00000000-0000-0000-0000-00000000d002'
\set nita '00000000-0000-0000-0000-00000000d003'
select pg_temp.create_visible_member(:'asha', '{networking}');
select pg_temp.create_visible_member(:'ravi', '{friends}');
-- A Member whose only Mode the sender can't be matched under.
select pg_temp.create_visible_member(:'nita', '{activities}');

select pg_temp.act_as_member(:'asha');

-- What the sender may ask under: their Modes and the other's, not only the other's.
select results_eq(
  format($$ select request_modes from public.get_profile(%L) $$, :'ravi'),
  $$ values ('{friends,networking}'::public.mode[]) $$,
  'both sides'' Modes may be asked under, even with nothing in common');
select results_eq(
  format($$ select request_modes from public.get_profile(%L) $$, :'nita'),
  $$ values ('{activities,networking}'::public.mode[]) $$,
  'the sender''s own Mode is always among them');

-- The feed still says what is actually shared, so the app knows when to warn.
select results_eq(
  format($$ select modes from public.discover_feed() where user_id = %L $$, :'ravi'),
  $$ values ('{}'::public.mode[]) $$,
  'the card still shows no shared Modes, which is what the warning is for');

select lives_ok(format($$ select public.send_request(%L, 'networking', 'Hello') $$, :'ravi'),
  'a request goes under the sender''s own Mode with nothing in common');
select lives_ok(format($$ select public.send_request(%L, 'activities', 'Hi') $$, :'nita'),
  'and under the other''s Mode as before');

-- Casual is not opened up: it still needs both sides (decision 39). A Casual Member needs a
-- gender and Dating Preferences, as submission demands.
\set kiran '00000000-0000-0000-0000-00000000d004'
reset role;
create function pg_temp.dating_ready(member_id uuid, member_gender public.gender, wants public.gender[],
  member_modes public.mode[]) returns void
language plpgsql as $$
begin
  update public.profiles
  set modes = member_modes, gender = member_gender, pref_genders = wants,
      pref_age_min = 25, pref_age_max = 35, pref_max_km = 10,
      date_of_birth = (now() at time zone 'Asia/Kolkata')::date - make_interval(years => 30)
  where id = member_id;
end;
$$;
select pg_temp.create_visible_member(:'kiran', '{friends}');
select pg_temp.dating_ready(:'kiran', 'woman', '{man}', '{friends}');
select pg_temp.dating_ready(:'asha', 'man', '{woman}', '{casual,friends,networking}');
select pg_temp.act_as_member(:'asha');
select throws_ok(format($$ select public.send_request(%L, 'casual', null) $$, :'kiran'),
  'that mode is not open between you', 'Casual still needs both sides to have chosen it');
reset role;
select pg_temp.dating_ready(:'kiran', 'woman', '{man}', '{casual,friends}');
select pg_temp.act_as_member(:'asha');
select lives_ok(format($$ select public.send_request(%L, 'casual', null) $$, :'kiran'),
  'and goes through once both have');

-- A Mode nobody holds is still refused.
\set tara '00000000-0000-0000-0000-00000000d005'
reset role;
select pg_temp.create_visible_member(:'tara', '{friends}');
select pg_temp.act_as_member(:'asha');
select throws_ok(format($$ select public.send_request(%L, 'serious', null) $$, :'tara'),
  'that mode is not open between you', 'a Mode neither side chose is refused');
select throws_ok($$ select public.requestable_modes(
  '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d002') $$,
  '42501', null, 'the rule itself is internal');

select * from finish();
rollback;
