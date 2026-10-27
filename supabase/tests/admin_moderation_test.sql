begin;
\ir helpers/act_as.psql
select plan(64);

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

-- Whether viewer a1 sees a photo on a Member's profile.
create function pg_temp.photo_shown(member uuid, photo uuid) returns boolean
language plpgsql as $$
declare found boolean;
begin
  perform pg_temp.as_member('a1');
  found := exists (select 1 from public.get_profile(member) p where photo = any (p.photo_ids));
  reset role;
  return found;
end;
$$;

create function pg_temp.in_feed(member uuid) returns boolean
language plpgsql as $$
declare found boolean;
begin
  perform pg_temp.as_member('a1');
  found := exists (select 1 from public.discover_feed(null, 50) f where f.user_id = member);
  reset role;
  return found;
end;
$$;

create function pg_temp.on_board(activity uuid) returns boolean
language plpgsql as $$
declare found boolean;
begin
  perform pg_temp.as_member('a1');
  found := exists (select 1 from public.activity_board() b where b.id = activity)
           and exists (select 1 from public.get_activity(activity));
  reset role;
  return found;
end;
$$;

-- The last message b1 sees in their chat with c2.
create function pg_temp.last_message_b1() returns text
language plpgsql as $$
declare body text;
begin
  perform pg_temp.as_member('b1');
  select c.last_message_body into body from public.my_connections() c where c.other_id = pg_temp.m('c2');
  reset role;
  return body;
end;
$$;

-- The given Member files a report. Run as postgres; leaves the role reset.
create function pg_temp.report_as(suffix text, kind public.report_target, target uuid) returns void
language plpgsql as $$
begin
  perform pg_temp.as_member(suffix);
  perform public.report(kind, target, 'harassment');
  reset role;
end;
$$;

-- Reports on a target as an admin sees them.
create function pg_temp.reports_on(target uuid)
returns table (status public.report_status, handled_by uuid, handled boolean)
language plpgsql as $$
begin
  perform pg_temp.act_as_admin(pg_temp.m('ad'));
  return query select r.status, r.handled_by, r.handled_at is not null
    from public.reports r where r.target_id = target;
  reset role;
end;
$$;

-- a1 views; c1 is moderated; ad is the admin.
select pg_temp.create_account(pg_temp.m('ad'));
select pg_temp.create_visible_member(pg_temp.m(s)) from unnest(array['a1', 'c1']) s;
insert into public.photos (user_id, object_key, position, uploaded_at)
values (pg_temp.m('c1'), pg_temp.m('c1') || '/3.jpg', 3, now());
-- b1 and c2 chat; c2 sent the latest message. c3 hosts an Activity.
select pg_temp.keep('chat', pg_temp.accepted_pair(pg_temp.m('b1'), pg_temp.m('c2')));
insert into public.messages (id, connection_id, sender_id, type, body, created_at) values
  (gen_random_uuid(), pg_temp.id('chat'), pg_temp.m('b1'), 'text', 'Hi', now() - interval '1 minute'),
  (pg_temp.keep('c2msg', gen_random_uuid()), pg_temp.id('chat'), pg_temp.m('c2'), 'text', 'Something nasty', now());
select pg_temp.create_visible_member(pg_temp.m('c3'));
select pg_temp.as_member('c3');
select pg_temp.keep('c3act', public.post_activity('Evening badminton', 'sports',
  now() + interval '2 days', null, 4::smallint, 'Bring a racket', null));
reset role;
select pg_temp.keep('c1photo1', (select id from public.photos where user_id = pg_temp.m('c1') and position = 1));
select pg_temp.keep('c1photo3', (select id from public.photos where user_id = pg_temp.m('c1') and position = 3));

-- Takedown: photo
select pg_temp.as_member('c1');
select throws_ok(
  $$ select public.admin_takedown('photo', pg_temp.id('c1photo3'), 'nudity') $$,
  'admins only', 'a Member cannot take down a photo');
reset role;

select pg_temp.act_as_admin(pg_temp.m('ad'));
select public.admin_takedown('photo', pg_temp.id('c1photo3'), 'nudity');
reset role;
select ok(not pg_temp.photo_shown(pg_temp.m('c1'), pg_temp.id('c1photo3')),
  'a taken-down photo leaves the profile');
select ok(pg_temp.in_feed(pg_temp.m('c1')), 'two live photos left keep the Member in Discover');

