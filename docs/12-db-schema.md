# V1 database schema

Concrete V1 schema built from docs/03-data-model-rls.md and docs/11-screen-data-map.md, revised after the 2026-10-07 design session (glossary in CONTEXT.md, decisions 15 to 17, docs/adr/). V1 only: no columns for deferred features. Where this differs from docs/03 or docs/11, this file wins.

29 tables in `public`, plus a policy on `realtime.messages`. Every table has RLS enabled, default deny.

## Conventions
- Primary keys: `uuid default gen_random_uuid()`, except user-keyed tables (`profiles.id = auth.users.id`) and messages (client-generated id).
- User references point at `profiles(id)`; `profiles.id` references `auth.users(id) on delete cascade`, so deleting the auth user removes everything the user owns, including both sides of their Connections and messages.
- Times are `timestamptz`. Every table has `created_at default now()`.
- Fixed lists are Postgres enums (adding a value later is one `alter type`). Lists admins edit are catalog tables.
- Admin = `auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'`, set only with the service role. Wrapped in `is_admin()`. No admin table.
- Owners edit only safe columns: `grant update (col, ...)` to `authenticated`, never table-wide update. Status and moderation columns change only through functions or admin.
- No pre-approval (decision 15): content is live when written; moderation is after the fact through `hidden_at` (Auto-hide) and `removed_at` / `banned` (Takedown).

## Enums
| Enum | Values |
|---|---|
| `mode` | friends, activities, networking, dating, serious, casual |
| `gender` | woman, man, nonbinary |
| `career_stage` | student, early, mid, senior, founder |
| `availability_slot` | weekday_evenings, weekends, early_mornings |
| `account_status` | active, banned |
| `connection_status` | requested, accepted, declined, closed |
| `mode_change_outcome` | accepted, declined |
| `activity_type` | sports, food_chai, outdoors, games, learning |
| `activity_status` | open, cancelled, expired, removed |
| `request_status` | requested, accepted, declined, cancelled, withdrawn |
| `message_type` | text, image, video, voice, activity_card |
| `report_target` | profile, message, activity, photo |
| `report_reason` | fake_or_spam, harassment, inappropriate_content, underage, felt_unsafe, other, word_filter |
| `report_status` | open, actioned, dismissed |
| `consent_kind` | terms, guidelines, data_notice |
| `tag_kind` | interest, activity |
| `data_request_kind` | access, erasure |

`word_filter` is system-only: a Flagged Message files a report with `reporter_id` null. Members cannot choose it.

## Tables

### Catalogs (seeded by migration, read-only to signed-in users, admin writes)
| Table | Columns |
|---|---|
| `areas` | `id text pk` (slug: baner, wakad, ...), `name`, `center geography(Point)` (area centroid, used for distance), `is_active`, `zone` (west, pimpri_chinchwad, central, east, south; groups the picker), `lat` and `lng` (generated from `center`, so the app can suggest the nearest Area on the phone). 55 Pune Areas (decision 50). Signed-in people read it; signed-out visitors see nothing |
| `tags` | `id smallint identity pk`, `slug unique`, `label`, `kind tag_kind`, `sort_order`, `is_active` |
| `industries` | `id smallint identity pk`, `slug unique`, `label`, `sort_order`, `is_active` |
| `prompt_questions` | `id smallint identity pk`, `text`, `sort_order`, `is_active` |
| `consent_documents` | `id`, `kind consent_kind`, `version text`, `url`, `effective_at`; unique (kind, version) |
| `banned_terms` | `term text pk` (lowercase and trimmed, checked). Admins select, insert and delete; Members get nothing. Seeded empty; the founder fills it from the dashboard |
| `blocked_email_domains` | `domain text pk`. Admin only; read by the signup hook |

