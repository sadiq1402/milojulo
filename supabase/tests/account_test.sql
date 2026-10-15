begin;
\ir helpers/act_as.psql
select plan(57);

create function pg_temp.m(suffix text) returns uuid
language sql immutable as $$ select ('00000000-0000-0000-0000-0000000020' || suffix)::uuid $$;

create function pg_temp.as_member(suffix text) returns void
language sql as $$ select pg_temp.act_as_member(pg_temp.m(suffix)) $$;

create temp table ids (k text primary key, v uuid);
grant select, insert on ids to authenticated, anon;

create function pg_temp.id(key text) returns uuid
language sql stable as $$ select v from ids where k = $1 $$;

create function pg_temp.doc(doc_kind text) returns uuid
language sql stable as $$ select id from public.consent_documents where kind::text = doc_kind and version = 'v1' $$;

-- What the viewer sees of the subject on each surface where Members find each other. Run as postgres.
create function pg_temp.seen_by(viewer text, subject text) returns text[]
language plpgsql as $$
declare
  seen text[] := '{}';
begin
  perform pg_temp.as_member(viewer);
  if exists (select 1 from public.discover_feed() where user_id = pg_temp.m(subject)) then
    seen := seen || 'discover'::text; end if;
  if exists (select 1 from public.get_profile(pg_temp.m(subject))) then
    seen := seen || 'profile'::text; end if;
  if exists (select 1 from public.activity_board() where host_id = pg_temp.m(subject)) then
    seen := seen || 'board'::text; end if;
  if exists (select 1 from public.circle_members_of(pg_temp.id('circle')) where member_id = pg_temp.m(subject)) then
    seen := seen || 'circle'::text; end if;
  reset role;
  return seen;
end;
$$;

-- What the viewer still reaches of the subject: their chats, Join Requests and photo links. Run as postgres.
create function pg_temp.reached_by(viewer text, subject text) returns text[]
language plpgsql as $$
declare
  seen text[] := '{}';
begin
  perform pg_temp.as_member(viewer);
  if exists (select 1 from public.my_connections() where other_id = pg_temp.m(subject)) then
    seen := seen || 'chats'::text; end if;
  if exists (select 1 from public.my_join_requests() where other_id = pg_temp.m(subject)) then
    seen := seen || 'join requests'::text; end if;
  reset role;
  perform pg_temp.act_as_service();
  if exists (select 1 from public.photo_links(pg_temp.m(viewer),
               (select array_agg(id) from public.photos where user_id = pg_temp.m(subject)))) then
    seen := seen || 'photos'::text; end if;
  reset role;
  return seen;
end;
$$;

-- Rows of the subject's photos the viewer gets links for. Run as postgres.
create function pg_temp.media_photo_count(viewer text, subject text) returns setof int
language plpgsql as $$
begin
  perform pg_temp.act_as_service();
  if exists (select 1 from public.photo_links(pg_temp.m(viewer),
               (select array_agg(id) from public.photos where user_id = pg_temp.m(subject)))) then
    return next 1;
  end if;
  reset role;
end;
$$;

-- a1 is the subject, b1 the viewer; both in one Circle, a1 hosting an Activity.
select pg_temp.create_visible_member(pg_temp.m('a1'));
select pg_temp.create_visible_member(pg_temp.m('b1'));
select pg_temp.act_as_admin(pg_temp.m('ad'));
insert into ids select 'circle', public.admin_create_circle('Trekkers', 'baner',
  (select id from public.tags order by id limit 1), 'A local circle.');
reset role;
select pg_temp.as_member('a1');
select public.join_circle(pg_temp.id('circle'));
select public.post_activity('Trek', 'sports', 'baner', now() + interval '1 day');
select pg_temp.as_member('b1');
select public.join_circle(pg_temp.id('circle'));
reset role;

select is(pg_temp.seen_by('b1', 'a1'), '{discover,profile,board,circle}',
  'a Member with every consent shows in Discover, profile view, the board and Circles');

-- Withdrawing consent

select pg_temp.as_member('a1');
select lives_ok(format($$ select public.withdraw_consent(%L) $$, pg_temp.doc('terms')),
  'a Member withdraws their own consent');
select isnt((select withdrawn_at from public.consents where document_id = pg_temp.doc('terms')), null,
  'the withdrawal time is recorded');
select is((select count(*) from public.consents where withdrawn_at is not null), 1::bigint,
  'only the withdrawn consent is marked');
