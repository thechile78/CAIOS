"use client";

import { useMemo, useState } from "react";

import { getPublicDatabaseEnvironment } from "@/lib/server-env";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const tusVersion = "1.0.0";
const chunkSize = 6 * 1024 * 1024;
const retryDelays = [0, 1_000, 3_000, 5_000];

interface UploadArtifact {
  id: string;
  artifactKey: string;
  platformProfile: string;
  objectPath: string;
  sha256: string;
  byteSize: number;
  uploadStatus: string;
}

interface ArtifactState {
  file?: File;
  status: "waiting" | "checking" | "ready" | "uploading" | "complete" | "error";
  message: string;
  progress: number;
}

function bytesToHex(value: ArrayBuffer): string {
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function metadataHeader(metadata: Record<string, string>): string {
  return Object.entries(metadata)
    .map(([key, value]) => `${key} ${btoa(value)}`)
    .join(",");
}

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function directStorageOrigin(): string {
  const projectUrl = new URL(getPublicDatabaseEnvironment().NEXT_PUBLIC_SUPABASE_URL);
  const projectRef = projectUrl.hostname.split(".")[0];
  return `https://${projectRef}.storage.supabase.co`;
}

function validatedUploadUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:"
      || url.origin !== directStorageOrigin()
      || url.port !== ""
      || url.username !== ""
      || url.password !== ""
      || url.search !== ""
      || url.hash !== ""
      || !url.pathname.startsWith("/storage/v1/upload/resumable/")) {
    throw new Error("Rejected an unsafe resumable upload URL before sending credentials.");
  }
  return url.toString();
}

async function currentAccessToken(): Promise<string> {
  const { data, error } = await createSupabaseBrowserClient().auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Your CAIOS session expired. Sign in again.");
  return data.session.access_token;
}

async function readOffset(uploadUrl: string, token: string): Promise<number | null> {
  const safeUploadUrl = validatedUploadUrl(uploadUrl);
  const response = await fetch(safeUploadUrl, {
    method: "HEAD",
    redirect: "error",
    headers: { Authorization: `Bearer ${token}`, "Tus-Resumable": tusVersion },
  });
  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok) throw new Error(`Unable to resume private upload (${response.status}).`);
  const offset = Number(response.headers.get("Upload-Offset"));
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Private upload returned an invalid offset.");
  return offset;
}

async function createUpload(artifact: UploadArtifact, file: File, token: string): Promise<string> {
  const endpoint = `${directStorageOrigin()}/storage/v1/upload/resumable`;
  const response = await fetch(endpoint, {
    method: "POST",
    redirect: "error",
    headers: {
      Authorization: `Bearer ${token}`,
      "Tus-Resumable": tusVersion,
      "Upload-Length": String(file.size),
      "Upload-Metadata": metadataHeader({
        bucketName: "caios-media-review",
        objectName: artifact.objectPath,
        contentType: "video/mp4",
        cacheControl: "3600",
      }),
    },
  });
  if (!response.ok) throw new Error(`Private upload could not start (${response.status}).`);
  const location = response.headers.get("Location");
  if (!location) throw new Error("Private upload did not return a resumable location.");
  return validatedUploadUrl(new URL(location, `${endpoint}/`).toString());
}

async function resumableUpload(
  artifact: UploadArtifact,
  file: File,
  onProgress: (progress: number) => void,
): Promise<void> {
  const token = await currentAccessToken();
  const storageKey = `caios-private-upload:${artifact.sha256}:${artifact.objectPath}`;
  let uploadUrl = window.sessionStorage.getItem(storageKey);
  const resumedOffset = uploadUrl ? await readOffset(uploadUrl, token) : null;
  let offset: number;
  if (!uploadUrl || resumedOffset === null) {
    uploadUrl = await createUpload(artifact, file, token);
    window.sessionStorage.setItem(storageKey, uploadUrl);
    offset = 0;
  } else {
    offset = resumedOffset;
  }

  while (offset < file.size) {
    const end = Math.min(offset + chunkSize, file.size);
    const body = file.slice(offset, end);
    let uploaded = false;
    let lastError: Error | null = null;

    for (const retryDelay of retryDelays) {
      if (retryDelay) await delay(retryDelay);
      try {
        const safeUploadUrl = validatedUploadUrl(uploadUrl);
        const response: Response = await fetch(safeUploadUrl, {
          method: "PATCH",
          redirect: "error",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/offset+octet-stream",
            "Tus-Resumable": tusVersion,
            "Upload-Offset": String(offset),
          },
          body,
        });
        if (response.status === 409) {
          const remoteOffset = await readOffset(uploadUrl, token);
          if (remoteOffset === null) throw new Error("The resumable upload expired.");
          offset = remoteOffset;
          uploaded = true;
          break;
        }
        if (!response.ok) throw new Error(`Private upload failed (${response.status}).`);
        const nextOffset: number = Number(response.headers.get("Upload-Offset"));
        if (!Number.isSafeInteger(nextOffset) || nextOffset <= offset || nextOffset > file.size) {
          throw new Error("Private upload returned an invalid progress offset.");
        }
        offset = nextOffset;
        uploaded = true;
        onProgress(Math.round((offset / file.size) * 100));
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Private upload failed.");
      }
    }
    if (!uploaded) throw lastError ?? new Error("Private upload failed after retries.");
  }
  window.sessionStorage.removeItem(storageKey);
}

