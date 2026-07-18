# CAIOS Social Hub — Security and Rollout Plan

## Objective

Connect official social accounts to CAIOS while preserving final human approval for every publication.

## Security baseline

- OAuth only; never collect social passwords.
- Store refresh/access tokens through encrypted secret storage, never in source control or browser local storage.
- Request the smallest permission set needed.
- Keep production and staging credentials separate.
- Validate OAuth `state` and PKCE where supported.
- Rotate secrets and revoke unused connections.
- Log approvals and publishing attempts without logging secrets.
- Require re-approval whenever the media, caption, destination, link, thumbnail, or schedule changes after approval.

## Release stages

### Stage 1 — Draft management

- Save video package, caption, hashtags, thumbnail and platform variants.
- Run technical and editorial QA.
- Present a final preview.
- No external publishing.

### Stage 2 — WordPress drafts

- Create unpublished WordPress drafts only.
- The Chile reviews the draft before any publication.

### Stage 3 — YouTube private/unlisted test

- Upload a private or unlisted test video only after explicit approval.
- Verify platform transcoding, title, description, thumbnail and audio.

### Stage 4 — Meta test assets

- Connect a Facebook Page and linked Instagram Business account through official Meta OAuth.
- Create a single approved test publication or schedule.
- Confirm the resulting post and audit record.

### Stage 5 — Additional platforms

Add Threads, LinkedIn, X and TikTok individually after each connector passes security, permission, staging and rollback checks.

## Approval gate

A publish action is blocked unless all conditions are true:

1. Required QA checks pass.
2. Music and visual rights are attested.
3. The content hash matches the version that was reviewed.
4. The Chile explicitly approves the selected platforms.
5. The approval is recorded in the audit log.
6. The access token is valid and limited to the correct brand account.

Any edit after approval invalidates the approval and returns the item to `ready_for_review`.

## Immediate next operational steps

1. Apply the database schema to the Supabase staging project.
2. Build the draft queue and approval screen.
3. Connect WordPress in draft-only mode.
4. Connect YouTube and test with private/unlisted visibility.
5. Connect Facebook Pages and Instagram Business through Meta OAuth.
6. Keep every other connector disabled until its acceptance test passes.
