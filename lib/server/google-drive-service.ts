import { createSign } from "node:crypto";
import type { DriveBridgeId } from "./drive-bridge-auth";
import { driveBridgeOriginalsMealsFolderId } from "./drive-bridge-auth";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_READ_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

type CachedToken = { accessToken: string; expiresAt: number };
let tokenCache: CachedToken | null = null;

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function base64url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

async function getServiceAccountToken() {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt - 60 > now) return tokenCache.accessToken;

  const email = env("LIFE_DRIVE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = env("LIFE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
  if (!email || !privateKey) throw new Error("GOOGLE_DRIVE_SERVICE_ACCOUNT_NOT_CONFIGURED");

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: email,
    scope: DRIVE_READ_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey).toString("base64url");

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("GOOGLE_DRIVE_TOKEN_FAILED");
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("GOOGLE_DRIVE_TOKEN_MISSING");
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + Math.max(300, data.expires_in ?? 3600),
  };
  return tokenCache.accessToken;
}

async function driveFetch(path: string) {
  const token = await getServiceAccountToken();
  return fetch(`${DRIVE_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

export type DriveMealOriginal = {
  bytes: Buffer;
  mimeType: string;
  name: string;
  size: number;
};

export async function downloadDriveMealOriginal(fileId: string, bridgeId: DriveBridgeId): Promise<DriveMealOriginal> {
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) throw new Error("GOOGLE_DRIVE_FILE_ID_INVALID");
  const allowedFolder = driveBridgeOriginalsMealsFolderId(bridgeId);
  if (!allowedFolder) throw new Error("GOOGLE_DRIVE_ORIGINALS_FOLDER_NOT_CONFIGURED");

  const metaResponse = await driveFetch(`/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,parents,trashed&supportsAllDrives=true`);
  if (!metaResponse.ok) throw new Error("GOOGLE_DRIVE_FILE_METADATA_FAILED");
  const meta = (await metaResponse.json()) as {
    name?: string;
    mimeType?: string;
    size?: string;
    parents?: string[];
    trashed?: boolean;
  };
  if (meta.trashed) throw new Error("GOOGLE_DRIVE_FILE_TRASHED");
  if (!meta.parents?.includes(allowedFolder)) throw new Error("GOOGLE_DRIVE_FILE_OUTSIDE_ACTOR_ORIGINALS");
  if (!meta.mimeType?.startsWith("image/")) throw new Error("GOOGLE_DRIVE_FILE_NOT_IMAGE");

  const response = await driveFetch(`/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`);
  if (!response.ok) throw new Error("GOOGLE_DRIVE_FILE_DOWNLOAD_FAILED");
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    bytes,
    mimeType: meta.mimeType,
    name: meta.name || fileId,
    size: Number(meta.size ?? bytes.byteLength) || bytes.byteLength,
  };
}
