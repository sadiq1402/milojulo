# MiloJulo

Intent-first social discovery app for Pune. Tagline: "Find your people." Users choose what kind of connection they want (friends, activities, dating, serious, casual, networking), see people whose choices overlap, and are nudged toward meeting in real life. V1 is a beta in Pune with open sign-up (decision 27).

Name: "milo-julo" echoes Hindi *milna-julna* (to meet and mingle). The logo is design/brand/logo.png (decision 32), used as is; no other hearts or cupid imagery in the product.

## Read these first
@docs/00-overview.md
@docs/01-v1-scope.md
@docs/02-architecture.md
@docs/03-data-model-rls.md
@docs/05-ui-standards.md

Domain language is in CONTEXT.md (use its terms; avoid the ones it lists under _Avoid_). For database work read docs/12-db-schema.md (the V1 schema; wins over docs/03 and docs/11) and docs/adr/.

Other docs: docs/04-safety-compliance.md, docs/06-brand-colour.md, docs/07-screens.md, docs/08-decisions.md, docs/09-open-questions.md, docs/10-build-plan.md. The founder's original blueprint is in docs/reference/blueprint.md (background only; the docs/ folder wins where they differ).

## Stack (decided)
- Backend: Supabase only (Mumbai region). Auth with email OTP, Postgres with RLS and PostGIS, Realtime, pg_cron, Edge Functions (TypeScript/Deno).
- Business rules live in Postgres functions (SQL), not application code. Edge Functions are thin: `media` (signed upload and download URLs, upload checks), `push` (FCM), `account-purge` and `purge-chat-media` (R2 cleanup); pg_cron jobs and database triggers call them over `pg_net`. Admin actions are SQL functions.
- Media (photos, chat images, video, voice notes): Cloudflare R2, private bucket, short-lived signed URLs issued by an Edge Function.
- Chat and live updates: Supabase Realtime using Broadcast from database triggers on one private channel per Member, `member:<id>` (decision 51), not Postgres Changes.
- Mobile: React Native CLI (bare workflow) with TypeScript. DECIDED: no Expo, no EAS. Bootstrap with `npx @react-native-community/cli@latest init` and keep `@react-native-community/cli` as an explicit devDependency. Android first; iOS builds need macOS (a Mac or macOS CI).
- Admin: Supabase dashboard first, calling the admin SQL functions (`admin_takedown`, `admin_restore`, `admin_ban`, Circle admin functions) as a user whose JWT has `app_metadata.role = admin`. How: docs/runbooks/moderation.md. A small Next.js moderation page comes later; `apps/admin` is only a placeholder README.
- Email: Supabase Auth sends sign-in codes through Resend over SMTP (`smtp.resend.com:465`, from `no-reply@milojulo.co.in`; `[remotes.cloud.auth.email.smtp]` in `supabase/config.toml`). Edge Functions cannot use ports 25/587, so any email they send must use a provider's HTTP API. Bot protection: Cloudflare Turnstile, not built yet (#70). Push: FCM directly (the `push` Edge Function sends via the FCM HTTP v1 API); no Expo push.
- Everything free-tier until the beta; Supabase Pro (about $25/month) when real users arrive.

## Hard rules
1. Every table has RLS enabled and starts default-deny. Policies grant the minimum.
2. Never read other users' rows from tables directly. Use the discovery function, which returns Visible (active, submitted, unpaused, not Auto-hidden, not deleted, current consents; see CONTEXT.md), unblocked people and a safe column subset.
3. One SQL function `is_blocked(a, b)` is the single source of truth for blocks; use it in discovery, connection and message policies.
4. Functions that bypass RLS (security definer) are few, reviewed, and tested. Set a fixed `search_path`.
5. Every RLS rule gets an automated test that runs in CI before migrations are applied.
6. Schema changes are migration files in `supabase/migrations/`, never dashboard edits.
7. Exact coordinates live only in `member_locations` (latest point, fixed per-Member offset, no history, deleted with the account), which no client role can read; use them only inside security definer functions and show distances as rounded bands (decision 40, docs/adr/0003). No religion or community fields in V1.
8. Messages use a client-generated UUID for idempotent sends. Client must catch up after reconnect.
9. Media is never public: private bucket, signed URLs only, issued after visibility and block checks, batched per feed call. Account deletion must delete the user's R2 objects.
10. Never commit secrets. Use `.env.example` as the template.
11. Do not add Expo packages, EAS or Expo-only APIs. Any native module must support React Native CLI autolinking; ask before adding one and prefer well-maintained libraries.

