import { describe, expect, it } from "vitest";
import {
  buildHeatmapDay,
  computeCoinPreview,
  computeCoupleBonus,
  computeRecoveryBonus,
  exerciseTagFromMinutes,
  gemsForPerson,
  gemsFromDeficit,
  gemsFromExercise,
  getCoinWeekRange,
  heatLevelFromDeficit,
  isInCoinWeek,
  parseNonNegativeInt,
  parseOptionalWeight,
  type PreviousDailyRecord,
  type SideLogInput,
} from "../../lib/home/settlement-rules";

const side = (deficit: number, minutes: number): SideLogInput => ({
  weightKg: null,
  deficit,
  minutes,
});

const record = (
  recordDate: string,
  fish: Pick<SideLogInput, "deficit" | "minutes">,
  cat: Pick<SideLogInput, "deficit" | "minutes">,
): PreviousDailyRecord => ({
  day: Number(recordDate.slice(-2)),
  recordDate,
  fish,
  cat,
});

describe("input parsers", () => {
  it("parses optional positive weight", () => {
    expect(parseOptionalWeight("")).toBeNull();
    expect(parseOptionalWeight(" 52.5 ")).toBe(52.5);
    expect(parseOptionalWeight("abc")).toBeNull();
    expect(parseOptionalWeight("0")).toBeNull();
    expect(parseOptionalWeight("-1")).toBeNull();
  });

  it("parses non-negative integers with fallback", () => {
    expect(parseNonNegativeInt("12")).toBe(12);
    expect(parseNonNegativeInt("12.9")).toBe(12);
    expect(parseNonNegativeInt("-1", 7)).toBe(7);
    expect(parseNonNegativeInt("abc", 7)).toBe(7);
  });
});

describe("gem settlement rules", () => {
  it("settles fish deficit gems on boundary values", () => {
    expect(gemsFromDeficit("fish", 199)).toBe(0);
    expect(gemsFromDeficit("fish", 200)).toBe(1);
    expect(gemsFromDeficit("fish", 299)).toBe(1);
    expect(gemsFromDeficit("fish", 300)).toBe(2);
    expect(gemsFromDeficit("fish", 499)).toBe(2);
    expect(gemsFromDeficit("fish", 500)).toBe(4);
  });

  it("settles cat deficit gems on boundary values", () => {
    expect(gemsFromDeficit("cat", 99)).toBe(0);
    expect(gemsFromDeficit("cat", 100)).toBe(1);
    expect(gemsFromDeficit("cat", 199)).toBe(1);
    expect(gemsFromDeficit("cat", 200)).toBe(2);
  });

  it("settles exercise gems by person and deficit precondition", () => {
    expect(gemsFromExercise("fish", 29, false)).toBe(0);
    expect(gemsFromExercise("fish", 30, false)).toBe(1);
    expect(gemsFromExercise("fish", 60, false)).toBe(1);

    expect(gemsFromExercise("cat", 29, true)).toBe(0);
    expect(gemsFromExercise("cat", 30, true)).toBe(1);
    expect(gemsFromExercise("cat", 59, true)).toBe(1);
    expect(gemsFromExercise("cat", 60, true)).toBe(2);
    expect(gemsFromExercise("cat", 60, false)).toBe(0);
  });

  it("settles recovery bonus only with yesterday exercise and today's deficit", () => {
    const yesterday = record(
      "2026-05-06",
      { deficit: 200, minutes: 30 },
      { deficit: 100, minutes: 29 },
    );

    expect(computeRecoveryBonus("fish", side(1, 0), yesterday)).toBe(1);
    expect(computeRecoveryBonus("cat", side(1, 0), yesterday)).toBe(0);
    expect(computeRecoveryBonus("fish", side(0, 0), yesterday)).toBe(0);
    expect(computeRecoveryBonus("fish", side(1, 0), null)).toBe(0);
  });

  it("combines deficit, exercise, and recovery gems", () => {
    const yesterday = record(
      "2026-05-06",
      { deficit: 200, minutes: 30 },
      { deficit: 100, minutes: 60 },
    );

    expect(gemsForPerson("fish", side(500, 30), yesterday)).toBe(6);
    expect(gemsForPerson("cat", side(200, 60), yesterday)).toBe(5);
  });

  it("settles couple bonus when both exercised at least 30 minutes", () => {
    expect(computeCoupleBonus(side(0, 30), side(0, 30))).toMatchObject({
      gems: 2,
    });
    expect(computeCoupleBonus(side(0, 30), side(0, 29))).toEqual({
      gems: 0,
      reasons: [],
    });
    expect(computeCoupleBonus(side(0, 30), side(0, 30)).reasons.length).toBe(1);
  });
});

