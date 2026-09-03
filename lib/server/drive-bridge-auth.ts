import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { FixedLifeIdentity } from "./fixed-life-auth";
import {
  getDriveBridgeConfig,
  type DriveBridgeId,
  type DriveBridgeRuntimeConfig,
} from "./drive-bridge-config";

const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseDriveBridgeId(value: string): DriveBridgeId | null {
  return value === "cat" || value === "fish" ? value : null;
}

export function driveBridgeIdentity(bridgeId: DriveBridgeId): FixedLifeIdentity {
  return {
    partnerKey: bridgeId,
    displayName: bridgeId === "cat" ? "猫猫" : "鱼鱼",
  };
}

export function signDriveBridgeBody(secret: string, timestamp: string, rawBody: string) {
  const digest = createHash("sha256").update(rawBody).digest("hex");
  return createHmac("sha256", secret).update(`${timestamp}.${digest}`).digest("base64url");
}

export async function verifyDriveBridgeRequest(request: Request, rawBody: string) {
  const bridgeId = parseDriveBridgeId(request.headers.get("x-life-bridge-id")?.trim() ?? "");
  if (!bridgeId) {
    return { ok: false as const, status: 401, code: "BRIDGE_ID_INVALID", message: "Drive Bridge 身份无效" };
  }

  let config: DriveBridgeRuntimeConfig | null;
  try {
    config = await getDriveBridgeConfig(bridgeId);
  } catch {
    return { ok: false as const, status: 503, code: "BRIDGE_CONFIG_UNAVAILABLE", message: "Drive Bridge 配置暂时不可用" };
  }
  if (!config) {
    return { ok: false as const, status: 503, code: "BRIDGE_NOT_CONFIGURED", message: "Drive Bridge 尚未配置" };
  }

  const timestamp = request.headers.get("x-life-bridge-timestamp")?.trim() ?? "";
  const supplied = request.headers.get("x-life-bridge-signature")?.trim() ?? "";
  const epochSeconds = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(epochSeconds) || Math.abs(now - epochSeconds) > MAX_CLOCK_SKEW_SECONDS) {
    return { ok: false as const, status: 401, code: "BRIDGE_TIMESTAMP_INVALID", message: "Drive Bridge 请求时间无效" };
  }

  const expected = signDriveBridgeBody(config.bridgeSecret, timestamp, rawBody);
  if (!supplied || !safeEqual(supplied, expected)) {
    return { ok: false as const, status: 401, code: "BRIDGE_SIGNATURE_INVALID", message: "Drive Bridge 签名无效" };
  }

  return { ok: true as const, bridgeId, identity: driveBridgeIdentity(bridgeId), config };
}

export async function verifyDriveWatchToken(request: Request) {
  const supplied = request.headers.get("x-goog-channel-token")?.trim() ?? "";
  if (!supplied) return { ok: false as const };
  for (const bridgeId of ["cat", "fish"] as const) {
    try {
      const config = await getDriveBridgeConfig(bridgeId);
      if (config?.watchToken && safeEqual(supplied, config.watchToken)) {
        return { ok: true as const, bridgeId, config };
      }
    } catch {
      continue;
    }
  }
  return { ok: false as const };
}
