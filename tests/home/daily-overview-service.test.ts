import { describe, expect, it } from "vitest";
import { selectDailyGameOverview } from "../../lib/home/daily-overview-service";
import type { DailyRecord } from "../../lib/home/types";

const record: DailyRecord = {
  id: "daily-1",
  date: "9月1日",
  recordDate: "2026-09-01",
  createdAt: "2026-09-01T08:00:00.000Z",
  day: 1,
  fish: { weightKg: 60.1, deficit: 320, minutes: 30, gems: 2 },
  cat: { weightKg: 52.4, deficit: 180, minutes: 45, gems: 2 },
  bonus: 0,
  coins: 0,
  fishHeat: { level: "good", exercise: "run" },
  catHeat: { level: "ok", exercise: "run" },
};

describe("daily overview service", () => {
  it("selects the requested role from the requested date", () => {
    expect(selectDailyGameOverview([record], "2026-09-01", "cat")).toEqual({
      hasRecord: true,
      deficitKcal: 180,
      exerciseMinutes: 45,
      weightKg: 52.4,
    });

    expect(selectDailyGameOverview([record], "2026-09-01", "fish")).toEqual({
      hasRecord: true,
      deficitKcal: 320,
      exerciseMinutes: 30,
      weightKg: 60.1,
    });
  });

  it("returns an explicit missing state when that date has no daily record", () => {
    expect(selectDailyGameOverview([record], "2026-09-02", "cat")).toEqual({
      hasRecord: false,
      deficitKcal: null,
      exerciseMinutes: null,
      weightKg: null,
    });
  });
});