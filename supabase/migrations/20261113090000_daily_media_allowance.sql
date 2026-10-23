-- Daily media allowance (#183): a Member may send this many media messages (image, video or
-- voice) per Connection in any rolling 24 hours; each side of each Connection has its own. Null
-- means no limit. Counted from sent messages, so a taken-down or expired one still counts and an
-- abandoned upload does not.
alter table public.chat_media_settings
  add column daily_media_allowance integer check (daily_media_allowance >= 1);

update public.chat_media_settings set daily_media_allowance = 1;

-- The sender's allowance in a Connection: what's left (null: no limit) and, once used up, when
-- the next one opens (the oldest message that still counts turns 24 hours old). Internal.
create function public.media_allowance(member_id uuid, connection_id uuid)
returns table (remaining integer, next_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  with allowance as (
    select (select s.daily_media_allowance from public.chat_media_settings s) as daily
  ), sent as (
    select m.created_at from public.messages m
    where m.connection_id = media_allowance.connection_id and m.sender_id = media_allowance.member_id
      and m.type in ('image', 'video', 'voice') and m.created_at > now() - interval '24 hours'
  )
  select case when a.daily is not null then greatest(a.daily - (select count(*) from sent), 0)::integer end,
         case when (select count(*) from sent) >= a.daily then
           (select s.created_at from sent s order by s.created_at desc offset a.daily - 1 limit 1)
             + interval '24 hours'
         end
  from allowance a;
$$;

revoke execute on function public.media_allowance(uuid, uuid) from public, anon, authenticated;

-- As before, plus the daily allowance, checked before a slot (and so an upload link) exists.
create or replace function public.start_chat_upload(member_id uuid, connection_id uuid, kind public.message_type,
  size integer)
returns table (upload_id uuid, upload_key text)
language plpgsql security definer
set search_path = ''
as $$
declare
  new_id uuid := gen_random_uuid();
  format record;
begin
  select * into format from public.chat_media_format(kind) f where f.mime is not null;
  if not found then
    raise exception 'choose image, video or voice';
  end if;
  if not exists (
    select 1 from public.connections c
    join public.profiles me on me.id = member_id
    where c.id = start_chat_upload.connection_id
      and c.status = 'accepted'
      and member_id in (c.requester_id, c.addressee_id)
      and me.status = 'active' and me.deleted_at is null
      and not public.is_blocked(c.requester_id, c.addressee_id)
  ) then
    raise exception 'no connection';
  end if;
  if kind in ('image', 'video') and not public.media_allowed(connection_id) then
    raise exception 'media is off in this chat';
  end if;
  if kind = 'image' and size > (select l.image_max_bytes from public.chat_media_limits() l) then
    raise exception 'image is too large';
  end if;
  if (select a.remaining from public.media_allowance(member_id, connection_id) a) = 0 then
    raise exception 'media limit reached';
  end if;

  insert into public.chat_uploads (id, media_key, sender_id, connection_id, kind, mime, size)
  values (new_id, 'chat/' || connection_id || '/' || new_id || '.' || format.ext, member_id, connection_id,
          kind, format.mime, size);
  return query select new_id, 'uploads/chat/' || connection_id || '/' || new_id || '.' || format.ext;
end;
$$;

-- As before, plus the daily allowance. The sender's own connection_members row is locked first,
-- so two sends at the same moment wait for each other and the second sees the first.
create or replace function public.check_message_media() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  limits record;
begin
  -- Left to other guards: not media, or no key (the table's check refuses it); a caller who may
  -- not send here or sends as someone else (the insert policy refuses it, 42501); a retried id
  -- (on conflict makes it a no-op, so it must not need a fresh slot nor count again). Inserts by
  -- the database owner or service role have no auth.uid() and so skip this too; no Member path
  -- does that.
  if new.type not in ('image', 'video', 'voice') or new.media_key is null
     or not public.can_send_in(new.connection_id) or new.sender_id is distinct from auth.uid()
     or exists (select 1 from public.messages m where m.id = new.id) then
    return new;
  end if;
  select * into limits from public.chat_media_limits();
  if new.type = 'video' and new.media_duration_ms > limits.video_max_ms then
    raise exception 'video is too long';
  end if;
  if new.type = 'voice' and new.media_duration_ms > limits.voice_max_ms then
    raise exception 'voice note is too long';
  end if;
  if new.type in ('image', 'video') and not public.media_allowed(new.connection_id) then
    raise exception 'media is off in this chat';
  end if;
  perform 1 from public.connection_members cm
  where cm.connection_id = new.connection_id and cm.user_id = new.sender_id
  for update;
  if (select a.remaining from public.media_allowance(new.sender_id, new.connection_id) a) = 0 then
    raise exception 'media limit reached';
  end if;
  update public.chat_uploads u set used_at = now()
  where u.media_key = new.media_key and u.sender_id = new.sender_id and u.connection_id = new.connection_id
    and u.kind = new.type and u.mime = new.media_mime and u.confirmed_at is not null and u.used_at is null;
  if not found then
    raise exception 'upload the media first';
  end if;
  return new;
end;
$$;

-- The caller's allowance in one of their Connections, for the app to show the wait.
create function public.chat_media_allowance(connection_id uuid)
returns table (remaining integer, next_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.connections c
    where c.id = chat_media_allowance.connection_id and auth.uid() in (c.requester_id, c.addressee_id)
  ) then
    raise exception 'no connection';
  end if;
  return query select a.remaining, a.next_at from public.media_allowance(auth.uid(), connection_id) a;
end;
$$;

revoke execute on function public.chat_media_allowance(uuid) from public, anon;
grant execute on function public.chat_media_allowance(uuid) to authenticated;
