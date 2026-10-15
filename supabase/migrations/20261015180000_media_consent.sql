-- Casual Media Consent (#12) and chat media links. In a Casual Connection nobody receives images or
-- video until both Members switch Media Consent on. Every image, video and voice message points at
-- an upload slot the media Edge Function made for that sender and Connection, so a message can only
-- carry a file the sender uploaded there.

alter table public.connection_members add column media_consent boolean not null default false;

-- Images and video may flow in this Connection: it is not Casual, or both sides consent.
create function public.media_allowed(connection_id uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select c.mode <> 'casual'
         or not exists (select 1 from public.connection_members m
                        where m.connection_id = c.id and not m.media_consent)
  from public.connections c where c.id = media_allowed.connection_id;
$$;

revoke execute on function public.media_allowed(uuid) from public, anon, authenticated;

-- Either side switches their own Media Consent, on or off, at any time.
create function public.set_media_consent(connection_id uuid, consent boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.connection_members m set media_consent = coalesce(consent, false)
  where m.connection_id = set_media_consent.connection_id and m.user_id = auth.uid();
  if not found then
    raise exception 'no connection';
  end if;
end;
$$;

-- Whether the Connection is Casual, and each side's switch; no row for a non-member.
create function public.chat_media_state(connection_id uuid)
returns table (is_casual boolean, mine boolean, theirs boolean)
language sql stable security definer
set search_path = ''
as $$
  select c.mode = 'casual', mine.media_consent, theirs.media_consent
  from public.connections c
  join public.connection_members mine on mine.connection_id = c.id and mine.user_id = auth.uid()
  join public.connection_members theirs on theirs.connection_id = c.id and theirs.user_id <> auth.uid()
  where c.id = chat_media_state.connection_id;
$$;

revoke execute on function public.set_media_consent(uuid, boolean), public.chat_media_state(uuid) from public, anon;

-- An upload the media function signed for a sender in a Connection; used by at most one message.
create table public.chat_uploads (
  media_key text primary key,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  connection_id uuid not null references public.connections (id) on delete cascade,
  kind public.message_type not null check (kind in ('image', 'video', 'voice')),
  mime text not null,
  size integer not null check (size > 0),
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index on public.chat_uploads (connection_id);
alter table public.chat_uploads enable row level security;
revoke all on public.chat_uploads from anon, authenticated;

-- A slot for the Member's file; the same rules as sending (accepted, a side, Active, no Block) plus
-- Media Consent for images and video. Service role only: the media function signs its upload link.
create function public.start_chat_upload(member_id uuid, connection_id uuid, kind public.message_type,
  mime text, size integer) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  key text;
begin
  if kind is null or kind not in ('image', 'video', 'voice') then
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

  key := 'chat/' || connection_id || '/' || gen_random_uuid()
         || case kind when 'image' then '.jpg' when 'video' then '.mp4' else '.m4a' end;
  insert into public.chat_uploads (media_key, sender_id, connection_id, kind, mime, size)
  values (key, member_id, connection_id, kind, mime, size);
  return key;
end;
$$;

-- The media messages the viewer may open: in their Connections, no Block either way, not removed
-- by moderation and not expired. Service role only: the media function signs the links.
create function public.chat_media_links(viewer uuid, message_ids uuid[])
returns table (message_id uuid, media_key text)
language sql stable security definer
set search_path = ''
as $$
  select m.id, m.media_key
  from public.messages m
  join public.connections c on c.id = m.connection_id
  where m.id = any (message_ids)
    and m.type in ('image', 'video', 'voice')
    and m.removed_at is null
    and m.media_deleted_at is null
    and viewer in (c.requester_id, c.addressee_id)
    and not public.is_blocked(c.requester_id, c.addressee_id);
$$;

revoke execute on function public.start_chat_upload(uuid, uuid, public.message_type, text, integer),
  public.chat_media_links(uuid, uuid[]) from public, anon, authenticated;

-- Before a media message goes in: durations, Media Consent, and the sender's unused slot, which it
-- then marks used. Definer, since Members cannot see slots. Anyone who may not send here is left to
-- the insert policy, and a retried send (same id) to its on conflict.
create function public.check_message_media() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.type not in ('image', 'video', 'voice') or new.media_key is null
     or not public.can_send_in(new.connection_id) or new.sender_id is distinct from auth.uid()
     or exists (select 1 from public.messages m where m.id = new.id) then
    return new;
  end if;
  if new.type = 'video' and new.media_duration_ms > 30000 then
    raise exception 'video can be at most 30 seconds';
  end if;
  if new.type = 'voice' and new.media_duration_ms > 120000 then
    raise exception 'voice notes can be at most 2 minutes';
  end if;
  if new.type in ('image', 'video') and not public.media_allowed(new.connection_id) then
    raise exception 'media is off in this chat';
  end if;
  update public.chat_uploads u set used_at = now()
  where u.media_key = new.media_key and u.sender_id = new.sender_id and u.connection_id = new.connection_id
    and u.kind = new.type and u.mime = new.media_mime and u.used_at is null;
  if not found then
    raise exception 'upload the media first';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_message_media() from public, anon, authenticated;

create trigger check_media before insert on public.messages
  for each row execute function public.check_message_media();
