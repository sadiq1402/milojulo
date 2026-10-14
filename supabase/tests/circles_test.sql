begin;
\ir helpers/act_as.psql
select plan(57);

-- Shared id helpers (as in join_requests_test).
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

-- Create an active Circle through the admin path and remember its id.
create function pg_temp.make_circle(key text, cname varchar, area text default 'baner', tag text default 'badminton')
returns uuid
language plpgsql as $$
declare new_id uuid;
begin
  perform pg_temp.act_as_admin(pg_temp.m('ad'));
  new_id := public.admin_create_circle(cname, area, (select id from public.tags where slug = tag), 'A local circle.');
  reset role;
  return pg_temp.keep(key, new_id);
end;
$$;

-- Members: c1..c6 visible; c0 complete but not submitted (not visible).
select pg_temp.create_visible_member(pg_temp.m(s))
from unnest(array['c1', 'c2', 'c3', 'c4', 'c5', 'c6']) s;
select pg_temp.create_complete_member(pg_temp.m('c0'));
update public.profiles set display_name = 'Asha' where id = pg_temp.m('c1');
update public.profiles set display_name = 'Bina' where id = pg_temp.m('c2');
update public.profiles set display_name = 'Chetan' where id = pg_temp.m('c3');

-- ============ Admin create / edit / archive ============

-- Allow: an admin creates a Circle.
select pg_temp.make_circle('cup', 'Baner Cup');
select isnt(pg_temp.id('cup'), null, 'admin creates a circle');

-- Deny: a Member cannot create a Circle.
select pg_temp.as_member('c1');
select throws_ok(
  $$ select public.admin_create_circle('Sneaky', 'baner', (select id from public.tags where slug = 'badminton'), 'x') $$,
  'admins only', 'a member cannot create a circle');
reset role;

-- Deny: anon cannot create a Circle (execute revoked).
select pg_temp.act_as_anon();
select throws_ok(
  $$ select public.admin_create_circle('Sneaky', 'baner', 1::smallint, 'x') $$,
  null::text, null::text, 'anon cannot create a circle');
reset role;

-- Allow: an admin edits a Circle; the new name shows through get_circle.
select pg_temp.act_as_admin(pg_temp.m('ad'));
select lives_ok(
  $$ select public.admin_edit_circle(pg_temp.id('cup'), 'Baner Badminton Cup', 'wakad',
       (select id from public.tags where slug = 'cafes'), 'Updated.') $$,
  'admin edits a circle');
reset role;
select pg_temp.as_member('c1');
select is((select name from public.get_circle(pg_temp.id('cup'))), 'Baner Badminton Cup'::varchar,
  'the edit is visible through get_circle');
reset role;

-- Deny: a Member cannot edit a Circle.
select pg_temp.as_member('c1');
select throws_ok(
  $$ select public.admin_edit_circle(pg_temp.id('cup'), 'Hacked', 'baner', 1::smallint, 'x') $$,
  'admins only', 'a member cannot edit a circle');
reset role;

-- Deny: editing an unknown Circle is refused.
select pg_temp.act_as_admin(pg_temp.m('ad'));
select throws_ok(
  $$ select public.admin_edit_circle(gen_random_uuid(), 'Ghost', 'baner', 1::smallint, 'x') $$,
  'no circle to edit', 'editing an unknown circle is refused');
reset role;

-- Deny: a Member cannot archive a Circle.
select pg_temp.as_member('c1');
select throws_ok(
  $$ select public.admin_archive_circle(pg_temp.id('cup')) $$,
  'admins only', 'a member cannot archive a circle');
reset role;

-- ============ browse_circles ============

-- A second active Circle and an archived one.
select pg_temp.make_circle('trek', 'Trekking Trail', 'kharadi', 'trekking');
select pg_temp.make_circle('old', 'Old Circle');
select pg_temp.act_as_admin(pg_temp.m('ad'));
select public.admin_archive_circle(pg_temp.id('old'));
reset role;

-- Allow: a visible Member browses active Circles; the archived one is left out.
select pg_temp.as_member('c1');
select ok(
  pg_temp.id('cup') in (select circle_id from public.browse_circles())
  and pg_temp.id('trek') in (select circle_id from public.browse_circles()),
  'a visible member browses active circles');
select ok(
  pg_temp.id('old') not in (select circle_id from public.browse_circles()),
  'browse leaves out an archived circle');
reset role;

