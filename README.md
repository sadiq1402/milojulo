# MiloJulo

[![Database tests](https://github.com/sadiq1402/milojulo/actions/workflows/database.yml/badge.svg?branch=main)](https://github.com/sadiq1402/milojulo/actions/workflows/database.yml)

Find your people. Intent-first social discovery for Pune.

This repository starts as a context pack so Claude Code (and humans) can pick up exactly where the product and design work left off.

- `CLAUDE.md`: the file Claude Code loads automatically
- `docs/`: product, scope, architecture, data model, safety, UI standards, decisions, open questions, build plan
- `design/`: design tokens and static HTML references for every screen
- `apps/mobile`, `apps/admin`, `supabase/`: empty placeholders for the code

## Database tests
pgTAP tests in `supabase/tests/` act as a Member or admin (helpers in `supabase/tests/helpers/`) and use only public functions and tables under RLS.

```bash
npx supabase db start   # local Postgres with every migration applied (Docker)
npx supabase db reset   # re-apply migrations from scratch
npx supabase test db    # run all tests
```

GitHub Actions (`.github/workflows/database.yml`) runs them on every pull request and again on every push to `main`. Edge Function and mobile test jobs join the same workflow when they arrive.

## Using it with Claude Code
1. Create a Git repo from this folder and open a terminal in the root.
2. Run `claude`. It reads `CLAUDE.md` and the docs it imports.
3. Start with: "Read docs/10-build-plan.md and do the first-week foundations, one step at a time."

Private links to the original work (visible only to the author's account):
- V1 plan doc: https://claude.ai/code/artifact/5ae6bdea-62f1-49bb-b516-03c06627a7c6
- Screen designs canvas: https://claude.ai/artifact/CUiLCrHKpSmoQ8SSF6aY7x
