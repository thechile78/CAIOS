# CAIOS Social Hub

CAIOS Social Hub is the approval-first publishing control plane for CAIOS Media Studio.

## Non-negotiable safety rules

1. No social account passwords are stored in CAIOS.
2. Only official OAuth or platform-approved connectors may be used.
3. Every generated post starts in `draft` status.
4. Publishing requires an explicit approval event from The Chile.
5. Tokens must be encrypted at rest, scoped to the minimum permissions, and revocable.
6. Automatic publishing remains disabled in v1.
7. Every action is written to an audit log.

## v1 workflow

`media ready -> draft package -> automated checks -> human review -> approval -> optional scheduling -> publish connector`

## Initial platform priority

1. WordPress
2. YouTube
3. Facebook Pages
4. Instagram Business
5. Threads
6. LinkedIn
7. X
8. TikTok

## Status model

- `draft`
- `qa_failed`
- `ready_for_review`
- `changes_requested`
- `approved`
- `scheduled`
- `publishing`
- `published`
- `publish_failed`
- `rejected`

A post cannot move from `draft` to `approved` without all required checks and a recorded human approval.
