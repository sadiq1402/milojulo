# MiloJulo

Intent-first social discovery app for Pune. Tagline: "Find your people." Users choose what kind of connection they want (friends, activities, dating, serious, casual, networking), see people whose choices overlap, and are nudged toward meeting in real life. V1 is an invite-only closed beta in Pune.

Name: "milo-julo" echoes Hindi *milna-julna* (to meet and mingle). Never use hearts or cupid imagery in product or brand.

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
- Business rules live in Postgres functions (SQL), not application code. Edge Functions are thin: signed media URLs, push, webhooks, media checks, admin actions.
- Media (photos, chat images, video, voice notes): Cloudflare R2, private bucket, short-lived signed URLs issued by an Edge Function.
- Chat: Supabase Realtime using Broadcast from database triggers on private channels (not Postgres Changes).
- Mobile: React Native CLI (bare workflow) with TypeScript. DECIDED: no Expo, no EAS. Bootstrap with `npx @react-native-community/cli@latest init` and keep `@react-native-community/cli` as an explicit devDependency. Android first; iOS builds need macOS (a Mac or macOS CI).
- Admin: small Next.js moderation page, later; Supabase dashboard first.
- Email: custom SMTP provider called by API (Edge Functions cannot use ports 25/587). Bot protection: Cloudflare Turnstile. Push: FCM directly (Edge Function sends via the FCM HTTP v1 API); no Expo push.
- Everything free-tier until the beta; Supabase Pro (about $25/month) when real users arrive.

## Hard rules
1. Every table has RLS enabled and starts default-deny. Policies grant the minimum.
2. Never read other users' rows from tables directly. Use the discovery function, which returns visible (active, submitted, unpaused, not hidden), unblocked people and a safe column subset.
3. One SQL function `is_blocked(a, b)` is the single source of truth for blocks; use it in discovery, connection and message policies.
4. Functions that bypass RLS (security definer) are few, reviewed, and tested. Set a fixed `search_path`.
5. Every RLS rule gets an automated test that runs in CI before migrations are applied.
6. Schema changes are migration files in `supabase/migrations/`, never dashboard edits.
7. Store only a coarse location cell, never exact coordinates. No religion or community fields in V1.
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
Foundations (week 1). First tasks are in docs/10-build-plan.md.
