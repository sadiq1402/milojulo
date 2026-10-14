-- Profile photo links (#35). The media Edge Function is the only caller of everything here: it
-- makes an upload slot, hands the app a short-lived upload link to a staging key, checks the file
-- arrived, copies it to the live key, confirms it, and signs download links only for the photos the
-- caller may see. Upload links never point at a live key, so a live photo can't be overwritten.

-- An upload waiting for its file. Kept apart from photos so a replacement can be uploaded while the
-- photo it replaces stays live, and so an unconfirmed upload is never anyone's photo.
create table public.photo_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  position smallint not null check (position between 1 and 4),
  object_key text not null, -- the live key; the file is staged at 'uploads/' || object_key
  created_at timestamptz not null default now(),
  constraint photo_uploads_one_per_position unique (user_id, position)
);
alter table public.photo_uploads enable row level security;
revoke all on public.photo_uploads from anon, authenticated;

-- Refuses a Member who may not add photos.
create function public.check_photo_uploader(member_id uuid) returns void
language plpgsql stable
set search_path = ''
as $$
declare
  me public.profiles;
begin
  select * into me from public.profiles where id = member_id;
  if not found then
    raise exception 'accept the terms first';
  end if;
  if me.status = 'banned' or me.deleted_at is not null then
    raise exception 'your account cannot add photos';
  end if;
end;
$$;

revoke execute on function public.check_photo_uploader(uuid) from public, anon, authenticated;

-- A new slot for a position replaces any earlier one there, and slots older than an hour go too;
-- their staging keys come back so the function can delete any file that did arrive.
create function public.start_photo_upload(member_id uuid, photo_position smallint)
returns table (photo_id uuid, upload_key text, object_key text, discarded_keys text[])
language plpgsql security definer
set search_path = ''
as $$
declare
  new_id uuid := gen_random_uuid();
  discarded text[];
begin
  perform public.check_photo_uploader(member_id);
  if photo_position is null or photo_position not between 1 and 4 then
    raise exception 'choose a photo position from 1 to 4';
  end if;
  -- One slot change at a time per Member.
  perform 1 from public.profiles where id = member_id for update;

  with gone as (
    delete from public.photo_uploads u
    where u.user_id = member_id
      and (u.position = photo_position or u.created_at <= now() - interval '1 hour')
    returning 'uploads/' || u.object_key as upload_key
  )
  select coalesce(array_agg(gone.upload_key order by gone.upload_key), '{}') into discarded from gone;

  insert into public.photo_uploads (id, user_id, position, object_key)
  values (new_id, member_id, photo_position, member_id || '/' || new_id || '.jpg');

  return query select new_id, 'uploads/' || member_id || '/' || new_id || '.jpg', member_id || '/' || new_id || '.jpg',
    discarded;
end;
$$;

-- The staging and live keys of the Member's own upload slot; no row when there is none to confirm.
create function public.pending_photo_upload(member_id uuid, upload_id uuid)
returns table (upload_key text, object_key text)
language sql stable security definer
set search_path = ''
as $$
  select 'uploads/' || u.object_key, u.object_key from public.photo_uploads u
  where u.id = upload_id and u.user_id = member_id and u.created_at > now() - interval '1 hour';
$$;

-- Once the file is at its live key, the slot becomes the live photo at its position (same id). A
-- photo already there is replaced in the same statement set, so a Submitted Profile never drops
-- below the minimum; its object key comes back so the function can delete the file, except for a
-- photo an admin took down, whose file is kept as evidence.
drop function public.confirm_photo_upload(uuid);
create function public.confirm_photo_upload(member_id uuid, upload_id uuid) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  slot public.photo_uploads;
  old public.photos;