select pg_temp.act_as_admin(pg_temp.m('ad'));
select public.admin_takedown('photo', pg_temp.id('c1photo1'), 'nudity');
reset role;
select ok(not pg_temp.in_feed(pg_temp.m('c1')), 'a takedown below two live photos hides the Member from Discover');

-- Takedown: message
select pg_temp.as_member('c2');
select throws_ok($$ select public.admin_takedown('message', pg_temp.id('c2msg'), 'abuse') $$,
  'admins only', 'a Member cannot take down a message');
reset role;
select is(pg_temp.last_message_b1(), 'Something nasty', 'the message shows before its takedown');
select pg_temp.as_member('b1');
select is((select count(*) from public.messages where id = pg_temp.id('c2msg')), 1::bigint,
  'the other side reads the message before its takedown');
reset role;
select pg_temp.act_as_admin(pg_temp.m('ad'));
select public.admin_takedown('message', pg_temp.id('c2msg'), 'abuse');
reset role;
select is(pg_temp.last_message_b1(), 'Hi', 'a taken-down message leaves the chat');
select pg_temp.as_member('b1');
select is((select count(*) from public.messages where id = pg_temp.id('c2msg')), 0::bigint,
  'a taken-down message cannot be read from the table');
reset role;

-- Takedown: Activity
select pg_temp.as_member('c3');
select throws_ok($$ select public.admin_takedown('activity', pg_temp.id('c3act'), 'spam') $$,
  'admins only', 'a Member cannot take down an Activity');
reset role;
select ok(pg_temp.on_board(pg_temp.id('c3act')), 'the Activity is on the board before its takedown');
select pg_temp.act_as_admin(pg_temp.m('ad'));
select public.admin_takedown('activity', pg_temp.id('c3act'), 'spam');
reset role;
select ok(not pg_temp.on_board(pg_temp.id('c3act')), 'a taken-down Activity leaves the board');

-- A profile is not taken down; a Member is banned instead.
select pg_temp.act_as_admin(pg_temp.m('ad'));
select throws_ok($$ select public.admin_takedown('profile', pg_temp.m('c3'), 'spam') $$,
  'ban the member instead', 'a profile takedown is refused');
select throws_ok($$ select public.admin_takedown('photo', gen_random_uuid(), 'spam') $$,
  'nothing to take down', 'a takedown of nothing is refused');
reset role;

-- Audit log
select pg_temp.act_as_admin(pg_temp.m('ad'));
select results_eq(
  $$ select admin_id, action, target_type, target_id, note from public.admin_actions
     where target_id in (pg_temp.id('c1photo3'), pg_temp.id('c2msg'), pg_temp.id('c3act'))
     order by target_type $$,
  $$ values (pg_temp.m('ad'), 'takedown'::text, 'activity'::text, pg_temp.id('c3act'), 'spam'::text),
            (pg_temp.m('ad'), 'takedown', 'message', pg_temp.id('c2msg'), 'abuse'),
            (pg_temp.m('ad'), 'takedown', 'photo', pg_temp.id('c1photo3'), 'nudity') $$,
  'every takedown is in the audit log for admins');
select is((select count(*) from public.admin_actions where target_id = pg_temp.m('c3')), 0::bigint,
  'a refused action leaves no audit entry');
select throws_ok($$ update public.admin_actions set note = 'edited' $$,
  '42501', null, 'an admin cannot edit the audit log');
select throws_ok($$ delete from public.admin_actions $$,
  '42501', null, 'an admin cannot delete from the audit log');
select throws_ok($$ insert into public.admin_actions (admin_id, action, target_type, target_id)
                    values (pg_temp.m('ad'), 'takedown', 'photo', gen_random_uuid()) $$,
  '42501', null, 'an admin cannot write the audit log by hand');
reset role;

select pg_temp.as_member('c1');
select is((select count(*) from public.admin_actions), 0::bigint, 'a Member cannot read the audit log');
reset role;

select pg_temp.act_as_service();
select throws_ok($$ update public.admin_actions set note = 'edited' $$,
  'the audit log cannot be changed', 'not even the service role can edit the audit log');
select throws_ok($$ delete from public.admin_actions $$,
  'the audit log cannot be changed', 'not even the service role can delete from the audit log');
select throws_ok($$ truncate public.admin_actions $$,
  'the audit log cannot be changed', 'not even the service role can empty the audit log');
