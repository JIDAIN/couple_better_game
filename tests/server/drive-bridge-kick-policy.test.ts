import { describe, expect, it } from "vitest";
import { shouldAvoidSecondHarborWake } from "../../lib/server/drive-bridge-kick-policy";

describe("Harbor Fast Wake lock policy", () => {
  it("avoids a second wake when another worker owns the script lock", () => {
    expect(shouldAvoidSecondHarborWake({ ok: false, skipped: "locked" })).toBe(true);
  });

  it("keeps retry available for non-lock worker failures", () => {
    expect(shouldAvoidSecondHarborWake({ ok: false, skipped: "snapshot_failed" })).toBe(false);
    expect(shouldAvoidSecondHarborWake({ ok: true, skipped: "locked" })).toBe(false);
  });
});
