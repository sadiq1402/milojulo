begin;
\ir helpers/act_as.psql
select plan(36);

-- A visible Member holding Friends and Casual. Run as postgres.
create function pg_temp.create_casual(member_id uuid, member_gender public.gender, wants public.gender[])
returns void
language plpgsql as $$
begin
  perform pg_temp.create_complete_member(member_id);
  update public.profiles
  set modes = '{friends,casual}', gender = member_gender, pref_genders = wants,
      pref_age_min = 25, pref_age_max = 35, pref_max_km = 10,
      date_of_birth = (now() at time zone 'Asia/Kolkata')::date - make_interval(years => 30)
  where id = member_id;
  perform pg_temp.act_as_member(member_id);
  perform public.submit_profile();
  reset role;
end;
$$;

-- The Mode-change flow: one side proposes, the other accepts. Run as postgres; leaves the role reset.
create function pg_temp.change_mode(proposer uuid, answerer uuid, conn uuid, to_mode public.mode) returns void
language plpgsql as $$
declare
  change uuid;
begin
  perform pg_temp.act_as_member(proposer);
  change := public.propose_mode_change(conn, to_mode);
  perform pg_temp.act_as_member(answerer);
  perform public.respond_mode_change(change, true);
  reset role;
end;
$$;

\set m1 '00000000-0000-0000-0000-0000000000a1'
\set m2 '00000000-0000-0000-0000-0000000000a2'
\set m3 '00000000-0000-0000-0000-0000000000a3'
\set f1 '00000000-0000-0000-0000-0000000000b1'
\set f2 '00000000-0000-0000-0000-0000000000b2'
\set all_sent '{00000000-0000-0000-0000-00000000ee01,00000000-0000-0000-0000-00000000ee02,00000000-0000-0000-0000-00000000ee03}'
select pg_temp.create_casual(:'m1', 'man', '{woman}');
select pg_temp.create_casual(:'m2', 'woman', '{man}');
select pg_temp.create_casual(:'m3', 'woman', '{man}');
select pg_temp.accepted_pair(:'m1', :'m2', 'casual', create_members => false) as casual \gset
select pg_temp.accepted_pair(:'f1', :'f2') as friends \gset

-- The state starts off on both sides.
select pg_temp.act_as_member(:'m1');
select results_eq(format($$ select * from public.chat_media_state(%L) $$, :'casual'),
  $$ values (true, false, false) $$, 'a Casual Connection starts with Media Consent off on both sides');
select pg_temp.act_as_member(:'f1');
select results_eq(format($$ select is_casual from public.chat_media_state(%L) $$, :'friends'),
  $$ values (false) $$, 'a Friends Connection is not Casual');
select pg_temp.act_as_member(:'m3');
select is_empty(format($$ select * from public.chat_media_state(%L) $$, :'casual'),
  'a Member outside the Connection gets no media state');
select throws_ok(format($$ select public.set_media_consent(%L, true) $$, :'casual'),
  'P0001', 'no connection', 'a Member outside the Connection cannot switch its Media Consent');
select pg_temp.act_as_anon();
select throws_ok(format($$ select public.set_media_consent(%L, true) $$, :'casual'),
  '42501', null, 'a signed-out visitor cannot call set_media_consent');
select throws_ok(format($$ select * from public.chat_media_state(%L) $$, :'casual'),
  '42501', null, 'a signed-out visitor cannot call chat_media_state');

-- Nobody's consent: no image or video upload; text and voice fine.
reset role;
select throws_ok(format($$ select pg_temp.chat_upload(%L, %L, 'image') $$, :'m1', :'casual'),
  'P0001', 'media is off in this chat', 'an image upload with neither side consenting is refused');
select throws_ok(format($$ select pg_temp.chat_upload(%L, %L, 'video') $$, :'m1', :'casual'),
  'P0001', 'media is off in this chat', 'a video upload with neither side consenting is refused');
select pg_temp.chat_upload(:'m1', :'casual', 'voice') as voice_key \gset
select pg_temp.act_as_member(:'m1');
select lives_ok(format($$ insert into public.messages (id, connection_id, sender_id, type, body)
    values (gen_random_uuid(), %L, %L, 'text', 'Hi') $$, :'casual', :'m1'),
  'text is unaffected by Media Consent');
select lives_ok(pg_temp.media_insert('00000000-0000-0000-0000-00000000ee01', :'m1', :'casual', 'voice', :'voice_key'),
  'voice notes are unaffected by Media Consent');

-- One side only.
select lives_ok(format($$ select public.set_media_consent(%L, true) $$, :'casual'),
  'a Member switches on their own Media Consent');
select results_eq(format($$ select * from public.chat_media_state(%L) $$, :'casual'),
  $$ values (true, true, false) $$, 'the state shows mine on, theirs off');
select pg_temp.act_as_member(:'m2');
select results_eq(format($$ select mine, theirs from public.chat_media_state(%L) $$, :'casual'),
  $$ values (false, true) $$, 'the other side sees theirs on, mine off');
reset role;
select throws_ok(format($$ select pg_temp.chat_upload(%L, %L, 'image') $$, :'m1', :'casual'),
  'P0001', 'media is off in this chat', 'an image upload is refused while only the sender consents');
select throws_ok(format($$ select pg_temp.chat_upload(%L, %L, 'image') $$, :'m2', :'casual'),
  'P0001', 'media is off in this chat', 'an image upload is refused while only the recipient consents');

-- Both sides.
select pg_temp.act_as_member(:'m2');
select lives_ok(format($$ select public.set_media_consent(%L, true) $$, :'casual'),
  'the other Member switches theirs on');
