import { describe, expect, it } from "vitest";
import {
  buildChatgptMealIdempotencyKey,
  isChatgptMealIdempotencyKey,
  prepareConfirmedChatgptMeal,
} from "../../lib/nutrition/chatgpt-meal-protocol";

const draft = {
  partnerKey: "fish",
  mealDate: "2026-09-02",
  mealType: "lunch",
  eatenAt: "2026-09-02T12:20:00+08:00",
  snackPeriod: null,
  totalCaloriesKcal: 430,
  calorieMinKcal: 390,
  calorieMaxKcal: 480,
  note: "ChatGPT 估算后确认",
  items: [
    {
      foodId: null,
      rawName: "米饭",
      displayName: "米饭",
      portionDescription: "一小碗",
      estimatedWeightG: 120,
      caloriesKcal: 180,
      calorieMinKcal: 160,
      calorieMaxKcal: 200,
      proteinG: null,
      carbsG: null,
      fatG: null,
    },
    {
      foodId: null,
      rawName: "番茄炒蛋",
      displayName: "番茄炒蛋",
      portionDescription: "一份",
      estimatedWeightG: null,
      caloriesKcal: 250,
      calorieMinKcal: 230,
      calorieMaxKcal: 280,
      proteinG: null,
      carbsG: null,
      fatG: null,
    },
  ],
};

describe("ChatGPT meal persistence protocol", () => {
  it("builds a stable chatgpt-prefixed idempotency key", () => {
    const key = buildChatgptMealIdempotencyKey(
      "fish",
      "2026-09-02",
      "confirm 00:21:03 #1",
    );

    expect(key).toBe("chatgpt:fish:2026-09-02:confirm-00-21-03-1");
    expect(isChatgptMealIdempotencyKey(key)).toBe(true);
  });

  it("forces source/status/idempotency after explicit confirmation", () => {
    const key = "chatgpt:fish:2026-09-02:meal-001";
    const result = prepareConfirmedChatgptMeal(
      { ...draft, source: "manual", status: "draft", idempotencyKey: "wrong" },
      key,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.source).toBe("chatgpt");
    expect(result.value.status).toBe("confirmed");
    expect(result.value.idempotencyKey).toBe(key);
  });

  it("rejects non-chatgpt idempotency keys", () => {
    const result = prepareConfirmedChatgptMeal(draft, "web-meal-1");
    expect(result).toMatchObject({ ok: false });
  });

  it("requires food items for ChatGPT persistence", () => {
    const result = prepareConfirmedChatgptMeal(
      { ...draft, items: [], totalCaloriesKcal: 430 },
      "chatgpt:fish:2026-09-02:meal-002",
    );

    expect(result).toMatchObject({
      ok: false,
      reason: "ChatGPT 记上时至少需要一个食物明细",
    });
  });

  it("rejects a meal total that does not equal fully known item totals", () => {
    const result = prepareConfirmedChatgptMeal(
      { ...draft, totalCaloriesKcal: 440 },
      "chatgpt:fish:2026-09-02:meal-003",
    );

    expect(result).toMatchObject({
      ok: false,
      reason: "ChatGPT 餐食总热量必须等于已完整估算的食物明细热量之和",
    });
  });

  it("allows saving food facts without inventing calories", () => {
    const result = prepareConfirmedChatgptMeal(
      {
        partnerKey: "cat",
        mealDate: "2026-09-02",
        mealType: "dinner",
        items: [
          { rawName: "烤鱼", caloriesKcal: null },
          { rawName: "青菜" },
        ],
      },
      "chatgpt:cat:2026-09-02:meal-no-kcal",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalCaloriesKcal).toBeNull();
    expect(result.value.items.map((item) => item.caloriesKcal)).toEqual([null, null]);
  });
});