-- Deny: a non-visible Member sees no Circles.
select pg_temp.as_member('c0');
select is((select count(*) from public.browse_circles()), 0::bigint,
  'a non-visible member browses nothing');
reset role;

-- Allow: a joined Circle sorts first and i_am_member / member_count are right.
select pg_temp.as_member('c2');
select public.join_circle(pg_temp.id('trek'));
select is((select circle_id from public.browse_circles() limit 1), pg_temp.id('trek'),
  'a joined circle sorts first');
select ok((select i_am_member from public.browse_circles() where circle_id = pg_temp.id('trek')),
  'i_am_member is true for a joined circle');
select is((select member_count from public.browse_circles() where circle_id = pg_temp.id('trek')), 1,
  'member_count counts the joiner');
select ok(not (select i_am_member from public.browse_circles() where circle_id = pg_temp.id('cup')),
  'i_am_member is false for a circle not joined');
reset role;

-- ============ get_circle ============

-- Allow: a visible Member reads an active Circle.
select pg_temp.as_member('c1');
select is((select circle_id from public.get_circle(pg_temp.id('cup'))), pg_temp.id('cup'),
  'a visible member reads an active circle');
reset role;

-- Deny: a non-member gets no row for an archived Circle.
select pg_temp.as_member('c1');
select is((select count(*) from public.get_circle(pg_temp.id('old'))), 0::bigint,
  'a non-member gets no row for an archived circle');
reset role;

-- Allow: a member reads their own Circle even after it is archived.
select pg_temp.as_member('c3');
select public.join_circle(pg_temp.id('cup'));
reset role;
select pg_temp.act_as_admin(pg_temp.m('ad'));
select public.admin_archive_circle(pg_temp.id('cup'));
reset role;
select pg_temp.as_member('c3');
select is((select circle_id from public.get_circle(pg_temp.id('cup'))), pg_temp.id('cup'),
  'a member reads their own archived circle');
reset role;

-- Allow: an admin reads an archived Circle.
select pg_temp.act_as_admin(pg_temp.m('ad'));
select is((select circle_id from public.get_circle(pg_temp.id('cup'))), pg_temp.id('cup'),
  'an admin reads an archived circle');
reset role;

-- Deny: a non-visible non-member gets no row for an active Circle.
select pg_temp.as_member('c0');
select is((select count(*) from public.get_circle(pg_temp.id('trek'))), 0::bigint,
  'a non-visible non-member gets no row');
reset role;

-- ============ join_circle ============

-- Allow: a visible Member joins; joining again is idempotent.
select pg_temp.as_member('c4');
select lives_ok($$ select public.join_circle(pg_temp.id('trek')) $$, 'a visible member joins a circle');
select lives_ok($$ select public.join_circle(pg_temp.id('trek')) $$, 'joining again is idempotent');
reset role;
select is((select count(*) from public.circle_members where circle_id = pg_temp.id('trek') and user_id = pg_temp.m('c4')),
  1::bigint, 'an idempotent join leaves one membership');

-- Deny: a non-visible Member cannot join.
select pg_temp.as_member('c0');
select throws_ok($$ select public.join_circle(pg_temp.id('trek')) $$,
  'your profile is not visible', 'a non-visible member cannot join');
reset role;

-- Deny: joining an unknown Circle is refused.
select pg_temp.as_member('c4');
select throws_ok($$ select public.join_circle(gen_random_uuid()) $$,
  'no circle to join', 'joining an unknown circle is refused');

-- Deny: joining an archived Circle is refused.
select throws_ok($$ select public.join_circle(pg_temp.id('old')) $$,
  'no circle to join', 'joining an archived circle is refused');
reset role;

-- Deny: anon cannot join (execute revoked).
select pg_temp.act_as_anon();
select throws_ok($$ select public.join_circle(pg_temp.id('trek')) $$,
  null::text, null::text, 'anon cannot join a circle');
reset role;

-- ============ leave_circle ============

-- Allow: a member leaves.
select pg_temp.as_member('c4');
select lives_ok($$ select public.leave_circle(pg_temp.id('trek')) $$, 'a member leaves a circle');
reset role;
select is((select count(*) from public.circle_members where circle_id = pg_temp.id('trek') and user_id = pg_temp.m('c4')),
  0::bigint, 'the membership is gone after leaving');