### People
**`profiles`**: one row per Member, created by `accept_consents()` (open sign-up, decision 27).
| Column | Notes |
|---|---|
| `id uuid pk` → auth.users | |
| `display_name varchar(30)` | first name |
| `date_of_birth date` | never leaves the server; functions return age |
| `gender gender` | nullable; required while a Dating Mode is held |
| `area_id` → areas | neighbourhood; its centre stands in for a Member with no `member_locations` row |
| `discover_range_km smallint` | 2, 5, 10, 25 or 50, or null for anywhere in Pune; default 10; owner updates it |
| `modes mode[]` | at least one once submitted; GIN index |
| `availability availability_slot[]` | three fixed slots |
| `profession varchar(40)` | optional, Networking, display-only |
| `industry_id` → industries, `career_stage career_stage` | optional, Networking; used to rank the Networking feed |
| `pref_age_min`, `pref_age_max smallint`, `pref_genders gender[]`, `pref_max_km smallint` | Dating Preferences; required while a Dating Mode is held; checks: 18 ≤ min ≤ max |
| `notify_messages bool`, `notify_activities bool` | default true |
| `status account_status` | default active |
| `submitted_at` | set once by `submit_profile()`; marks a Submitted Profile |
| `paused_at` | Member's own pause; independent of status |
| `hidden_at` | Auto-hide; cleared or kept by an admin |
| `banned_at`, `banned_reason` | |
| `deleted_at` | set by `delete_account()`; hides the Member at once until the purge runs |

