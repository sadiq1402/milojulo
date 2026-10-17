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

## Scheduled jobs (pg_cron)

- `expire-activities` (every 15 minutes): SQL only.
- `purge-chat-media` (daily, 21:30 UTC = 03:00 India time, #20): calls the `purge-chat-media` Edge Function over `pg_net` with the service role. The function itself is not built yet, so until it is deployed each run gets a 404 (harmless; see `net._http_response`).
- `account-purge` (hourly at :15, #96): calls the `account-purge` Edge Function the same way. It needs the R2 secrets the `media` function uses (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`); the R2 key must be allowed to delete objects.
- `send-meet-nudges` (daily, 05:30 UTC = 11:00 India time, #50): SQL only.

**Vault secrets (founder, once per project):** the job reads the project URL and service role key from Vault, so neither is in git. In the dashboard SQL editor of the hosted project:

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<service role key>', 'service_role_key');
```

To change one later: `select vault.update_secret((select id from vault.secrets where name = 'service_role_key'), '<new key>');`. Without them the job's URL is null and the request fails without doing anything.

If the nightly purge seems not to run, check `select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'purge-chat-media') order by start_time desc limit 5;` (did the job run and queue the request), then `net._http_response` (the HTTP status) and the `purge-chat-media` function logs in the dashboard.

## Push notifications (#36)

Queued pushes reach the `push` Edge Function through the same Vault secrets as the purge job above (`project_url`, `service_role_key`); without them pushes wait in `push_queue` and nothing is sent. The function needs a Firebase service account (Firebase console → Project settings → Service accounts → Generate new private key). Store the whole JSON as one secret, never in the repo:

```bash
printf 'FCM_SERVICE_ACCOUNT=%s\n' "$(jq -c . service-account.json)" > /tmp/push.env
npx supabase secrets set --env-file /tmp/push.env && rm /tmp/push.env
```

or paste it in the dashboard (Edge Functions → Secrets) as `FCM_SERVICE_ACCOUNT`. If pushes stop, check `net._http_response` for the call and the `push` function logs.

## Continuous deployment

`.github/workflows/deploy.yml` deploys to the hosted project automatically on every push to `main` that touches `supabase/migrations/**` or `supabase/functions/**`: it links the project, runs `supabase db push` (applies only new migrations), and redeploys the `media` function when a function file changed. PRs are gated by `db-tests` / `function-tests` before merge, so only tested changes reach it.

Requires three GitHub Actions secrets (Settings → Secrets and variables → Actions):
- `SUPABASE_ACCESS_TOKEN` — a personal access token from the Supabase dashboard (Account → Access Tokens).
- `SUPABASE_DB_PASSWORD` — the project's database password.
- `SUPABASE_PROJECT_REF` — the project ref.

Not auto-deployed: auth/SMTP settings in `config.toml` (`supabase config push`) and R2/function secrets (`supabase secrets set`) — applied by hand, since they change rarely and the free tier limits email-template pushes.
