import "server-only";

import { createHash } from "node:crypto";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const hashPattern = /^[0-9a-f]{64}$/;
const slugPattern = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const jobPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export interface MediaPackageArtifactInput {
  artifact_key: string;
  platform_profile: string;
  sha256: string;
  byte_size: number;
  mime_type: "video/mp4";
  width: number;
  height: number;
  duration_ms: number;
  audio_choice: "keep" | "mute";
  qa_status: "verified" | "needs_review" | "failed";
}

export interface MediaPackageEnvelope {
  schema: "media-package.v1";
  local_job_id: string;
  title: string;
  package_hash: string;
  caption_file_hash: string | null;
  music_license_hash: string | null;
  rights_evidence_hash: string | null;
  qa_status: "verified" | "needs_review" | "failed";
  artifacts: MediaPackageArtifactInput[];
}

export interface MediaPackageSummary {
  id: string;
  localJobId: string;
  title: string;
  packageHash: string;
  rightsAttested: boolean;
  rightsNote: string | null;
  qaStatus: "verified" | "needs_review" | "failed";
  status: string;
  updatedAt: string;
  activeAuthorizationId: string | null;
  activeAuthorizationExpiresAt: string | null;
  artifacts: Array<{
    id: string;
    artifactKey: string;
    platformProfile: string;
    objectPath: string;
    sha256: string;
    byteSize: number;
    width: number;
    height: number;
    durationMs: number;
    audioChoice: "keep" | "mute";
    qaStatus: string;
    uploadStatus: string;
    previewUrl: string | null;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalHash(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !hashPattern.test(value)) throw new Error("Invalid evidence hash");
  return value;
}

function integer(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error("Invalid numeric media metadata");
  }
  return value;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
  );
}

export function producerPackageHash(envelopeWithoutHash: Omit<MediaPackageEnvelope, "package_hash">): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(envelopeWithoutHash)))
    .digest("hex");
}

export function parseMediaPackageEnvelope(value: unknown): MediaPackageEnvelope {
  if (!isRecord(value) || value.schema !== "media-package.v1") throw new Error("Unsupported media package schema");
  if (typeof value.local_job_id !== "string" || !jobPattern.test(value.local_job_id)) throw new Error("Invalid local job ID");
  if (typeof value.title !== "string" || value.title.trim().length < 1 || value.title.trim().length > 160) throw new Error("Invalid title");
  if (typeof value.package_hash !== "string" || !hashPattern.test(value.package_hash)) throw new Error("Invalid package hash");
  if (!Array.isArray(value.artifacts) || value.artifacts.length < 1 || value.artifacts.length > 10) throw new Error("Invalid artifact list");
  if (!["verified", "needs_review", "failed"].includes(String(value.qa_status))) throw new Error("Invalid package QA status");

  const artifacts = value.artifacts.map((item): MediaPackageArtifactInput => {
    if (!isRecord(item)) throw new Error("Invalid artifact");
    if (typeof item.artifact_key !== "string" || !slugPattern.test(item.artifact_key)) throw new Error("Invalid artifact key");
    if (typeof item.platform_profile !== "string" || !slugPattern.test(item.platform_profile)) throw new Error("Invalid platform profile");
    if (typeof item.sha256 !== "string" || !hashPattern.test(item.sha256)) throw new Error("Invalid artifact hash");
    if (item.mime_type !== "video/mp4") throw new Error("Only MP4 review artifacts are accepted");
    if (!['keep', 'mute'].includes(String(item.audio_choice))) throw new Error("Invalid audio choice");
    if (!["verified", "needs_review", "failed"].includes(String(item.qa_status))) throw new Error("Invalid artifact QA status");
    return {
      artifact_key: item.artifact_key,
      platform_profile: item.platform_profile,
      sha256: item.sha256,
      byte_size: integer(item.byte_size, 1, 67_108_864),
      mime_type: "video/mp4",
      width: integer(item.width, 1, 7680),
      height: integer(item.height, 1, 7680),
      duration_ms: integer(item.duration_ms, 1, 3_600_000),
      audio_choice: item.audio_choice as "keep" | "mute",
      qa_status: item.qa_status as "verified" | "needs_review" | "failed",
    };
  });

  const envelope: MediaPackageEnvelope = {
    schema: "media-package.v1",
    local_job_id: value.local_job_id,
    title: value.title.trim(),
    package_hash: value.package_hash,
    caption_file_hash: optionalHash(value.caption_file_hash),
    music_license_hash: optionalHash(value.music_license_hash),
    rights_evidence_hash: optionalHash(value.rights_evidence_hash),
    qa_status: value.qa_status as "verified" | "needs_review" | "failed",
    artifacts,
  };

  if (artifacts.reduce((total, artifact) => total + artifact.byte_size, 0) > 536_870_912) {
    throw new Error("Media package exceeds the 512 MiB private-review limit");
  }

  const { package_hash: suppliedHash, ...hashPayload } = envelope;
  if (producerPackageHash(hashPayload) !== suppliedHash) throw new Error("Media package hash does not match its contents");
  return envelope;
}