select throws_ok(format($$ select public.withdraw_consent(%L) $$, pg_temp.doc('terms')),
  'no consent to withdraw', 'a consent already withdrawn cannot be withdrawn again');
select throws_ok($$ select public.withdraw_consent(gen_random_uuid()) $$,
  'no consent to withdraw', 'an unknown document is refused');
reset role;

select is(pg_temp.seen_by('b1', 'a1'), '{}',
  'a Member who withdrew a required consent leaves Discover, profile view, the board and Circles');
select is(pg_temp.seen_by('a1', 'b1'), '{}',
  'and, no longer visible, sees nobody either');

-- A document nobody has accepted: a later version, not yet in effect (no public path adds documents).
with d as (insert into public.consent_documents (kind, version, effective_at)
           values ('terms', 'v2', now() + interval '1 year') returning id)
insert into ids select 'v2', id from d;
select pg_temp.as_member('a1');
select throws_ok(format($$ select public.withdraw_consent(%L) $$, pg_temp.id('v2')),
  'no consent to withdraw', 'a document the Member never accepted is refused');
select pg_temp.as_member('b1');
select is((select count(*) from public.consents where withdrawn_at is not null), 0::bigint,
  'another Member''s consents are untouched');
select pg_temp.act_as_anon();
select throws_ok(format($$ select public.withdraw_consent(%L) $$, pg_temp.doc('guidelines')),
  '42501', null, 'signed-out visitors cannot withdraw consent');
reset role;

select pg_temp.as_member('a1');
select public.accept_consents('1995-06-15', (select array_agg(id) from public.consent_documents where version = 'v1'));
select is((select count(*) from public.consents where withdrawn_at is not null), 0::bigint,
  'accepting the current documents again clears the withdrawal');
reset role;
select is(pg_temp.seen_by('b1', 'a1'), '{discover,profile,board,circle}',
  'and the Member is visible again everywhere');

-- Data requests

select pg_temp.as_member('a1');
select lives_ok($$ insert into ids select 'dr', public.request_data_copy() $$, 'a Member asks for a copy of their data');
select results_eq($$ select id, user_id, kind::text, status::text, completed_at from public.data_requests $$,
  format($$ values (%L::uuid, %L::uuid, 'access', 'pending', null::timestamptz) $$, pg_temp.id('dr'), pg_temp.m('a1')),
  'and reads it back as a pending access request');
select throws_ok($$ select public.request_data_copy() $$,
  'you already have a data copy request in progress', 'a second copy request while one is pending is refused');
select throws_ok(format($$ insert into public.data_requests (user_id, kind) values (%L, 'access') $$, pg_temp.m('a1')),
  '42501', null, 'Members cannot insert data requests directly');
select throws_ok($$ update public.data_requests set status = 'done' $$,
  '42501', null, 'Members cannot complete their own data requests');
select throws_ok($$ delete from public.data_requests $$,
  '42501', null, 'Members cannot delete data requests');
select pg_temp.as_member('b1');
select is((select count(*) from public.data_requests), 0::bigint, 'other Members read none of them');
select pg_temp.act_as_admin(pg_temp.m('ad'));
select is((select count(*) from public.data_requests where id = pg_temp.id('dr')), 1::bigint,
  'admins read every data request');
select pg_temp.act_as_anon();
select throws_ok($$ select public.request_data_copy() $$, '42501', null, 'signed-out visitors cannot ask for a copy');
select throws_ok($$ select 1 from public.data_requests $$, '42501', null, 'signed-out visitors cannot read data requests');
reset role;
-- Done by the founder today (no public path completes a request yet).
update public.data_requests set status = 'done', completed_at = now() where id = pg_temp.id('dr');
select pg_temp.as_member('a1');
select lives_ok($$ select public.request_data_copy() $$, 'once the last request is done, a new one can be made');
reset role;

-- Deleting an account

-- c1 deletes their account; d1 shares a Connection, a Circle and Join Requests both ways with them.
insert into ids select 'cd', pg_temp.accepted_pair(pg_temp.m('c1'), pg_temp.m('d1'));
select pg_temp.as_member('c1');
insert into public.messages (id, connection_id, type, body) values (gen_random_uuid(), pg_temp.id('cd'), 'text', 'Before I go');
select public.join_circle(pg_temp.id('circle'));
insert into ids select 'c1act', public.post_activity('Chess', 'games', 'baner', now() + interval '1 day');
select pg_temp.as_member('d1');
select public.join_circle(pg_temp.id('circle'));
insert into ids select 'd1act', public.post_activity('Run', 'sports', 'baner', now() + interval '1 day');
select public.join_activity_request(pg_temp.id('c1act'));
select pg_temp.as_member('c1');
select public.join_activity_request(pg_temp.id('d1act'));
reset role;

