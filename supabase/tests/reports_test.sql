begin;
\ir helpers/act_as.psql
select plan(49);

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

-- The given Member files a report. Run as postgres; leaves the role reset.
create function pg_temp.report_as(suffix text, kind public.report_target, target uuid,
  why public.report_reason default 'harassment') returns void
language plpgsql as $$
begin
  perform pg_temp.as_member(suffix);
  perform public.report(kind, target, why);
  reset role;
end;
$$;

-- Whether viewer v1 sees a Member in Discover / profile view, or an Activity on the board.
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

create function pg_temp.in_profile_view(member uuid) returns boolean
language plpgsql as $$
declare found boolean;
begin
  perform pg_temp.as_member('a1');
  found := exists (select 1 from public.get_profile(member));
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

-- a1 views; b1..b3 report; c1..c6 are reported; d1 is deleted; e0 has an account but no profile.
select pg_temp.create_visible_member(pg_temp.m(s))
from unnest(array['a1', 'b1', 'b2', 'b3', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'd1']) s;
select pg_temp.create_account(pg_temp.m('e0'));
update public.profiles set deleted_at = now() where id = pg_temp.m('d1');
update public.profiles set display_name = 'Chirag' where id = pg_temp.m('c1');

-- c4 has a third photo, so hiding it keeps the profile visible.
insert into public.photos (user_id, object_key, position, uploaded_at)
values (pg_temp.m('c4'), pg_temp.m('c4') || '/3.jpg', 3, now());
select pg_temp.keep('c4photo', (select id from public.photos where user_id = pg_temp.m('c4') and position = 3));
select pg_temp.keep('b1photo', (select id from public.photos where user_id = pg_temp.m('b1') and position = 1));

-- c5 hosts an Activity; b1 hosts one too.
select pg_temp.as_member('c5');
select pg_temp.keep('c5act', public.post_activity('Evening badminton', 'sports', 'baner',
  now() + interval '2 days', null, 4::smallint, 'Bring a racket', null));
select pg_temp.as_member('b1');
select pg_temp.keep('b1act', public.post_activity('Chai walk', 'food_chai', 'baner',
  now() + interval '2 days', null, 4::smallint, null, null));
reset role;

-- b1 and c6 chat; b2 and c6 chat (b1 is outside the second).
select pg_temp.as_member('c6');
select pg_temp.keep('chat', public.send_request(pg_temp.m('b1'), 'friends'));
select pg_temp.as_member('b1');
select public.respond_request(pg_temp.id('chat'), true);
insert into public.messages (id, connection_id, sender_id, type, body)
values (pg_temp.keep('b1msg', gen_random_uuid()), pg_temp.id('chat'), pg_temp.m('b1'), 'text', 'Hello');
select pg_temp.as_member('c6');
insert into public.messages (id, connection_id, sender_id, type, body)
values (pg_temp.keep('c6msg', gen_random_uuid()), pg_temp.id('chat'), pg_temp.m('c6'), 'text', 'Rude words');
select pg_temp.keep('other', public.send_request(pg_temp.m('b2'), 'friends'));
select pg_temp.as_member('b2');
select public.respond_request(pg_temp.id('other'), true);
select pg_temp.as_member('c6');
insert into public.messages (id, connection_id, sender_id, type, body)
values (pg_temp.keep('othermsg', gen_random_uuid()), pg_temp.id('other'), pg_temp.m('c6'), 'text', 'Hi b2');
reset role;

-- ============ Refusals ============

select pg_temp.act_as_anon();
select throws_ok(
  format($$ select public.report('profile', %L, 'harassment') $$, pg_temp.m('c1')),
  '42501', null, 'a signed-out visitor cannot report');
reset role;

select pg_temp.as_member('e0');
select throws_ok(
  format($$ select public.report('profile', %L, 'harassment') $$, pg_temp.m('c1')),
  'sign in first', 'an account without a profile cannot report');

