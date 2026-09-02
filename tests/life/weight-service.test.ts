import { describe, expect, it } from "vitest";
import { parseWeightPartner, parseWeightWritePayload } from "../../lib/life/weight-service";

describe("weight service", () => {
  it("accepts supported partners", () => {
    expect(parseWeightPartner("cat")).toEqual({ ok: true, value: "cat" });
    expect(parseWeightPartner("fish")).toEqual({ ok: true, value: "fish" });
    expect(parseWeightPartner("other").ok).toBe(false);
  });

  it("accepts a manual weight payload with optional note", () => {
    const result = parseWeightWritePayload({
      partnerKey: "cat",
      measurementDate: "2026-09-02",
      measuredAt: null,
      weightKg: 52.63,
      note: "早晨",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        partnerKey: "cat",
        measurementDate: "2026-09-02",
        measuredAt: null,
        weightKg: 52.63,
        note: "早晨",
      },
    });
  });

  it("rejects invalid dates and weights", () => {
    expect(parseWeightWritePayload({ partnerKey: "cat", measurementDate: "2026-02-30", weightKg: 50 }).ok).toBe(false);
    expect(parseWeightWritePayload({ partnerKey: "cat", measurementDate: "2026-09-02", weightKg: 0 }).ok).toBe(false);
    expect(parseWeightWritePayload({ partnerKey: "cat", measurementDate: "2026-09-02", weightKg: 500 }).ok).toBe(false);
  });
});
