import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  driveBridgeActor,
  signDriveBridgeBody,
  verifyDriveBridgeRequest,
  verifyDriveWatchToken,
} from "../../lib/server/drive-bridge-auth";

const SECRET = "r10-test-secret-long-enough-for-hmac";
let previous: Record<string, string | undefined> = {};

beforeEach(() => {
  previous = {
    LIFE_DRIVE_BRIDGE_SECRET: process.env.LIFE_DRIVE_BRIDGE_SECRET,
    LIFE_DRIVE_BRIDGE_ACTOR: process.env.LIFE_DRIVE_BRIDGE_ACTOR,
    LIFE_DRIVE_WATCH_TOKEN: process.env.LIFE_DRIVE_WATCH_TOKEN,
  };
  process.env.LIFE_DRIVE_BRIDGE_SECRET = SECRET;
  process.env.LIFE_DRIVE_BRIDGE_ACTOR = "cat";
  process.env.LIFE_DRIVE_WATCH_TOKEN = "watch-token";
});

afterEach(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("R10 Drive bridge auth", () => {
  it("binds the bridge to the configured fixed identity", () => {
    expect(driveBridgeActor()).toEqual({ partnerKey: "cat", displayName: "猫猫" });
    process.env.LIFE_DRIVE_BRIDGE_ACTOR = "fish";
    expect(driveBridgeActor()).toEqual({ partnerKey: "fish", displayName: "鱼鱼" });
  });

  it("accepts an HMAC signed body inside the clock window", () => {
    const body = JSON.stringify({ commands: [{ commandId: "abc" }] });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signDriveBridgeBody(SECRET, timestamp, body);
    const request = new Request("https://example.test/api/drive-bridge/execute", {
      method: "POST",
      headers: {
        "x-life-bridge-timestamp": timestamp,
        "x-life-bridge-signature": signature,
      },
      body,
    });
    const result = verifyDriveBridgeRequest(request, body);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.identity.partnerKey).toBe("cat");
  });

  it("rejects a tampered body and stale timestamp", () => {
    const original = JSON.stringify({ commands: [{ commandId: "abc" }] });
    const now = Math.floor(Date.now() / 1000);
    const timestamp = String(now);
    const signature = signDriveBridgeBody(SECRET, timestamp, original);
    const tampered = JSON.stringify({ commands: [{ commandId: "def" }] });
    const request = new Request("https://example.test/api/drive-bridge/execute", {
      headers: {
        "x-life-bridge-timestamp": timestamp,
        "x-life-bridge-signature": signature,
      },
    });
    expect(verifyDriveBridgeRequest(request, tampered)).toMatchObject({ ok: false, code: "BRIDGE_SIGNATURE_INVALID" });

    const staleTimestamp = String(now - 301);
    const staleRequest = new Request("https://example.test/api/drive-bridge/execute", {
      headers: {
        "x-life-bridge-timestamp": staleTimestamp,
        "x-life-bridge-signature": signDriveBridgeBody(SECRET, staleTimestamp, original),
      },
    });
    expect(verifyDriveBridgeRequest(staleRequest, original)).toMatchObject({ ok: false, code: "BRIDGE_TIMESTAMP_INVALID" });
  });

  it("validates the Google Drive watch channel token", () => {
    expect(verifyDriveWatchToken(new Request("https://example.test", { headers: { "x-goog-channel-token": "watch-token" } }))).toBe(true);
    expect(verifyDriveWatchToken(new Request("https://example.test", { headers: { "x-goog-channel-token": "wrong" } }))).toBe(false);
  });
});