select pg_temp.as_member('b1');
select throws_ok(
  format($$ select public.report('profile', %L, 'word_filter') $$, pg_temp.m('c1')),
  'choose a reason', 'a Member cannot choose the word filter reason');
select throws_ok(
  format($$ select public.report('profile', %L, null) $$, pg_temp.m('c1')),
  'choose a reason', 'a reason is required');
select throws_ok(
  format($$ select public.report('profile', %L, 'other', %L) $$, pg_temp.m('c1'), repeat('x', 501)),
  'keep details to 500 characters', 'details over 500 characters are refused');
select lives_ok(
  format($$ select public.report('profile', %L, 'other', %L) $$, pg_temp.m('c2'), repeat('x', 500)),
  'details of 500 characters are accepted');

select throws_ok(
  format($$ select public.report('profile', %L, 'harassment') $$, gen_random_uuid()),
  'nothing to report', 'an unknown profile cannot be reported');
select throws_ok(
  format($$ select public.report('profile', %L, 'harassment') $$, pg_temp.m('d1')),
  'nothing to report', 'a deleted profile cannot be reported');
select throws_ok(
  format($$ select public.report('profile', %L, 'harassment') $$, pg_temp.m('b1')),
  'nothing to report', 'a Member cannot report their own profile');
select throws_ok(
  format($$ select public.report('photo', %L, 'harassment') $$, pg_temp.id('b1photo')),
  'nothing to report', 'a Member cannot report their own photo');
select throws_ok(
  format($$ select public.report('photo', %L, 'harassment') $$, gen_random_uuid()),
  'nothing to report', 'an unknown photo cannot be reported');
select throws_ok(
  format($$ select public.report('activity', %L, 'harassment') $$, pg_temp.id('b1act')),
  'nothing to report', 'a host cannot report their own Activity');
select throws_ok(
  format($$ select public.report('activity', %L, 'harassment') $$, gen_random_uuid()),
  'nothing to report', 'an unknown Activity cannot be reported');
select throws_ok(
  format($$ select public.report('message', %L, 'harassment') $$, pg_temp.id('b1msg')),
  'nothing to report', 'a Member cannot report their own message');
select throws_ok(
  format($$ select public.report('message', %L, 'harassment') $$, pg_temp.id('othermsg')),
  'nothing to report', 'a Member cannot report a message in a Connection they are not part of');
select throws_ok(
  format($$ select public.report(null, %L, 'harassment') $$, pg_temp.m('c1')),
  'nothing to report', 'a report needs a target type');
select throws_ok(
  format($$ select public.report('message', %L, 'harassment') $$, gen_random_uuid()),
  'nothing to report', 'an unknown message cannot be reported');
reset role;

-- ============ What a report stores ============

select pg_temp.as_member('b1');
select lives_ok(
  format($$ select public.report('profile', %L, 'fake_or_spam', '   ') $$, pg_temp.m('c1')),
  'a Member reports a profile');
select pg_temp.act_as_admin(pg_temp.m('ad'));
select results_eq(
  format($$ select reporter_id, target_user_id, reason, details, status, evidence->>'display_name'
           from public.reports where target_type = 'profile' and target_id = %L $$, pg_temp.m('c1')),
  format($$ values (%L::uuid, %L::uuid, 'fake_or_spam'::public.report_reason, null::varchar,
                    'open'::public.report_status, 'Chirag') $$, pg_temp.m('b1'), pg_temp.m('c1')),
  'the report stores reporter, owner, reason, blank details as null, open status and the name');
select is(
  (select jsonb_array_length(evidence->'prompts') from public.reports
   where target_type = 'profile' and target_id = pg_temp.m('c1')),
  2, 'the profile evidence holds the prompts');
select is(
  (select evidence->'prompts'->0->>'answer' from public.reports
   where target_type = 'profile' and target_id = pg_temp.m('c1')),
  'An answer', 'the profile evidence holds each prompt answer');

select pg_temp.as_member('b1');
select lives_ok(
  format($$ select public.report('photo', %L, 'inappropriate_content', 'Not ok') $$, pg_temp.id('c4photo')),
  'a Member reports a photo');