-- Deny: leaving a Circle one is not in is refused.
select pg_temp.as_member('c4');
select throws_ok($$ select public.leave_circle(pg_temp.id('trek')) $$,
  'you are not in this circle', 'leaving when not a member is refused');
reset role;

-- Allow: leaving keeps the Member's Activities posted to the Circle.
select pg_temp.as_member('c5');
select public.join_circle(pg_temp.id('trek'));
select pg_temp.keep('c5act', public.post_activity('Trek meetup', 'outdoors', 'kharadi',
  now() + interval '2 days', null, 4::smallint, null, null, pg_temp.id('trek')));
select public.leave_circle(pg_temp.id('trek'));
reset role;
select is((select circle_id from public.activities where id = pg_temp.id('c5act')), pg_temp.id('trek'),
  'leaving leaves the posted activity on its circle');

-- ============ circle_members_of ============

-- A Circle with members c1, c2, c3; c1 blocks c6 (also a member); cn joins but is not visible.
select pg_temp.make_circle('club', 'Baner Club');
select pg_temp.as_member('c1'); select public.join_circle(pg_temp.id('club')); reset role;
select pg_temp.as_member('c2'); select public.join_circle(pg_temp.id('club')); reset role;
select pg_temp.as_member('c3'); select public.join_circle(pg_temp.id('club')); reset role;
select pg_temp.as_member('c6'); select public.join_circle(pg_temp.id('club')); reset role;
-- cn cannot join through the function (not visible), so insert the membership directly to test the filter.
insert into public.circle_members (circle_id, user_id) values (pg_temp.id('club'), pg_temp.m('c0'));
select pg_temp.as_member('c1'); select public.block_user(pg_temp.m('c6')); reset role;

-- Allow: a member sees fellow visible, unblocked members, excluding self, the blocked one and the non-visible one.
select pg_temp.as_member('c1');
select results_eq(
  $$ select member_id from public.circle_members_of(pg_temp.id('club')) order by member_id $$,
  $$ select unnest(array[pg_temp.m('c2'), pg_temp.m('c3')]) order by 1 $$,
  'a member sees fellow visible unblocked members only');
select ok(pg_temp.m('c1') not in (select member_id from public.circle_members_of(pg_temp.id('club'))),
  'the member list excludes the caller');
select ok(pg_temp.m('c6') not in (select member_id from public.circle_members_of(pg_temp.id('club'))),
  'the member list excludes a blocked member');
select ok(pg_temp.m('c0') not in (select member_id from public.circle_members_of(pg_temp.id('club'))),
  'the member list excludes a non-visible member');
select is((select display_name from public.circle_members_of(pg_temp.id('club')) where member_id = pg_temp.m('c2')),
  'Bina'::varchar, 'the member list carries the display name');
reset role;

-- Deny: a non-member gets an empty member list.
select pg_temp.as_member('c4');
select is((select count(*) from public.circle_members_of(pg_temp.id('club'))), 0::bigint,
  'a non-member gets an empty member list');
reset role;

-- The blocked member (c6) also cannot see c1.
select pg_temp.as_member('c6');
select ok(pg_temp.m('c1') not in (select member_id from public.circle_members_of(pg_temp.id('club'))),
  'a block hides both ways in the member list');
reset role;

-- ============ circle_activities ============

-- c1 (a member of club) posts an Activity to it.
select pg_temp.as_member('c1');
select pg_temp.keep('clubact', public.post_activity('Club run', 'sports', 'baner',
  now() + interval '3 days', null, 5::smallint, null, null, pg_temp.id('club')));
reset role;

-- Allow: a visible member sees the Circle's upcoming Activity, with the Circle name.
select pg_temp.as_member('c2');
select is((select circle_name from public.circle_activities(pg_temp.id('club')) where id = pg_temp.id('clubact')),
  'Baner Club'::varchar, 'circle_activities shows the activity with its circle name');
select is((select circle_id from public.circle_activities(pg_temp.id('club')) where id = pg_temp.id('clubact')),
  pg_temp.id('club'), 'circle_activities carries circle_id');
reset role;

-- Deny: a non-visible caller sees no Circle Activities.
select pg_temp.as_member('c0');
select is((select count(*) from public.circle_activities(pg_temp.id('club'))), 0::bigint,
  'a non-visible caller sees no circle activities');
reset role;

-- An Activity of another Circle is not listed here.
select pg_temp.as_member('c1');
select ok(pg_temp.id('c5act') not in (select id from public.circle_activities(pg_temp.id('club'))),
  'circle_activities lists only this circle''s activities');
