import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMealRecord,
  deleteMealRecord,
  fetchMeals,
  MealApiError,
  updateMealRecord,
} from "../../lib/nutrition/meal-client";
import type { MealRecord, MealWritePayload } from "../../lib/nutrition/meal-service";

const meal: MealRecord = {
  id: "f4ef02e8-e262-4ed7-a76c-8f47b29398cc",
  partnerKey: "fish",
  mealDate: "2026-09-01",
  mealType: "lunch",
  eatenAt: null,
  snackPeriod: null,
  status: "confirmed",
  source: "manual",
  totalCaloriesKcal: 180,
  calorieMinKcal: 160,
  calorieMaxKcal: 200,
  note: null,
  idempotencyKey: "web-meal-1",
  createdAt: "2026-09-01T04:00:00.000Z",
  updatedAt: "2026-09-01T04:00:00.000Z",
  deletedAt: null,
  items: [],
};

const payload: MealWritePayload = {
  partnerKey: "fish",
  mealDate: "2026-09-01",
  mealType: "lunch",
  eatenAt: null,
  snackPeriod: null,
  status: "confirmed",
  source: "manual",
  totalCaloriesKcal: 180,
  calorieMinKcal: 160,
  calorieMaxKcal: 200,
  note: null,
  idempotencyKey: "web-meal-1",
  items: [
    {
      foodId: null,
      rawName: "米饭",
      displayName: "米饭",
      portionDescription: "一小碗",
      estimatedWeightG: null,
      caloriesKcal: 180,
      calorieMinKcal: 160,
      calorieMaxKcal: 200,
      proteinG: null,
      carbsG: null,
      fatG: null,
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("meal browser client", () => {
  it("queries meals by date and partner using the same-origin cloud session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ ok: true, meals: [meal] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchMeals({
      mealDate: "2026-09-01",
      partnerKey: "fish",
    });

    expect(result).toEqual([meal]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/meals?date=2026-09-01&person=fish",
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      }),
    );
  });

  it("creates and updates meals with the canonical meal payload", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ ok: true, meal }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ ok: true, meal }));
    vi.stubGlobal("fetch", fetchMock);

    await createMealRecord(payload);
    await updateMealRecord(meal.id, payload);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/meals",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/meals/${meal.id}`,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    );
  });

  it("soft-deletes through the existing meal endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ ok: true, meal }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await deleteMealRecord(meal.id);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/meals/${meal.id}`,
      expect.objectContaining({
        method: "DELETE",
        credentials: "same-origin",
      }),
    );
  });

  it("surfaces API status and errorCode for UI error states", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          ok: false,
          error: "同步密码不正确或云端会话无效",
          errorCode: "UNAUTHORIZED",
        },
        { status: 401 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchMeals({ mealDate: "2026-09-01", partnerKey: "cat" }),
    ).rejects.toMatchObject<Partial<MealApiError>>({
      status: 401,
      errorCode: "UNAUTHORIZED",
      message: "同步密码不正确或云端会话无效",
    });
  });
});