select lives_ok(
  format($$ select public.report('message', %L, 'harassment') $$, pg_temp.id('c6msg')),
  'a Member reports a message in their own Connection');
select lives_ok(
  format($$ select public.report('activity', %L, 'felt_unsafe') $$, pg_temp.id('c5act')),
  'a Member reports an Activity');
select pg_temp.act_as_admin(pg_temp.m('ad'));
select results_eq(
  format($$ select target_user_id, evidence->>'object_key', evidence->>'owner_id', details
           from public.reports where target_id = %L $$, pg_temp.id('c4photo')),
  format($$ values (%L::uuid, %L, %L, 'Not ok'::varchar) $$,
         pg_temp.m('c4'), pg_temp.m('c4') || '/3.jpg', pg_temp.m('c4')),
  'the photo evidence holds the owner and object key');
select is(
  (select evidence_source_key from public.reports where target_id = pg_temp.id('c4photo')),
  pg_temp.m('c4') || '/3.jpg', 'a photo report keeps the object key as the source of its evidence (#160)');
select results_eq(
  format($$ select target_user_id, evidence->>'body', evidence->>'sender_id', evidence->>'type',
                  evidence ? 'media_key', evidence ? 'sent_at'
           from public.reports where target_id = %L $$, pg_temp.id('c6msg')),
  format($$ values (%L::uuid, 'Rude words', %L, 'text', true, true) $$, pg_temp.m('c6'), pg_temp.m('c6')),
  'the message evidence holds body, sender, media key and type, and sent at');
select results_eq(
  format($$ select target_user_id, evidence->>'title', evidence->>'description', evidence->>'type',
                  evidence->>'area_id', evidence->>'host_id', evidence ? 'starts_at'
           from public.reports where target_id = %L $$, pg_temp.id('c5act')),
  format($$ values (%L::uuid, 'Evening badminton', 'Bring a racket', 'sports', 'baner', %L, true) $$,
         pg_temp.m('c5'), pg_temp.m('c5')),
  'the Activity evidence holds title, description, type, Area, start and host');

-- A Block either way does not stop a report.
select pg_temp.as_member('b2');
select public.block_user(pg_temp.m('c3'));
select lives_ok(
  format($$ select public.report('profile', %L, 'harassment') $$, pg_temp.m('c3')),
  'a Member can report someone they blocked');
reset role;
select pg_temp.as_member('c2');
select public.block_user(pg_temp.m('b3'));
select pg_temp.as_member('b3');
select lives_ok(
  format($$ select public.report('profile', %L, 'harassment') $$, pg_temp.m('c2')),
  'a Member can report someone who blocked them');
reset role;

-- ============ Who reads reports ============

select pg_temp.as_member('b1');
select is((select count(*) from public.reports), 0::bigint, 'a reporter cannot read their reports back');
select throws_ok(
  format($$ insert into public.reports (reporter_id, target_type, target_id, reason)
           values (%L, 'profile', %L, 'other') $$, pg_temp.m('b1'), pg_temp.m('c1')),
  '42501', null, 'a Member cannot write a report directly');
select pg_temp.as_member('c1');
select is((select count(*) from public.reports), 0::bigint, 'the reported Member cannot read reports');
reset role;
select pg_temp.act_as_admin(pg_temp.m('ad'));
select ok((select count(*) from public.reports) >= 7, 'an admin reads reports');
reset role;

-- ============ Auto-hide ============

-- Profile: 2 distinct reporters don't hide; the 3rd within 7 days does.
select pg_temp.report_as('b2', 'profile', pg_temp.m('c1'));
select ok(pg_temp.in_feed(pg_temp.m('c1')), 'a profile reported by 2 Members stays in Discover');
select ok(pg_temp.in_profile_view(pg_temp.m('c1')), 'a profile reported by 2 Members stays in profile view');
select pg_temp.report_as('b3', 'profile', pg_temp.m('c1'));
select ok(not pg_temp.in_feed(pg_temp.m('c1')), 'a profile reported by 3 Members leaves Discover');
select ok(not pg_temp.in_profile_view(pg_temp.m('c1')), 'a profile reported by 3 Members leaves profile view');

