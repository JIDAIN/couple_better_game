import { describe, expect, it } from "vitest";
import { monthStartDate, parseLifeMonth } from "../../lib/life/calendar-service";

describe("life calendar month parsing", () => {
  it("accepts a valid YYYY-MM month", () => {
    expect(parseLifeMonth("2026-09")).toEqual({ ok: true, value: "2026-09" });
    expect(monthStartDate("2026-09")).toBe("2026-09-01");
  });

  it("rejects malformed or impossible months", () => {
    expect(parseLifeMonth("2026-9")).toMatchObject({ ok: false });
    expect(parseLifeMonth("2026-13")).toMatchObject({ ok: false });
    expect(parseLifeMonth("not-a-month")).toMatchObject({ ok: false });
    expect(parseLifeMonth(null)).toMatchObject({ ok: false });
  });
});
