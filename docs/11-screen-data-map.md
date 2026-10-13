# Screen to data map

Use this to design the database from the screens. docs/12-db-schema.md is the resulting schema and wins where they differ (notably: no pre-approval, Connections carry a Mode). Mockups are in design/reference-html/screens/ (names in brackets). Content in the mockups (names, areas, times) is sample data, not real data. Fields marked NEW are not in the 17-table model in docs/03-data-model-rls.md yet.

## Enumerations seen on the screens
- area: baner, wakad, hinjewadi, balewadi, kharadi (catalog with a coarse location cell)
- mode: friends, activities, networking, dating, serious, casual
- availability slot: weekday_evenings, weekends, early_mornings
- activity type: sports, food_chai, outdoors, games, learning
- activity timing tab (derived from starts_at): tonight, this_weekend, later
- report reason: fake_or_spam, harassment, inappropriate_content, underage, felt_unsafe, other
- report target type: profile, message, activity, photo
- account status: active, banned (paused is a separate timestamp; no pending/approved since decision 15)
- photo: no status enum; live once uploaded, unless hidden or removed
- connection status: requested, accepted, declined, closed
- activity request status: requested, accepted, declined, cancelled, withdrawn
- message type: text, image, video, voice, activity_card (NEW)

## Per screen
| Screen (file) | Reads | Writes | Notes and gaps |
|---|---|---|---|
| Welcome (Main) | none | none | Static |
| Invite code (InviteCode) | none | none | **Dropped** (decision 27: open sign-up) |
| Email, Verify code (Email, Otp) | auth | auth.users | Supabase Auth only |
| Age and consent (AgeConsent) | consent document versions NEW (terms, guidelines, data notice) | profiles row (created here) with date_of_birth; consents (document, version, accepted_at) x3 | Reject under 18; a refusal leaves no profile. Never expose DOB to others; expose age only |
| Profile basics (Setup1Basics) | areas | profiles.display_name, area | |
| Photos (Setup2Photos) | photos | photos (R2 key, position NEW, uploaded_at; position 1 is the cover) | 2 to 4 photos, 4:5 |
| Prompts (Setup3Prompts) | prompt_questions NEW | profile_prompts NEW (user, question, answer up to 140 chars) | Two answers required |
| Modes (Setup4Modes) | enum | profiles.modes (array of modes) | Casual shows an adult-intent note. A Dating Mode adds a setup step for own gender and Dating Preferences (screen to design) |
| Interests (Setup5Interests) | tags | profile_tags; availability (slots) | About 40 curated tags |
| Under review (UnderReview) | none | none | Dropped (decision 15): `submit_profile()` sets submitted_at and the Member goes straight to Discover |
| Discover (Discover) | discover_feed(): user id, display name, age (from DOB), area, modes, cover photo (signed URL), why-you-match text (computed), shared tags (computed) | none | Filter by mode; cursor pagination; excludes blocked, unapproved, paused. Photo URLs signed in one batch |
| Profile (ProfileDetail) | profile via function: photos (all live), name, age, area, modes, why you match, prompts, tags, availability | none | No DOB, no exact location |
| Send request (SendRequest) | requests sent in the last 24 h (cap 10); Eligible Modes for the pair | connections (to_user, mode, note, status requested) | Cap enforced in the function; note optional; Mode picker to design |
| Inbox: requests (Inbox) | incoming connections (sender summary, note, created_at); sent (status) | respond_request: accepted or declined | Accept opens chat |
| Inbox: chats (Chats) | per connection: other user's name and avatar, last message preview and time, unread flag | none | Needs read state per participant: last_read_at NEW (on connection participant rows) |
| Chat (Chat) | messages (type, body, media key, created_at); other user header; shared activity card | messages insert; last_read_at; allows_media (Casual); Mode Change proposals; typing via Broadcast (not stored) | NEW message columns: type, media_duration_ms (voice 0:14), media_width, media_height, media_mime, activity_id (for activity card) |
| Activities (Activities) | open activities: title, area, starts_at, host name and avatar, spots left (capacity minus accepted requests) | none | Tabs derived from starts_at; expiry job removes past activities |
| Activity (ActivityDetail) | activity, host, description, spots, safety copy; exact venue only for accepted participants | activity_requests (requested) | NEW activities.venue_detail revealed after the host accepts; activities.description |
| New activity (CreateActivity) | enums | activities (host, title, type, area, starts_at, ends_at, capacity, description optional, circle_id optional) | The form now has an optional Details field (activities.description). The post expires automatically (pg_cron) |
| Circles (Circles) | circles (name, area, interest, short description); my membership | none | No member counts shown by design |
| Circle (CircleDetail) | circle; upcoming activities with circle_id; member avatars (visible, unblocked only) | circle_members (join) | Post an activity to a circle uses activities.circle_id. Members are tappable: they open the member's profile, where a connection request starts a 1:1 chat. No group chat in V1 |
| After you meet (MeetFeedback) | activity or connection context | meetup_feedback (did_meet, keep_connection) | Private until both say yes; function computes mutual keep |
| Report (Report) | target summary | reports (target type, target id, reason, details optional); optional block | The sheet now has an optional free-text field (reports.details). Keep a snapshot of reported content NEW (reports.evidence) so deleted messages stay reviewable |
| Safety Centre (SafetyCentre) | static copy | none (Contact support opens the email app or a support form) | The support address itself is still to be set once the domain exists |
| Me (Me) | own profile, status, photos | none | Shows a notice if a photo was taken down |
| Settings (Settings) | visibility and pause (profiles.status), notification prefs NEW, blocked list, consents | profiles.status (paused), notification_settings NEW (requests_messages, activity_updates), consents (withdraw), data_requests NEW ("request a copy") | |
| Delete account (DeleteAccount) | none | deletion request: mark account, purge job removes rows and R2 objects | Keep minimal safety records for a limited period; the exact retention period is a legal decision and is not shown on the screen. Link to the privacy notice |
| Moderation queue (Admin) | reports with target, reporter, reason, age, response target (created_at + 24 h), status; auto-hidden profiles, photos and Activities; recently joined Members (spot checks); users; admin_actions | reports.status and handler; profiles.status (ban); photos/messages removed_at; hidden_at cleared; admin_actions (action, target, note) | Internal note field: store on admin_actions or reports.internal_note NEW |

## Additions to the 17-table model (found from the screens)
New tables: `areas`, `prompt_questions`, `profile_prompts`, `device_tokens` (user, token, platform, last_seen), `notification_settings`, `data_requests` (access/erasure requests, status), `consent_documents` (document, version, text, effective date), `banned_terms` (word filter), `blocked_email_domains` (disposable emails). That brings the schema to about 26 tables (docs/12 has the final count).

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
