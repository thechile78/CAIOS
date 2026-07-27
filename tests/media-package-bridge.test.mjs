import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20260719213630_media_package_bridge.sql";
const hardeningMigrationPath = "supabase/migrations/20260719213831_media_bridge_post_apply_hardening.sql";

test("media bridge uses private immutable storage and explicit ingestion authorization", async () => {
  const migration = await read(migrationPath);
  assert.match(migration, /'caios-media-review'[\s\S]+false/);
  assert.match(migration, /private_upload_authorized/);
  assert.match(migration, /purpose = 'private_review'/);
  assert.match(migration, /ingest_auth\.used_at is null/);
  assert.match(migration, /ingest_auth\.expires_at > now\(\)/);
  assert.match(migration, /ingest_auth\.object_plan/);
  assert.match(migration, /public\.is_current_social_final_approver\(\)/);
  assert.ok(
    migration.indexOf("create or replace function public.is_current_social_final_approver")
      < migration.indexOf('create policy "authorized user uploads exact private review objects"'),
  );
  assert.match(migration, /object_path text not null unique/);
  assert.doesNotMatch(migration, /upsert/i);
});

test("media metadata is normalized, constrained, and read-only to authenticated clients", async () => {
  const migration = await read(migrationPath);
  for (const table of ["media_packages", "media_artifacts", "media_ingest_authorizations", "social_draft_artifacts"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} force row level security`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`));
    assert.match(migration, new RegExp(`grant select on table public\\.${table} to authenticated`));
  }
  assert.match(migration, /object_path !~ '\(\^\/\|\\\.\\\.\|:\/\//);
  assert.match(migration, /sha256 ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(migration, /mime_type = 'video\/mp4'/);
  assert.doesNotMatch(migration, /grant (insert|update|delete) on table public\.media_/i);
});

test("social approval binds captions, destinations, rights evidence, and verified media hashes", async () => {
  const migration = await read(migrationPath);
  assert.match(migration, /CAIOS_SOCIAL_APPROVAL_V2/);
  assert.match(migration, /1214069685123391/);
  assert.match(migration, /17841403279084160/);
  assert.match(migration, /producer_package_hash/);
  assert.match(migration, /rights_evidence_hash/);
  assert.match(migration, /artifact\.sha256/);
  assert.match(migration, /artifact\.audio_choice/);
  assert.match(migration, /approval_payload/);
  assert.match(migration, /content_hash.*approval_payload/s);
  assert.match(migration, /social_final_approvers/);
  assert.match(migration, /singleton boolean primary key/);
  assert.match(migration, /one_active_media_package_idx/);
  assert.doesNotMatch(migration, /array_agg\(id|where active = true and role = 'administrator'/);
  assert.match(migration, /p_decision = 'approved' and not public\.is_current_social_final_approver\(\)/);
  assert.match(migration, /Each captioned platform requires exactly one verified primary artifact/);
  assert.match(migration, /extensions\.digest\(v_payload::text/);
  assert.doesNotMatch(migration, /user_metadata|display_name.*social_final_approvers|email.*social_final_approvers/i);
});

test("resumable uploader verifies exact files and keeps publication out of scope", async () => {
  const uploader = await read("app/social-drafts/private-media-uploader.tsx");
  assert.match(uploader, /storage\.supabase\.co/);
  assert.match(uploader, /\/storage\/v1\/upload\/resumable/);
  assert.match(uploader, /chunkSize = 6 \* 1024 \* 1024/);
  assert.match(uploader, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(uploader, /artifact\.byteSize/);
  assert.match(uploader, /artifact\.sha256/);
  assert.match(uploader, /validatedUploadUrl/);
  assert.match(uploader, /sessionStorage/);
  assert.match(uploader, /redirect: "error"/);
  assert.match(uploader, /private review storage and never authorizes publishing/i);
  assert.doesNotMatch(uploader, /x-upsert|pages_manage_posts|instagram_content_publish/i);
});

test("bridge exposes import and review controls but no delivery primitive", async () => {
  const actions = await read("app/social-drafts/actions.ts");
  const page = await read("app/social-drafts/page.tsx");
  const migration = await read(migrationPath);
  assert.match(actions, /import_media_package/);
  assert.match(actions, /authorize_media_package_private_upload/);
  assert.match(await read("lib/supabase/admin.ts"), /finalize_media_package_private_upload_verified/);
  assert.match(actions, /createHash\("sha256"\)/);
  assert.match(actions, /finalizeTrustedMediaUpload/);
  assert.match(actions, /remoteVerification/);
  assert.match(actions, /create_media_social_content_draft/);
  assert.match(page, /Import private media package/);
  assert.match(page, /Authorize private review upload/);
  assert.match(page, /does not authorize publication/i);
  assert.doesNotMatch(actions, /media_publish|pages_manage_posts|instagram_content_publish|\/feed/);
  assert.match(await read("lib/supabase/admin.ts"), /import "server-only"/);
  assert.match(await read("lib/supabase/admin.ts"), /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(await read("lib/supabase/admin.ts"), /startsWith\("sb_secret_"\)/);
  assert.match(migration, /grant execute on function public\.finalize_media_package_private_upload_verified\(uuid, uuid, jsonb\) to service_role/);
  assert.doesNotMatch(migration, /grant execute on function public\.finalize_media_package_private_upload_verified[^\n]+authenticated/);
});

test("legacy Social Hub schema is explicitly quarantined from migrations", async () => {
  const readme = await read("apps/social-hub/README.md");
  const prototype = await read("apps/social-hub/schema/social-hub.sql");
  const migrations = await read(migrationPath);
  assert.match(readme, /non-deployable design artifact/i);
  assert.match(readme, /Never apply that file to a database/i);
  assert.match(prototype, /NON-DEPLOYABLE PROTOTYPE\. DO NOT APPLY/);
  assert.doesNotMatch(migrations, /create table [^(]*publish|status in \([^)]*'(scheduled|publishing|published)'/is);
});

test("internal approval helpers are not directly exposed through the Data API", async () => {
  const migration = await read(hardeningMigrationPath);
  assert.match(migration, /social_media_approval_payload[\s\S]+from authenticated, service_role/);
  assert.match(migration, /social_media_approval_hash[\s\S]+from authenticated, service_role/);
  assert.match(migration, /social_final_approvers_bound_by_idx/);
});
