# CAIOS v4.0 Implementation Plan

## Objective

Turn the existing Chilemaniacs newsroom modules into one cohesive AI Editorial Command Center.

## Release 4.0 Scope

### 1. Command Center Shell
- Unified navigation
- KPI cards
- Breaking-news panel
- Editorial queue
- Site-health summary
- Analytics summary
- Approval queue
- Activity log

### 2. Story Intelligence
- Trusted-source monitoring
- Source verification
- Duplicate detection
- Cross-source clustering
- Story scoring
- Houston relevance
- Alert generation

### 3. Editorial Workflow
- Discovery
- Verification
- Research
- Draft
- Fact Check
- SEO Review
- Ready for Approval
- WordPress Draft
- Published

### 4. AI Editorial Tools
- Article draft
- SEO title
- Meta description
- Slug
- Categories and tags
- Social copy
- Newsletter copy
- Internal-link suggestions
- Image-rights guidance
- Fact-check checklist

### 5. Publishing Controls
- Human approval gate
- Facts verified gate
- Image rights gate
- SEO complete gate
- WordPress draft creation only
- No automatic public publishing

### 6. Analytics and Site Health
- GA4
- Search Console
- Core Web Vitals
- Sitemap health
- Broken links and 404s
- Category performance
- Content refresh opportunities

### 7. Administration
- Authentication
- Roles and permissions
- Source configuration
- Audit log
- Environment validation
- System-health checks

## Execution Order

### Milestone 4.0.1 — Repository and CI Foundation
- Next.js application shell
- TypeScript strict mode
- Environment template
- ESLint
- Unit tests
- GitHub Actions CI
- Branch and pull-request workflow

### Milestone 4.0.2 — Data and Authentication
- Supabase schema
- Auth guard
- Admin and Editor roles
- Story, draft, source, alert, analytics, and audit tables

### Milestone 4.0.3 — Unified Command Center
- Dashboard shell
- Live KPIs
- Editorial queue
- Alerts
- Activity log

### Milestone 4.0.4 — Editorial Workflow
- Live story pipeline
- Status transitions
- Validation rules
- Approval controls

### Milestone 4.0.5 — AI and WordPress
- AI draft package
- Citation preservation
- WordPress draft creation
- Draft URL persistence

### Milestone 4.0.6 — Analytics and Site Health
- GA4 and Search Console
- Crawl and sitemap monitoring
- Performance recommendations

### Milestone 4.0.7 — Staging Readiness
- End-to-end tests
- Security review
- Accessibility review
- Deployment documentation
- Staging deployment approval

## Definition of Done

A milestone is complete only when:

- Code is reviewed through a pull request.
- Lint passes.
- Typecheck passes.
- Tests pass.
- Production build passes.
- Publishing approval gates remain intact.
- No credentials are committed.
- Documentation is updated.
