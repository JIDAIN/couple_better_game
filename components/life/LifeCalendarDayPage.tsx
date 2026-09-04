"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";
import { DailyNutritionSummary } from "@/components/life/DailyNutritionSummary";
import { TodayActivityCard } from "@/components/life/today/TodayActivityCard";
import { TodayMoodCard } from "@/components/life/today/TodayMoodCard";
import { TodaySleepCard } from "@/components/life/today/TodaySleepCard";
import { displayDate } from "@/components/life/today/today-life-model";
import { fetchLifeDay, LifeApiError } from "@/lib/life/life-client";
import { fetchMeals, MealApiError } from "@/lib/nutrition/meal-client";
import { preloadMealPhotos } from "@/lib/nutrition/meal-photo-cache";
import type { LifeDayRecord, LifePartnerKey } from "@/lib/life/life-service";
import type { MealRecord, NutritionPartnerKey } from "@/lib/nutrition/meal-service";
import { useStaleQuery } from "@/lib/client/use-stale-query";

const EMPTY_MEALS: MealRecord[] = [];

function mealNames(meal: MealRecord) {
  return meal.items.map((item) => item.displayName || item.rawName).filter(Boolean).join("、") || "已记录一餐";
}

function calorieSummary(meals: MealRecord[]) {
  if (!meals.length) return "未记录";
  if (meals.some((meal) => meal.totalCaloriesKcal == null)) return `${meals.length} 餐`;
  return `${meals.length} 餐 · ${meals.reduce((sum, meal) => sum + (meal.totalCaloriesKcal ?? 0), 0)} kcal`;
}

export function LifeCalendarDayPage({ date }: { date: string }) {
  const router = useRouter();
  const { mePartnerKey, taPartnerKey } = useLifeIdentity();

  const dayFetcher = useCallback(() => fetchLifeDay(date), [date]);
  const dayQuery = useStaleQuery<LifeDayRecord>({ key: `life-day:${date}`, fetcher: dayFetcher, staleMs: 60_000 });

  const meMealsFetcher = useCallback(async () => {
    if (!mePartnerKey) return [] as MealRecord[];
    return (await fetchMeals({ mealDate: date, partnerKey: mePartnerKey as NutritionPartnerKey })).filter((meal) => !meal.deletedAt);
  }, [date, mePartnerKey]);
  const meMealsQuery = useStaleQuery<MealRecord[]>({
    key: `meals:${mePartnerKey ?? "pending"}:${date}`,
    fetcher: meMealsFetcher,
    staleMs: 60_000,
  });

  const taMealsFetcher = useCallback(async () => {
    if (!taPartnerKey) return [] as MealRecord[];
    return (await fetchMeals({ mealDate: date, partnerKey: taPartnerKey as NutritionPartnerKey })).filter((meal) => !meal.deletedAt);
  }, [date, taPartnerKey]);
  const taMealsQuery = useStaleQuery<MealRecord[]>({
    key: `meals:${taPartnerKey ?? "pending"}:${date}`,
    fetcher: taMealsFetcher,
    staleMs: 60_000,
  });

  const day = dayQuery.data ?? null;
  const meMeals = meMealsQuery.data ?? EMPTY_MEALS;
  const taMeals = taMealsQuery.data ?? EMPTY_MEALS;
  const errors = [dayQuery.error, meMealsQuery.error, taMealsQuery.error].filter(Boolean) as Error[];
  const error = errors[0] instanceof LifeApiError || errors[0] instanceof MealApiError
    ? errors[0].message
    : errors.length
      ? "这一天的生活记录暂时没有加载出来"
      : null;

  const warmFoodPhotos = useCallback(() => {
    void preloadMealPhotos([...meMeals, ...taMeals]);
  }, [meMeals, taMeals]);

  const foodHref = `/food?date=${encodeURIComponent(date)}`;
  const warmFoodRoute = useCallback(() => {
    warmFoodPhotos();
    router.prefetch(foodHref);
  }, [foodHref, router, warmFoodPhotos]);

  const openFood = useCallback(() => {
    warmFoodRoute();
    // R8.6 monthly hydration already filled the exact meals:<actor>:<date> keys used by Food.
    // Keep this as a client router transition so the browser never performs a second document load.
    router.push(foodHref);
  }, [foodHref, router, warmFoodRoute]);

  useEffect(() => {
    if (meMeals.length || taMeals.length) warmFoodRoute();
  }, [meMeals.length, taMeals.length, warmFoodRoute]);

  const people = useMemo(() => {
    if (!mePartnerKey || !taPartnerKey) return [] as Array<{ key: LifePartnerKey; label: "我" | "Ta" }>;
    return [{ key: mePartnerKey, label: "我" as const }, { key: taPartnerKey, label: "Ta" as const }];
  }, [mePartnerKey, taPartnerKey]);
  const mealsByPerson = useMemo(() => {
    if (!mePartnerKey || !taPartnerKey) return new Map<LifePartnerKey, MealRecord[]>();
    return new Map<LifePartnerKey, MealRecord[]>([[mePartnerKey, meMeals], [taPartnerKey, taMeals]]);
  }, [meMeals, mePartnerKey, taMeals, taPartnerKey]);

  if (!mePartnerKey || !taPartnerKey) {
    return <AppPageShell title={displayDate(date)} subtitle="正在确认当前账号…"><section className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">正在确认当前账号…</section></AppPageShell>;
  }

  return (
    <AppPageShell
      title={displayDate(date)}
      subtitle="翻开这一天，看看我们留下了什么。"
      actions={<button type="button" className="life-back-link" onClick={() => router.push("/calendar")}>返回月历</button>}
    >
      {error ? <div className="mb-3 rounded-[var(--life-radius-control)] bg-[color:color-mix(in_srgb,var(--life-coral)_14%,white)] px-3 py-2.5 text-sm text-[var(--life-danger)]">{error}</div> : null}
      {day ? (
        <div className="grid gap-3">
          <TodayMoodCard date={date} day={day} readOnly />
          <TodaySleepCard date={date} day={day} readOnly />
          <TodayActivityCard date={date} day={day} readOnly />

          <section className="life-surface life-section-card life-calendar-food-card">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-extrabold text-[var(--life-text)]">🍚 饮食</p>
              <button
                type="button"
                className="life-card-action inline-flex items-center"
                onClick={openFood}
                onPointerEnter={warmFoodRoute}
                onPointerDown={warmFoodRoute}
                onFocus={warmFoodRoute}
              >查看</button>
            </div>
            <div className="mt-3 grid gap-3">
              {people.map((person) => {
                const meals = mealsByPerson.get(person.key) ?? [];
                return (
                  <div key={person.key} className="life-calendar-food-person">
                    <div className="life-calendar-food-list">
                      <div className="flex items-center justify-between gap-2"><p className="text-xs font-extrabold text-[var(--life-text)]">{person.label}</p><span className="text-[9px] font-bold text-[var(--life-text-muted)]">{calorieSummary(meals)}</span></div>
                      {meals.length ? <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-[var(--life-text-body)]">{meals.map((meal) => mealNames(meal)).join("；")}</p> : <p className="mt-1.5 text-xs text-[var(--life-text-muted)]">没有饮食记录</p>}
                    </div>
                    <DailyNutritionSummary meals={meals} label={person.label} />
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : dayQuery.loading ? <section className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">正在翻开这一天…</section> : null}
    </AppPageShell>
  );
}