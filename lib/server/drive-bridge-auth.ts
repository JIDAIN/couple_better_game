import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { FixedLifeIdentity } from "./fixed-life-auth";

const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function driveBridgeActor(): FixedLifeIdentity | null {
  const actor = env("LIFE_DRIVE_BRIDGE_ACTOR");
  if (actor !== "cat" && actor !== "fish") return null;
  return {
    partnerKey: actor,
    displayName: actor === "cat" ? "猫猫" : "鱼鱼",
  };
}

export function signDriveBridgeBody(secret: string, timestamp: string, rawBody: string) {
  const digest = createHash("sha256").update(rawBody).digest("hex");
  return createHmac("sha256", secret).update(`${timestamp}.${digest}`).digest("base64url");
}

export function verifyDriveBridgeRequest(request: Request, rawBody: string) {
  const secret = env("LIFE_DRIVE_BRIDGE_SECRET");
  const identity = driveBridgeActor();
  if (!secret || !identity) {
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

  return { ok: true as const, identity };
}

export function verifyDriveWatchToken(request: Request) {
  const expected = env("LIFE_DRIVE_WATCH_TOKEN");
  const supplied = request.headers.get("x-goog-channel-token")?.trim() ?? "";
  return Boolean(expected && supplied && safeEqual(supplied, expected));
}
