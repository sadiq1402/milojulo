# MiloJulo

[![Database tests](https://github.com/sadiq1402/milojulo/actions/workflows/database.yml/badge.svg?branch=main)](https://github.com/sadiq1402/milojulo/actions/workflows/database.yml)

Find your people. Intent-first social discovery for Pune.

## Status
The V1 database (#1) and the V1 mobile app screens (#33) are built: sign-up, profile setup, Discover, requests, chat with media, Activities, Circles, the learning loop, reports, blocks and account controls (docs/07-screens.md lists every screen). Android builds go to testers through Firebase App Distribution. Not built yet: the admin web page (apps/admin), the web account deletion page (#98), Turnstile (#70) and the disposable-email blocklist (#71). Open work is in GitHub Issues.

## Layout
- `CLAUDE.md`: the file Claude Code loads automatically; `CONTEXT.md`: domain language
- `docs/`: product, scope, architecture, data model and schema (docs/12), safety, UI standards, brand, screens, decisions, open questions, build plan; `docs/adr/`: architecture decision records
- `design/`: design tokens, the logo and static HTML references for every screen (design/README.md)
- `apps/mobile`: the React Native CLI app (apps/mobile/README.md)
- `apps/admin`: README only; the admin page is not built (apps/admin/README.md)
- `supabase/`: migrations, pgTAP tests, Edge Functions (`media`, `push`, `account-purge`, `purge-chat-media`) and seeds (supabase/README.md)
- `scripts/brand-assets.sh`: makes the app icon, launch screens and in-app images from the logo
- `tasks/`: plan, review notes and lessons (tasks/todo.md, tasks/lessons.md)

## Database tests
pgTAP tests in `supabase/tests/` act as a Member, admin or signed-out visitor (helpers in `supabase/tests/helpers/`) and use only public functions and tables under RLS.

```bash
npx supabase db start   # local Postgres with every migration applied (Docker)
npx supabase db reset   # re-apply migrations from scratch
npx supabase test db    # run all tests
```

## CI and deploy (`.github/workflows/`)
- `database.yml` (`db-tests`): the pgTAP tests, on every pull request and every push to `main`.
- `functions.yml`: `deno fmt --check`, `deno lint`, `deno check` and `deno test` for the Edge Functions, when `supabase/functions` changes.
- `mobile.yml`: the app's lint, typecheck and component tests, then its integration tests against a local Supabase stack, when `apps/mobile`, `design` or `supabase` changes.
- `deploy.yml`: on a push to `main` that changes migrations or functions, applies new migrations to the hosted project and, if a function file changed, redeploys the four Edge Functions.
- `android-distribute.yml`: on a push to `main` that changes `apps/mobile`, builds a release APK and sends it to Firebase App Distribution.

Secrets go in `.env` (template `.env.example`, never committed); the app's own config is `apps/mobile/src/config/env.ts`.

## Using it with Claude Code
Run `claude` in the repo root. It reads `CLAUDE.md` and the docs it imports; work is one GitHub issue per branch and PR (see "Database tickets" in CLAUDE.md).

Private links to the original work (visible only to the author's account):
- V1 plan doc: https://claude.ai/code/artifact/5ae6bdea-62f1-49bb-b516-03c06627a7c6
- Screen designs canvas: https://claude.ai/artifact/CUiLCrHKpSmoQ8SSF6aY7x