reset role;

-- Allow: once the Circle is archived the Activity stays but loses its name.
select pg_temp.act_as_admin(pg_temp.m('ad'));
select public.admin_archive_circle(pg_temp.id('club'));
reset role;
select pg_temp.as_member('c2');
select is((select circle_name from public.circle_activities(pg_temp.id('club')) where id = pg_temp.id('clubact')),
  null::varchar, 'an archived circle drops its name but keeps the activity');
select is((select count(*) from public.circle_activities(pg_temp.id('club')) where id = pg_temp.id('clubact')),
  1::bigint, 'the activity stays after the circle is archived');
reset role;

-- ============ post_activity to a Circle ============

-- Allow: a member posts to the Circle (trek, c5 rejoins).
select pg_temp.as_member('c5');
select public.join_circle(pg_temp.id('trek'));
select pg_temp.keep('trekact', public.post_activity('Sunday trek', 'outdoors', 'kharadi',
  now() + interval '4 days', null, 6::smallint, null, null, pg_temp.id('trek')));
reset role;
select is((select circle_id from public.activities where id = pg_temp.id('trekact')), pg_temp.id('trek'),
  'a member posts an activity to their circle');

-- Deny: a non-member cannot post to the Circle.
select pg_temp.as_member('c6');
select throws_ok(
  $$ select public.post_activity('Crash', 'outdoors', 'kharadi', now() + interval '2 days',
       null, 4::smallint, null, null, pg_temp.id('trek')) $$,
  'join the circle to post to it', 'a non-member cannot post to a circle');
reset role;

-- Deny: posting to an archived Circle is refused even for a former member.
select pg_temp.make_circle('arch', 'Archive Soon');
select pg_temp.as_member('c5'); select public.join_circle(pg_temp.id('arch')); reset role;
select pg_temp.act_as_admin(pg_temp.m('ad')); select public.admin_archive_circle(pg_temp.id('arch')); reset role;
select pg_temp.as_member('c5');
select throws_ok(
  $$ select public.post_activity('Too late', 'outdoors', 'kharadi', now() + interval '2 days',
       null, 4::smallint, null, null, pg_temp.id('arch')) $$,
  'join the circle to post to it', 'posting to an archived circle is refused');
reset role;

-- Allow: posting without a Circle still works.
select pg_temp.as_member('c6');
select isnt(public.post_activity('Solo plan', 'games', 'baner', now() + interval '2 days'), null,
  'posting without a circle still works');
reset role;

-- ============ activity_board / get_activity Circle label ============

-- Allow: the board carries circle_id and circle_name for a circle activity.
select pg_temp.as_member('c6');
select is((select circle_name from public.activity_board() where id = pg_temp.id('trekact')),
  'Trekking Trail'::varchar, 'the board shows the circle name');
select is((select circle_id from public.activity_board() where id = pg_temp.id('trekact')),
  pg_temp.id('trek'), 'the board shows circle_id');
-- get_activity likewise.
select is((select circle_name from public.get_activity(pg_temp.id('trekact'))),
  'Trekking Trail'::varchar, 'get_activity shows the circle name');
select is((select circle_id from public.get_activity(pg_temp.id('trekact'))),
  pg_temp.id('trek'), 'get_activity shows circle_id');
reset role;

-- Allow: once trek is archived the label drops on the board but the activity stays.
select pg_temp.act_as_admin(pg_temp.m('ad'));
select public.admin_archive_circle(pg_temp.id('trek'));
reset role;
select pg_temp.as_member('c6');
select is((select circle_name from public.activity_board() where id = pg_temp.id('trekact')),
  null::varchar, 'an archived circle drops its label on the board');
select is((select count(*) from public.activity_board() where id = pg_temp.id('trekact')), 1::bigint,
  'the activity stays on the board after the circle is archived');
select is((select circle_name from public.get_activity(pg_temp.id('trekact'))), null::varchar,
  'get_activity drops the label for an archived circle');
reset role;

-- ============ Tables are default-deny to clients ============

select pg_temp.as_member('c1');
select throws_ok($$ select count(*) from public.circles $$,
  null::text, null::text, 'a member cannot read circles directly');
select throws_ok($$ select count(*) from public.circle_members $$,
  null::text, null::text, 'a member cannot read circle_members directly');
reset role;

select * from finish();
rollback;
