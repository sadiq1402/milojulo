begin;
\ir helpers/act_as.psql
select plan(13);

create function pg_temp.m(suffix text) returns uuid
language sql immutable as $$ select ('00000000-0000-0000-0000-0000000104' || suffix)::uuid $$;

-- r01 chose Friends only; r02 chose Friends and Networking.
select pg_temp.create_visible_member(pg_temp.m('01'), '{friends}');
select pg_temp.create_visible_member(pg_temp.m('02'), '{friends,networking}');

select pg_temp.act_as_member(pg_temp.m('01'));
select lives_ok(format('select public.send_request(%L, %L)', pg_temp.m('02'), 'networking'),
  'a request may go under a Mode only the recipient chose');

select pg_temp.act_as_member(pg_temp.m('02'));
select results_eq($$ select mode from public.connections $$, array['networking'::public.mode],
  'the recipient sees the request under that Mode');
select public.respond_request(id, true) from public.connections;
select results_eq($$ select mode, status::text from public.connections $$,
  $$ values ('networking'::public.mode, 'accepted') $$, 'accepting makes it a Connection under that Mode');

-- r03 chose Friends only, r04 Friends and Activities.
reset role;
select pg_temp.create_visible_member(pg_temp.m('03'), '{friends}');
select pg_temp.create_visible_member(pg_temp.m('04'), '{friends,activities}');
select pg_temp.act_as_member(pg_temp.m('04'));
select throws_ok(format('select public.send_request(%L, %L)', pg_temp.m('03'), 'activities'),
  'P0001', 'that mode is not open between you', 'a request under a Mode the recipient did not choose is refused');

-- Dating Preferences that fit each other: r05 a man wanting women, r06 and r07 women wanting men, r08 a woman wanting women. Run as postgres.
reset role;
create function pg_temp.dating(member uuid, member_modes public.mode[], g public.gender, wants public.gender)
returns void language sql as $$
  update public.profiles set modes = member_modes, gender = g, pref_genders = array[wants],
    pref_age_min = 18, pref_age_max = 60, pref_max_km = 50 where id = member;
$$;
select pg_temp.create_visible_member(pg_temp.m('05'), '{friends}');
select pg_temp.dating(pg_temp.m('05'), '{friends}', 'man', 'woman');
select pg_temp.create_visible_member(pg_temp.m('06'), '{friends}');
select pg_temp.dating(pg_temp.m('06'), '{friends,casual}', 'woman', 'man');
select pg_temp.create_visible_member(pg_temp.m('07'), '{friends}');
select pg_temp.dating(pg_temp.m('07'), '{friends,dating}', 'woman', 'man');
select pg_temp.create_visible_member(pg_temp.m('08'), '{friends}');
select pg_temp.dating(pg_temp.m('08'), '{friends,dating}', 'woman', 'woman');

select pg_temp.act_as_member(pg_temp.m('05'));
select throws_ok(format('select public.send_request(%L, %L)', pg_temp.m('06'), 'casual'),
  'P0001', 'that mode is not open between you', 'Casual is refused when only the recipient chose it');
select lives_ok(format('select public.send_request(%L, %L)', pg_temp.m('07'), 'dating'),
  'a Dating Mode only the recipient chose is open when both Dating Preferences fit');
select throws_ok(format('select public.send_request(%L, %L)', pg_temp.m('08'), 'dating'),
  'P0001', 'that mode is not open between you', 'a Dating Mode is refused when the Dating Preferences do not fit');

reset role;
select pg_temp.dating(pg_temp.m('05'), '{friends,casual}', 'man', 'woman');
select pg_temp.act_as_member(pg_temp.m('05'));
select lives_ok(format('select public.send_request(%L, %L)', pg_temp.m('06'), 'casual'),
  'Casual is open when both chose it');

-- Mode Changes follow the same rule: r10 (Friends, Activities) requested r11 (Friends, Networking) under Friends.
reset role;
select pg_temp.create_visible_member(pg_temp.m('10'), '{friends,activities}');
select pg_temp.create_visible_member(pg_temp.m('11'), '{friends,networking}');
select pg_temp.act_as_member(pg_temp.m('10'));
select public.send_request(pg_temp.m('11'), 'friends') as conn \gset
select pg_temp.act_as_member(pg_temp.m('11'));
select public.respond_request(:'conn', true);

select throws_ok(format('select public.propose_mode_change(%L, %L)', :'conn', 'networking'),
  'P0001', 'that mode is not open between you', 'a Mode Change to a Mode only the proposer chose is refused');
select public.propose_mode_change(:'conn', 'activities') as change \gset
select pg_temp.act_as_member(pg_temp.m('10'));
select lives_ok(format('select public.respond_mode_change(%L, true)', :'change'),
  'a Mode Change to a Mode only the other side chose can be proposed and accepted');
select results_eq(format('select mode from public.connections where id = %L', :'conn'),
  array['activities'::public.mode], 'the Connection moves to that Mode');

select lives_ok(format('select public.propose_mode_change(%L, %L)', :'conn', 'networking'),
  'the requester may propose a Mode only the addressee chose');
select id as change2 from public.connection_mode_changes where outcome is null \gset
reset role;
update public.profiles set modes = '{friends,activities}' where id = pg_temp.m('11');
select pg_temp.act_as_member(pg_temp.m('11'));
select throws_ok(format('select public.respond_mode_change(%L, true)', :'change2'),
  'P0001', 'that mode is no longer open between you',
  'a proposal cannot be accepted once the side answering no longer has its Mode');

select * from finish();
rollback;