export async function listMediaPackages(): Promise<MediaPackageSummary[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: packages, error }, { data: userData }, { data: isFinalApprover }] = await Promise.all([
    supabase
      .from("media_packages")
      .select("id,local_job_id,title,producer_package_hash,rights_attested,rights_note,qa_status,status,updated_at")
      .order("updated_at", { ascending: false })
      .limit(25),
    supabase.auth.getUser(),
    supabase.rpc("is_current_social_final_approver"),
  ]);
  if (error) throw new Error("Unable to load media packages.");

  const packageIds = (packages ?? []).map((item) => item.id);
  if (packageIds.length === 0) return [];

  const [{ data: artifacts, error: artifactError }, { data: authorizations, error: authorizationError }] = await Promise.all([
    supabase
      .from("media_artifacts")
      .select("id,package_id,artifact_key,platform_profile,bucket_id,object_path,sha256,byte_size,width,height,duration_ms,audio_choice,qa_status,upload_status")
      .in("package_id", packageIds)
      .order("artifact_key"),
    supabase
      .from("media_ingest_authorizations")
      .select("id,package_id,authorized_by,expires_at,used_at")
      .in("package_id", packageIds)
      .order("authorized_at", { ascending: false }),
  ]);
  if (artifactError || authorizationError) throw new Error("Unable to load media package details.");

  const artifactsWithPreviews = await Promise.all((artifacts ?? []).map(async (artifact) => {
    let previewUrl: string | null = null;
    if (isFinalApprover === true && artifact.upload_status === "verified") {
      const signed = await supabase.storage.from(artifact.bucket_id).createSignedUrl(artifact.object_path, 300);
      previewUrl = signed.error ? null : signed.data.signedUrl;
    }
    return { artifact, previewUrl };
  }));

  const now = Date.now();
  return (packages ?? []).map((item) => {
    const activeAuthorization = (authorizations ?? []).find((authorization) =>
      authorization.package_id === item.id
      && authorization.authorized_by === userData.user?.id
      && authorization.used_at === null
      && new Date(authorization.expires_at).getTime() > now
    );
    return {
      id: item.id,
      localJobId: item.local_job_id,
      title: item.title,
      packageHash: item.producer_package_hash,
      rightsAttested: item.rights_attested === true,
      rightsNote: item.rights_note,
      qaStatus: item.qa_status as "verified" | "needs_review" | "failed",
      status: item.status,
      updatedAt: item.updated_at,
      activeAuthorizationId: activeAuthorization?.id ?? null,
      activeAuthorizationExpiresAt: activeAuthorization?.expires_at ?? null,
      artifacts: artifactsWithPreviews
        .filter(({ artifact }) => artifact.package_id === item.id)
        .map(({ artifact, previewUrl }) => ({
          id: artifact.id,
          artifactKey: artifact.artifact_key,
          platformProfile: artifact.platform_profile,
          objectPath: artifact.object_path,
          sha256: artifact.sha256,
          byteSize: artifact.byte_size,
          width: artifact.width,
          height: artifact.height,
          durationMs: artifact.duration_ms,
          audioChoice: artifact.audio_choice as "keep" | "mute",
          qaStatus: artifact.qa_status,
          uploadStatus: artifact.upload_status,
          previewUrl,
        })),
    };
  });
}
