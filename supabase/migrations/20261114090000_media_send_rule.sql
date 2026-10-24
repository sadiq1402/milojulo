-- One chat media send rule (#186). start_chat_upload and check_message_media each carried their
-- own copy of the checks, and the upload copy had missed the withdrawn-consent rule. Both now call
-- check_media_send(), and can_send_in is built on the same Member-scoped check.

-- May this Member send in this Connection: an Active side of an accepted Connection, no Block
-- either way, no current consent withdrawn. Internal.
create function public.member_can_send_in(member_id uuid, connection_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.connections c
    join public.profiles me on me.id = member_can_send_in.member_id
    where c.id = member_can_send_in.connection_id
      and c.status = 'accepted'
      and member_can_send_in.member_id in (c.requester_id, c.addressee_id)
      and me.status = 'active' and me.deleted_at is null
      and not public.is_blocked(c.requester_id, c.addressee_id)
  ) and not public.consent_withdrawn(member_id);
$$;

revoke execute on function public.member_can_send_in(uuid, uuid) from public, anon, authenticated;

create or replace function public.can_send_in(connection_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.member_can_send_in(auth.uid(), connection_id);
$$;

-- The chat media send rule: raises the Member's refusal unless they may send this media in this
-- Connection now. Media Consent (decision 33), the limits (decision 59) and the Daily Media
-- Allowance (decision 60). `size` is known when an upload starts, `duration_ms` when the message
-- goes in; the other is null. Locks the sender's connection_members row first, so two sends at
-- once see each other; the lock lasts until the caller's transaction ends. Internal.
create function public.check_media_send(member_id uuid, connection_id uuid, kind public.message_type,
  size integer, duration_ms integer) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  limits record;
begin
  if not public.member_can_send_in(member_id, connection_id) then
    raise exception 'no connection';
  end if;
  if kind in ('image', 'video') and not public.media_allowed(connection_id) then
    raise exception 'media is off in this chat';
  end if;
  select * into limits from public.chat_media_limits();
  if kind = 'image' and size > limits.image_max_bytes then
    raise exception 'image is too large';
  end if;
  if kind = 'video' and duration_ms > limits.video_max_ms then
    raise exception 'video is too long';
  end if;
  if kind = 'voice' and duration_ms > limits.voice_max_ms then
    raise exception 'voice note is too long';
  end if;
  perform 1 from public.connection_members cm
  where cm.connection_id = check_media_send.connection_id and cm.user_id = check_media_send.member_id
  for update;
  if (select a.remaining from public.media_allowance(member_id, connection_id) a) = 0 then
    raise exception 'media limit reached';
  end if;
end;
$$;

revoke execute on function public.check_media_send(uuid, uuid, public.message_type, integer, integer)
  from public, anon, authenticated;

-- A slot for the Member's file once the send rule allows it. Service role only.
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
  perform public.check_media_send(member_id, connection_id, kind, size, null);

  insert into public.chat_uploads (id, media_key, sender_id, connection_id, kind, mime, size)
  values (new_id, 'chat/' || connection_id || '/' || new_id || '.' || format.ext, member_id, connection_id,
          kind, format.mime, size);
  return query select new_id, 'uploads/chat/' || connection_id || '/' || new_id || '.' || format.ext;
end;
$$;

-- Before a media message goes in: the send rule, then the sender's confirmed, unused slot, which
-- it marks used. Definer, since Members cannot see slots.
create or replace function public.check_message_media() returns trigger
language plpgsql security definer
set search_path = ''
as $$
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
  perform public.check_media_send(new.sender_id, new.connection_id, new.type, null, new.media_duration_ms);
  update public.chat_uploads u set used_at = now()
  where u.media_key = new.media_key and u.sender_id = new.sender_id and u.connection_id = new.connection_id
    and u.kind = new.type and u.mime = new.media_mime and u.confirmed_at is not null and u.used_at is null;
  if not found then
    raise exception 'upload the media first';
  end if;
  return new;
end;
$$;
