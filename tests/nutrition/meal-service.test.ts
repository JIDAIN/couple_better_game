import { describe, expect, it } from "vitest";
import {
  parseMealQuery,
  parseMealWritePayload,
} from "../../lib/nutrition/meal-service";

describe("nutrition meal service", () => {
  it("accepts a confirmed ChatGPT meal and derives totals from items", () => {
    const result = parseMealWritePayload({
      partnerKey: "fish",
      mealDate: "2026-09-01",
      mealType: "lunch",
      source: "chatgpt",
      items: [
        {
          rawName: "米饭",
          portionDescription: "一小碗",
          caloriesKcal: 180,
          calorieMinKcal: 160,
          calorieMaxKcal: 200,
        },
        {
          rawName: "清炒蔬菜",
          caloriesKcal: 120,
          calorieMinKcal: 100,
          calorieMaxKcal: 140,
        },
      ],
    });

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        partnerKey: "fish",
        mealDate: "2026-09-01",
        mealType: "lunch",
        source: "chatgpt",
        status: "confirmed",
        totalCaloriesKcal: 300,
        calorieMinKcal: 260,
        calorieMaxKcal: 340,
      }),
    });
  });

  it("keeps a meal-level estimate when one is explicitly provided", () => {
    const result = parseMealWritePayload({
      partnerKey: "cat",
      mealDate: "2026-09-01",
      mealType: "dinner",
      totalCaloriesKcal: 520,
      calorieMinKcal: 480,
      calorieMaxKcal: 570,
      items: [{ rawName: "晚餐组合", caloriesKcal: 510 }],
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        totalCaloriesKcal: 520,
        calorieMinKcal: 480,
        calorieMaxKcal: 570,
      },
    });
  });

  it("rejects snack periods on non-snack meals", () => {
    expect(
      parseMealWritePayload({
        partnerKey: "fish",
        mealDate: "2026-09-01",
        mealType: "breakfast",
        snackPeriod: "morning",
        totalCaloriesKcal: 300,
      }),
    ).toEqual({ ok: false, reason: "只有加餐可以设置 snackPeriod" });
  });

  it("rejects invalid calorie bounds", () => {
    expect(
      parseMealWritePayload({
        partnerKey: "fish",
        mealDate: "2026-09-01",
        mealType: "snack",
        totalCaloriesKcal: 200,
        calorieMinKcal: 220,
        calorieMaxKcal: 260,
      }),
    ).toEqual({ ok: false, reason: "整餐估计热量低于区间下限" });
  });

  it("requires a valid date when listing meals", () => {
    expect(parseMealQuery(new URLSearchParams("date=2026-09-01&person=fish"))).toEqual({
      ok: true,
      value: { mealDate: "2026-09-01", partnerKey: "fish" },
    });
    expect(parseMealQuery(new URLSearchParams("date=2026-02-30"))).toEqual({
      ok: false,
      reason: "date 必须是 YYYY-MM-DD 格式的有效日期",
    });
  });
});
