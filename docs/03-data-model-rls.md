# Data model and access rules

**Superseded for schema detail by docs/12-db-schema.md** (29 tables, no pre-approval, Connections carry a Mode). The screens need more than the tables below: see docs/11-screen-data-map.md for the per-screen data map and the additions (about 27 tables in total) that supersede this first list.

Seventeen tables in Supabase Postgres. RLS on every table, default deny.

| Table | Key fields | Who can access |
|---|---|---|
| profiles | user id, display name, date of birth, area, coarse location cell, intents, prompts, preferences (age range, gender, distance), optional profession/industry, status (pending, approved, paused, banned) | Owner reads and edits; others only through the discovery function |
| photos | user id, R2 object key, status (pending, approved, rejected) | Owner; others get approved photos by signed URL |
| tags, profile_tags | curated tag catalog; user-to-tag links | Catalog readable by signed-in users; links by owner and discovery function |
| availability | user id, time slots | Owner; used by the matching function |
| activities | host, type, area, time window, spots, expiry, status, optional circle | Approved users read open activities; host edits own |
| activity_requests | activity, requester, status | Requester and host only |
| connections | two users, requester, note, status (requested, accepted, declined, closed) | The two users only |
| messages | client-generated id, connection, sender, body, media path and type, time | Participants of an accepted, unblocked connection |
| blocks | blocker, blocked | Blocker writes; checked in every function and policy |
| reports | reporter, target type and id, reason, details, status, handler | Reporter creates; admins read and resolve |
| consents | user, document, version, accepted at | Owner reads; written at onboarding |
| invite_codes | code, issuer, event tag, uses left, expiry | Admins; redeemed through a function |
| meetup_feedback | activity or connection, user, did meet, keep connection | Owner writes; admins read for metrics |
| admin_actions | admin, action, target, time | Admins only (audit log) |
| circles | name, area, interest, description, status | Admins create/edit; approved users read active circles |
| circle_members | circle, user, joined at | Members see own memberships and fellow members; joining via a function |

## Rules
1. Every table starts with no access; each policy grants the minimum.
2. Other users' profiles are never read from the table directly. The discovery function returns visible (active, submitted, unpaused, not hidden), unblocked people and a safe column subset.
3. The block check lives in one SQL function used by the discovery function, the connection policy and the message policy.
4. A message insert is allowed only for a participant of an accepted connection with no block in either direction.
5. Admin tools use a separate role claim; app users can never read reports or the audit log.
6. Business rules live in Postgres functions the app calls. Functions that bypass RLS are few, reviewed and tested.
7. Every rule has an automated test that runs in CI before each migration is applied.

## Functions to implement (SQL)
`is_blocked(a, b)`, `discover_feed(mode_filter, limit, cursor)`, `match_reason(a, b)` (templated text), `send_request(to, note)`, `respond_request(id, accept)`, `block_user(id)`, `report(target_type, target_id, reason, details)`, `redeem_invite(code)`, `join_activity_request(activity)`, `join_circle(circle)`, `submit_meetup_feedback(...)`, `delete_account()` (also triggers R2 cleanup), `expire_activities()` (pg_cron).

## Matching (rule-based, SQL)
Candidates: same or nearby area/cell, overlapping modes, not blocked, visible, availability overlap. Score: shared intent, shared interests/activity tags, availability overlap, distance. "Why you match" is a template filled from the overlap (for example "You both want friends, like badminton and cafés, and are free on weekends"). Keep matching in one module/function so AI can later become one more signal.

## Illustrative sketch (verify and test before use)
```sql
-- sketch only
create function is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks
                 where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;
-- messages insert policy: sender is a participant of an accepted connection and not blocked
```