describe("heatmap visual rules", () => {
  it("maps fish heat levels with fish thresholds", () => {
    expect(heatLevelFromDeficit("fish", 199)).toBe("none");
    expect(heatLevelFromDeficit("fish", 200)).toBe("ok");
    expect(heatLevelFromDeficit("fish", 300)).toBe("good");
    expect(heatLevelFromDeficit("fish", 500)).toBe("perfect");
  });

  it("maps cat heat levels with cat thresholds", () => {
    expect(heatLevelFromDeficit("cat", 99)).toBe("none");
    expect(heatLevelFromDeficit("cat", 100)).toBe("ok");
    expect(heatLevelFromDeficit("cat", 200)).toBe("good");
    expect(heatLevelFromDeficit("cat", 300)).toBe("perfect");
  });

  it("maps exercise tags on boundary values", () => {
    expect(exerciseTagFromMinutes(0)).toBe("none");
    expect(exerciseTagFromMinutes(1)).toBe("run");
    expect(exerciseTagFromMinutes(59)).toBe("run");
    expect(exerciseTagFromMinutes(60)).toBe("intense");
  });

  it("builds heatmap day from deficit and exercise", () => {
    expect(buildHeatmapDay("cat", side(300, 60))).toEqual({
      level: "perfect",
      exercise: "intense",
    });
  });
});

describe("coin week helpers", () => {
  it("uses Saturday to Friday as the coin week", () => {
    expect(getCoinWeekRange("2026-05-14")).toEqual({
      start: "2026-05-09",
      end: "2026-05-15",
    });
  });

  it("checks whether records are in the same coin week", () => {
    expect(isInCoinWeek("2026-05-09", "2026-05-14")).toBe(true);
    expect(isInCoinWeek("2026-05-15", "2026-05-14")).toBe(true);
    expect(isInCoinWeek("2026-05-08", "2026-05-14")).toBe(false);
  });
});

describe("coin settlement rules", () => {
  const base = {
    fish: side(0, 0),
    cat: side(0, 0),
    todayDay: 14,
    todayDate: "2026-05-14",
    dailyRecords: [] as PreviousDailyRecord[],
  };

  it("awards a coin when weekly gems cross 30", () => {
    expect(
      computeCoinPreview({
        ...base,
        todayGemTotal: 2,
        currentWeekGemTotal: 29,
      }).delta,
    ).toBe(1);
  });

  it("awards both weekly gem thresholds if one day crosses 30 and 50", () => {
    expect(
      computeCoinPreview({
        ...base,
        todayGemTotal: 25,
        currentWeekGemTotal: 29,
      }).delta,
    ).toBe(2);
  });

  it("does not re-award thresholds that were already reached", () => {
    expect(
      computeCoinPreview({
        ...base,
        todayGemTotal: 10,
        currentWeekGemTotal: 50,
      }).delta,
    ).toBe(0);
  });

  it("awards the configured five-day successful check-in streak once", () => {
    const previousRecords = [
      "2026-05-09",
      "2026-05-10",
      "2026-05-11",
      "2026-05-12",
    ].map((date) =>
      record(date, { deficit: 200, minutes: 0 }, { deficit: 100, minutes: 0 }),
    );

    expect(
      computeCoinPreview({
        ...base,
        fish: side(200, 0),
        cat: side(100, 0),
        todayDate: "2026-05-13",
        todayDay: 13,
        todayGemTotal: 0,
        currentWeekGemTotal: 0,
        dailyRecords: previousRecords,
      }).delta,
    ).toBe(1);
  });

  it("does not add extra streak coins on day six", () => {
    const previousRecords = [
      "2026-05-09",
      "2026-05-10",
      "2026-05-11",
      "2026-05-12",
      "2026-05-13",
    ].map((date) =>
      record(date, { deficit: 200, minutes: 0 }, { deficit: 100, minutes: 0 }),
    );

    expect(
      computeCoinPreview({
        ...base,
        fish: side(200, 0),
        cat: side(100, 0),
        todayDate: "2026-05-14",
        todayDay: 14,
        todayGemTotal: 0,
        currentWeekGemTotal: 0,
        dailyRecords: previousRecords,
      }).delta,
    ).toBe(0);
  });

  it("awards a coin when together exercise reaches twice in the week", () => {
    expect(
      computeCoinPreview({
        ...base,
        fish: side(0, 30),
        cat: side(0, 30),
        todayGemTotal: 0,
        currentWeekGemTotal: 0,
        dailyRecords: [
          record(
            "2026-05-10",
            { deficit: 0, minutes: 30 },
            { deficit: 0, minutes: 30 },
          ),
        ],
      }).delta,
    ).toBe(1);
  });

  it("returns zero and a hint when no coin rule is triggered", () => {
    const result = computeCoinPreview({
      ...base,
      todayGemTotal: 1,
      currentWeekGemTotal: 0,
    });
    expect(result.delta).toBe(0);
    expect(result.hint.length).toBeGreaterThan(0);
  });
});
