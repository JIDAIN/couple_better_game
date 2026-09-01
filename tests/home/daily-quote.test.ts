import { describe, expect, it } from "vitest";
import {
  DAILY_QUOTES,
  formatLocalDateKey,
  getDailyQuote,
} from "../../lib/home/daily-quote";

describe("daily quote", () => {
  it("keeps the same quote for the same date key", () => {
    expect(getDailyQuote("2026-05-18")).toBe(getDailyQuote("2026-05-18"));
  });

  it("returns a quote from the configured gentle quote list", () => {
    expect(DAILY_QUOTES).toContain(getDailyQuote("2026-05-19"));
  });

  it("formats a local date key for seeding", () => {
    expect(formatLocalDateKey(new Date(2026, 4, 8))).toBe("2026-05-08");
  });
});
