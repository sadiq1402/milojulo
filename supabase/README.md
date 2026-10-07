# Supabase

- `migrations/`: all schema changes as SQL files, applied with the Supabase CLI. Never edit the schema from the dashboard.
- `functions/`: Edge Functions in TypeScript (media signing, push, webhooks, media checks, admin actions).

The schema is in docs/12-db-schema.md (rules in docs/03-data-model-rls.md, terms in CONTEXT.md). Every RLS rule needs a test that runs in CI.
