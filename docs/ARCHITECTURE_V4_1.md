# CAIOS v4.1 Consolidated Architecture

## Objective

CAIOS v4.1 begins the transition from isolated milestone modules into one cohesive newsroom application.

## Canonical Layers

1. **Domain** — shared newsroom types and vocabulary.
2. **Workflow** — legal editorial transitions and approval gates.
3. **Application APIs** — validation, health, and future service orchestration.
4. **Interface** — one command center consuming the shared domain model.
5. **Integrations** — Supabase, OpenAI, Google, WordPress, and notifications.

## Canonical Editorial Lifecycle

Discovery → Verification → Research → Draft → Fact Check → SEO Review → Human Approval → WordPress Draft → Published

The application must not create a WordPress draft unless every publishing-gate requirement is complete.

## Publishing-Gate Requirements

- Sources verified
- Facts checked
- Image rights cleared
- SEO complete
- Accessibility reviewed
- Human approval recorded

## Consolidation Rules

- New features must import shared domain types from `lib/domain.ts`.
- Workflow decisions must use `lib/workflow.ts` rather than duplicating stage logic.
- API endpoints must validate input and return structured errors.
- Health endpoints must never expose environment variables or credentials.
- External writes remain disabled until authentication, authorization, audit logging, and integration tests are complete.

## Migration Sequence

1. Replace duplicated workflow arrays with `editorialStages`.
2. Replace local story interfaces with the canonical `Story` type.
3. Route every stage change through `validateTransition`.
4. Connect the command center to one persistence layer.
5. Add role-based access and audit logs.
6. Connect integrations one at a time behind approval gates.

## Current Scope

This milestone establishes the architectural spine. It does not deploy the application or connect live publishing services.