**`member_locations`** (decision 40, docs/adr/0003): `user_id pk` → profiles, `point geography(Point)` (the phone's latest point moved by the offset), `offset_m`, `offset_azimuth` (drawn once: 200 to 500 m, random direction), `updated_at`. RLS on, no policies: nobody reads or writes it directly, owner and admins included.

**`service_regions`** (decision 42): `id smallint identity pk`, `name unique`, `min_lat`, `max_lat`, `min_lng`, `max_lng`, `active` (default true). RLS on, no policies, no client grants; rows added by migration or an admin. Seeded with Pune (18.40-18.75 N, 73.65-74.05 E).

Owner can select own row and update: display_name, area_id, discover_range_km, modes, availability, gender, profession, industry_id, career_stage, pref_*, notify_*, paused_at (via `set_paused()`). Everyone else: only through `discover_feed()` / `get_profile()`.

**Profile minimum** (trigger `enforce_profile_minimum`, active once `submitted_at` is set): a first name, at least 2 live photos, 2 prompts, 1 Mode, an Area, and gender plus Dating Preferences while a Dating Mode is held. Deletes or updates that would break it are rejected; replacing is fine. An admin Takedown of a photo may break the photo minimum: the Member is then not visible until they add one.

| Table | Columns | Access |
|---|---|---|
| `profile_prompts` | pk (user_id, position 1..2), `question_id`, `answer varchar(140)` | owner CRUD (within the minimum); others via `get_profile()` |
| `profile_tags` | pk (user_id, tag_id) | owner CRUD; others via functions |
| `photos` | `id`, `user_id`, `provider text default 'r2'`, `object_key` (`<member id>/<photo id>.jpg`), `position 1..4` (1 = cover; lists use the first live photo, so a hidden or removed cover gives way to the next), `width`, `height`, `uploaded_at`, `hidden_at`, `removed_at`, `removed_by`; unique (user_id, position), deferrable | Only confirmed uploads: `confirm_photo_upload()` inserts the row with `uploaded_at` set, after the media Edge Function has checked the file is in R2. Live = uploaded, not hidden, not removed. Owner selects, reorders, deletes. Others never read the table; they get signed URLs from the media function (`photo_links()`) |
| `chat_uploads` | `id` pk (the upload id), `media_key` unique (`chat/<connection id>/<id>.jpg\|mp4\|m4a`; staged at `uploads/` + it), `sender_id`, `connection_id`, `kind` (image, video, voice), `mime` (type and extension from `chat_media_format(kind)`), `size` (the signed Content-Length; confirm checks the file against it), `created_at`, `confirmed_at`, `used_at` | Chat upload slots (#12). No client access; the media function makes them with `start_chat_upload()` (same send rules as messages plus Media Consent), checks them through `pending_chat_upload()` and confirms them with `confirm_chat_upload()` once the file is at its live key (within an hour). A confirmed slot is used by at most one message |
| `photo_uploads` | `id` (becomes the photo id), `user_id`, `position 1..4`, `object_key` (the live key; the file is staged at `uploads/` + it), `created_at`; unique (user_id, position) | Upload slots waiting for their file (#35), kept apart from `photos` so a replacement uploads while the old photo stays live. No client access; only the media function, through `start_photo_upload()`, `pending_photo_upload()` and `confirm_photo_upload()`. A new slot for a position replaces the earlier one there; slots older than an hour can't be confirmed and are discarded when the Member's next slot is made |
| `consents` | pk (user_id, document_id), `accepted_at`, `withdrawn_at` | owner reads; written by `accept_consents()` (which also clears a withdrawal), withdrawn by `withdraw_consent()`. A Member with a withdrawn current document is not visible (Discover, profile view, Circles) and their Activities leave the board until they accept again (decision 37); as for a Paused Member their Connections stay in chat lists and keep their photo links, but `is_reachable` is false (out of Join Request lists and the learning loop) and `can_send_in` refuses them as senders (the other side can still send) |
| `device_tokens` | `token text pk`, `user_id`, `platform` (android, ios), `last_seen_at` | owner selects and deletes (sign out); written only by `register_device_token(token, platform)` (security definer, not anon; refuses `create your profile first`, `choose android or ios`), which moves a token to the caller if another account held it (same phone, new account) and refreshes `last_seen_at`. Read by the push Edge Function (service role), which deletes tokens FCM calls unregistered or invalid |
| `push_queue` | `id bigint identity`, `recipient_id`, `title`, `body`, `data jsonb` (`kind`: request, accepted, message, join_request, join_accepted; plus `connectionId` or `activityId`), `created_at` | No client access (RLS on, no policies). Written by triggers on `connections`, `messages` and `activity_requests` when the recipient's `notify_messages` / `notify_activities` is on (and, for messages, the chat is not muted). An insert trigger calls the push Edge Function over `pg_net` with `{"id"}` and the Vault service role key (nothing if the Vault secrets are missing); the function sends and deletes the row (decision 47) |

Reviewer Account: seeded per environment by `supabase/seed/reviewer.sql` (service role, not a migration) through `seed_reviewer()`, which gives it a profile with an adult date of birth and the current consents. Metrics queries exclude it by its account id.

### Connections and chat
| Table | Columns | Access |
|---|---|---|
| `connections` | `id`, `requester_id`, `addressee_id`, `mode`, `activity_id` (nullable, the Activity that created it), `note varchar(200)`, `status`, `responded_at`, `closed_at`, `closed_by`; check requester ≠ addressee; **partial** unique index on (least, greatest) of the pair `where status in ('requested','accepted')` | both Members select; writes only via `send_request()`, `respond_request()`, `block_user()`, `close_connection()`, `respond_activity_request()`. Activity Connections (`activity_id` set; FK on delete set null) don't count towards the Request Cap |
| `connection_mode_changes` | `id`, `connection_id`, `proposed_by`, `from_mode`, `to_mode`, `proposed_at`, `outcome mode_change_outcome` (null while open), `decided_at`; partial unique index on (connection_id) `where outcome is null` | both Members select; writes via `propose_mode_change()` / `respond_mode_change()`. Doubles as the moderation log of Mode history |
| `connection_members` | pk (connection_id, user_id), `last_read_at`, `muted bool`, `media_consent bool default false` | two rows created on accept. Member selects both rows of their Connections and updates own `last_read_at`, `muted`; Media Consent only through `set_media_consent()`; a Mode change into Casual switches both sides off (trigger, decision 33) |
| `messages` | `id uuid pk` (client-generated, idempotent), `connection_id`, `sender_id`, `type`, `body text`, `media_key`, `media_mime`, `media_width`, `media_height`, `media_duration_ms`, `media_deleted_at`, `activity_id`, `removed_at`; index (connection_id, created_at) | select: member of the Connection. Insert: sender = me, sender active, Connection accepted, `not is_blocked()`, and (a before-insert trigger, `check_message_media`) image/video/voice must use an unused `chat_uploads` slot of the sender for that Connection with the same kind and `media_mime` (`upload the media first`), which must be confirmed and is then marked used; image/video in a Casual Connection need both sides' `media_consent` (`media is off in this chat`); video over 30 s and voice over 2 min are refused with their own messages. No update/delete by Members. Checks per type (text needs body, media types need media_key, activity_card needs activity_id; video ≤ 30 000 ms, voice ≤ 120 000 ms) |

Connection rules (docs/adr/0001):
- One Requested or Accepted Connection per pair; older rows stay as history.
- `send_request()`: mode must be an Eligible Mode from sender to recipient (one the recipient chose that the sender may see in Discover, decision 39); accepting keeps that Mode on the Connection; sender and recipient both visible (so neither paused); recipient inside the sender's Discover Range (null range: the sender's Service Region), else `that member is not in your Discover` (decision 43; accepting and Mode Changes are not re-checked); Request Cap of 10 per rolling 24 h; no re-request by the same sender within 30 days of a decline; never while a Block stands.
- Mode Change: one open proposal per Connection; `to_mode` must be an Eligible Mode from the proposer to the other side, checked again when they accept; an open proposal older than 7 days counts as lapsed; a declined proposer cannot propose again for 7 days. Accepting updates `connections.mode`.
- Dropping a Mode from a profile leaves existing Connections and their Mode untouched.

Realtime: an insert trigger on `messages` broadcasts the row to the other Member's private topic `member:<id>` (not the sender's, never across a Block); a policy on `realtime.messages` lets a Member join only their own topic (decision 51). Changes to `last_read_at` (`read`), `media_consent` (`media-consent`) and Mode Change proposals or answers (`mode-change`) send `{connection_id}` to the other Member the same way (`send_to_other_members`: not the actor, not across a Block); the app refetches that Connection's query. Connection Requests (sent, answered, closed) send `connection` and Join Requests (sent, answered, withdrawn) send `join-request` to whichever of the two did not act (`send_to_pair`, nothing across a Block); the app refetches the Inbox or the Activity lists. Unread = messages newer than my `last_read_at`. Mute only suppresses push for that Member.

Chat media: uploads capped at 20 MB for video (upload Edge Function). Media Expiry: the `purge-chat-media` Edge Function (#97; `expired_chat_media(batch)` and `mark_chat_media_deleted(ids)`, service role only; a file a report keeps as evidence is marked expired in the chat but not deleted), scheduled daily at 03:00 India time by the pg_cron job `purge-chat-media` through pg_net (URL and key from Vault, supabase/README.md), deletes R2 objects older than 90 days and sets `media_deleted_at`; the message stays.

### Activities and circles
| Table | Columns | Access |
|---|---|---|
| `activities` | `id`, `host_id`, `circle_id` (nullable), `title varchar(60)`, `type`, `area_id`, `starts_at`, `ends_at`, `capacity smallint` (1..20, joiners only), `description varchar(300)`, `status`, `hidden_at` | visible Members select open, unhidden, non-expired Activities whose host is not blocked (the Activity Board, regardless of Modes held). Host inserts (must be visible; if circle_id set, must be a Circle member) and updates own description, capacity, status→cancelled; title, starts_at, ends_at, area and venue only while no one is accepted (Locked Activity). Capacity can never drop below accepted joiners |
| `activity_venues` | `activity_id pk`, `venue_detail` | no direct access; `get_activity()` gives it to the host and accepted joiners only (not waiting, declined, cancelled or withdrawn requesters); locked with the Activity |
| `activity_requests` | `id`, `activity_id`, `requester_id`, `status request_status`, `created_at`, `responded_at`, `withdrawn_at`; unique (activity_id, requester_id), so one Join Request per Member per Activity, never re-asked after a decline, cancel or Withdrawal | requester and host select; no direct writes. `join_activity_request()` refuses a Paused or not-visible Member, an Activity not on the caller's board (unseen, blocked, cancelled, over), the host, a started Activity, a second request, no spots left, and the Join Cap (10 created per rolling 24 h, cancelled ones included). `respond_activity_request()`: host only, a waiting request on an open Activity not yet started, pair not blocked, requester not banned, deleted or Auto-hidden; accept (spots permitting) returns the Activity Connection: the pair's accepted Connection as it is, their waiting Connection Request accepted as it stands, or a new accepted one (joiner → host, mode activities, `activity_id` set). `withdraw_activity_request()`: requester only, before `starts_at`; waiting → cancelled, accepted → withdrawn (the Connection stays). A Block cancels or withdraws Join Requests between the pair, either way round. Lists: `activity_join_requests()` (host) and `my_join_requests()` (waiting, both ways), leaving out blocked, banned, deleted and Auto-hidden Members |
| `circles` | `id`, `name varchar(50)`, `area_id` → areas, `tag_id` → tags (the interest), `description varchar(300)`, `is_active` (default true), `created_by`, `created_at` | no direct client access. Visible Members read active Circles via `browse_circles()` (joined first, then by name; each row carries `member_count` and `i_am_member`) and `get_circle()` (one Circle: active ones for a visible Member, plus the caller's own Circles and admins). `circle_activities()` returns a Circle's upcoming Activities for a visible caller, as on the board. Admin-only `admin_create_circle()`, `admin_edit_circle()`, `admin_archive_circle()` (is_admin()) write; the app never calls these |
| `circle_members` | pk (circle_id, user_id), `joined_at` | no direct client access. `circle_members_of()` lists fellow members (visible, unblocked, excluding the caller) only to a member of that Circle; `join_circle()` (visible Member, active Circle, idempotent) and `leave_circle()` (refuses when not a member) are the only writes. Leaving leaves one's posted Activities alone |

Spots left = capacity − accepted Join Requests (the host is not counted). Tonight / This weekend / Later tabs are computed from `starts_at`. `expire_activities()` (pg_cron, every 15 min) sets `status = expired` once `ends_at` (or `starts_at` + 3 h) has passed. Cancelling notifies accepted joiners. Circle Activities appear on the main board; an archived Circle (`is_active = false`) drops its label from upcoming Activities, which stay. Leaving a Circle leaves one's posted Activities alone.

### Safety, admin, learning loop, account
| Table | Columns | Access |
|---|---|---|
| `blocks` | pk (blocker_id, blocked_id) | blocker selects own list and unblocks (delete); insert via `block_user()` (also closes the Connection) |
| `reports` | `id`, `reporter_id` (nullable: null for word-filter flags and after the reporter's deletion), `target_type`, `target_id uuid`, `target_user_id`, `reason`, `details varchar(500)`, `evidence jsonb` (snapshot taken by `report()`), `evidence_media_key`, `status`, `handled_by`, `handled_at`, `internal_note` | insert via `report()` only; no Member reads them (reporters can't read back); admins select (admin writes come with the moderation tools) |
| `admin_actions` | `id`, `admin_id`, `action text`, `target_type`, `target_id`, `note` | admin insert/select only; never updated |
| `meetup_feedback` | `id`, `user_id`, `other_user_id`, `activity_id` (nullable, on delete set null), `did_meet bool`, `keep bool`, `created_at`; unique nulls not distinct (user_id, other_user_id, activity_id) | owner inserts via `submit_meetup_feedback()` and reads own; admin reads for metrics; no direct writes |
| `meet_nudges` | `connection_id`, `user_id`, `sent_at`; primary key (connection_id, user_id) | no client access; written by `send_meet_nudges()` (pg_cron `send-meet-nudges`, daily 11:00 India time): once per Member per chat, a week after acceptance when both sides have written, not muted, no Block, not yet answered; Activity Connections are left out (their Activity prompt asks); pushes `meet_nudge` ("Did you meet <name>?"), obeying `notify_messages` |
| `data_requests` | `id`, `user_id`, `kind data_request_kind`, `status data_request_status` (pending, done), `created_at`, `completed_at` | owner and admins select; no direct writes. Made by `request_data_copy()` (access) and `delete_account()` (erasure); completed by the founder (access) or the account purge (erasure, by cascade) |

Moderation:
- **Auto-hide**: `report()` sets `hidden_at` on the target profile, photo or Activity once 3 distinct reporters (word-filter flags excluded) have reported it within 7 days. An admin then clears `hidden_at` or takes it down.
- **Takedown**: photo/message `removed_at`, Activity `status = removed`, profile `status = banned`. Every one writes `admin_actions`.
- **Ban**: closes all the Member's Connections (chats read-only for the other side), withdraws their Join Requests, cancels their open Activities, removes their Circle memberships.
- **Word filter** (triggers on display names, prompt answers, Activity titles and descriptions, messages): a term matches case-insensitively as a whole word (a multi-word term as a phrase; letters, digits, underscore and all of Devanagari U+0900 to U+097F count as word characters, so a matra or virama is never a boundary), via `matches_banned_term(text)`, which builds one combined pattern from all terms per call (security definer, not executable by app roles). Profile text and Activities that match are refused with `that wording isn't allowed; please change it` on insert or update; messages are delivered unchanged and filed as a `word_filter` report (`reporter_id` null, `target_user_id` the sender, evidence from `message_evidence(message)`, the snapshot `report()` also uses), which never counts toward Auto-hide.
- **Reported media**: an Edge Function on `reports` insert copies the media into an evidence prefix (`evidence_media_key`), kept for the safety-retention period instead of the 90-day Media Expiry.
- Admin queue: open reports (24 h target), Auto-hidden items, and a recently-joined list for spot checks (no approval).

Learning loop (Kept Connection = both rows have `did_meet` and `keep` true):
- Activity: 2 h after `ends_at`, the host and each accepted, non-withdrawn joiner are asked about each other (joiners are not asked about other joiners).
- Connection: a "We met" action in chat, plus one nudge 7 days after acceptance if both Members have sent messages (the nudge needs push, #36).

## Functions
Shared helpers (security definer, fixed `search_path`, few and tested):
`is_admin()`, `is_visible(uid)` (active, submitted, not paused, not hidden, not deleted, every current consent accepted and not withdrawn, at least 2 live photos), `is_blocked(a, b)`, `is_connection_member(connection_id)`, `eligible_modes(a, b)` (shared Modes, Dating Modes filtered by both Members' Dating Preferences).

Business functions:
| Function | Notes |
|---|---|
| `accept_consents(dob, document_ids[])` | rejects under 18 or no date of birth, and a missing current document (a null list or null entry counts as missing); creates the caller's profile row if there is none, stores DOB and consents (a refusal leaves no profile) |
| `submit_profile()` | requires the age gate and consents to be passed; checks the profile minimum; sets submitted_at; the Member is visible at once |
| `start_photo_upload(member_id, photo_position)` | service role only (media function): makes an upload slot and returns its photo id, staging key (`uploads/<member id>/<photo id>.jpg`, where the app uploads) and live key, plus the staging keys of slots it discarded (same position, or older than an hour) so their files can be deleted. Refuses `accept the terms first` (no profile), `your account cannot add photos` (banned or deleted), `choose a photo position from 1 to 4` |
| `pending_photo_upload(member_id, upload_id)` | service role only: the staging and live keys of the Member's own slot younger than an hour, else no row |
| `confirm_photo_upload(member_id, upload_id)` | service role only: the slot becomes the live photo at its position under the same id; a photo already there is deleted after the new one is in, so a Submitted Profile never drops below the minimum. Returns the replaced photo's object key so its file can be deleted, or null when nothing was replaced or the replaced photo was taken down by an admin (its file is kept as evidence). Refuses `no photo upload to confirm`, `your account cannot add photos` |
| `delete_photo(member_id, photo_id)` | service role only (the media function's `photo-delete`): deletes the Member's own photo, with the profile minimum still enforced (`add at least 2 photos`); returns its object key for the file to be deleted, or null for a photo taken down by an admin (kept). Refuses `no photo to delete` |
| `move_photo(photo_id, new_position)` | authenticated only; security invoker, so it runs under RLS and touches only the caller's photos. One statement moves the photo to `new_position` (1..4) and swaps whichever of the caller's photos held it (the unique constraint is deferrable), or just moves it into a free position. Refuses `no photo to move` (not the caller's, or unknown), `choose a photo position from 1 to 4` |
| `set_media_consent(connection_id, consent)` | the caller switches their own Media Consent in a Connection they are a side of, on or off at any time; `no connection` otherwise. Not executable by `anon` |
| `chat_media_state(connection_id)` | `is_casual`, `mine`, `theirs` for the caller's Connection; no row for a non-member. Not executable by `anon` |
| `start_chat_upload(member_id, connection_id, kind, size)` | service role only (the media function's `chat-upload`): a slot's upload id and staging key, for an Active side of an accepted Connection with no Block either way (`no connection`), Media Consent applying to image and video (`media is off in this chat`); `choose image, video or voice` for any other kind |
| `pending_chat_upload(member_id, upload_id)`, `confirm_chat_upload(member_id, upload_id)` | service role only (`chat-confirm`): the Member's own unconfirmed slot under an hour old (staging key, live key, type, size), and confirming it, which returns the live key; `no upload to confirm` otherwise |
| `chat_media_links(viewer, message_ids)` | service role only (`chat-urls`): of the asked-for messages, the image/video/voice ones in the viewer's Connections with no Block either way, not removed by moderation and not expired (`media_deleted_at` null), and in a Casual Connection images and video only while both sides have Media Consent on (decision 33); with media keys to sign |
| `photo_links(viewer, photo_ids)` | service role only: of the asked-for photos, those the viewer may see, with object keys to sign. Owner: every confirmed photo not taken down. Anyone else: live photos of a Member not banned, deleted or Auto-hidden, with no Block either way (`is_blocked`), whom the viewer may see in Discover/profile view, or who shares with them a Connection (any status but declined, so a waiting request counts), a waiting or accepted Join Request (host and requester), a place among an Activity's accepted joiners, or a Circle with both Visible, decision 46 (`shares_photos_with`; Join Requests count after the Activity is cancelled or over, as history); a banned or deleted viewer gets only their own |
| `set_paused(paused)` | |
| `discover_feed(mode_filter, page_size, after)` | decision 45: every Visible, unblocked Member inside the caller's Discover Range (null: same Service Region), with all their Modes; the filter keeps Members who chose that Mode. Columns: `user_id, display_name, age, area_id, modes` (shared visible Modes, may be empty), `their_modes` (the Modes the caller may see), `distance_band` (`<2 km` / `~N km`), `cover_photo_id, shared_tag_ids, why_you_match` (shared Modes, tags, availability; the other's Modes when none shared; the distance), `cursor` (opaque `rank:score:id`). Score: shared tags + availability + shared Modes + nearness (3/2/1 under 2/5/10 km); the Networking filter ranks by shared Industry and Career Stage first |
| `get_profile(member_id)` | full profile view under the feed's rules; also returns `their_modes`, `distance_band` and `request_modes` (the caller's Eligible Modes towards this Member) |
| `match_reason(a, b)` | templated text |
| `send_request(to, mode, note)`, `respond_request(id, accept)`, `close_connection(id)` | rules above |
| `propose_mode_change(connection, mode)`, `respond_mode_change(id, accept)` | rules above |
| `my_connections()` | the caller's Connections for the Inbox and chat list: requests both ways (with direction and note), accepted, and closed as history; declined left out, and so are Connections with a deleted Member (the other side can still read that history directly from `messages` until the purge erases it). A consent-withdrawn Member's Connections stay, as a Paused Member's do. Other side: first name, cover photo id and Area only, also while Paused; banned or Auto-hidden Members keep their name but no photo. Plus Mode, status, the newest message not removed by moderation, and unread = the other side's messages newer than my `last_read_at`. Newest activity first. A Block's closed Connection looks like any other close (decision 19) |
| `my_blocks()` | Members the caller has blocked, first name only; never who has blocked the caller |
| `join_activity_request(activity)`, `respond_activity_request(id, accept)`, `withdraw_activity_request(id)` | |
| `browse_circles()`, `get_circle(circle)`, `circle_members_of(circle)`, `circle_activities(circle)`, `join_circle(circle)`, `leave_circle(circle)` | `activity_board()` and `get_activity()` also return `circle_id` and a `circle_name` that is NULL once the Circle is archived; `activity_board()` also returns `visible_until` (`activity_ends_at`), so the app drops each Activity then without polling (#148) |
| `admin_create_circle(name, area, tag, description)`, `admin_edit_circle(circle, name, area, tag, description)`, `admin_archive_circle(circle)` | is_admin() only; for the seed and the dashboard |
| `block_user(id)`, `report(target_type, target_id, reason, details)` | `report()` snapshots the content (profile: name and prompts; photo: owner and object key, also kept in `evidence_media_key`; message: body, sender, media key (also in `evidence_media_key`) and type, sent at; Activity: title, description, type, Area, start, host), applies Auto-hide, and refuses `sign in first`, `choose a reason` (none or `word_filter`), `keep details to 500 characters`, `nothing to report` (unknown or deleted target, own content, a message outside the caller's Connections); a Block either way doesn't stop a report |
| `submit_meetup_feedback(other_user, did_meet, keep, activity)` | `activity` optional, both answers required; not executable by `anon`. The other Member must be reachable (not banned, deleted or Auto-hidden) with no Block either way. With an Activity: it ran (status `open` past its end, or `expired`; never `cancelled` or `removed`, decision 35) and the pair is the host and an accepted, non-withdrawn joiner, either way round (never joiner to joiner). Without one: the pair shares a Connection that was accepted at some point (accepted, or closed after acceptance). Refuses `no one to give feedback about` (not eligible, unknown, self, unreachable, or a Block either way). A Block withdraws the pair's Join Requests (#14), so their Activity feedback stays refused even after the Block is lifted and `you already answered` (same pair and Activity, or same pair without one) |
| `pending_meetup_feedback()` | the caller's Activity pairs (as above, the same eligibility) whose Activity ended 2 hours to 14 days ago and that the caller hasn't answered; `other_user_id`, `display_name`, `cover_photo_id`, `activity_id`, `activity_title`, `ends_at`, newest first. Not executable by `anon` |
| `kept_connections(since)` | admin only (Members get no rows): each pair of people once, by any route (an Activity or chat), as `user_a < user_b` and `kept_at`, the earliest time both had answered met and keep on one route (decision 35); only pairs whose `kept_at` is at or after `since` |
| `admin_takedown(target_type, target_id, note)`, `admin_ban(user_id, reason)`, `admin_restore(target_type, target_id)` | admin only; write admin_actions |
| `withdraw_consent(document_id)` | the caller's own accepted, not yet withdrawn consent; refuses `no consent to withdraw` (unknown, not mine, already withdrawn). Not executable by anon |
| `request_data_copy()` | a pending access data_request for the caller, returns its id; refuses `you already have a data copy request in progress`. Not executable by anon |
| `delete_account()` | deletes the Member Location at once, sets `deleted_at` (out of Discover, profile view, the board, Circles, chat lists, Join Requests and photo links at once) and queues an erasure data_request; refuses `your account is already being deleted`. Not executable by anon. The `account-purge` Edge Function (#96, hourly by pg_cron through pg_net) deletes the Member's R2 objects (`erasure_media_keys`: their photos and uploads and the media on both sides of their chats, never a key a report keeps as evidence), then the auth user, then writes `completed_erasures` (admin-readable, no foreign keys, survives the cascade); a failed delete leaves the erasure queued for the next run: the cascade removes profile, photos, prompts, tags, consents, Connections with both sides' messages, Join Requests, Circle memberships, meetup feedback and data requests; reports stay with `reporter_id` / `target_user_id` nulled and their evidence intact |
| `expire_activities()` | pg_cron |
| `set_location(lat, lng)` | the caller's Member Location; not executable by anon. Refuses `create your profile first` (no profile, or deleted), `MiloJulo isn't in your city yet` (null, or outside every active `service_regions` box: the implausible-jump check), `you can update your location once an hour` |
| `member_point(member)` | internal (no client role): the Member's offset point if updated in the last 7 days, else their Area's centre; for `discover_feed()` |
| `in_service_region()` | not anon: false when the caller's point (as `member_point`) lies in no active Service Region, so the app can say MiloJulo isn't in their city yet |
| `region_of(point)`, `within_range(owner, other)`, `discover_modes(viewer, member)`, `discover_pair(viewer, member)`, `distance_band(m)`, `mode_phrase(mode)` | internal (no client role): Discover's rules, shared by `discover_feed`, `get_profile`, `match_reason` and `shares_photos_with` (photo links follow Discover) |
| `needs_reconsent()` | true when the caller has a current consent document not accepted or withdrawn (the data notice moved to v2 with location); the app sends them to Reconsent. Not executable by anon |

Triggers: word filter (`banned_terms`), profile minimum, `updated_at`, message broadcast.

Edge Functions (service role, thin): sign R2 upload/download URLs, push via FCM, account purge, chat media purge, evidence copy, admin actions.

## Changes from docs/03 and docs/11
- `availability` table → `profiles.availability` array (three fixed slots).
- `notification_settings` table → two booleans on `profiles`.
- `photos.is_primary` dropped: position 1 is the cover.
- `profiles.coarse_cell` dropped; distance uses `member_locations` (decision 40), falling back to `areas.center`.
- `profiles.intents` → `profiles.modes` (glossary: Mode).
- No pre-approval: `profile_status` → `account_status` (active, banned) plus `paused_at`; `photo_status`, `approved_at`, `approved_by`, `reviewed_*` dropped; `hidden_at` / `removed_at` added for after-the-fact moderation.
- Added `connection_members`, `connection_mode_changes`, `activity_venues`, `industries`.
- Added `connections.mode` and `activity_id`; pair uniqueness is partial (active only).
- Added `profiles.gender`, `career_stage`, `industry_id`, `deleted_at`; `reports.target_user_id`, `evidence_media_key`.
- `meetup_feedback` is per pair of people (`other_user_id`), not per connection or activity.
- No invite codes (decision 27): `invite_codes` and `invite_redemptions` dropped; `accept_consents()` creates the profile row.

## Open points
1. Safety-retention period for reports and evidence media (lawyer).
