import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  parseAllowedGoogleWebAppRedirect,
} from "../../lib/server/drive-bridge-google-webapp";
import {
  buildDriveProjectKickToken,
  isDriveProjectKickCommandId,
  verifyDriveProjectKickToken,
} from "../../lib/server/drive-bridge-project-kick";
import { clearDriveBridgeConfigCache } from "../../lib/server/drive-bridge-config";

const KEYS = [
  "LIFE_DRIVE_CAT_BRIDGE_SECRET",
  "LIFE_DRIVE_CAT_WATCH_TOKEN",
  "LIFE_DRIVE_CAT_APPS_SCRIPT_URL",
  "LIFE_DRIVE_CAT_APPS_SCRIPT_WAKE_SECRET",
  "LIFE_DRIVE_CAT_ORIGINALS_MEALS_FOLDER_ID",
] as const;

let previous: Record<string, string | undefined> = {};

beforeEach(() => {
  previous = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  process.env.LIFE_DRIVE_CAT_BRIDGE_SECRET = "cat-bridge-secret";
  process.env.LIFE_DRIVE_CAT_WATCH_TOKEN = "cat-watch-token";
  process.env.LIFE_DRIVE_CAT_APPS_SCRIPT_URL = "https://script.google.com/macros/s/example/exec";
  process.env.LIFE_DRIVE_CAT_APPS_SCRIPT_WAKE_SECRET = "cat-wake-secret";
  process.env.LIFE_DRIVE_CAT_ORIGINALS_MEALS_FOLDER_ID = "cat-originals";
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

describe("R10 Harbor project fast wake", () => {
  it("derives a stable wake-only token without exposing the Drive watch token", () => {
    const token = buildDriveProjectKickToken("cat-watch-token");
    expect(token).toBe(buildDriveProjectKickToken("cat-watch-token"));
    expect(token).not.toBe("cat-watch-token");
    expect(token.length).toBeGreaterThan(20);
  });

  it("accepts only valid UUID command ids", () => {
    expect(isDriveProjectKickCommandId("66a5e651-27e9-4550-bb9c-b69b3a0e0781")).toBe(true);
    expect(isDriveProjectKickCommandId("not-a-uuid")).toBe(false);
    expect(isDriveProjectKickCommandId("")).toBe(false);
  });

  it("authenticates the derived Cat kick token against the fixed Cat worker", async () => {
    const token = buildDriveProjectKickToken("cat-watch-token");
    await expect(verifyDriveProjectKickToken("cat", token)).resolves.toMatchObject({
      ok: true,
      bridgeId: "cat",
      config: {
        bridgeId: "cat",
        actor: "cat",
        appsScriptUrl: "https://script.google.com/macros/s/example/exec",
      },
    });
    await expect(verifyDriveProjectKickToken("cat", "wrong-token")).resolves.toEqual({ ok: false });
  });

  it("follows only HTTPS redirects on Google Apps Script content hosts", () => {
    const base = "https://script.google.com/macros/s/example/exec";
    expect(
      parseAllowedGoogleWebAppRedirect(
        "https://script.googleusercontent.com/macros/echo?user_content_key=abc",
        base,
      )?.hostname,
    ).toBe("script.googleusercontent.com");
    expect(parseAllowedGoogleWebAppRedirect("https://accounts.google.com/signin", base)).toBeNull();
    expect(parseAllowedGoogleWebAppRedirect("https://evil.example/steal", base)).toBeNull();
    expect(parseAllowedGoogleWebAppRedirect("http://script.google.com/macros/echo", base)).toBeNull();
  });
});
