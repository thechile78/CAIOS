# Supabase migration reconciliation — 2026-08-28

## Decision

Use a **forward-only reconciliation** from the current live staging schema. Do not
repair or rewrite remote migration history, and do not apply this migration to
staging or production without explicit approval.

The repository and Supabase staging migration ledgers differ in timestamps and
granularity. Staging contains split foundation migrations and additional
operational migrations that are not represented one-for-one locally, including
administrator promotion, command-center read models, the original social OAuth
setup, and the media package bridge. The current live schema is therefore the
comparison baseline; historical filenames are evidence, not a safe replay plan.

## Advisor classification

| Finding | Count | Classification | Action |
| --- | ---: | --- | --- |
| Mutable `search_path` on `set_updated_at_timestamp()` | 1 warning | Actionable | Set an empty function search path in the reconciliation migration. |
| Signed-in execution of `SECURITY DEFINER` RPCs | 17 warnings | Intentional, review periodically | Preserve. Every live function checks `auth.uid()` and an application role or final-approver condition. These RPCs enforce approval and workflow transitions that ordinary table writes cannot safely perform. |
| Leaked-password protection disabled | 1 warning | Dashboard configuration | Enable separately in Supabase Auth after plan/availability confirmation; it is not a schema migration. |
| RLS enabled with no policies | 3 informational | Intentional deny-by-default | Preserve for `search_console_connections`, `social_oauth_connections`, and `social_final_approvers`. Browser roles have no table grants; server operations use the service role. |
| Unindexed foreign key | 1 informational | Actionable | Add `search_console_connections_connected_by_idx`. |
| Unused indexes | 45 informational | Insufficient evidence | Preserve. Staging traffic is too sparse to establish that these indexes are unnecessary. |

Supabase references:

- [Function search-path advisor](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [Authenticated SECURITY DEFINER advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Unindexed foreign-key advisor](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
- [Leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## Pre-apply validation

1. Review `20260828003702_reconcile_supabase_advisors.sql` and confirm the target
   is CAIOS Staging (`ozucetngucaerxjziily`).
2. Apply only with separate authorization.
3. Re-run Supabase security and performance advisors.
4. Confirm the mutable-search-path and unindexed-foreign-key findings are gone.
5. Exercise authenticated editorial, social approval, WordPress dispatch, and
   Search Console connection flows before promoting the same migration.

## Expected residual findings

The 17 authenticated privileged-RPC warnings, three deny-by-default RLS notices,
and unused-index notices are expected to remain. A change in function grants,
authorization predicates, exposed schemas, or sustained query statistics should
trigger a new review rather than an automatic suppression or index removal.
