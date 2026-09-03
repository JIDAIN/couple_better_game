import type { DriveBridgeId } from "./drive-bridge-config";

const DEFAULT_SUPABASE_URL = "https://bfhntnzngozdqsmgfvjk.supabase.co";
const STAGING_BUCKET = "drive-bridge-staging";
export const DRIVE_BRIDGE_STAGING_MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function supabaseUrl() {
  return env("SUPABASE_URL") || DEFAULT_SUPABASE_URL;
}

function supabaseSecretKey() {
  return env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
}

function serviceHeaders(extra?: HeadersInit) {
  const secret = supabaseSecretKey();
  if (!secret) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  return {
    apikey: secret,
    Authorization: `Bearer ${secret}`,
    ...extra,
  };
}

function encodedPath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function validCommandId(commandId: string) {
  return /^[A-Za-z0-9._:-]{8,120}$/.test(commandId);
}

export function driveBridgeStagingPath(bridgeId: DriveBridgeId, commandId: string) {
  if (!validCommandId(commandId)) throw new Error("commandId 格式不适合照片暂存");
  return `${bridgeId}/${commandId}/original`;
}

export function assertDriveBridgeOriginalDescriptor(input: { mimeType: string; size: number }) {
  const mimeType = input.mimeType.trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) throw new Error("暂不支持这种餐食照片格式");
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > DRIVE_BRIDGE_STAGING_MAX_BYTES) {
    throw new Error("Drive 原图必须小于等于 25MB");
  }
  return { mimeType, size: Math.floor(input.size) };
}

export async function createDriveBridgeStagingUpload(
  bridgeId: DriveBridgeId,
  input: { commandId: string; mimeType: string; size: number },
) {
  const descriptor = assertDriveBridgeOriginalDescriptor(input);
  const path = driveBridgeStagingPath(bridgeId, input.commandId);
  const response = await fetch(
    `${supabaseUrl()}/storage/v1/object/upload/sign/${STAGING_BUCKET}/${encodedPath(path)}`,
    {
      method: "POST",
      headers: serviceHeaders({ "Content-Type": "application/json", "x-upsert": "true" }),
      body: "{}",
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error("DRIVE_BRIDGE_STAGING_SIGN_FAILED");
  const data = (await response.json()) as { url?: string };
  if (!data.url?.startsWith("/object/upload/sign/")) throw new Error("DRIVE_BRIDGE_STAGING_SIGN_INVALID");
  return {
    path,
    signedUrl: `${supabaseUrl()}/storage/v1${data.url}`,
    mimeType: descriptor.mimeType,
    maxBytes: DRIVE_BRIDGE_STAGING_MAX_BYTES,
  };
}

export async function downloadDriveBridgeStagedOriginal(bridgeId: DriveBridgeId, commandId: string, path: string) {
  const expected = driveBridgeStagingPath(bridgeId, commandId);
  if (path !== expected) throw new Error("DRIVE_BRIDGE_STAGING_PATH_INVALID");
  const response = await fetch(
    `${supabaseUrl()}/storage/v1/object/authenticated/${STAGING_BUCKET}/${encodedPath(path)}`,
    { headers: serviceHeaders(), cache: "no-store" },
  );
  if (!response.ok) throw new Error("DRIVE_BRIDGE_STAGING_DOWNLOAD_FAILED");
  const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(contentType)) throw new Error("DRIVE_BRIDGE_STAGING_NOT_IMAGE");
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > DRIVE_BRIDGE_STAGING_MAX_BYTES) throw new Error("Drive 原图超过 25MB");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength <= 0 || bytes.byteLength > DRIVE_BRIDGE_STAGING_MAX_BYTES) throw new Error("Drive 原图超过 25MB");
  return { bytes, mimeType: contentType };
}

export async function deleteDriveBridgeStagedOriginal(bridgeId: DriveBridgeId, commandId: string, path: string) {
  const expected = driveBridgeStagingPath(bridgeId, commandId);
  if (path !== expected) return;
  const response = await fetch(`${supabaseUrl()}/storage/v1/object/${STAGING_BUCKET}`, {
    method: "DELETE",
    headers: serviceHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes: [path] }),
    cache: "no-store",
  });
  if (!response.ok && response.status !== 404) throw new Error("DRIVE_BRIDGE_STAGING_DELETE_FAILED");
}
