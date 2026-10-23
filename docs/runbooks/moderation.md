# Moderation from the Supabase dashboard

Until the admin page exists (`apps/admin`), moderation runs in the Supabase dashboard's SQL editor. Reading the queue needs nothing special; acting (takedown, restore, ban, Circles) goes through the admin functions, which only an admin's session may call (`is_admin()` reads `app_metadata.role` from the caller's JWT). Every admin function writes to the audit log, `admin_actions`, which nobody can edit; dismissing a Report by hand and editing banned terms (below) are not logged there.

Targets: Reports are answered within 24 hours (docs/04). Report ids, Member ids, photo ids, message ids and Activity ids are all uuids, read from the queue queries below.

## 1. Make an account an admin (once per admin)

The admin must be a real account (takedowns and settled reports record who did them). Use a dedicated address, not a Member's own account: Dashboard → Authentication → Users → Add user → Create new user, with the admin's email and "Auto Confirm User" ticked. Then, in the SQL editor:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where email = 'admin@milojulo.co.in';
```

To remove admin rights later: `set raw_app_meta_data = raw_app_meta_data - 'role'` for that email.

## 2. Read the queue

These run as the dashboard's own role, which reads every table, so no admin session is needed.

Open Reports, oldest first, with how long each has waited:

```sql
select r.id, r.created_at, now() - r.created_at as waiting, r.target_type, r.target_id,
       r.target_user_id, p.display_name as reported_member, r.reason, r.details,
       r.evidence, r.evidence_media_key
from public.reports r
left join public.profiles p on p.id = r.target_user_id
where r.status = 'open'
order by r.created_at;
```

`reason = 'word_filter'` rows are messages the word filter flagged (no reporter). `evidence` is a snapshot of what was reported; `evidence_media_key` is the R2 key of a reported photo or chat file.

Auto-hidden items (3 different Members reported them within 7 days; they stay hidden until you restore or take them down):

```sql
select 'profile' as target_type, id as target_id, display_name as detail, hidden_at
from public.profiles where hidden_at is not null and status = 'active' and deleted_at is null
union all
select 'photo', id, user_id::text, hidden_at from public.photos
where hidden_at is not null and removed_at is null
union all
select 'activity', id, title, hidden_at from public.activities
where hidden_at is not null and status <> 'removed'
order by hidden_at;
```

Recently joined Members (spot checks; profiles go live on submission, decision 15):

```sql
select id, display_name, area_id, modes, submitted_at
from public.profiles
where submitted_at > now() - interval '7 days' and status = 'active' and deleted_at is null
order by submitted_at desc;
```

## 3. Act

Every action runs inside this block. Set the admin's email once, put one or more calls in the middle, and run the whole block. The block signs in as that account with its real `app_metadata`, so only an account made admin in step 1 can act, and the audit log records who did it. Without the `set_config` and `set local role` lines, or with an email that is not an admin (or not an account at all), the functions refuse with `admins only`.

```sql
begin;
select set_config('request.jwt.claims', (
  select json_build_object('sub', id, 'role', 'authenticated', 'app_metadata', raw_app_meta_data)
  from auth.users where email = 'admin@milojulo.co.in')::text, true);
set local role authenticated;

-- one or more calls, for example:
select public.admin_takedown('photo', '<photo id>', 'nudity, report <report id>');

commit;
```

The calls:

| To | Call | Effect |
|---|---|---|
| Take down a photo, message or Activity | `select public.admin_takedown('photo' \| 'message' \| 'activity', '<id>', '<note>');` | Hidden for good (a message disappears from both sides' chat at once); the open Reports on it are marked actioned |
| Clear an Auto-hide | `select public.admin_restore('profile' \| 'photo' \| 'activity', '<id>', '<note>');` | Visible again; its open Reports are dismissed and no longer count toward Auto-hide |
| Ban a Member | `select public.admin_ban('<member id>', '<reason>');` | Status banned; their Connections close, Join Requests are withdrawn, upcoming Activities cancelled, Circle memberships removed; every open Report about them is actioned. A reason is required. There is no unban yet |
| Create a Circle | `select public.admin_create_circle('<name>', '<area id>', (select id from public.tags where slug = '<tag slug>'), '<description>');` | Returns the new Circle's id |
| Edit a Circle | `select public.admin_edit_circle('<circle id>', '<name>', '<area id>', <tag id>, '<description>');` | |
| Archive a Circle | `select public.admin_archive_circle('<circle id>');` | It leaves browsing and can't be joined; its members can still open it |

A profile is never taken down: ban the Member instead. Refusals come back as errors: `admins only` (the session block is missing, or the email is not an admin account), `nothing to take down`, `nothing to restore`, `nothing to ban`, `give a reason for the ban`, `ban the member instead`.

To dismiss a Report without acting on its target (it was unfounded), as the dashboard's own role (it changes nothing, `UPDATE 0`, unless the email is an admin account):

```sql
update public.reports
set status = 'dismissed', handled_at = now(),
    handled_by = (select id from auth.users where email = 'admin@milojulo.co.in'),
    internal_note = '<why>'
where id = '<report id>' and status = 'open'
  and exists (select 1 from auth.users
              where email = 'admin@milojulo.co.in' and raw_app_meta_data->>'role' = 'admin');
```

## 4. Banned terms (word filter)

The list starts empty (docs/01). Terms are lower case and trimmed. As the dashboard's own role:

```sql
insert into public.banned_terms (term) values ('<term>') on conflict do nothing;
delete from public.banned_terms where term = '<term>';
```

From then on, a name, prompt answer or Activity title or description that is saved (new or edited) with the term is refused, and a new message containing it is flagged as a `word_filter` Report; text already saved is not touched.

## 5. Check the audit log

```sql
select a.created_at, u.email as admin, a.action, a.target_type, a.target_id, a.note
from public.admin_actions a
left join auth.users u on u.id = a.admin_id
order by a.created_at desc
limit 50;
```

## 6. Chat media limits

The longest video, the largest image and the longest voice note (decision 59). Each value can only tighten its fixed maximum (video 30 000 ms, image 5 242 880 bytes, voice 120 000 ms); `null` means the fixed maximum. A change applies at once, in the app too, with no deploy. As the dashboard's own role:

```sql
-- See the current values.
select * from public.chat_media_settings;

-- Change a limit: video in milliseconds, image in bytes (2 MB = 2097152), voice in milliseconds.
update public.chat_media_settings set video_max_ms = 20000;
update public.chat_media_settings set image_max_bytes = 3145728;
update public.chat_media_settings set voice_max_ms = 60000;

-- Clear a limit (back to the fixed maximum).
update public.chat_media_settings set video_max_ms = null;
```

A value above the fixed maximum is refused by the table's check.
