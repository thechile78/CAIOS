# CAIOS controlled launch runbook

## Release gates

Do not launch until all gates are complete:

1. CI and CodeQL pass on the exact release commit.
2. All Supabase migrations are applied and verified in staging.
3. Role and RLS tests pass for administrator, editor, producer, researcher, reviewer, and read-only users.
4. The complete editorial flow passes in staging: create, edit, checklist, approval, handoff, immutable package, draft outbox, and manual WordPress draft dispatch.
5. WordPress dispatch first passes in dry-run mode and then creates a real **draft** in staging.
6. No automatic publishing or scheduling capability is enabled.
7. Database backup and restore are tested.
8. Monitoring, error logging, and an incident owner are assigned.

## Required secret-store values

Never commit these values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- server-side Supabase secrets required by the hosting environment
- `CAIOS_WORDPRESS_URL`
- `CAIOS_WORDPRESS_USERNAME`
- `CAIOS_WORDPRESS_APPLICATION_PASSWORD`

## Safe activation sequence

1. Deploy to a private staging URL.
2. Keep `CAIOS_WORDPRESS_DRAFT_OUTBOX_ENABLED=false` and `CAIOS_WORDPRESS_DRAFT_DISPATCH_ENABLED=false` for initial application testing.
3. Enable the outbox and verify payload previews.
4. Enable dispatch with `CAIOS_WORDPRESS_DRY_RUN=true`.
5. Run the full staging acceptance plan.
6. Set `CAIOS_WORDPRESS_DRY_RUN=false` only in staging and create one WordPress draft.
7. Confirm the WordPress item is a draft and has no scheduled date.
8. Deploy the same verified commit to production.
9. Keep dispatch disabled until production health, authentication, RLS, and audit checks pass.
10. Enable manual draft dispatch for administrators and editors only.

## Rollback

1. Set `CAIOS_WORDPRESS_DRAFT_DISPATCH_ENABLED=false` immediately.
2. Set `CAIOS_WORDPRESS_DRAFT_OUTBOX_ENABLED=false` if draft-intent creation must also stop.
3. Roll back the application to the previous verified release.
4. Do not reverse destructive database migrations automatically. Use the documented migration-specific rollback after a backup.
5. Review audit events and WordPress drafts created during the incident window.
6. Rotate WordPress and Supabase credentials if exposure is suspected.

## Launch exclusions

CAIOS must not automatically publish, schedule posts, upload media, retry failed dispatches without a human action, or expose service-role credentials to the browser.
