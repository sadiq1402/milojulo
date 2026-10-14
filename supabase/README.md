# Supabase

- `migrations/`: all schema changes as SQL files, applied with the Supabase CLI. Never edit the schema from the dashboard.
- `functions/`: Edge Functions in TypeScript (media signing, push, webhooks, media checks, admin actions).

The schema is in docs/12-db-schema.md (rules in docs/03-data-model-rls.md, terms in CONTEXT.md). Every RLS rule needs a test that runs in CI.

## Edge Functions

### `media` (profile photo links, #35)

Signs Cloudflare R2 upload and download URLs; the rules are in the database functions (`start_photo_upload`, `confirm_photo_upload`, `photo_links`, see docs/12) and `functions/media/handler.ts`. `index.ts` only wires in Supabase, R2 and the clock. The HTTP contract is in tasks/todo.md ("Media links (#35)") and docs/02.

Uploads go to a staging key `uploads/<member id>/<photo id>.jpg`; confirming copies the file to the live key `<member id>/<photo id>.jpg` and deletes the staged one.

**R2 lifecycle rule (founder, Cloudflare dashboard):** R2 → the bucket → Settings → Object lifecycle rules → Add rule: name `expire-staged-uploads`, prefix `uploads/`, action "Delete objects" after **1 day**. It removes staged uploads that were never confirmed (the app quit between the PUT and the confirm). Don't widen it beyond `uploads/`: live photos sit at the bucket root.

Secrets: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (template: `functions/.env.example`). `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` come from Supabase.

Tests (no network or database needed; CI runs them in `.github/workflows/functions.yml`):

```bash
cd supabase/functions/media
deno test          # handler rules and SigV4 against AWS's published examples
deno fmt --check && deno lint && deno check index.ts
```

Run locally against the local stack and the real bucket:

```bash
cp supabase/functions/.env.example supabase/functions/.env   # fill in the R2 values (gitignored)
npx supabase functions serve media --env-file supabase/functions/.env </dev/null
# POST http://127.0.0.1:54321/functions/v1/media with Authorization: Bearer <user access token>
```

Deploy (after the migration is pushed):

```bash
npx supabase secrets set --env-file supabase/functions/.env --project-ref <ref>
npx supabase functions deploy media --project-ref <ref>
```

`config.toml` sets `verify_jwt = false` for `media`: the function verifies the caller itself (Auth `getUser`), so a signed-out request gets its own `{ "error": "sign in first" }`.

## Continuous deployment

`.github/workflows/deploy.yml` deploys to the hosted project automatically on every push to `main` that touches `supabase/migrations/**` or `supabase/functions/**`: it links the project, runs `supabase db push` (applies only new migrations), and redeploys the `media` function when a function file changed. PRs are gated by `db-tests` / `function-tests` before merge, so only tested changes reach it.

Requires three GitHub Actions secrets (Settings → Secrets and variables → Actions):
- `SUPABASE_ACCESS_TOKEN` — a personal access token from the Supabase dashboard (Account → Access Tokens).
- `SUPABASE_DB_PASSWORD` — the project's database password.
- `SUPABASE_PROJECT_REF` — the project ref.

Not auto-deployed: auth/SMTP settings in `config.toml` (`supabase config push`) and R2/function secrets (`supabase secrets set`) — applied by hand, since they change rarely and the free tier limits email-template pushes.
