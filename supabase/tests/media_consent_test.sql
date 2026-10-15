begin;
\ir helpers/act_as.psql
select plan(32);

-- A visible Member holding Casual (and Friends). Run as postgres.
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

-- An accepted Connection under the given Mode. Run as postgres.
create function pg_temp.connect(a uuid, b uuid, conn_mode public.mode) returns uuid
language plpgsql as $$
declare
  conn uuid;
begin
  perform pg_temp.act_as_member(a);
  conn := public.send_request(b, conn_mode);
  perform pg_temp.act_as_member(b);
  perform public.respond_request(conn, true);
  reset role;
  return conn;
end;
$$;

-- A media message the sender uploaded first, to pass to lives_ok / throws_ok. Run as postgres.
create function pg_temp.media_from(sender uuid, conn uuid, kind public.message_type) returns text
language plpgsql as $$
declare
  key text := pg_temp.chat_upload(sender, conn, kind);
begin
  return format($q$ insert into public.messages
                      (id, connection_id, sender_id, type, media_key, media_mime, media_duration_ms)
                    values (gen_random_uuid(), %L, %L, %L, %L, %L, %L) $q$,
                conn, sender, kind, key,
                case kind when 'image' then 'image/jpeg' when 'video' then 'video/mp4' else 'audio/mp4' end,
                case when kind in ('video', 'voice') then 1000 end);
end;
$$;

\set m1 '00000000-0000-0000-0000-0000000000a1'
\set m2 '00000000-0000-0000-0000-0000000000a2'
\set m3 '00000000-0000-0000-0000-0000000000a3'
\set f1 '00000000-0000-0000-0000-0000000000b1'
\set f2 '00000000-0000-0000-0000-0000000000b2'
select pg_temp.create_casual(:'m1', 'man', '{woman}');
select pg_temp.create_casual(:'m2', 'woman', '{man}');
select pg_temp.create_casual(:'m3', 'woman', '{man}');
select pg_temp.connect(:'m1', :'m2', 'casual') as casual \gset
select pg_temp.create_visible_member(:'f1');
select pg_temp.create_visible_member(:'f2');
select pg_temp.connect(:'f1', :'f2', 'friends') as friends \gset

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

-- Nobody's consent: no image or video slot, text and voice fine.
reset role;
select throws_ok(format($$ select pg_temp.chat_upload(%L, %L, 'image') $$, :'m1', :'casual'),
  'P0001', 'media is off in this chat', 'an image upload with neither side consenting is refused');
select throws_ok(format($$ select pg_temp.chat_upload(%L, %L, 'video') $$, :'m1', :'casual'),
  'P0001', 'media is off in this chat', 'a video upload with neither side consenting is refused');
select pg_temp.act_as_member(:'m1');
select lives_ok(format($$ insert into public.messages (id, connection_id, sender_id, type, body)
    values (gen_random_uuid(), %L, %L, 'text', 'Hi') $$, :'casual', :'m1'),
  'text is unaffected by Media Consent');
reset role;
select pg_temp.media_from(:'m1', :'casual', 'voice') as q \gset
select pg_temp.act_as_member(:'m1');
select lives_ok(:'q', 'voice notes are unaffected by Media Consent');

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
select lives_ok(format($$ select public.set_media_consent(%L, true) $$, :'casual'),
  'the other Member switches theirs on');
reset role;
select pg_temp.media_from(:'m1', :'casual', 'image') as q \gset
select pg_temp.act_as_member(:'m1');
select lives_ok(:'q', 'an image is accepted once both sides consent');
reset role;
select pg_temp.media_from(:'m2', :'casual', 'video') as q \gset
select pg_temp.act_as_member(:'m2');
select lives_ok(:'q', 'a video is accepted once both sides consent');

-- Slots made while both consent, used after one side switches off.
reset role;
select pg_temp.media_from(:'m1', :'casual', 'image') as q \gset
select pg_temp.media_from(:'m1', :'casual', 'video') as qv \gset
select pg_temp.media_from(:'m2', :'casual', 'image') as q2 \gset

-- Either side switches off again.
select pg_temp.act_as_member(:'m2');
select lives_ok(format($$ select public.set_media_consent(%L, false) $$, :'casual'),
  'either side can switch Media Consent off');
select pg_temp.act_as_member(:'m1');
select throws_ok(:'q', 'P0001', 'media is off in this chat', 'after one side switches off, images are refused again');
select throws_ok(:'qv', 'P0001', 'media is off in this chat', 'after one side switches off, video is refused again');
select pg_temp.act_as_member(:'m2');
select throws_ok(:'q2', 'P0001', 'media is off in this chat', 'the side that switched off cannot send images either');
select pg_temp.act_as_member(:'m1');
select results_eq(format($$ select mine, theirs from public.chat_media_state(%L) $$, :'casual'),
  $$ values (true, false) $$, 'the state shows theirs off again');
reset role;
select throws_ok(format($$ select pg_temp.chat_upload(%L, %L, 'image') $$, :'m1', :'casual'),
  'P0001', 'media is off in this chat', 'an image upload slot is refused while consent is off');
select throws_ok(format($$ select pg_temp.chat_upload(%L, %L, 'video') $$, :'m1', :'casual'),
  'P0001', 'media is off in this chat', 'a video upload slot is refused while consent is off');
select lives_ok(format($$ select pg_temp.chat_upload(%L, %L, 'voice') $$, :'m1', :'casual'),
  'a voice upload slot is fine while consent is off');

-- Members can't set the column directly, on either side.
select pg_temp.act_as_member(:'m1');
select throws_ok(format($$ update public.connection_members set media_consent = true
                         where connection_id = %L $$, :'casual'),
  '42501', null, 'Members cannot update media_consent directly');

-- Non-Casual Connections: media without anyone's consent.
reset role;
select pg_temp.media_from(:'f1', :'friends', 'image') as q \gset
select pg_temp.act_as_member(:'f1');
select lives_ok(:'q', 'an image in a Friends Connection needs no consent');
reset role;
select pg_temp.media_from(:'f2', :'friends', 'video') as q \gset
select pg_temp.act_as_member(:'f2');
select lives_ok(:'q', 'a video in a Friends Connection needs no consent');

-- After a Mode change to Casual, the rule applies.
reset role;
update public.connections set mode = 'casual' where id = :'friends'; -- no Mode change flow needed for the rule
select throws_ok(format($$ select pg_temp.chat_upload(%L, %L, 'image') $$, :'f1', :'friends'),
  'P0001', 'media is off in this chat', 'a Connection that becomes Casual needs consent');
select pg_temp.act_as_member(:'f1');
select results_eq(format($$ select is_casual from public.chat_media_state(%L) $$, :'friends'),
  $$ values (true) $$, 'chat_media_state follows the Connection''s current Mode');

-- The Connection stays private.
select pg_temp.act_as_member(:'m3');
select is_empty(format($$ select 1 from public.connection_members where connection_id = %L $$, :'casual'),
  'outsiders still see nothing of the Connection');

select * from finish();
rollback;
