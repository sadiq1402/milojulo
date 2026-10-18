-- #169: Circle admin actions join takedown, restore and ban in the audit log; the note is the name.

create or replace function public.admin_create_circle(name varchar, area_id text, tag_id smallint, description varchar)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  insert into public.circles (name, area_id, tag_id, description, created_by)
  values (btrim(admin_create_circle.name), admin_create_circle.area_id, admin_create_circle.tag_id,
          nullif(btrim(admin_create_circle.description), ''), auth.uid())
  returning id into new_id;
  perform public.audit('create_circle', 'circle', new_id, btrim(admin_create_circle.name));
  return new_id;
end;
$$;

create or replace function public.admin_edit_circle(circle_id uuid, name varchar, area_id text, tag_id smallint,
  description varchar) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  update public.circles c
  set name = btrim(admin_edit_circle.name), area_id = admin_edit_circle.area_id,
      tag_id = admin_edit_circle.tag_id, description = nullif(btrim(admin_edit_circle.description), '')
  where c.id = admin_edit_circle.circle_id;
  if not found then
    raise exception 'no circle to edit';
  end if;
  perform public.audit('edit_circle', 'circle', admin_edit_circle.circle_id, btrim(admin_edit_circle.name));
end;
$$;

create or replace function public.admin_archive_circle(circle_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  update public.circles c set is_active = false
  where c.id = admin_archive_circle.circle_id and c.is_active;
  if not found then
    raise exception 'no circle to archive';
  end if;
  perform public.audit('archive_circle', 'circle', admin_archive_circle.circle_id, null);
end;
$$;