-- The same reporter three times counts once.
select pg_temp.report_as('b1', 'profile', pg_temp.m('c5'));
select pg_temp.report_as('b1', 'profile', pg_temp.m('c5'));
select pg_temp.report_as('b1', 'profile', pg_temp.m('c5'));
select ok(pg_temp.in_feed(pg_temp.m('c5')), 'one Member reporting three times does not hide a profile');

-- Reports older than 7 days don't count.
insert into public.reports (reporter_id, target_type, target_id, target_user_id, reason, created_at)
values (pg_temp.m('b1'), 'profile', pg_temp.m('c6'), pg_temp.m('c6'), 'other', now() - interval '8 days'),
       (pg_temp.m('b2'), 'profile', pg_temp.m('c6'), pg_temp.m('c6'), 'other', now() - interval '8 days');
select pg_temp.report_as('b3', 'profile', pg_temp.m('c6'));
select ok(pg_temp.in_feed(pg_temp.m('c6')), 'reports older than 7 days do not count');
-- ...but ones just inside the window do.
update public.reports set created_at = now() - interval '6 days'
where target_id = pg_temp.m('c6') and reporter_id in (pg_temp.m('b1'), pg_temp.m('b2'));
select pg_temp.report_as('b3', 'profile', pg_temp.m('c6'));
select ok(not pg_temp.in_feed(pg_temp.m('c6')), 'reports within 7 days count');

-- Word-filter flags (no reporter) don't count.
insert into public.reports (reporter_id, target_type, target_id, target_user_id, reason)
values (null, 'profile', pg_temp.m('c2'), pg_temp.m('c2'), 'word_filter'),
       (null, 'profile', pg_temp.m('c2'), pg_temp.m('c2'), 'word_filter');
select pg_temp.report_as('b1', 'profile', pg_temp.m('c2'));
select ok(pg_temp.in_feed(pg_temp.m('c2')), 'word-filter flags do not count toward Auto-hide');

-- Photo: hidden from profile view after 3; the profile stays.
select pg_temp.report_as('b2', 'photo', pg_temp.id('c4photo'));
select ok(pg_temp.photo_shown(pg_temp.m('c4'), pg_temp.id('c4photo')), 'a photo reported by 2 Members stays');
select pg_temp.report_as('b3', 'photo', pg_temp.id('c4photo'));
select ok(not pg_temp.photo_shown(pg_temp.m('c4'), pg_temp.id('c4photo')), 'a photo reported by 3 Members is hidden');
select ok(pg_temp.in_profile_view(pg_temp.m('c4')), 'hiding one photo leaves the profile visible');

-- Activity: off the board after 3.
select pg_temp.report_as('b2', 'activity', pg_temp.id('c5act'));
select ok(pg_temp.on_board(pg_temp.id('c5act')), 'an Activity reported by 2 Members stays on the board');
select pg_temp.report_as('b3', 'activity', pg_temp.id('c5act'));
select ok(not pg_temp.on_board(pg_temp.id('c5act')), 'an Activity reported by 3 Members leaves the board');
select ok(pg_temp.in_feed(pg_temp.m('c5')), 'hiding an Activity leaves its host visible');

-- Messages are never hidden, however many report them.
insert into public.reports (reporter_id, target_type, target_id, target_user_id, reason)
values (pg_temp.m('b2'), 'message', pg_temp.id('c6msg'), pg_temp.m('c6'), 'harassment'),
       (pg_temp.m('b3'), 'message', pg_temp.id('c6msg'), pg_temp.m('c6'), 'harassment');
select pg_temp.report_as('b1', 'message', pg_temp.id('c6msg'));
select pg_temp.as_member('b1');
select is((select count(*) from public.messages where id = pg_temp.id('c6msg') and removed_at is null),
  1::bigint, 'a reported message is never hidden');
reset role;

select * from finish();
rollback;