export function PrivateMediaUploader({ artifacts }: { artifacts: UploadArtifact[] }) {
  const pendingArtifacts = useMemo(
    () => artifacts.filter((artifact) => artifact.uploadStatus !== "verified"),
    [artifacts],
  );
  const [states, setStates] = useState<Record<string, ArtifactState>>(() =>
    Object.fromEntries(pendingArtifacts.map((artifact) => [artifact.id, {
      status: "waiting", message: "Select the exact authorized MP4.", progress: 0,
    }])),
  );
  const [busy, setBusy] = useState(false);

  async function selectFile(artifact: UploadArtifact, file?: File) {
    if (!file) return;
    setStates((current) => ({ ...current, [artifact.id]: {
      file, status: "checking", message: "Checking size, type, and SHA-256…", progress: 0,
    } }));
    try {
      if (file.size !== artifact.byteSize) throw new Error("File size does not match the authorized artifact.");
      if (file.type && file.type !== "video/mp4") throw new Error("Only the authorized MP4 file is accepted.");
      const digest = bytesToHex(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
      if (digest !== artifact.sha256) throw new Error("SHA-256 does not match. Nothing was uploaded.");
      setStates((current) => ({ ...current, [artifact.id]: {
        file, status: "ready", message: "Exact hash verified locally. Ready for private upload.", progress: 0,
      } }));
    } catch (error) {
      setStates((current) => ({ ...current, [artifact.id]: {
        status: "error", message: error instanceof Error ? error.message : "File verification failed.", progress: 0,
      } }));
    }
  }

  async function uploadAll() {
    const ready = pendingArtifacts.filter((artifact) => states[artifact.id]?.status === "ready");
    if (ready.length !== pendingArtifacts.length) return;
    setBusy(true);
    for (const artifact of ready) {
      const file = states[artifact.id]?.file;
      if (!file) continue;
      setStates((current) => ({ ...current, [artifact.id]: {
        ...current[artifact.id], status: "uploading", message: "Uploading to private CAIOS review storage…",
      } }));
      try {
        await resumableUpload(artifact, file, (progress) => setStates((current) => ({
          ...current,
          [artifact.id]: { ...current[artifact.id], progress },
        })));
        setStates((current) => ({ ...current, [artifact.id]: {
          ...current[artifact.id], status: "complete", message: "Private upload complete. Server verification is still required.", progress: 100,
        } }));
      } catch (error) {
        setStates((current) => ({ ...current, [artifact.id]: {
          ...current[artifact.id], status: "error", message: error instanceof Error ? error.message : "Private upload failed.",
        } }));
        setBusy(false);
        return;
      }
    }
    setBusy(false);
  }

  if (pendingArtifacts.length === 0) return null;
  const allReady = pendingArtifacts.every((artifact) => states[artifact.id]?.status === "ready");
  const allComplete = pendingArtifacts.every((artifact) => states[artifact.id]?.status === "complete");

  return (
    <div className="private-upload-panel">
      <strong>Authorized private upload</strong>
      <p className="editorial-form-note">Files are hash-checked in this browser before transmission. This permission is only for private review storage and never authorizes publishing.</p>
      {pendingArtifacts.map((artifact) => {
        const state = states[artifact.id];
        return (
          <label className="private-upload-file" key={artifact.id}>
            <span>{artifact.platformProfile.replaceAll("_", " ")} · {(artifact.byteSize / 1_048_576).toFixed(1)} MB</span>
            <input
              type="file"
              accept="video/mp4,.mp4"
              disabled={busy || state?.status === "complete"}
              onChange={(event) => void selectFile(artifact, event.target.files?.[0])}
            />
            <span role={state?.status === "error" ? "alert" : "status"}>{state?.message}</span>
            {state?.status === "uploading" || state?.status === "complete" ? <progress max={100} value={state.progress}>{state.progress}%</progress> : null}
          </label>
        );
      })}
      <button className="secondary-button" type="button" disabled={!allReady || busy || allComplete} onClick={() => void uploadAll()}>
        {busy ? "Uploading privately…" : allComplete ? "Private upload complete" : "Upload exact files privately"}
      </button>
    </div>
  );
}
