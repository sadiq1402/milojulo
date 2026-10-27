# Data model and access rules

The rules every table and function follows. The schema itself (tables, columns, enums and every function with its refusals) is in docs/12-db-schema.md, which is built from the migrations in `supabase/migrations/` (where a later migration redefines a function, the later one is what runs). The per-screen data needs are in docs/11-screen-data-map.md; where it differs from docs/12, docs/12 wins.

## Rules
1. Every table has RLS enabled and starts with no access; each policy grants the minimum. Tables only functions touch (`member_locations`, `push_queue`, `meet_nudges`, upload slots) have no Member policy at all.
2. Other users' profiles are never read from the table directly. `discover_feed()` and `get_profile()` return Visible (active, submitted, unpaused, not Auto-hidden, not deleted, current consents in place, at least 2 live photos), unblocked Members within the viewer's Discover Range, with a safe column subset and distance as a band only.
3. Blocks have one source of truth, `is_blocked(a, b)` (security definer, internal), used by discovery, connection, chat, photo and media-link checks.
4. A message insert is allowed only for the sender, an active side of an accepted Connection with no Block either way (`can_send_in()`); taken-down messages are hidden from both sides.
5. Admins are users whose JWT carries `app_metadata.role = 'admin'` (`is_admin()`). App users can never read reports (reporters included) or the audit log (`admin_actions`, append-only).
6. Business rules live in Postgres functions the app calls. Security definer functions set `search_path = ''`; internal helpers are revoked from client roles, and the ones only Edge Functions call are granted to the service role alone.
7. Exact location lives only in `member_locations` (one offset point, latest only, no client can read it, deleted with the account; decision 40, docs/adr/0003).
8. Photos have no approval status (no pre-approval, decision 15, docs/adr/0002): a photo is live once its upload is confirmed (`uploaded_at`), and `hidden_at` (Auto-hide) or `removed_at` (admin takedown) take it out of view.
9. Every rule has an allow and a deny test in `supabase/tests/`, run by the `db-tests` check on every pull request before a migration reaches `main`.

## Main functions the app calls
- Getting in and account: `accept_consents(birth_date, document_ids)` (age gate and consents; creates the profile), `submit_profile()`, `set_location(lat, lng)`, `needs_reconsent()`, `withdraw_consent(document_id)`, `set_paused(paused)`, `request_data_copy()`, `delete_account()`, `register_device_token(token, platform)`, `move_photo(photo_id, new_position)`.
- Discover and Connections: `discover_feed(mode_filter, page_size, after)` (`mode_filter` is a list of Modes), `get_profile(member_id)`, `send_request(to_member, mode, note)`, `respond_request(connection_id, accept)`, `propose_mode_change(connection_id, to_mode)`, `respond_mode_change(change_id, accept)`, `close_connection(connection_id)`, `my_connections()`, `block_user(member_id)`, `my_blocks()`, `set_media_consent(connection_id, consent)`.
- Activities and Circles: `post_activity(...)`, `update_activity(...)`, `cancel_activity(activity_id)`, `activity_board()`, `get_activity(activity_id)`, `join_activity_request(activity_id)`, `respond_activity_request(request_id, accept)`, `withdraw_activity_request(request_id)`, `joined_activities()`, `my_join_requests()`, `activity_join_requests(activity_id)`, `browse_circles()`, `get_circle(circle_id)`, `join_circle(circle_id)`, `leave_circle(circle_id)`, `circle_members_of(circle_id)`, `circle_activities(circle_id)`.
- Safety and learning loop: `report(target_type, target_id, reason, details)`, `submit_meetup_feedback(other_user, did_meet, keep, activity)`, `pending_meetup_feedback()`.
- Admin: `admin_takedown`, `admin_restore`, `admin_ban`, `admin_create_circle`, `admin_edit_circle`, `admin_archive_circle`, `kept_connections(since)`.
- Photo and chat media uploads and links go through the `media` Edge Function, which calls service-role-only functions (`start_photo_upload`, `photo_links`, `start_chat_upload`, `chat_media_links` and others; see docs/02).

## Matching (rule-based, SQL)
Candidates: Visible, unblocked Members within the viewer's Discover Range of their fresh Member Location (none, or one older than 30 days: no candidates, decision 66), with no waiting or accepted Connection between the two; every Mode shown (decision 45; the Casual and Dating rules apply to requests only, through `eligible_modes()`). Score: shared tags, shared availability, shared Modes and nearness (3 under 2 km, 2 under 5 km, 1 up to 10 km); the Networking filter ranks by shared industry and career stage first. "Why you match" (`match_reason()`) is a template filled from what is shared, for example "You both want friends, like badminton and cafés, and are free on weekends". Matching stays in these functions so AI can later become one more signal.