select is(pg_temp.seen_by('d1', 'c1') || pg_temp.reached_by('d1', 'c1'),
  '{discover,profile,board,circle,chats,"join requests",photos}',
  'before deleting, the Member shows on every surface');

select pg_temp.as_member('c1');
select lives_ok($$ select public.delete_account() $$, 'a Member deletes their account');
select results_eq($$ select kind::text, status::text from public.data_requests $$,
  $$ values ('erasure', 'pending') $$, 'and an erasure request is queued');
select throws_ok($$ select public.delete_account() $$,
  'your account is already being deleted', 'deleting again is refused');
select is((select count(*) from public.data_requests), 1::bigint, 'and queues nothing more');
reset role;

select is(pg_temp.seen_by('d1', 'c1') || pg_temp.reached_by('d1', 'c1'), '{}',
  'a deleted Member leaves Discover, profile view, the board, Circles, chat lists, Join Requests and photo links at once');
select pg_temp.as_member('d1');
select is_empty(format($$ select 1 from public.activity_join_requests(%L) $$, pg_temp.id('d1act')),
  'and their Join Request leaves the host''s list');
reset role;
select is(pg_temp.seen_by('d1', 'b1') || pg_temp.reached_by('d1', 'b1'), '{discover,profile,circle,photos}',
  'other Members are unaffected');

select pg_temp.act_as_anon();
select throws_ok($$ select public.delete_account() $$, '42501', null, 'signed-out visitors cannot delete an account');
reset role;

-- Until the purge, the other side still reads the history directly, though the chat list drops it.
select pg_temp.as_member('d1');
select is((select count(*) from public.messages where connection_id = pg_temp.id('cd')), 1::bigint,
  'the other side can still read the chat history with a deleted Member until the purge');
reset role;

-- A Member who withdrew consent, as a Paused one: c2 shares a Connection with c3 and asked to join c3's Activity.
insert into ids select 'hk', pg_temp.accepted_pair(pg_temp.m('c3'), pg_temp.m('c2'));
select pg_temp.as_member('c3');
insert into ids select 'h1act', public.post_activity('Swim', 'sports', 'baner', now() + interval '1 day');
select pg_temp.as_member('c2');
select public.join_activity_request(pg_temp.id('h1act'));
select public.withdraw_consent(pg_temp.doc('data_notice'));
select throws_ok($$ insert into public.messages (id, connection_id, type, body)
                    values (gen_random_uuid(), (select v from ids where k = 'hk'), 'text', 'Still here') $$,
  '42501', null, 'a Member who withdrew consent cannot send messages');
select pg_temp.as_member('c3');
select is((select count(*) from public.my_connections() where other_id = pg_temp.m('c2')), 1::bigint,
  'the other side keeps the Connection in their chat list, as for a Paused Member');
select lives_ok($$ insert into public.messages (id, connection_id, type, body)
                   values (gen_random_uuid(), (select v from ids where k = 'hk'), 'text', 'Hello?') $$,
  'and can still send into it');
select is_empty(format($$ select 1 from public.activity_join_requests(%L) $$, pg_temp.id('h1act')),
  'their Join Request leaves the host''s list');
select throws_ok($$ select public.submit_meetup_feedback('00000000-0000-0000-0000-0000000020c2', true, true) $$,
  'no one to give feedback about', 'and no feedback can be given about them');
reset role;
select is((select count(*) from pg_temp.media_photo_count('c3', 'c2')), 1::bigint,
  'a Connection still gets their photo links, as for a Paused Member');
select is((select count(*) from pg_temp.media_photo_count('b1', 'c2')), 0::bigint,
  'a stranger gets none');

select pg_temp.as_member('c2');
select public.accept_consents('1995-06-15', (select array_agg(id) from public.consent_documents where version = 'v1'));
select lives_ok($$ insert into public.messages (id, connection_id, type, body)
                   values (gen_random_uuid(), (select v from ids where k = 'hk'), 'text', 'Back') $$,
  'after accepting again they can send');
select pg_temp.as_member('c3');
select isnt_empty(format($$ select 1 from public.activity_join_requests(%L) $$, pg_temp.id('h1act')),
  'and their Join Request is back on the host''s list');
reset role;

-- Erasure: removing the auth user