## UI rules
Follow docs/05-ui-standards.md for every dimension (touch targets 48, pill buttons 52 high, 20 page margin, 4-pt grid) and docs/06-brand-colour.md for colour ("Orchid pop"). Static HTML mockups of every screen are in design/reference-html/screens/ (read them for exact styling; they are not runnable). Tokens are in design/tokens.ts and design/tokens.json.

## Working agreements
- Ask before adding a dependency or a new service. The stack above is deliberate and cost-driven.
- Do not assume anything listed in docs/09-open-questions.md. Surface the question instead.
- Keep PRs small: one migration or one feature at a time, with tests.
- When a decision changes, update the relevant doc and add an entry to docs/08-decisions.md.

## Current phase
V1 is built: the database (issue #1, tickets #2 to #20) and the mobile app (issue #33) were closed as complete on 2026-10-18. Android dev builds go to testers through Firebase App Distribution when the build is run by hand (`gh workflow run android-distribute.yml --ref main`, or the Actions tab; .github/workflows/android-distribute.yml). It ran on every merge until 2026-10-26, which cost about a fifth of the account's monthly Actions minutes. What remains before the beta:
- Open issues, all waiting on founder input: #70 (Turnstile), #71 (disposable-email blocklist), #98 (web account deletion page, a Google Play requirement) and #160 (report evidence retention). #137 (media cache through a Cloudflare Worker) is parked.
- Beta prep in docs/10-build-plan.md: final terms, guidelines and data notice (the app links placeholders), Google Play listing and Data safety form, a release signing key, a k6 load test, Supabase Pro.
- Open questions in docs/09-open-questions.md.
Plan and lessons in tasks/todo.md.

## Tickets
Work one ticket per branch and PR, test-first with the mattpocock-skills `tdd` skill. Database rules first; app work follows apps/mobile/README.md.
- Start: `gh issue view <n>`; check its blockers are merged; branch `feat/<n>-<slug>` from an up-to-date `main`. Read the Review section of tasks/todo.md for gotchas.
- Local database: `npx supabase db start` (Docker), `npx supabase db reset` to re-apply migrations, `npx supabase test db` to run tests. Pass `</dev/null` to Supabase CLI commands when not in a terminal.
- One migration per ticket in `supabase/migrations/`. Tests in `supabase/tests/` only; the test runner cannot see other folders.
- Test seam: act as a Member, admin or signed-out visitor with `supabase/tests/helpers/act_as.psql`, then use only public functions and tables under RLS. Assert behaviour (rows visible, calls refused, results returned), never internals. Every rule gets an allow and a deny test.
- One red → green cycle at a time. A test that passes before its code exists gets mutation-checked: break the rule in the local database, confirm a test fails, then `db reset`.
- App tickets: `npm run lint`, `npm run typecheck`, `npm test` and `npm run test:integration` (against local Supabase) in `apps/mobile`; `npm run gen:types` after a migration. Edge Functions have Deno tests beside each handler (`handler_test.ts`).
- Finish: add a line to the Review section of tasks/todo.md, commit, push, open a PR that closes the issue, and wait for its checks: `db-tests` on every PR, plus `app-checks` and `app-integration` when `apps/mobile`, `design` or `supabase` change, and `function-tests` when `supabase/functions` change. `main` is protected: merges need a PR with `db-tests` passing and an up-to-date branch. A merge to `main` deploys new migrations and Edge Functions to the hosted project (.github/workflows/deploy.yml).

## Agent skills

### Issue tracker

GitHub Issues on sadiq1402/milojulo, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
