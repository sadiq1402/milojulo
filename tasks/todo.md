# V1 database: migration plan

Source of truth: docs/12-db-schema.md, CONTEXT.md, docs/adr/. One migration per PR, each with pgTAP tests in `supabase/tests/` that prove every RLS rule and function guard (hard rule 5).

## Setup (before 0001)
- [x] `npx supabase init` (Supabase CLI via npx, no global install); commit `supabase/config.toml`
- [x] Local stack with `npx supabase start` (Docker is installed); tests run with `npx supabase test db` (pgTAP)
- [x] GitHub Actions: start the local stack, apply migrations, run `supabase test db` on every PR
- [x] Test helpers: a pgTAP helper to act as a given Member or admin (set `request.jwt.claims` and role `authenticated`)

## Migrations
- [ ] **0001 foundations**: extensions (postgis, pg_cron, pg_net, pgtap in tests only); all enums; catalogs (`areas` with centroids, `tags`, `industries`, `prompt_questions`, `consent_documents`, `banned_terms`, `blocked_email_domains`) with seed rows; `is_admin()`; `updated_at` trigger function
- [ ] **0002 profiles and onboarding**: `profiles`, `profile_prompts`, `profile_tags`, `photos`, `consents`, `invite_codes`, `invite_redemptions`, `device_tokens`; column grants; `check_invite`, `redeem_invite`, `accept_consents`, `submit_profile`, `confirm_photo_upload`, `set_paused`; `enforce_profile_minimum` trigger; word-filter trigger on names and prompts
- [ ] **0003 blocks and discovery**: `blocks`, `is_blocked`, `is_visible`, `eligible_modes`, `block_user`, `discover_feed`, `get_profile`, `match_reason`
- [ ] **0004 connections and chat**: `connections` (partial unique pair), `connection_members`, `connection_mode_changes`, `messages`; `send_request`, `respond_request`, `close_connection`, `propose_mode_change`, `respond_mode_change`; message insert policy (incl. Casual media consent); broadcast trigger and `realtime.messages` policy; message word filter → `word_filter` report (report table stubbed here or 0006 moved earlier)
- [ ] **0005 activities and circles**: `activities`, `activity_venues`, `activity_requests`, `circles`, `circle_members`; `join_activity_request`, `respond_activity_request` (Activity Connection), `withdraw_activity_request`, `join_circle`, `circle_members_of`; Locked Activity and capacity triggers; `expire_activities` pg_cron job
- [ ] **0006 moderation**: `reports`, `admin_actions`; `report` (Auto-hide at 3 distinct reporters / 7 days), `admin_takedown`, `admin_ban`, `admin_restore`
- [ ] **0007 learning loop and account**: `meetup_feedback`, `data_requests`; `submit_meetup_feedback`, `withdraw_consent`, `delete_account`; chat media purge pg_cron → pg_net job
- [ ] `supabase/seed/reviewer.sql` (Reviewer Account, `REVIEWER` code)

Ordering note: 0004's message word filter files a report, so `reports` must exist first. Either move `reports`/`admin_actions` into 0003, or add the message filter in 0006. Proposed: create `reports` and `admin_actions` tables in 0003, functions in 0006.

## Needs input before 0001
- [ ] The full ~40 interest and activity tags (mockups show 14: badminton, board games, books, cafes, cooking, cricket, cycling, football, live music, movies, photography, running, trekking, yoga)
- [ ] The prompt questions list
- [ ] The industries list (a provisional 12-item starter list is seeded in #5)
- [ ] Banned-terms seed list (or start empty and fill from the dashboard via admin)

## Review
- #2 (harness + CI): foundations migration (postgis, pg_cron, pg_net, `is_admin()`), act-as helpers, 4 admin tests passing locally; a deliberately broken `is_admin()` made the suite fail. Gotcha: `supabase migration new` waits on stdin when not run from a terminal, so pass `</dev/null`. Branch protection pending the first workflow run on GitHub.
- #3 (invites, age gate, consents): `check_invite`, `redeem_invite`, `accept_consents` (18+ by India calendar date, every current document required), `seed_reviewer` (service role only) plus `supabase/seed/reviewer.sql`; reserved `REVIEWER` code with no uses. 24 new tests; every rule mutation-checked. Gotcha: `supabase test db` mounts only `supabase/tests`, so seed logic lives in a function the test can call. Consent document URLs are null until the domain and lawyer-reviewed texts exist.
- #4 (build and submit a profile): catalogs (5 Areas with centroids, the 14 mockup tags, the 2 mockup prompts; full ~40 tags still needed), profile columns with column-level update grants, `profile_prompts`, `profile_tags`, `photos`, `confirm_photo_upload` (service role only), `submit_profile`, `enforce_profile_minimum`, `set_paused`. First name added to the minimum (decision 18). 63 new tests; every deny mutation-checked. Gotchas: Supabase grants table-wide insert/update to `authenticated` by default, so revoke before granting columns; a cross-Member UPDATE with a `where` is also stopped by the SELECT policy, so write deny tests without one to isolate the UPDATE policy; the minimum guard checks only what each table holds, so an admin Takedown below the photo minimum doesn't lock the Member out of other edits; `unique (user_id, position)` is deferrable so photos can be swapped in one statement.
- #5 (Dating Mode and Networking fields): `industries` catalog (provisional starter list of 12, final list still needed), `career_stage` and `gender` enums, profession/Industry/Career Stage, own gender and Dating Preferences columns with checks (18 ≤ min ≤ max, max km > 0). Holding any Dating Mode needs gender, at least one preferred gender, an age range and a max distance, both at submission and afterwards (adding a Dating Mode later, or clearing a field while holding one). Networking fields stay optional and are not tied to holding Networking. 21 new tests; every rule mutation-checked. Gotcha: the profiles trigger is `before update of <columns>`, so a new column the minimum depends on must be added to that list too, or clearing it slips past.
- #6 (Discover feed and profile view): `discover_feed(mode, page_size, cursor)` and `get_profile(member_id)` are the only security definer entry points; `is_visible`, `eligible_modes`, `shared_tags`, `match_reason`, `age_of` run as the caller and no client role can execute them. Feed cards and profiles show only the shared Modes, photo ids (never R2 keys), age (never DOB); a viewer who is not visible gets nothing. Ranking: shared tags + shared availability + same Area, keyset cursor `score:id`, page size capped at 50. Eligible Modes are plain shared Modes here (Dating Preferences come in #7); blocks are not applied until #8. 49 new tests; early-passing rules mutation-checked. Gotcha: a Python `replace` on a migration hits every occurrence, so scope mutations to one function or two rules break at once.
