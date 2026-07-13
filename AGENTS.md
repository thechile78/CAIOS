# CAIOS Engineering Instructions

## Product purpose

Build a secure internal newsroom application for Chilemaniacs.com.

## Non-negotiable editorial rules

1. AI may discover, cluster, score, summarize, draft, and recommend.
2. Nothing publishes automatically.
3. The Chile must approve WordPress drafts and all public or social content.
4. Never invent facts, quotes, dates, identities, or sources.
5. Preserve source URLs and citation metadata.
6. Images must be original, licensed, royalty-free, or official press assets.

## Engineering rules

- Inspect the repository before changing code.
- Make incremental, reviewable changes.
- Keep secrets in environment variables.
- Never expose service-role keys or publishing credentials to client code.
- Validate API inputs and return consistent JSON responses.
- Preserve authentication, authorization, audit logging, and approval gates.
- Keep the interface mobile-friendly and accessible.
- Add or update tests for business-critical logic.
- Run lint, typecheck, tests, and production build before declaring a task complete.

## Preferred architecture

- Frontend: Next.js + TypeScript
- Database/Auth: Supabase
- Public CMS: WordPress
- AI: OpenAI API through server-side routes
- Analytics: GA4 + Google Search Console
- Hosting: Vercel

## Required completion report

For every implementation task, report:

- Files changed
- Commands run
- Test/build results
- Remaining blockers
- Recommended next task
