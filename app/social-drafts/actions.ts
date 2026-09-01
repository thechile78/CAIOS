"use server";

import { createHash } from "node:crypto";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { parseMediaPackageEnvelope } from "@/lib/media-packages";
import { getPublicDatabaseEnvironment } from "@/lib/server-env";
import { finalizeTrustedMediaUpload } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const creatorRoles = ["administrator", "editor", "producer", "researcher"] as const;
const reviewerRoles = ["administrator", "editor", "reviewer"] as const;

function requiredString(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function optionalString(formData: FormData, name: string, maxLength: number): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error(`${name} exceeds its maximum length`);
  return normalized || null;
}

function failure(message: string): never {
  redirect(`/social-drafts?error=${encodeURIComponent(message)}`);
}

export async function createSocialDraft(formData: FormData) {
  await requireRole(creatorRoles);

  let title: string;
  let facebookCaption: string | null;
  let instagramCaption: string | null;
  try {
    title = requiredString(formData, "title");
    facebookCaption = optionalString(formData, "facebookCaption", 5000);
    instagramCaption = optionalString(formData, "instagramCaption", 2200);
  } catch {
    failure("Review the draft fields and try again.");
  }

  if (title.length > 160 || (!facebookCaption && !instagramCaption)) {
    failure("A title and at least one platform caption are required.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_social_content_draft", {
    p_title: title,
    p_facebook_caption: facebookCaption,
    p_instagram_caption: instagramCaption,
  });

  if (error || !data) failure("The private draft could not be created.");
  redirect(`/social-drafts?created=${encodeURIComponent(String(data))}`);
}

export async function importMediaPackage(formData: FormData) {
  await requireRole(creatorRoles);
  const packageFile = formData.get("packageFile");
  const rightsAttested = formData.get("rightsAttested") === "on";
  const rightsNote = optionalString(formData, "rightsNote", 2000);
  if (!(packageFile instanceof File) || packageFile.size < 1 || packageFile.size > 262_144) {
    failure("Select a valid Media Studio package file.");
  }
  if (!rightsAttested) failure("Confirm the media and performance rights before importing.");

  let envelope;
  try {
    envelope = parseMediaPackageEnvelope(JSON.parse(await packageFile.text()));
  } catch {
    failure("The Media Studio package is invalid or its hash does not match.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("import_media_package", {
    p_local_job_id: envelope.local_job_id,
    p_title: envelope.title,
    p_package_hash: envelope.package_hash,
    p_caption_file_hash: envelope.caption_file_hash,
    p_music_license_hash: envelope.music_license_hash,
    p_rights_evidence_hash: envelope.rights_evidence_hash,
    p_rights_attested: true,
    p_rights_note: rightsNote,
    p_qa_status: envelope.qa_status,
    p_artifacts: envelope.artifacts,
  });

  if (error || !data) failure("The private media package could not be imported.");
  redirect(`/social-drafts?media_imported=${encodeURIComponent(String(data))}`);
}

export async function authorizePrivateMediaUpload(formData: FormData) {
  await requireRole(["administrator"] as const);
  const packageId = requiredString(formData, "packageId");
  const expectedUpdatedAt = requiredString(formData, "expectedUpdatedAt");
  const acknowledged = formData.get("privateUploadAcknowledged") === "on";
  if (!acknowledged) failure("Confirm that this authorization is only for private CAIOS review storage.");

  const supabase = await createSupabaseServerClient();
  const { data: isFinalApprover, error: approverError } = await supabase.rpc("is_current_social_final_approver");
  if (approverError || isFinalApprover !== true) failure("Only the bound CAIOS final approver may authorize private media transmission.");
  const { data, error } = await supabase.rpc("authorize_media_package_private_upload", {
    p_package_id: packageId,
    p_expected_updated_at: expectedUpdatedAt,
  });
  if (error || !data) failure("The private upload authorization could not be recorded.");
  redirect(`/social-drafts?upload_authorized=${encodeURIComponent(String(data))}`);
}

export async function finalizePrivateMediaUpload(formData: FormData) {
  const profile = await requireRole(["administrator"] as const);
  const authorizationId = requiredString(formData, "authorizationId");
  const supabase = await createSupabaseServerClient();
  const { data: isFinalApprover, error: approverError } = await supabase.rpc("is_current_social_final_approver");
  if (approverError || isFinalApprover !== true) failure("Only the bound CAIOS final approver may verify private media.");

  const { data: authorization, error: authorizationError } = await supabase
    .from("media_ingest_authorizations")
    .select("package_id,authorized_by,expires_at,used_at")
    .eq("id", authorizationId)
    .single();
  if (authorizationError || !authorization
      || authorization.authorized_by !== profile.id
      || authorization.used_at !== null
      || new Date(authorization.expires_at).getTime() <= Date.now()) {
    failure("The private upload authorization is invalid or expired. Authorize the unchanged package again.");
  }

  const { data: artifacts, error: artifactError } = await supabase
    .from("media_artifacts")
    .select("id,bucket_id,object_path,sha256,byte_size,mime_type")
    .eq("package_id", authorization.package_id)
    .order("artifact_key");
  if (artifactError || !artifacts?.length) failure("The authorized media artifacts could not be loaded.");

  const expectedProject = new URL(getPublicDatabaseEnvironment().NEXT_PUBLIC_SUPABASE_URL);
  const remoteVerification: Array<{ artifact_id: string; sha256: string; byte_size: number }> = [];
  for (const artifact of artifacts) {
    const signed = await supabase.storage.from(artifact.bucket_id).createSignedUrl(artifact.object_path, 300);
    if (signed.error || !signed.data.signedUrl) failure("An authorized private object is missing.");
    const signedUrl = new URL(signed.data.signedUrl);
    if (signedUrl.origin !== expectedProject.origin
        || !signedUrl.pathname.startsWith(`/storage/v1/object/sign/${artifact.bucket_id}/`)) {
      failure("Private object verification returned an unsafe URL.");
    }

    const response = await fetch(signedUrl, { cache: "no-store", redirect: "error" });
    if (!response.ok || !response.body) failure("An authorized private object could not be verified.");
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim();
    if (contentType !== artifact.mime_type) failure("A private object has the wrong media type.");

    const hash = createHash("sha256");
    let byteSize = 0;
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteSize += value.byteLength;
      if (byteSize > artifact.byte_size) failure("A private object is larger than authorized.");
      hash.update(value);
    }
    const sha256 = hash.digest("hex");
    if (byteSize !== artifact.byte_size || sha256 !== artifact.sha256) {
      failure("Trusted server verification found a size or SHA-256 mismatch. The package was not finalized.");
    }
    remoteVerification.push({ artifact_id: artifact.id, sha256, byte_size: byteSize });
  }

  try {
    await finalizeTrustedMediaUpload({
      authorizationId,
      actorId: profile.id,
      verification: remoteVerification,
    });
  } catch {
    failure("Trusted verification could not finalize the authorized package.");
  }
  redirect(`/social-drafts?upload_finalized=${encodeURIComponent(authorizationId)}`);
}

