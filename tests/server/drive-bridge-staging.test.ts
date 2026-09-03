import { describe, expect, it } from "vitest";
import {
  assertDriveBridgeOriginalDescriptor,
  DRIVE_BRIDGE_STAGING_MAX_BYTES,
  driveBridgeStagingPath,
} from "../../lib/server/drive-bridge-staging";

describe("R10 Drive bridge staging", () => {
  it("binds a deterministic staging path to bridge identity and command id", () => {
    expect(driveBridgeStagingPath("cat", "123e4567-e89b-12d3-a456-426614174000")).toBe(
      "cat/123e4567-e89b-12d3-a456-426614174000/original",
    );
    expect(driveBridgeStagingPath("fish", "123e4567-e89b-12d3-a456-426614174000")).toBe(
      "fish/123e4567-e89b-12d3-a456-426614174000/original",
    );
  });

  it("rejects unsafe command ids", () => {
    expect(() => driveBridgeStagingPath("cat", "../fish/evil")).toThrow();
  });

  it("accepts supported image types up to 25MB and rejects larger/non-image files", () => {
    expect(assertDriveBridgeOriginalDescriptor({ mimeType: "image/jpeg", size: DRIVE_BRIDGE_STAGING_MAX_BYTES })).toEqual({
      mimeType: "image/jpeg",
      size: DRIVE_BRIDGE_STAGING_MAX_BYTES,
    });
    expect(() => assertDriveBridgeOriginalDescriptor({ mimeType: "application/pdf", size: 100 })).toThrow();
    expect(() => assertDriveBridgeOriginalDescriptor({ mimeType: "image/jpeg", size: DRIVE_BRIDGE_STAGING_MAX_BYTES + 1 })).toThrow();
  });
});
