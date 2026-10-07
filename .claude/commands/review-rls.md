Review the SQL migrations changed in this branch against docs/03-data-model-rls.md and CLAUDE.md hard rules.
Check: RLS enabled on every new table, default deny, no direct reads of other users' rows, is_blocked() used where required, security definer functions set a fixed search_path, and every policy has a test. List violations first, then suggested fixes.
