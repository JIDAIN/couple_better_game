import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import type { LifePartnerKey } from "@/lib/life/life-service";

const MEDIA_RECOVERY_SECONDS = 10 * 60;
const TOKEN_VERSION = 1;
const DEFAULT_PUBLIC_BASE_URL = "https://couple-better-game.vercel.app";

type JsonRecord = Record<string, unknown>;

export type LifeMediaRecoveryPayload = {
  version: 1;
  kind: "life_media_recovery";
  iat: number;
  exp: number;
  partnerKey: LifePartnerKey;
  args: JsonRecord;
  userText: string;
  operationId: string;
};

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function encryptionKey() {
  const secret = env("LIFE_MCP_SIGNING_SECRET");
  if (secret.length < 32) throw new Error("LIFE_MCP_SIGNING_SECRET_MISSING");
  return createHash("sha256").update(`life-media-recovery:${secret}`).digest();
}

function publicBaseUrl() {
  const configured = env("LIFE_PUBLIC_BASE_URL") || env("NEXT_PUBLIC_APP_URL");
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.hostname === "localhost") return url.origin;
    } catch {
      // Fall through to the stable production origin.
    }
  }
  return DEFAULT_PUBLIC_BASE_URL;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function encryptPayload(payload: LifeMediaRecoveryPayload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

function decryptPayload(token: string): LifeMediaRecoveryPayload | null {
  let packed: Buffer;
  try {
    packed = Buffer.from(token, "base64url");
  } catch {
    return null;
  }
  if (packed.length < 12 + 16 + 2) return null;

  try {
    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const ciphertext = packed.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    const payload = JSON.parse(plaintext) as Partial<LifeMediaRecoveryPayload>;
    if (payload.version !== TOKEN_VERSION || payload.kind !== "life_media_recovery") return null;
    if (payload.partnerKey !== "cat" && payload.partnerKey !== "fish") return null;
    if (typeof payload.iat !== "number" || typeof payload.exp !== "number" || payload.exp <= nowSeconds()) {
      return null;
    }
    if (!payload.args || typeof payload.args !== "object" || Array.isArray(payload.args)) return null;
    if (typeof payload.userText !== "string" || typeof payload.operationId !== "string") return null;
    return payload as LifeMediaRecoveryPayload;
  } catch {
    return null;
  }
}

export function createLifeMediaRecovery(input: {
  partnerKey: LifePartnerKey;
  args: JsonRecord;
  userText: string;
  toolCallId?: string;
}) {
  const now = nowSeconds();
  const payload: LifeMediaRecoveryPayload = {
    version: TOKEN_VERSION,
    kind: "life_media_recovery",
    iat: now,
    exp: now + MEDIA_RECOVERY_SECONDS,
    partnerKey: input.partnerKey,
    args: input.args,
    userText: input.userText.slice(0, 2000),
    operationId: input.toolCallId?.trim() || `media-${randomUUID()}`,
  };
  const token = encryptPayload(payload);
  const url = new URL("/ai-media-upload", publicBaseUrl());
  url.searchParams.set("token", token);
  return {
    uploadUrl: url.toString(),
    expiresInSeconds: MEDIA_RECOVERY_SECONDS,
  };
}

export function resolveLifeMediaRecovery(token: string) {
  return decryptPayload(token.trim());
}