export async function createMediaSocialDraft(formData: FormData) {
  await requireRole(creatorRoles);
  const packageId = requiredString(formData, "packageId");
  const title = requiredString(formData, "title");
  const facebookCaption = optionalString(formData, "facebookCaption", 5000);
  const instagramCaption = optionalString(formData, "instagramCaption", 2200);
  if (title.length > 160 || (!facebookCaption && !instagramCaption)) {
    failure("A title and at least one platform caption are required.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_media_social_content_draft", {
    p_media_package_id: packageId,
    p_title: title,
    p_facebook_caption: facebookCaption,
    p_instagram_caption: instagramCaption,
  });
  if (error || !data) failure("The media package is not ready for a social draft.");
  redirect(`/social-drafts?created=${encodeURIComponent(String(data))}`);
}

export async function submitSocialDraftForReview(formData: FormData) {
  await requireRole(creatorRoles);
  const contentItemId = requiredString(formData, "contentItemId");
  const expectedUpdatedAt = requiredString(formData, "expectedUpdatedAt");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("submit_social_content_for_review", {
    p_content_item_id: contentItemId,
    p_expected_updated_at: expectedUpdatedAt,
  });

  if (error) failure("The draft changed or could not be submitted for review.");
  redirect(`/social-drafts?submitted=${encodeURIComponent(contentItemId)}`);
}

export async function recordSocialDraftDecision(formData: FormData) {
  await requireRole(reviewerRoles);
  const contentItemId = requiredString(formData, "contentItemId");
  const expectedUpdatedAt = requiredString(formData, "expectedUpdatedAt");
  const decision = requiredString(formData, "decision");
  const note = optionalString(formData, "note", 4000);

  if (!["approved", "changes_requested", "rejected"].includes(decision)) {
    failure("Invalid review decision.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_social_content_decision", {
    p_content_item_id: contentItemId,
    p_expected_updated_at: expectedUpdatedAt,
    p_decision: decision,
    p_note: note,
  });

  if (error) failure("The draft changed or is no longer awaiting review.");
  redirect(`/social-drafts?decision=${encodeURIComponent(decision)}`);
}
