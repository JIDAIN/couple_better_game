import { describe, expect, it } from "vitest";
import { buildMonthGridByStartDate, dayLabel } from "../../components/home/mockHeatmapData";
import type { HeatmapDay } from "../../components/home/types";

const activeHeat: HeatmapDay = {
  level: "perfect",
  exercise: "intense",
};

describe("heatmap month grid", () => {
  it("shows previous-month days in the first partial week", () => {
    const grid = buildMonthGridByStartDate({
      monthDate: new Date(2026, 4, 1),
      startDate: "2026-04-25",
      heatByDate: {
        "2026-04-30": activeHeat,
      },
    });

    expect(grid[0].map((cell) => cell?.date)).toEqual([
      "2026-04-25",
      "2026-04-26",
      "2026-04-27",
      "2026-04-28",
      "2026-04-29",
      "2026-04-30",
      "2026-05-01",
    ]);

    const april30 = grid[0][5];
    expect(april30?.isCurrentMonth).toBe(false);
    expect(april30?.heat).toBe(activeHeat);
    expect(dayLabel(april30)).toBe("4/30日");
  });

  it("keeps current-month labels compact", () => {
    const grid = buildMonthGridByStartDate({
      monthDate: new Date(2026, 4, 1),
      startDate: "2026-04-25",
      heatByDate: {},
    });

    expect(dayLabel(grid[0][6])).toBe("1日");
  });
});