reset role;

-- Takedown closes the open Reports on its target. c4 hosts a reported Activity.
select pg_temp.create_visible_member(pg_temp.m('c4'));
select pg_temp.as_member('c4');
select pg_temp.keep('c4act', public.post_activity('Late chai', 'food_chai',
  now() + interval '2 days', null, 4::smallint, 'Chai and talk', null));
reset role;
select pg_temp.report_as('a1', 'activity', pg_temp.id('c4act'));
select pg_temp.report_as('b1', 'activity', pg_temp.id('c4act'));
select results_eq($$ select status::text from pg_temp.reports_on(pg_temp.id('c4act')) $$,
  $$ values ('open'), ('open') $$, 'reports stay open until an admin acts');
select pg_temp.act_as_admin(pg_temp.m('ad'));
select public.admin_takedown('activity', pg_temp.id('c4act'), 'spam');
reset role;
select results_eq($$ select * from pg_temp.reports_on(pg_temp.id('c4act')) $$,
  $$ values ('actioned'::public.report_status, pg_temp.m('ad'), true),
            ('actioned'::public.report_status, pg_temp.m('ad'), true) $$,
  'a takedown marks the open reports on its target actioned by the admin');

-- Restore. c5 is Auto-hidden by three reports; so are c6's third photo and c6's Activity.
select pg_temp.create_visible_member(pg_temp.m(s)) from unnest(array['c5', 'c6']) s;
insert into public.photos (user_id, object_key, position, uploaded_at)
values (pg_temp.m('c6'), pg_temp.m('c6') || '/3.jpg', 3, now());
select pg_temp.keep('c6photo3', (select id from public.photos where user_id = pg_temp.m('c6') and position = 3));
select pg_temp.as_member('c6');
select pg_temp.keep('c6act', public.post_activity('Sunday trek', 'outdoors',
  now() + interval '3 days', null, 6::smallint, 'Sinhagad at dawn', null));
reset role;
select pg_temp.report_as(r, k, t)
from unnest(array['a1', 'b1', 'c2']) r,
     (values ('profile'::public.report_target, pg_temp.m('c5')),
             ('photo', pg_temp.id('c6photo3')),
             ('activity', pg_temp.id('c6act'))) v (k, t);
select ok(not pg_temp.in_feed(pg_temp.m('c5')), 'an Auto-hidden Member is out of Discover');
select ok(not pg_temp.photo_shown(pg_temp.m('c6'), pg_temp.id('c6photo3')), 'an Auto-hidden photo is not shown');
select ok(not pg_temp.on_board(pg_temp.id('c6act')), 'an Auto-hidden Activity is off the board');

select pg_temp.as_member('c5');
select throws_ok($$ select public.admin_restore('profile', pg_temp.m('c5'), 'fine') $$,
  'admins only', 'a Member cannot restore');
reset role;

select pg_temp.act_as_admin(pg_temp.m('ad'));
select public.admin_restore('profile', pg_temp.m('c5'), 'reports were unfounded');
select public.admin_restore('photo', pg_temp.id('c6photo3'), null);
select public.admin_restore('activity', pg_temp.id('c6act'), null);
select throws_ok($$ select public.admin_restore('profile', pg_temp.m('c5'), null) $$,
  'nothing to restore', 'restoring what is not Auto-hidden is refused');
select throws_ok($$ select public.admin_restore('message', pg_temp.id('c2msg'), null) $$,
  'nothing to restore', 'a message is never Auto-hidden, so it is not restored');
reset role;
select ok(pg_temp.in_feed(pg_temp.m('c5')), 'a restored Member is back in Discover');
select ok(pg_temp.photo_shown(pg_temp.m('c6'), pg_temp.id('c6photo3')), 'a restored photo is shown again');
select ok(pg_temp.on_board(pg_temp.id('c6act')), 'a restored Activity is back on the board');
select results_eq($$ select distinct status::text, handled_by from pg_temp.reports_on(pg_temp.m('c5')) $$,
  $$ values ('dismissed', pg_temp.m('ad')) $$, 'a restore dismisses the open reports on its target');
select pg_temp.act_as_admin(pg_temp.m('ad'));
select results_eq(
  $$ select action, target_type, note from public.admin_actions where target_id = pg_temp.m('c5') $$,
  $$ values ('restore'::text, 'profile'::text, 'reports were unfounded'::text) $$,
  'a restore is in the audit log');