reset role;
select pg_temp.chat_upload(:'m1', :'casual', 'image') as sent_image_key \gset
select pg_temp.chat_upload(:'m2', :'casual', 'video') as sent_video_key \gset
-- Uploaded while both consent, sent after one side switches off.
select pg_temp.chat_upload(:'m1', :'casual', 'image') as late_image_key \gset
select pg_temp.chat_upload(:'m1', :'casual', 'video') as late_video_key \gset
select pg_temp.chat_upload(:'m2', :'casual', 'image') as switcher_image_key \gset
select pg_temp.act_as_member(:'m1');
select lives_ok(pg_temp.media_insert('00000000-0000-0000-0000-00000000ee02', :'m1', :'casual', 'image', :'sent_image_key'),
  'an image is accepted once both sides consent');
select pg_temp.act_as_member(:'m2');
select lives_ok(pg_temp.media_insert('00000000-0000-0000-0000-00000000ee03', :'m2', :'casual', 'video', :'sent_video_key'),
  'a video is accepted once both sides consent');
reset role;
select results_eq(format($$ select pg_temp.media_links(%L, %L) $$, :'m1', :'all_sent'),
  $$ values ('00000000-0000-0000-0000-00000000ee01'::uuid), ('00000000-0000-0000-0000-00000000ee02'::uuid),
            ('00000000-0000-0000-0000-00000000ee03'::uuid) $$,
  'while both consent, links are signed for images, video and voice');

-- Either side switches off again.
reset role;
select pg_temp.act_as_member(:'m2');
select lives_ok(format($$ select public.set_media_consent(%L, false) $$, :'casual'),
  'either side can switch Media Consent off');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'m2', :'casual', 'image', :'switcher_image_key'),
  'P0001', 'media is off in this chat', 'the side that switched off cannot send images either');
select pg_temp.act_as_member(:'m1');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'m1', :'casual', 'image', :'late_image_key'),
  'P0001', 'media is off in this chat', 'after one side switches off, images are refused again');
select throws_ok(pg_temp.media_insert(gen_random_uuid(), :'m1', :'casual', 'video', :'late_video_key'),
  'P0001', 'media is off in this chat', 'after one side switches off, video is refused again');
select results_eq(format($$ select mine, theirs from public.chat_media_state(%L) $$, :'casual'),
  $$ values (true, false) $$, 'the state shows theirs off again');
reset role;
select results_eq(format($$ select pg_temp.media_links(%L, %L) $$, :'m1', :'all_sent'),
  $$ values ('00000000-0000-0000-0000-00000000ee01'::uuid) $$,
  'while either side has it off, already-sent images and video get no links; voice still does');
reset role;
select throws_ok(format($$ select pg_temp.chat_upload(%L, %L, 'video') $$, :'m1', :'casual'),
  'P0001', 'media is off in this chat', 'a video upload is refused again once consent is off');
select lives_ok(format($$ select pg_temp.chat_upload(%L, %L, 'voice') $$, :'m1', :'casual'),
  'a voice upload is fine while consent is off');

-- Members can't set the column directly.
select pg_temp.act_as_member(:'m1');
select throws_ok(format($$ update public.connection_members set media_consent = true
                         where connection_id = %L $$, :'casual'),
  '42501', null, 'Members cannot update media_consent directly');

-- Non-Casual Connections need no consent, for sending or links.
reset role;
select pg_temp.chat_upload(:'f1', :'friends', 'image') as friends_image_key \gset
select pg_temp.chat_upload(:'f2', :'friends', 'video') as friends_video_key \gset
select pg_temp.act_as_member(:'f1');
select lives_ok(pg_temp.media_insert('00000000-0000-0000-0000-00000000ee04', :'f1', :'friends', 'image', :'friends_image_key'),
  'an image in a Friends Connection needs no consent');
select pg_temp.act_as_member(:'f2');
select lives_ok(pg_temp.media_insert(gen_random_uuid(), :'f2', :'friends', 'video', :'friends_video_key'),
  'a video in a Friends Connection needs no consent');
reset role;
select results_eq(format($$ select pg_temp.media_links(%L, '{00000000-0000-0000-0000-00000000ee04}') $$, :'f2'),
  $$ values ('00000000-0000-0000-0000-00000000ee04'::uuid) $$, 'an image in a Friends Connection gets its link');

-- Decision 33: changing into Casual resets both switches; changing out of it leaves them.
reset role;
select pg_temp.act_as_member(:'m2');
select public.set_media_consent(:'casual', true);
reset role;
select pg_temp.change_mode(:'m1', :'m2', :'casual', 'friends');
select pg_temp.act_as_member(:'m1');
select results_eq(format($$ select * from public.chat_media_state(%L) $$, :'casual'),
  $$ values (false, true, true) $$, 'changing out of Casual leaves both switches as they were');
reset role;
select pg_temp.change_mode(:'m2', :'m1', :'casual', 'casual');
select pg_temp.act_as_member(:'m1');
select results_eq(format($$ select * from public.chat_media_state(%L) $$, :'casual'),
  $$ values (true, false, false) $$, 'changing into Casual switches Media Consent off on both sides');
reset role;
select throws_ok(format($$ select pg_temp.chat_upload(%L, %L, 'image') $$, :'m1', :'casual'),
  'P0001', 'media is off in this chat', 'after changing into Casual, images need consent again');
select is_empty(format($$ select pg_temp.media_links(%L, '{00000000-0000-0000-0000-00000000ee02}') $$, :'m2'),
  'and images sent earlier get no links again');

-- The Connection stays private.
reset role;
select pg_temp.act_as_member(:'m3');
select is_empty(format($$ select 1 from public.connection_members where connection_id = %L $$, :'casual'),
  'outsiders still see nothing of the Connection');

select * from finish();
rollback;
