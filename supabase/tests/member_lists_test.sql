begin;
\ir helpers/act_as.psql
select plan(21);

-- c1 Asha and c2 Ravi are connected under Friends; c3 is unrelated.
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000c1');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000c2');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000c3');
update public.profiles set display_name = 'Asha', area_id = 'wakad' where id = '00000000-0000-0000-0000-0000000000c1';
update public.profiles set display_name = 'Ravi', area_id = 'kharadi' where id = '00000000-0000-0000-0000-0000000000c2';
select id as ravi_cover from public.photos
where user_id = '00000000-0000-0000-0000-0000000000c2' and position = 1 \gset

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select public.send_request('00000000-0000-0000-0000-0000000000c2', 'friends', 'Coffee?') as asha_ravi \gset
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c2');
select public.respond_request(:'asha_ravi', true);

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select results_eq(
  $$ select other_id, other_name, other_photo_id, other_area_id, mode, status::text
     from public.my_connections() $$,
  format($$ values ('00000000-0000-0000-0000-0000000000c2'::uuid, 'Ravi'::varchar, %L::uuid,
                    'kharadi'::text, 'friends'::public.mode, 'accepted') $$, :'ravi_cover'),
  'a Member sees their Connection with the other side''s first name, cover photo, Area, Mode and status');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c3');
select is_empty($$ select 1 from public.my_connections() $$,
  'a Member outside the Connection sees none of it');
select pg_temp.act_as_anon();
select throws_ok($$ select * from public.my_connections() $$, '42501', null,
  'a signed-out visitor cannot list Connections');

-- c4: Asha's request out; c5: a request in to Asha; c6 declined Asha.
reset role;
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000c4');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000c5');
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000c6');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select public.send_request('00000000-0000-0000-0000-0000000000c4', 'friends', 'Trek on Sunday?');
select public.send_request('00000000-0000-0000-0000-0000000000c6', 'friends') as declined_conn \gset
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c5');
select public.send_request('00000000-0000-0000-0000-0000000000c1', 'friends', 'Badminton?');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c6');
select public.respond_request(:'declined_conn', false);

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select results_eq(
  $$ select other_id, direction::text, note::text from public.my_connections()
     where status = 'requested' order by other_id $$,
  $$ values ('00000000-0000-0000-0000-0000000000c4'::uuid, 'outgoing', 'Trek on Sunday?'),
            ('00000000-0000-0000-0000-0000000000c5'::uuid, 'incoming', 'Badminton?') $$,
  'pending requests show in both directions with their note');
select is_empty(
  $$ select 1 from public.my_connections() where other_id = '00000000-0000-0000-0000-0000000000c6' $$,
  'a declined request is not listed');

-- c7 and Asha were connected, then c7 closed it.
reset role;
select pg_temp.create_visible_member('00000000-0000-0000-0000-0000000000c7');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select public.send_request('00000000-0000-0000-0000-0000000000c7', 'friends') as closed_conn \gset
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c7');
select public.respond_request(:'closed_conn', true);
select public.close_connection(:'closed_conn');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select results_eq(
  $$ select status::text from public.my_connections() where other_id = '00000000-0000-0000-0000-0000000000c7' $$,
  array['closed'], 'a closed Connection stays listed as history');

-- Ravi pauses; Asha's chat with him carries on.
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c2');
select public.set_paused(true);
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select results_eq(
  $$ select other_name, other_photo_id is not null, other_area_id from public.my_connections()
     where other_id = '00000000-0000-0000-0000-0000000000c2' $$,
  $$ values ('Ravi'::varchar, true, 'kharadi'::text) $$,
  'the other side''s details still come back while they are Paused');

reset role;
select date_of_birth::text as ravi_dob from public.profiles where id = '00000000-0000-0000-0000-0000000000c2' \gset
select object_key as ravi_key from public.photos where id = :'ravi_cover' \gset
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select is_empty(
  format($$ select 1 from public.my_connections() r
            where to_jsonb(r)::text like '%%' || %L || '%%' or to_jsonb(r)::text like '%%' || %L || '%%' $$,
         :'ravi_dob', :'ravi_key'),
  'neither the other side''s date of birth nor a photo''s R2 key is returned');

-- Ravi's cover is hidden after Reports; his second photo stands in.
reset role;
update public.photos set hidden_at = now() where id = :'ravi_cover';
select id as ravi_second from public.photos
where user_id = '00000000-0000-0000-0000-0000000000c2' and position = 2 \gset
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select results_eq(
  $$ select other_photo_id from public.my_connections() where other_id = '00000000-0000-0000-0000-0000000000c2' $$,
  format('select %L::uuid', :'ravi_second'),
  'a hidden cover photo is skipped for the next live one');

