begin;
\ir helpers/act_as.psql
select plan(6);

-- How many of the owner's photos the media Edge Function may sign for the viewer.
create function pg_temp.seen(viewer uuid, owner uuid) returns integer
language plpgsql as $$
declare
  ids uuid[] := array(select id from public.photos where user_id = owner);
  n integer;
begin
  perform pg_temp.act_as_service();
  select count(*) into n from public.photo_links(viewer, ids);
  reset role;
  return n;
end;
$$;

-- 01 hosts in Baner; 02 lives in Kharadi, beyond 01's Discover range, so only the board links them.
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000004101');
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000004102');
select pg_temp.place('00000000-0000-0000-0000-000000004102', 18.5515, 73.9348);
insert into public.activities (host_id, title, type, area_id, starts_at, capacity)
values ('00000000-0000-0000-0000-000000004101', 'Badminton', 'sports', 'baner', now() + interval '2 days', 3);

select is(pg_temp.seen('00000000-0000-0000-0000-000000004102', '00000000-0000-0000-0000-000000004101'), 2,
  'a Member who sees an Activity on the board gets its host''s live photos');

-- The board and the Activity give the host's cover photo, so the card can ask for its link.
select id as host_cover from public.photos
where user_id = '00000000-0000-0000-0000-000000004101' and position = 1 \gset
select pg_temp.act_as_member('00000000-0000-0000-0000-000000004102');
select is((select host_photo_id from public.activity_board()), :'host_cover'::uuid,
  'the board gives each Activity its host''s cover photo');
select is((select host_photo_id from public.get_activity((select id from public.activity_board()))), :'host_cover'::uuid,
  'the Activity gives its host''s cover photo');
reset role;

-- 04 blocked the host, so the Activity is not on 04's board.
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000004104');
select pg_temp.place('00000000-0000-0000-0000-000000004104', 18.5515, 73.9348);
insert into public.blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-000000004104', '00000000-0000-0000-0000-000000004101');
select is(pg_temp.seen('00000000-0000-0000-0000-000000004104', '00000000-0000-0000-0000-000000004101'), 0,
  'a Member who blocked the host gets none of their photos through the board');

-- 03 is Paused, so the board is empty for them.
select pg_temp.create_visible_member('00000000-0000-0000-0000-000000004103');
select pg_temp.place('00000000-0000-0000-0000-000000004103', 18.5515, 73.9348);
select pg_temp.act_as_member('00000000-0000-0000-0000-000000004103');
select public.set_paused(true);
reset role;
select is(pg_temp.seen('00000000-0000-0000-0000-000000004103', '00000000-0000-0000-0000-000000004101'), 0,
  'a Paused Member, whose board is empty, gets no host photos');

-- Once the Activity is cancelled it leaves the board, and the photos go with it.
update public.activities set status = 'cancelled' where host_id = '00000000-0000-0000-0000-000000004101';
select is(pg_temp.seen('00000000-0000-0000-0000-000000004102', '00000000-0000-0000-0000-000000004101'), 0,
  'a host whose Activity has left the board shares no photos through it');

select * from finish();
rollback;