begin
  select * into slot from public.photo_uploads u
  where u.id = upload_id and u.user_id = member_id and u.created_at > now() - interval '1 hour'
  for update;
  if not found then
    raise exception 'no photo upload to confirm';
  end if;
  perform public.check_photo_uploader(member_id);

  select * into old from public.photos p
  where p.user_id = member_id and p.position = slot.position
  for update;

  -- The new photo goes in before the old one leaves, so the minimum check on delete counts it.
  set constraints public.photos_user_id_position_key deferred;
  insert into public.photos (id, user_id, object_key, position, uploaded_at)
  values (slot.id, member_id, slot.object_key, slot.position, now());
  delete from public.photos where id = old.id;
  set constraints public.photos_user_id_position_key immediate;

  delete from public.photo_uploads where id = slot.id;
  return case when old.removed_at is null then old.object_key end;
end;
$$;

-- The Member deletes one of their photos; the profile minimum still applies (its trigger). Returns
-- the object key for the function to delete the file, or null for a photo an admin took down.
create function public.delete_photo(member_id uuid, photo_id uuid) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  gone public.photos;
begin
  delete from public.photos p where p.id = photo_id and p.user_id = member_id
  returning * into gone;
  if not found then
    raise exception 'no photo to delete';
  end if;
  return case when gone.removed_at is null then gone.object_key end;
end;
$$;

revoke execute on function public.start_photo_upload(uuid, smallint), public.pending_photo_upload(uuid, uuid),
  public.confirm_photo_upload(uuid, uuid), public.delete_photo(uuid, uuid) from public, anon, authenticated;

-- Whether the viewer may see another Member's photos: they could open each other in Discover or the
-- profile view, or they share a Connection (any but declined, so history keeps its faces), a
-- waiting or accepted Join Request, or a place among an Activity's accepted joiners. Join Requests
-- count whatever became of the Activity since (cancelled or over), as history.
create function public.shares_photos_with(viewer uuid, member_id uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select (public.is_visible(viewer) and public.is_visible(member_id)
          and cardinality(public.eligible_modes(viewer, member_id)) > 0)
    or exists (select 1 from public.connections c
               where least(c.requester_id, c.addressee_id) = least(viewer, member_id)
                 and greatest(c.requester_id, c.addressee_id) = greatest(viewer, member_id)
                 and c.status <> 'declined')
    or exists (select 1 from public.activity_requests r
               join public.activities a on a.id = r.activity_id
               where r.status in ('requested', 'accepted')
                 and ((r.requester_id = viewer and a.host_id = member_id)
                      or (r.requester_id = member_id and a.host_id = viewer)))
    or exists (select 1 from public.activity_requests mine
               join public.activity_requests theirs on theirs.activity_id = mine.activity_id
               where mine.requester_id = viewer and mine.status = 'accepted'
                 and theirs.requester_id = member_id and theirs.status = 'accepted');
$$;

revoke execute on function public.shares_photos_with(uuid, uuid) from public, anon, authenticated;

-- Of the asked-for photos, the ones the viewer may see, with the object keys to sign. The owner gets
-- every confirmed photo not taken down; anyone else only live photos of a Member who is not banned,
-- deleted or Auto-hidden, with no Block either way, and whom they share something with (above).
-- Pending uploads are never photos, so they never come back.
create function public.photo_links(viewer uuid, photo_ids uuid[])
returns table (photo_id uuid, object_key text)
language sql stable security definer
set search_path = ''
as $$
  select ph.id, ph.object_key
  from public.photos ph
  join public.profiles o on o.id = ph.user_id
  where ph.id = any (photo_ids)
    and ph.uploaded_at is not null
    and ph.removed_at is null
    and (ph.user_id = viewer
         or (ph.hidden_at is null
             and o.status = 'active' and o.deleted_at is null and o.hidden_at is null
             and exists (select 1 from public.profiles v
                         where v.id = viewer and v.status = 'active' and v.deleted_at is null)
             and not public.is_blocked(viewer, o.id)
             and public.shares_photos_with(viewer, o.id)));
$$;

revoke execute on function public.photo_links(uuid, uuid[]) from public, anon, authenticated;
