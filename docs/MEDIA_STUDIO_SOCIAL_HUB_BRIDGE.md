# Media Studio to Social Hub bridge

## Outcome

CAIOS Media Studio can create a sanitized `media-package.v1` JSON envelope for an already verified local render job. CAIOS Social Hub can validate and import that envelope, record media rights, authorize a private review upload, verify the expected private Storage objects, create a media-bound social draft, and record an approval snapshot covering the exact text and media hashes.

No publishing, scheduling, auto-posting, webhook delivery, or platform-write scope is added by this bridge.

## Safety boundaries

1. Creating `media-package.v1` is local and sends nothing.
2. Importing the package sends sanitized metadata only. Local paths, source paths, credentials, signed URLs, and mutable review history are excluded.
3. Uploading the MP4 files to the private `caios-media-review` bucket is a separate external transmission. It requires an explicit, single-use authorization from the bound final approver for the exact package hash, object paths, byte sizes, MIME types, and SHA-256 values. The authorization covers one resumable TUS session for up to 24 hours, matching Supabase's resumable-session lifetime; trusted verification must finish before that deadline.
4. Private upload authorization does not approve social publication.
5. Social approval is bound to the title, captions, fixed Facebook and Instagram destinations, producer package hash, rights evidence, exact Storage paths, artifact hashes, sizes, dimensions, duration, and audio choice.
6. The bucket remains private. Review URLs are generated server-side for five minutes and are never stored in application tables.
7. Authenticated clients receive no update or delete policy for review objects and no direct mutation grants on media metadata tables.
8. Final social approval is restricted to the exact Supabase user UUID bound in a separate environment activation transaction. The schema migration leaves the singleton binding empty and therefore fails closed until that explicit step; names, emails, roles, and user metadata are not authorization inputs.

## Current workflow

```text
verified local render
  -> local media-package.v1
  -> authenticated metadata import
  -> explicit private-upload authorization
  -> immutable private Storage upload
  -> object size/MIME verification
  -> media-bound Social Draft
  -> exact hash review and approval
  -> STOP (no delivery connector in this milestone)
```

## Resumable private uploader

The browser checks each selected file's byte size, MP4 type, and SHA-256 before transmitting it. The MVP caps each artifact at 64 MiB so this browser-side hash check does not attempt to buffer Supabase's much larger general Storage limit. It then uses the TUS protocol against the exact Supabase direct Storage origin in 6 MB chunks, retains only a validated resumable upload URL in session storage, rejects redirects, retries bounded failures, and never uses `upsert`. The authenticated access token is forwarded only to the validated Storage upload URL.

Finalization is server-only. The authenticated server downloads each private object through a short-lived signed URL, streams its bytes through SHA-256, compares the exact size and digest to the immutable authorization plan, and then calls a service-role-only database finalizer. Browser clients cannot directly mark artifacts verified. The service-role key remains inside the existing server-only environment boundary.

## Operational activation

Applying the migration and deploying the app are separate operational changes for CAIOS Staging and Vercel Preview. Importing a package and uploading the current concert video remain separate actions; no media file may be transmitted without an explicit authorization for that exact private upload.

After applying the schema, an operator must query the intended profile UUID, verify it independently, and insert that exact UUID into the singleton `social_final_approvers` row with the same UUID as `bound_by`. The insert and a `social_final_approver_bound` audit event must occur in one transaction. Activation must then verify there is exactly one row, that it matches the independently checked UUID, and that `is_current_social_final_approver()` returns true only in that user's authenticated session. Never discover or bind this principal from an email, display name, role, or user metadata.
