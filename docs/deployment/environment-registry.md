# CAIOS Environment Registry

This file is the authoritative registry for CAIOS infrastructure. Always verify the Supabase project reference and Vercel project ID before migrations, user invitations, role assignments, or deployment changes.

## Canonical staging environment

- Purpose: CAIOS application development, authentication testing, workflow QA, and migration validation
- Supabase project name: `CAIOS Staging`
- Supabase project reference: `ozucetngucaerxjziily`
- Supabase API URL: `https://ozucetngucaerxjziily.supabase.co`
- Expected schema: full CAIOS workflow schema with profiles, stories, sources, editorial checklists, approvals, audit events, publication records, handoffs, immutable packages, and WordPress draft outbox
- Migration ledger: tracked under `supabase/migrations/`
- Current administrator profile: `thechile@gmail.com` after account confirmation

## Legacy newsroom environment

- Purpose: legacy Chilemaniacs newsroom prototype only
- Supabase project name: `chilemaniacs-newsroom`
- Supabase project reference: `xnkwsfwkklkhkfphxgsk`
- Supabase API URL: `https://xnkwsfwkklkhkfphxgsk.supabase.co`
- Existing schema: legacy `stories`, `analytics_snapshots`, `category_performance`, and `seo_opportunities` tables
- Status: do not use for CAIOS authentication, migrations, administrator invitations, or new application deployment until an explicit migration/decommission decision is approved

## Canonical Vercel deployment

- Team: `Chile`
- Project: `caios-tepq`
- Project ID: `prj_e0oTXHGSGB89TLA0PWhzGrkwzExw`
- Canonical application URL: `https://caios-tepq.vercel.app`
- Additional aliases may resolve to the same deployment, including `https://caios-tepq-chile.vercel.app`, but all documentation and authentication redirects should use the canonical URL above.

## Required deployment binding

The CAIOS Vercel project must use:

```text
NEXT_PUBLIC_SUPABASE_URL=https://ozucetngucaerxjziily.supabase.co
```

The matching publishable/anonymous key must come from the same `CAIOS Staging` project. Never combine a URL from one Supabase project with a key from another.

## Preflight checks

Before any database or authentication operation:

1. Confirm the Supabase project reference is `ozucetngucaerxjziily`.
2. Confirm the Vercel project ID is `prj_e0oTXHGSGB89TLA0PWhzGrkwzExw`.
3. Confirm the canonical redirect is `https://caios-tepq.vercel.app`.
4. Confirm the migration ledger exists and matches the repository.
5. Stop immediately if an invitation or URL contains `xnkwsfwkklkhkfphxgsk`; that identifies the legacy project.

## Change control

Any future change to these mappings must update this file in the same pull request or commit. Do not delete, pause, migrate, or repurpose the legacy project without an explicit backup and decommission plan.