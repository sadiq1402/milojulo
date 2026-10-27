# Supabase

- `migrations/`: all schema changes as SQL files, applied with the Supabase CLI. Never edit the schema from the dashboard.
- `functions/`: Edge Functions in TypeScript (Deno): `media` (photo and chat media links), `push` (FCM), `account-purge` and `purge-chat-media` (R2 deletes), with shared R2 and SigV4 code in `_shared/`. Admin actions are SQL functions, not Edge Functions.
- `tests/`: pgTAP tests, one file per area; `tests/helpers/act_as.psql` acts as a Member, admin or signed-out visitor.
- `seed/`: the Reviewer Account seed (`reviewer.sql`) and local-only test data (`seed/dev/`).

Local database (Docker): `npx supabase db start`, `npx supabase db reset` (re-applies every migration), `npx supabase test db` (CI runs the same as `db-tests` in `.github/workflows/database.yml`). Pass `</dev/null` when not in a terminal.

The schema is in docs/12-db-schema.md (rules in docs/03-data-model-rls.md, terms in CONTEXT.md). Every RLS rule needs a test that runs in CI.

## Edge Functions

### `media` (profile photo and chat media links, #35, #12)

Signs Cloudflare R2 upload and download URLs; the rules are in the database functions (`start_photo_upload`, `confirm_photo_upload`, `delete_photo`, `photo_links`, `start_chat_upload`, `confirm_chat_upload`, `chat_media_links`, see docs/12) and `functions/media/handler.ts`. `index.ts` only wires in Supabase, R2 and the clock. The HTTP contract is in tasks/todo.md ("Media links (#35)") and docs/02.

Uploads go to a staging key (`uploads/<member id>/<photo id>.jpg`, or `uploads/chat/<connection id>/<upload id>.<ext>` for chat media); confirming copies the file to the live key (`<member id>/<photo id>.jpg`, `chat/<connection id>/<upload id>.<ext>`) and deletes the staged one.

**R2 lifecycle rule (founder, Cloudflare dashboard):** R2 → the bucket → Settings → Object lifecycle rules → Add rule: name `expire-staged-uploads`, prefix `uploads/`, action "Delete objects" after **1 day**. It removes staged uploads that were never confirmed (the app quit between the PUT and the confirm). Don't widen it beyond `uploads/`: live photos sit at the bucket root and live chat media under `chat/`.

Secrets: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (template: `functions/.env.example`). `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` come from Supabase.

Tests (no network or database needed). CI runs these in every function folder (`_shared`, `media`, `push`, `account-purge`, `purge-chat-media`) as `function-tests` in `.github/workflows/functions.yml`:

```bash
cd supabase/functions/media    # or _shared (SigV4 against AWS's published examples), push, account-purge, purge-chat-media
deno test                      # handler rules
deno fmt --check && deno lint && deno check *.ts
```

Run locally against the local stack and the real bucket:

```bash
cp supabase/functions/.env.example supabase/functions/.env   # fill in the R2 values (gitignored)
npx supabase functions serve media --env-file supabase/functions/.env </dev/null
# POST http://127.0.0.1:54321/functions/v1/media with Authorization: Bearer <user access token>
```

Deploy by hand (the deploy workflow below does this on merge; secrets are always set by hand):

```bash
npx supabase secrets set --env-file supabase/functions/.env --project-ref <ref>
npx supabase functions deploy media --project-ref <ref>
```

`config.toml` sets `verify_jwt = false` for all four functions. `media` verifies the caller itself (Auth `getUser`), so a signed-out request gets its own `{ "error": "sign in first" }`; `push`, `account-purge` and `purge-chat-media` accept only `Authorization: Bearer <service role key>` and answer `service role only` to anything else.

## Scheduled jobs (pg_cron)