reset role;

-- Dismissed reports no longer count toward Auto-hide; fresh ones do.
select pg_temp.report_as('a1', 'profile', pg_temp.m('c5'));
select ok(pg_temp.in_feed(pg_temp.m('c5')), 'one new report after a restore does not hide again');
select pg_temp.report_as(r, 'profile', pg_temp.m('c5')) from unnest(array['b1', 'c2']) r;
select ok(not pg_temp.in_feed(pg_temp.m('c5')), 'three new reports after a restore hide again');

-- Ban. e1 is banned: chatting with b2, a pending request to b3, a Join Request to d1's Activity,
-- hosting an Activity, in a Circle with b4. b5 and b6 chat and are not touched.
select pg_temp.keep('e1b2', pg_temp.accepted_pair(pg_temp.m('e1'), pg_temp.m('b2')));
select pg_temp.keep('b5b6', pg_temp.accepted_pair(pg_temp.m('b5'), pg_temp.m('b6')));
select pg_temp.create_visible_member(pg_temp.m(s)) from unnest(array['b3', 'b4', 'd1']) s;
select pg_temp.as_member('e1');
select pg_temp.keep('e1b3', public.send_request(pg_temp.m('b3'), 'friends'));
reset role;
select pg_temp.as_member('d1');
select pg_temp.keep('d1act', public.post_activity('Board games', 'games',
  now() + interval '2 days', null, 6::smallint, 'Catan night', null));
reset role;
select pg_temp.as_member('e1');
select pg_temp.keep('e1req', public.join_activity_request(pg_temp.id('d1act')));
select pg_temp.keep('e1act', public.post_activity('Cycling', 'sports',
  now() + interval '2 days', null, 4::smallint, 'Morning ride', null));
reset role;
-- An Activity e1 hosted that has already run, and one of d1's e1 went to; both still 'open' because
-- the expiry job hasn't run. Postgres fixtures: posting refuses a start in the past.
insert into public.activities (id, host_id, title, type, place, starts_at, ends_at, capacity)
values (pg_temp.keep('e1past', gen_random_uuid()), pg_temp.m('e1'), 'Past ride', 'sports', 'SRID=4326;POINT(73.787 18.559)',
        now() - interval '3 hours', now() - interval '1 hour', 4),
       (pg_temp.keep('d1past', gen_random_uuid()), pg_temp.m('d1'), 'Past games', 'games', 'SRID=4326;POINT(73.787 18.559)',
        now() - interval '3 hours', now() - interval '1 hour', 4);
insert into public.activity_requests (id, activity_id, requester_id, status, responded_at)
values (pg_temp.keep('e1pastreq', gen_random_uuid()), pg_temp.id('d1past'), pg_temp.m('e1'), 'accepted', now() - interval '1 day');
select pg_temp.act_as_admin(pg_temp.m('ad'));
select pg_temp.keep('circle', public.admin_create_circle('Baner gamers', 'baner',
  (select min(id) from public.tags), 'A local circle.'));
reset role;
select pg_temp.as_member('e1');
select public.join_circle(pg_temp.id('circle'));
reset role;
select pg_temp.as_member('b4');
select public.join_circle(pg_temp.id('circle'));
reset role;
select pg_temp.report_as('a1', 'profile', pg_temp.m('e1'));
select pg_temp.keep('e1photo', (select id from public.photos where user_id = pg_temp.m('e1') and position = 1));
select pg_temp.report_as('a1', 'photo', pg_temp.id('e1photo'));

select pg_temp.as_member('b2');
select throws_ok($$ select public.admin_ban(pg_temp.m('e1'), 'harassment') $$,
  'admins only', 'a Member cannot ban');
reset role;
select ok(pg_temp.in_feed(pg_temp.m('e1')), 'the Member is in Discover before the ban');

select pg_temp.act_as_admin(pg_temp.m('ad'));
select throws_ok($$ select public.admin_ban(pg_temp.m('e1'), '  ') $$,
  'give a reason for the ban', 'a ban without a reason is refused');
select throws_ok($$ select public.admin_ban(pg_temp.m('e1'), null) $$,
  'give a reason for the ban', 'a ban with no reason at all is refused');
select public.admin_ban(pg_temp.m('e1'), 'harassment');
select throws_ok($$ select public.admin_ban(pg_temp.m('e1'), 'again') $$,
  'nothing to ban', 'banning a banned Member is refused');
