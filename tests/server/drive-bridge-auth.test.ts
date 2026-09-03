import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  driveBridgeIdentity,
  signDriveBridgeBody,
  verifyDriveBridgeRequest,
  verifyDriveWatchToken,
} from "../../lib/server/drive-bridge-auth";
import { clearDriveBridgeConfigCache } from "../../lib/server/drive-bridge-config";

const CAT_SECRET = "r10-cat-test-secret-long-enough-for-hmac";
const FISH_SECRET = "r10-fish-test-secret-long-enough-for-hmac";
const KEYS = [
  "LIFE_DRIVE_CAT_BRIDGE_SECRET",
  "LIFE_DRIVE_FISH_BRIDGE_SECRET",
  "LIFE_DRIVE_CAT_WATCH_TOKEN",
  "LIFE_DRIVE_FISH_WATCH_TOKEN",
] as const;
let previous: Record<string, string | undefined> = {};

beforeEach(() => {
  previous = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  process.env.LIFE_DRIVE_CAT_BRIDGE_SECRET = CAT_SECRET;
  process.env.LIFE_DRIVE_FISH_BRIDGE_SECRET = FISH_SECRET;
  process.env.LIFE_DRIVE_CAT_WATCH_TOKEN = "cat-watch-token";
  process.env.LIFE_DRIVE_FISH_WATCH_TOKEN = "fish-watch-token";
  clearDriveBridgeConfigCache();
});

afterEach(() => {
  for (const key of KEYS) {
    const value = previous[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  clearDriveBridgeConfigCache();
});

function signedRequest(bridgeId: "cat" | "fish", secret: string, body: string, timestamp?: string) {
  const ts = timestamp ?? String(Math.floor(Date.now() / 1000));
  return new Request("https://example.test/api/drive-bridge/execute", {
    method: "POST",
    headers: {
      "x-life-bridge-id": bridgeId,
      "x-life-bridge-timestamp": ts,
      "x-life-bridge-signature": signDriveBridgeBody(secret, ts, body),
    },
    body,
  });
}

describe("R10 dual Drive bridge auth", () => {
  it("maps each Harbor bridge to exactly one fixed identity", () => {
    expect(driveBridgeIdentity("cat")).toEqual({ partnerKey: "cat", displayName: "猫猫" });
    expect(driveBridgeIdentity("fish")).toEqual({ partnerKey: "fish", displayName: "鱼鱼" });
  });

  it("accepts cat and fish only with their own HMAC secrets", async () => {
    const body = JSON.stringify({ commands: [{ commandId: "abc" }] });

    const cat = await verifyDriveBridgeRequest(signedRequest("cat", CAT_SECRET, body), body);
    expect(cat.ok).toBe(true);
    if (cat.ok) expect(cat.identity.partnerKey).toBe("cat");

    const fish = await verifyDriveBridgeRequest(signedRequest("fish", FISH_SECRET, body), body);
    expect(fish.ok).toBe(true);
    if (fish.ok) expect(fish.identity.partnerKey).toBe("fish");

    await expect(verifyDriveBridgeRequest(signedRequest("fish", CAT_SECRET, body), body)).resolves.toMatchObject({
      ok: false,
      code: "BRIDGE_SIGNATURE_INVALID",
    });
  });

  it("rejects a missing bridge id, tampered body, and stale timestamp", async () => {
    const original = JSON.stringify({ commands: [{ commandId: "abc" }] });
    const now = Math.floor(Date.now() / 1000);
    const timestamp = String(now);
    const signature = signDriveBridgeBody(CAT_SECRET, timestamp, original);

    const missingId = new Request("https://example.test", {
      headers: {
        "x-life-bridge-timestamp": timestamp,
        "x-life-bridge-signature": signature,
      },
    });
    await expect(verifyDriveBridgeRequest(missingId, original)).resolves.toMatchObject({ ok: false, code: "BRIDGE_ID_INVALID" });

    const tampered = JSON.stringify({ commands: [{ commandId: "def" }] });
    await expect(verifyDriveBridgeRequest(signedRequest("cat", CAT_SECRET, original, timestamp), tampered)).resolves.toMatchObject({
      ok: false,
      code: "BRIDGE_SIGNATURE_INVALID",
    });

    const staleTimestamp = String(now - 301);
    await expect(verifyDriveBridgeRequest(signedRequest("cat", CAT_SECRET, original, staleTimestamp), original)).resolves.toMatchObject({
      ok: false,
      code: "BRIDGE_TIMESTAMP_INVALID",
    });
  });

  it("routes Google Drive watch tokens to the matching Harbor project", async () => {
    await expect(verifyDriveWatchToken(new Request("https://example.test", { headers: { "x-goog-channel-token": "cat-watch-token" } }))).resolves.toMatchObject({
      ok: true,
      bridgeId: "cat",
    });
    await expect(verifyDriveWatchToken(new Request("https://example.test", { headers: { "x-goog-channel-token": "fish-watch-token" } }))).resolves.toMatchObject({
      ok: true,
      bridgeId: "fish",
    });
    await expect(verifyDriveWatchToken(new Request("https://example.test", { headers: { "x-goog-channel-token": "wrong" } }))).resolves.toEqual({ ok: false });
  });
});