-- e1 is erased; f1 chatted with e1 and they gave each other feedback; g1 reported e1 and e1 reported g1.
insert into ids select 'ef', pg_temp.accepted_pair(pg_temp.m('e1'), pg_temp.m('f1'));
select pg_temp.create_visible_member(pg_temp.m('a2'));
select pg_temp.as_member('e1');
insert into public.messages (id, connection_id, type, body) values (gen_random_uuid(), pg_temp.id('ef'), 'text', 'Hi from e1');
select public.submit_meetup_feedback(pg_temp.m('f1'), true, true);
select public.join_circle(pg_temp.id('circle'));
select public.request_data_copy();
select public.join_activity_request(pg_temp.id('d1act'));
select public.report('profile', pg_temp.m('a2'), 'other');
select pg_temp.as_member('f1');
insert into public.messages (id, connection_id, type, body) values (gen_random_uuid(), pg_temp.id('ef'), 'text', 'Hi from f1');
select public.submit_meetup_feedback(pg_temp.m('e1'), true, true);
select pg_temp.as_member('a2');
select public.report('profile', pg_temp.m('e1'), 'harassment', 'Rude at the meetup');
reset role;

-- The account-purge Edge Function does this in production, once e1's files are gone from R2.
delete from auth.users where id = pg_temp.m('e1');

select pg_temp.as_member('f1');
select is((select count(*) from public.connections), 0::bigint, 'the erased Member''s Connections are gone');
select is((select count(*) from public.messages), 0::bigint, 'with every message in them, from both sides');
select is((select count(*) from public.meetup_feedback), 0::bigint, 'and both sides'' meetup feedback');
select pg_temp.as_member('d1');
select is_empty(format($$ select 1 from public.activity_join_requests(%L) $$, pg_temp.id('d1act')),
  'their Join Requests are gone');
select is((select count(*) from public.circle_members_of(pg_temp.id('circle')) where member_id = pg_temp.m('e1')), 0::bigint,
  'and their Circle memberships');
select pg_temp.act_as_admin(pg_temp.m('ad'));
select is((select count(*) from public.data_requests where user_id = pg_temp.m('e1')), 0::bigint,
  'their data requests are gone');
select results_eq($$ select reporter_id, target_user_id, evidence ->> 'display_name', details from public.reports
                     where target_type = 'profile' and target_id = '00000000-0000-0000-0000-0000000020e1' $$,
  $$ values (pg_temp.m('a2'), null::uuid, 'Test', 'Rude at the meetup'::varchar) $$,
  'a report about the erased Member keeps its evidence, with the target id cleared');
select results_eq($$ select reporter_id, target_user_id from public.reports
                     where target_type = 'profile' and target_id = '00000000-0000-0000-0000-0000000020a2' $$,
  $$ values (null::uuid, pg_temp.m('a2')) $$,
  'a report the erased Member made stays, with the reporter cleared');
reset role;
-- Erased rows have no read path left (a Connection's messages are read through it, Join Requests and
-- Circle lists through the profile), so they are counted as postgres.
select is((select count(*) from public.profiles where id = pg_temp.m('e1'))
        + (select count(*) from public.photos where user_id = pg_temp.m('e1'))
        + (select count(*) from public.profile_prompts where user_id = pg_temp.m('e1'))
        + (select count(*) from public.consents where user_id = pg_temp.m('e1')), 0::bigint,
  'the profile, photos, prompts and consents are gone');
select is((select count(*) from public.messages where connection_id = pg_temp.id('ef')), 0::bigint,
  'no message of the erased Connection is left behind');
select is((select count(*) from public.activity_requests where requester_id = pg_temp.m('e1'))
        + (select count(*) from public.circle_members where user_id = pg_temp.m('e1')), 0::bigint,
  'no Join Request or Circle membership is left behind');

-- Daily chat-media purge

-- cron.job is readable only by postgres.
select results_eq($$ select schedule, active from cron.job where jobname = 'purge-chat-media' $$,
  $$ values ('30 21 * * *'::text, true) $$, 'the chat-media purge runs daily at 03:00 India time');
select matches((select command from cron.job where jobname = 'purge-chat-media'),
  'net\.http_post.*project_url.*/functions/v1/purge-chat-media.*service_role_key',
  'it calls the purge-chat-media function with the project URL and service role key from Vault');
select is((select array_length(regexp_split_to_array(command, 'vault\.decrypted_secrets'), 1) - 1
           from cron.job where jobname = 'purge-chat-media'), 1, 'it reads Vault once per run');

select * from finish();
rollback;