select throws_ok($$ select public.admin_ban(gen_random_uuid(), 'nobody') $$,
  'nothing to ban', 'banning nobody is refused');
reset role;

select ok(not pg_temp.in_feed(pg_temp.m('e1')), 'a banned Member is out of Discover');

select pg_temp.as_member('b2');
select is((select c.status::text from public.my_connections() c where c.connection_id = pg_temp.id('e1b2')),
  'closed', 'a ban closes the banned Member''s chats');
select throws_ok(
  $$ insert into public.messages (id, connection_id, sender_id, type, body)
     values (gen_random_uuid(), pg_temp.id('e1b2'), pg_temp.m('b2'), 'text', 'Hello?') $$,
  '42501', null, 'the other side can no longer write in the chat');
reset role;
select pg_temp.as_member('b3');
select is((select c.status::text from public.my_connections() c where c.connection_id = pg_temp.id('e1b3')),
  'closed', 'a ban closes the banned Member''s pending requests');
reset role;
select pg_temp.as_member('b5');
select is((select c.status::text from public.my_connections() c where c.connection_id = pg_temp.id('b5b6')),
  'accepted', 'other Members'' chats stay open');
reset role;

select pg_temp.as_member('d1');
select is((select r.status::text from public.activity_requests r where r.id = pg_temp.id('e1req')),
  'cancelled', 'a ban withdraws the banned Member''s Join Requests');
reset role;
select pg_temp.as_member('e1');
select is((select a.status::text from public.get_activity(pg_temp.id('e1act')) a),
  'cancelled', 'a ban cancels the banned Member''s open Activities');
reset role;
select pg_temp.as_member('e1');
select is((select a.status::text from public.get_activity(pg_temp.id('e1past')) a),
  'open', 'a ban leaves an Activity that already happened as it was');
reset role;
select pg_temp.as_member('d1');
select is((select r.status::text from public.activity_requests r where r.id = pg_temp.id('e1pastreq')),
  'accepted', 'a ban leaves a Join Request to an Activity that already happened as it was');
reset role;
select pg_temp.as_member('d1');
select is((select a.status::text from public.get_activity(pg_temp.id('d1act')) a),
  'open', 'other Members'' Activities stay open');
reset role;

select pg_temp.as_member('b4');
select results_eq($$ select member_count, i_am_member from public.get_circle(pg_temp.id('circle')) $$,
  $$ values (1, true) $$, 'a ban removes the banned Member from their Circles, and only them');
reset role;

select results_eq($$ select distinct status::text, handled_by from pg_temp.reports_on(pg_temp.m('e1')) $$,
  $$ values ('actioned', pg_temp.m('ad')) $$, 'a ban marks the open reports on the Member actioned');
select results_eq($$ select distinct status::text from pg_temp.reports_on(pg_temp.id('e1photo')) $$,
  $$ values ('actioned') $$, 'a ban also settles the reports on the Member''s photos');
select pg_temp.as_member('e1');
select throws_ok($$ select public.report('profile', pg_temp.m('b5'), 'harassment') $$,
  'sign in first', 'a banned Member cannot report');
reset role;
select pg_temp.as_member('b6');
select lives_ok($$ select public.report('profile', pg_temp.m('b5'), 'harassment') $$,
  'an active Member still can report');
reset role;
select pg_temp.act_as_admin(pg_temp.m('ad'));
select results_eq(
  $$ select action, target_type, note from public.admin_actions where target_id = pg_temp.m('e1') $$,
  $$ values ('ban'::text, 'profile'::text, 'harassment'::text) $$,
  'a ban is in the audit log with its reason');
reset role;

select pg_temp.act_as_anon();
select throws_ok($$ select public.admin_ban(pg_temp.m('b5'), 'x') $$, '42501', null,
  'a signed-out visitor cannot ban');
select throws_ok($$ select public.admin_takedown('photo', pg_temp.id('c6photo3'), 'x') $$, '42501', null,
  'a signed-out visitor cannot take down');
select throws_ok($$ select public.admin_restore('photo', pg_temp.id('c6photo3'), 'x') $$, '42501', null,
  'a signed-out visitor cannot restore');
select throws_ok($$ select * from public.admin_actions $$, '42501', null,
  'a signed-out visitor cannot read the audit log');
reset role;

select * from finish();
rollback;