- `expire-activities` (every 15 minutes): SQL only (`expire_activities()`).
- `purge-chat-media` (daily, 21:30 UTC = 03:00 India time, #20): calls the `purge-chat-media` Edge Function over `pg_net` with the service role. The function (#97) deletes up to 100 s of work per run (batches of 500, 8 deletes at a time); anything left, or a file whose delete failed, is picked up the next night. It uses the `media` function's R2 secrets and needs delete permission.
- `account-purge` (hourly at :15, #96): calls the `account-purge` Edge Function the same way. It needs the R2 secrets the `media` function uses (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`); the R2 key must be allowed to delete objects.
- `send-meet-nudges` (daily, 05:30 UTC = 11:00 India time, #50): SQL only (`send_meet_nudges()`); its pushes go through `push_queue` like any other.
- `retry-queued-pushes` (every 5 minutes, #167): SQL only (`retry_queued_pushes()`); hands pushes still queued after a minute to the push function again (same Vault secrets) and drops ones an hour old.

**Vault secrets (founder, once per project):** the purge jobs, evidence copies and push dispatch read the project URL and the call secret from Vault, so neither is in git. The call secret is a random string shared with the four functions as `DISPATCH_SECRET`; it is ours, not a Supabase key, so rotating Supabase's keys never breaks these calls. (Its Vault entry keeps the old name `service_role_key`.) Generate one, set it on the functions, then in Vault:

```bash
openssl rand -hex 32 > ~/dispatch-secret.txt && chmod 600 ~/dispatch-secret.txt
printf 'DISPATCH_SECRET=%s\n' "$(cat ~/dispatch-secret.txt)" > /tmp/d.env && npx supabase secrets set --env-file /tmp/d.env && rm /tmp/d.env
```

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<the call secret>', 'service_role_key');
```

To change it later: set the new `DISPATCH_SECRET` first, then `select vault.update_secret((select id from vault.secrets where name = 'service_role_key'), '<new secret>');`. Without these the calls fail: a missing URL does nothing, a mismatched secret gets `401 service role only` in `net._http_response`.

If the nightly purge seems not to run, check `select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'purge-chat-media') order by start_time desc limit 5;` (did the job run and queue the request), then `net._http_response` (the HTTP status) and the `purge-chat-media` function logs in the dashboard.

## Push notifications (#36)

A trigger on `push_queue` hands each new row to the `push` Edge Function over `pg_net`, using the same Vault secrets as the purge jobs above (`project_url`, `service_role_key`); without them pushes wait in `push_queue`. The `retry-queued-pushes` job (every 5 minutes) sends again anything still queued after a minute, and drops pushes an hour old. The function needs a Firebase service account (Firebase console → Project settings → Service accounts → Generate new private key). Store the whole JSON as one secret, never in the repo:

```bash
printf 'FCM_SERVICE_ACCOUNT=%s\n' "$(jq -c . service-account.json)" > /tmp/push.env
npx supabase secrets set --env-file /tmp/push.env && rm /tmp/push.env
```

or paste it in the dashboard (Edge Functions → Secrets) as `FCM_SERVICE_ACCOUNT`. If pushes stop, check `net._http_response` for the call and the `push` function logs.

## Continuous deployment

`.github/workflows/deploy.yml` deploys to the hosted project automatically on every push to `main` that touches `supabase/migrations/**` or `supabase/functions/**`: it links the project, runs `supabase db push` (applies only new migrations), and redeploys all four functions (`media`, `push`, `account-purge`, `purge-chat-media`) when a function file changed. PRs are gated by `db-tests` / `function-tests` before merge, so only tested changes reach it.

Requires three GitHub Actions secrets (Settings → Secrets and variables → Actions):
- `SUPABASE_ACCESS_TOKEN` — a personal access token from the Supabase dashboard (Account → Access Tokens).
- `SUPABASE_DB_PASSWORD` — the project's database password.
- `SUPABASE_PROJECT_REF` — the project ref.

Not auto-deployed: auth/SMTP settings in `config.toml` (`supabase config push`; the hosted project's SMTP, Resend, and rate limits are under `[remotes.cloud]`, with the SMTP password from `SMTP_PASS` in the gitignored root `.env`), R2 and FCM function secrets (`supabase secrets set`), the Vault secrets and the R2 lifecycle rule — applied by hand, since they change rarely and the free tier limits email-template pushes.

## Seeds

- Reviewer Account (store review), once per environment after creating its auth user: `psql "$DB_URL" -v reviewer_id=<auth user id> -f supabase/seed/reviewer.sql`. Rerun it when a consent document gets a new version (decision 41).
- `seed/dev/*.sql`: local development only (a chat partner, Activity partners, Circles); each file's header says how to run it. Never run them against a hosted project.

## The `evidence/` prefix in R2

Reported media is copied to `evidence/<report id><ext>` by the `copy-evidence` function (#160,
decision 62), and that copy is the evidence an admin opens. Keep the `uploads/` lifecycle rule off
this prefix: a rule that deleted `evidence/` after a day would throw away the safety record. Evidence
is meant to go 90 days after the report, by a scheduled job (not built yet, #160).
