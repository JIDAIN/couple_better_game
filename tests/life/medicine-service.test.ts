import { describe, expect, it } from "vitest";
import { medicineStatus, parseMedicinePayload } from "../../lib/life/medicine-service";

describe("medicine service", () => {
  it("accepts quantity and optional expiry fields", () => {
    const result = parseMedicinePayload({ name: "蒙脱石散", quantity: 2, packageExpiryDate: "2029-02-10" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.quantity).toBe(2);
  });
  it("rejects invalid quantity", () => {
    expect(parseMedicinePayload({ name: "药", quantity: -1 }).ok).toBe(false);
  });
  it("derives status without storing it", () => {
    const today = new Date(2026, 8, 2);
    expect(medicineStatus("2026-08-01", today)).toBe("expired");
    expect(medicineStatus("2026-12-01", today)).toBe("soon");
    expect(medicineStatus("2028-01-01", today)).toBe("normal");
    expect(medicineStatus(null, today)).toBe("unknown");
  });
});
