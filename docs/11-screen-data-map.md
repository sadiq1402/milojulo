# Screen to data map

Use this to design the database from the screens. docs/12-db-schema.md is the resulting schema and wins where they differ (notably: no pre-approval, Connections carry a Mode). Mockups are in design/reference-html/screens/ (names after the semicolon in the first column). Content in the mockups (names, areas, times) is sample data, not real data. The per-screen table below reflects what the app calls today.

## Enumerations seen on the screens
- area: 55 Pune neighbourhoods in five zones (west, pimpri_chinchwad, central, east, south; decision 50), catalog `areas` with a centre point
- mode: friends, activities, networking, dating, serious, casual
- availability slot: weekday_evenings, weekends, early_mornings
- activity type: sports, food_chai, outdoors, games, learning
- activity timing tab (derived from starts_at): tonight, this_weekend, later
- report reason: fake_or_spam, harassment, inappropriate_content, underage, felt_unsafe, other (plus system-only word_filter)
- report target type: profile, message, activity, photo
- account status: active, banned (paused is a separate timestamp; no pending/approved since decision 15)
- photo: no status enum; live once uploaded, unless hidden or removed
- connection status: requested, accepted, declined, closed
- activity request status: requested, accepted, declined, cancelled, withdrawn
- message type: text, image, video, voice, activity_card

