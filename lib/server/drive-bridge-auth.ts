import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { FixedLifeIdentity } from "./fixed-life-auth";

const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

export type DriveBridgeId = "cat" | "fish";

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseBridgeId(value: string): DriveBridgeId | null {
  return value === "cat" || value === "fish" ? value : null;
}

function bridgeEnvName(bridgeId: DriveBridgeId, suffix: string) {
  return `LIFE_DRIVE_${bridgeId.toUpperCase()}_${suffix}`;
}

export function driveBridgeIdentity(bridgeId: DriveBridgeId): FixedLifeIdentity {
  return {
    partnerKey: bridgeId,
    displayName: bridgeId === "cat" ? "猫猫" : "鱼鱼",
  };
}

export function driveBridgeSecret(bridgeId: DriveBridgeId) {
  return env(bridgeEnvName(bridgeId, "BRIDGE_SECRET"));
}

export function driveBridgeWatchToken(bridgeId: DriveBridgeId) {
  return env(bridgeEnvName(bridgeId, "WATCH_TOKEN"));
}

export function driveBridgeAppsScriptUrl(bridgeId: DriveBridgeId) {
  return env(bridgeEnvName(bridgeId, "APPS_SCRIPT_URL"));
}

export function driveBridgeAppsScriptWakeSecret(bridgeId: DriveBridgeId) {
  return env(bridgeEnvName(bridgeId, "APPS_SCRIPT_WAKE_SECRET"));
}

export function driveBridgeOriginalsMealsFolderId(bridgeId: DriveBridgeId) {
  return env(bridgeEnvName(bridgeId, "ORIGINALS_MEALS_FOLDER_ID"));
}

export function signDriveBridgeBody(secret: string, timestamp: string, rawBody: string) {
  const digest = createHash("sha256").update(rawBody).digest("hex");
  return createHmac("sha256", secret).update(`${timestamp}.${digest}`).digest("base64url");
}

export function verifyDriveBridgeRequest(request: Request, rawBody: string) {
  const bridgeId = parseBridgeId(request.headers.get("x-life-bridge-id")?.trim() ?? "");
  if (!bridgeId) {
    return { ok: false as const, status: 401, code: "BRIDGE_ID_INVALID", message: "Drive Bridge 身份无效" };
  }

  const secret = driveBridgeSecret(bridgeId);
  if (!secret) {
    return { ok: false as const, status: 503, code: "BRIDGE_NOT_CONFIGURED", message: "Drive Bridge 尚未配置" };
  }

  const timestamp = request.headers.get("x-life-bridge-timestamp")?.trim() ?? "";
  const supplied = request.headers.get("x-life-bridge-signature")?.trim() ?? "";
  const epochSeconds = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(epochSeconds) || Math.abs(now - epochSeconds) > MAX_CLOCK_SKEW_SECONDS) {
    return { ok: false as const, status: 401, code: "BRIDGE_TIMESTAMP_INVALID", message: "Drive Bridge 请求时间无效" };
  }

  const expected = signDriveBridgeBody(secret, timestamp, rawBody);
  if (!supplied || !safeEqual(supplied, expected)) {
    return { ok: false as const, status: 401, code: "BRIDGE_SIGNATURE_INVALID", message: "Drive Bridge 签名无效" };
  }

  return { ok: true as const, bridgeId, identity: driveBridgeIdentity(bridgeId) };
}

export function verifyDriveWatchToken(request: Request) {
  const supplied = request.headers.get("x-goog-channel-token")?.trim() ?? "";
  for (const bridgeId of ["cat", "fish"] as const) {
    const expected = driveBridgeWatchToken(bridgeId);
    if (expected && supplied && safeEqual(supplied, expected)) {
      return { ok: true as const, bridgeId };
    }
  }
  return { ok: false as const };
}
