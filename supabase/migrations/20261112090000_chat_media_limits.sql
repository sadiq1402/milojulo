-- Chat media limits (#182): one settings row the founder changes by SQL in the dashboard. Each
-- value can only tighten its fixed maximum (video 30 s, image 5 MB, voice 2 min); null means the
-- fixed maximum. No client role reads the row; Members read the limits through chat_media_limits().
create table public.chat_media_settings (
  id boolean primary key default true check (id),
  video_max_ms integer check (video_max_ms between 1 and 30000),
  image_max_bytes integer check (image_max_bytes between 1 and 5242880),
  voice_max_ms integer check (voice_max_ms between 1 and 120000)
);

alter table public.chat_media_settings enable row level security;
revoke all on public.chat_media_settings from public, anon, authenticated;

insert into public.chat_media_settings (video_max_ms, image_max_bytes, voice_max_ms)
values (15000, 2097152, 120000);

-- The limits in force: the row's values, or the fixed maximums where a value is empty.
create function public.chat_media_limits()
returns table (video_max_ms integer, image_max_bytes integer, voice_max_ms integer)
language sql stable security definer
set search_path = ''
as $$
  select coalesce(s.video_max_ms, 30000), coalesce(s.image_max_bytes, 5242880), coalesce(s.voice_max_ms, 120000)
  from (select 1) one
  left join public.chat_media_settings s on true;
$$;

revoke execute on function public.chat_media_limits() from public, anon;
grant execute on function public.chat_media_limits() to authenticated, service_role;

-- As before, plus the image limit, checked before a slot (and so an upload link) exists.
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

  insert into public.chat_uploads (id, media_key, sender_id, connection_id, kind, mime, size)
  values (new_id, 'chat/' || connection_id || '/' || new_id || '.' || format.ext, member_id, connection_id,
          kind, format.mime, size);
  return query select new_id, 'uploads/chat/' || connection_id || '/' || new_id || '.' || format.ext;
end;
$$;

-- As before, with the video and voice limits read from the settings row and fixed refusals: the
-- app matches refusals by their text, so a text with the number in it would break on a change.
create or replace function public.check_message_media() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  limits record;
begin
  -- Left to other guards: not media, or no key (the table's check refuses it); a caller who may
  -- not send here or sends as someone else (the insert policy refuses it, 42501); a retried id
  -- (on conflict makes it a no-op, so it must not need a fresh slot). Inserts by the database
  -- owner or service role have no auth.uid() and so skip this too; no Member path does that.
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
  update public.chat_uploads u set used_at = now()
  where u.media_key = new.media_key and u.sender_id = new.sender_id and u.connection_id = new.connection_id
    and u.kind = new.type and u.mime = new.media_mime and u.confirmed_at is not null and u.used_at is null;
  if not found then
    raise exception 'upload the media first';
  end if;
  return new;
end;
$$;