## Per screen
Screens are in apps/mobile/src/screens; what each one calls is in apps/mobile/src/features/*/api.ts. "media fn" is the `media` Edge Function (actions in brackets). Every photo shown is signed in a batch through media fn (`photo-urls`); every screen listens on the Member's private Realtime topic `member:<id>` (features/live).

| Screen (app file; mockup) | Reads | Writes | Notes and gaps |
|---|---|---|---|
| Welcome (gettingIn/WelcomeScreen; Main) | none | none | Static |
| Invite code (no screen; InviteCode) | none | none | **Dropped** (decision 27: open sign-up) |
| Email, Verify code (gettingIn/EmailScreen, OtpScreen; Email, Otp) | auth | auth.users | Supabase Auth email OTP only |
| Age and consent (gettingIn/AgeConsentScreen; AgeConsent) | `consent_documents` (newest per kind with effective_at ≤ now) | `accept_consents(birth_date, document_ids)`: creates the profile row with date_of_birth, and the three consents | Reject under 18; a refusal leaves no profile. Never expose DOB to others; expose age only |
| Reconsent (gettingIn/ReconsentScreen; no mockup) | `needs_reconsent()`, `consent_documents` | `accept_consents()` | Shown when a current document is not accepted or was withdrawn; offers Delete account |
| Location (location/LocationScreens; Location, LocationOff) | none | `set_location(lat, lng)` | Member Location (decision 40); without a point from the last 7 days the Member is not in Discover either way (#203) |
| Profile basics (profileSetup/BasicsStep; Setup1Basics) | none | `profiles.display_name` (direct update) | First name only |
| Photos (profileSetup/PhotosStep; Setup2Photos) | `photos` (own: id, position; not hidden or removed) | media fn (`photo-upload`, `photo-confirm`, `photo-delete`); `move_photo(photo_id, new_position)` | 2 to 4 photos, 4:5; position 1 is the cover |
| Prompts (profileSetup/PromptsStep; Setup3Prompts) | `prompt_questions`, own `profile_prompts` | `profile_prompts` insert/update (question, answer up to 140 chars) | Two answers required |
| Modes (profileSetup/ModesStep; Setup4Modes) | `industries` | `profiles.modes`, `gender`, `pref_age_min`, `pref_age_max`, `pref_genders`, `pref_max_km`, `profession`, `industry_id`, `career_stage` | Casual shows an adult-intent note. Gender and Dating Preferences appear on this step when a Dating Mode is chosen; Networking fields likewise |
| Interests (profileSetup/InterestsStep; Setup5Interests) | `tags` | `profile_tags`; `profiles.availability` | About 40 curated tags |
| Profile setup end (profileSetup/ProfileSetupScreen) | own `profiles`, `profile_prompts`, `profile_tags` | `submit_profile()` | Sets submitted_at; the Member goes straight to Discover |
| Under review (no screen; UnderReview) | none | none | Dropped (decision 15) |
| Discover (discover/DiscoverScreen, FeedCard, DiscoverSheets; Discover, DiscoverNoLocation) | `discover_feed(mode_filter, page_size, after)`: user_id, display_name, age, modes, their_modes, distance_band, photo_ids, shared_tag_ids, why_you_match, cursor; own `profiles` (modes, paused_at, discover_range_km: 2, 5, 10, 25, 50 or 100); `has_fresh_location()` | `profiles.discover_range_km`; `set_paused(false)` (paused notice); `set_location(lat, lng)` ("Turn on location") | Filter by Mode; cursor pagination; excludes blocked and not-visible Members |
| Profile (profile/ProfileScreen; ProfileDetail) | `get_profile(member_id)`: photo_ids, name, age, modes, their_modes, distance_band, why_you_match, prompts, tag_ids, availability, request_modes | none (menu: Report, Block) | No DOB, no exact location. Profession, industry and career stage are not returned |
| Send request (requests/SendRequestSheet; SendRequest) | `request_modes` from `get_profile()` | `send_request(to_member, mode, note)` | Request Cap enforced in the function (no read of sent requests); note optional |
| Inbox (inbox/InboxScreen, requests/RequestList; Inbox, Chats) | `my_connections()` (requests both ways with note, chats with last message and unread_count); `my_join_requests()` | `respond_request(connection_id, accept)`; `respond_activity_request(request_id, accept)` | Requests and chats on one screen; accept opens chat |
| Chat (chat/ChatScreen; Chat) | `messages` (not removed); `connection_members` (last_read_at, muted); `connection_mode_changes`; `chat_media_state(connection_id)`; `get_profile()` for the header; media fn (`chat-urls`) | `messages` insert (client id); `connection_members.last_read_at`, `muted`; `set_media_consent()`; `propose_mode_change()`, `respond_mode_change()`; media fn (`chat-upload`, `chat-confirm`); `close_connection()`, `block_user()`; "We met": `submit_meetup_feedback()` | Shows activity_card messages, but nothing in the app or database creates them yet. Typing is not built |
| Activities (activities/ActivitiesScreen, MeetPrompts; Activities) | `activity_board()`: host name and photo, title, area, starts_at, spots_left, starts_when, circle_name, visible_until; `pending_meetup_feedback()` | none | Tabs from starts_at; the board drops each Activity at visible_until |
| Joined (activities/JoinedScreen; no mockup) | `joined_activities()` | none | The caller's waiting and accepted Join Requests |
| Activity (activities/ActivityDetailScreen; ActivityDetail) | `get_activity(activity_id)` (venue_detail only for host and accepted joiners); host: `activity_join_requests(activity_id)` | `join_activity_request()`, `withdraw_activity_request()`, host: `respond_activity_request()`, `cancel_activity()` | |
| New activity (activities/CreateActivityScreen; CreateActivity) | `browse_circles()` (circle picker), `areas` | `post_activity(title, type, area_id, starts_at, ends_at, capacity, description, venue_detail, circle_id)` | Expires automatically (pg_cron `expire-activities`) |
| Edit activity (activities/EditActivityScreen; no mockup) | `get_activity()` | `update_activity(...)` | Locked once someone is accepted: only description and more spots |
| Circles (circles/CirclesScreen; Circles) | `browse_circles()`: name, area, tag, description, member_count, i_am_member | none | The app shows member counts |
| Circle (circles/CircleDetailScreen; CircleDetail) | `get_circle()`, `circle_members_of()`, `circle_activities()` | `join_circle()`, `leave_circle()` | Posting to a circle uses `post_activity(circle_id)`. Members open the member's profile; a request starts a 1:1 chat. No group chat in V1 |
| After you meet (meetFeedback/MeetFeedbackScreen; MeetFeedback) | own `meetup_feedback` (already answered?) | `submit_meetup_feedback(other_user, did_meet, keep, activity)` | Private; `kept_connections()` (admin) computes mutual keeps |
| Report (reports/ReportScreen; Report) | target summary from the screen it came from | `report(target_type, target_id, reason, details)`; optional `block_user()` | `report()` snapshots the content into reports.evidence |
| Safety Centre (me/SafetyCentreScreen; SafetyCentre) | static copy | none | Contact support opens the email app to support@milojulo.co.in |
| Me (me/MeScreen; Me) | own `profiles`, `photos`, catalogs | sign out (deletes this phone's `device_tokens` row) | No notice for a taken-down photo yet (the mockup shows one) |
| Edit profile (me/EditProfileScreen; no mockup) | as the setup steps | as the setup steps | Reuses one setup step at a time |
| Settings (me/SettingsScreen; Settings) | own `profiles` (paused_at, notify_messages, notify_activities) | `set_paused()`; `profiles.notify_messages`, `notify_activities` | Links to Blocked people, Consents, Data copy, Delete account |
| Blocked people (me/BlockedPeopleScreen; no mockup) | `my_blocks()` | `blocks` delete (unblock) | |
| Consents (account/ConsentSettingsScreen; no mockup) | `consents` with `consent_documents` (kind, version) | `withdraw_consent(document_id)`; `accept_consents()` to accept again | Withdrawing hides the profile (decision 37) |
| Data copy (account/DataCopyScreen; no mockup) | `data_requests` | `request_data_copy()` | The founder completes access requests |
| Delete account (account/DeleteAccountScreen; DeleteAccount) | none | `delete_account()`; the `account-purge` function erases later | Retention period is a legal decision, not shown. Link to the privacy notice |
| Push (features/push, no screen) | none | `register_device_token(token, platform)` | |
| Moderation queue (no screen; Admin) | dashboard: `reports`, `admin_actions`, Auto-hidden rows | `admin_takedown()`, `admin_ban()`, `admin_restore()` | No admin page yet; the founder uses the Supabase dashboard |

## Additions to the 17-table model (found from the screens)
Historical: the list the schema was designed from. docs/12-db-schema.md ("Changes from docs/03 and docs/11") says what was built instead (for example no approved_at, coarse_cell, is_primary or notification_settings).

New tables: `areas`, `prompt_questions`, `profile_prompts`, `device_tokens` (user, token, platform, last_seen), `notification_settings`, `data_requests` (access/erasure requests, status), `consent_documents` (document, version, text, effective date), `banned_terms` (word filter), `blocked_email_domains` (disposable emails; not built, #71). That brings the schema to about 26 tables (docs/12 has the final count: 33).

New columns:
- profiles: submitted_at, approved_at, approved_by, paused_at, banned_reason, preferences (age_min, age_max, interested_in, max_distance_km), profession, industry, area_id, coarse_cell.
- photos: position, is_primary, width, height.
- connections: responded_at, closed_at, closed_by, closed_reason; unique pair constraint on (least(a,b), greatest(a,b)); per-participant last_read_at.
- messages: type, media_duration_ms, media_width, media_height, media_mime, activity_id.
- activities: description, venue_detail (participants only), circle_id, capacity, starts_at, ends_at.
- activity_requests: requested_at, responded_at, cancelled status.
- reports: evidence (snapshot of reported content), internal_note, handled_at.
- circles: created_by, created_at.

Derived on the server, never stored: age, why-you-match text, spots left, tonight / this weekend tab, mutual "kept" connection.

## Screen gaps (resolved in the designs)
1. Create-activity: optional Details field added (activities.description).
2. Report: optional free-text field added (reports.details).
3. Circles: no group chat in V1. The circle screen now makes the path clear: tap a member, view the profile, send a request, chat 1:1 after acceptance. Still an open product decision: add a text-only circle chat later.
4. Delete-account and Safety Centre: bracketed placeholders removed from the screens (a Contact support button and a link to the privacy notice instead). Still to do outside the design: set the support address and get the retention period from a lawyer.