-- Ravi is Auto-hidden and c7 is banned: both stay in Asha's history by name, without a photo.
reset role;
update public.profiles set hidden_at = now() where id = '00000000-0000-0000-0000-0000000000c2';
update public.profiles set status = 'banned', banned_at = now() where id = '00000000-0000-0000-0000-0000000000c7';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select results_eq(
  $$ select other_name, other_photo_id from public.my_connections()
     where other_id in ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c7')
     order by other_id $$,
  $$ values ('Ravi'::varchar, null::uuid), ('Test'::varchar, null::uuid) $$,
  'an Auto-hidden or banned Member stays listed by name but without a cover photo');
reset role;
update public.profiles set hidden_at = null where id = '00000000-0000-0000-0000-0000000000c2';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select results_eq(
  $$ select other_photo_id from public.my_connections() where other_id = '00000000-0000-0000-0000-0000000000c2' $$,
  format('select %L::uuid', :'ravi_second'),
  'the cover photo returns once the Member is restored');

-- Asha and Ravi chat; times are set directly because now() is fixed inside the test transaction.
reset role;
insert into public.messages (id, connection_id, sender_id, type, body, created_at) values
  (gen_random_uuid(), :'asha_ravi', '00000000-0000-0000-0000-0000000000c2', 'text', 'Hi', now() - interval '3 minutes'),
  (gen_random_uuid(), :'asha_ravi', '00000000-0000-0000-0000-0000000000c1', 'text', 'Hello!', now() - interval '2 minutes'),
  (gen_random_uuid(), :'asha_ravi', '00000000-0000-0000-0000-0000000000c2', 'text', 'Saturday works?', now() - interval '1 minute');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select results_eq(
  format($$ select last_message_body, last_message_at = now() - interval '1 minute', unread_count
            from public.my_connections() where connection_id = %L $$, :'asha_ravi'),
  $$ values ('Saturday works?'::text, true, 2) $$,
  'the newest message is previewed, and the other side''s messages are unread');
update public.connection_members set last_read_at = now() - interval '150 seconds'
where connection_id = :'asha_ravi' and user_id = '00000000-0000-0000-0000-0000000000c1';
select results_eq(
  format('select unread_count from public.my_connections() where connection_id = %L', :'asha_ravi'),
  array[1], 'only messages newer than the read position count as unread');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c2');
select results_eq(
  format('select unread_count from public.my_connections() where connection_id = %L', :'asha_ravi'),
  array[1], 'a Member''s own messages never count as unread');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select results_eq(
  $$ select last_message_body is null, unread_count from public.my_connections()
     where other_id = '00000000-0000-0000-0000-0000000000c4' $$,
  $$ values (true, 0) $$, 'a pending request has no messages and nothing unread');

reset role;
update public.messages set removed_at = now() where body = 'Saturday works?';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select results_eq(
  format('select last_message_body, unread_count from public.my_connections() where connection_id = %L',
         :'asha_ravi'),
  $$ values ('Hello!'::text, 0) $$,
  'a message removed by moderation is neither previewed nor counted');

select is(
  (select connection_id from public.my_connections() with ordinality as r
   order by r.ordinality desc limit 1),
  :'asha_ravi'::uuid,
  'the Connection with the oldest activity comes last');

-- Blocks: Asha blocks c6 Neha; c5 blocks Asha.
reset role;
update public.profiles set display_name = 'Neha' where id = '00000000-0000-0000-0000-0000000000c6';
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select public.block_user('00000000-0000-0000-0000-0000000000c6');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c5');
select public.block_user('00000000-0000-0000-0000-0000000000c1');

select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c1');
select results_eq($$ select member_id, display_name from public.my_blocks() $$,
  $$ values ('00000000-0000-0000-0000-0000000000c6'::uuid, 'Neha'::varchar) $$,
  'a Member lists who they have blocked, by first name, and not who has blocked them');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c6');
select is_empty($$ select 1 from public.my_blocks() $$,
  'the blocked Member cannot see who blocked them');
select pg_temp.act_as_member('00000000-0000-0000-0000-0000000000c3');
select is_empty($$ select 1 from public.my_blocks() $$, 'another Member sees none of these Blocks');
select pg_temp.act_as_anon();
select throws_ok($$ select * from public.my_blocks() $$, '42501', null,
  'a signed-out visitor cannot list Blocks');

select * from finish();
rollback;
