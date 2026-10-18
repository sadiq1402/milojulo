# Admin web (not built)

This folder holds only this README. The planned small Next.js moderation page (report queue with the 24-hour target, auto-hidden items, recently-joined spot checks, takedown, restore and ban, the audit log) is not built and has no ticket yet; it was left out of the app epic (#33). Mockup: design/reference-html/screens/Admin.dc.html. There is no profile or photo approval (ADR 0002).

Until it exists, moderation runs through the Supabase dashboard and the SQL functions from #18, called as an admin (a user whose `app_metadata.role` is `admin`, checked by `public.is_admin()`) (supabase/migrations/20261106090000_admin_moderation.sql):

- `admin_takedown(target_type, target_id, note)` and `admin_restore(target_type, target_id, note)` for a profile, photo, message or Activity
- `admin_ban(member_id, reason)`

Each writes an entry to the append-only `admin_actions` audit log, which only admins can read.

These functions check `is_admin()` against the caller's JWT, so they refuse a plain SQL editor session (which has no JWT). They must be called as a signed-in admin, or in SQL with role `authenticated` and `request.jwt.claims` set for an admin user, as `supabase/tests/helpers/act_as.psql` does. How to do that from the dashboard, with the queue queries: docs/runbooks/moderation.md.
