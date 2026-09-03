"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";
import { DailyNutritionSummary } from "@/components/life/DailyNutritionSummary";
import { TodayActivityCard } from "@/components/life/today/TodayActivityCard";
import { TodayMoodCard } from "@/components/life/today/TodayMoodCard";
import { TodaySleepCard } from "@/components/life/today/TodaySleepCard";
import { displayDate } from "@/components/life/today/today-life-model";
import { fetchLifeDay, LifeApiError } from "@/lib/life/life-client";
import { fetchMeals, MealApiError } from "@/lib/nutrition/meal-client";
import type { LifeDayRecord, LifePartnerKey } from "@/lib/life/life-service";
import type { MealRecord, NutritionPartnerKey } from "@/lib/nutrition/meal-service";
import { useStaleQuery } from "@/lib/client/use-stale-query";

type CalendarDayBundle = { day: LifeDayRecord; meMeals: MealRecord[]; taMeals: MealRecord[] };
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
  const { mePartnerKey, taPartnerKey } = useLifeIdentity();
  const fetcher = useCallback(async (): Promise<CalendarDayBundle> => {
    if (!mePartnerKey || !taPartnerKey) throw new Error("正在确认当前账号");
    const [day, meMeals, taMeals] = await Promise.all([
      fetchLifeDay(date),
      fetchMeals({ mealDate: date, partnerKey: mePartnerKey as NutritionPartnerKey }),
      fetchMeals({ mealDate: date, partnerKey: taPartnerKey as NutritionPartnerKey }),
    ]);
    return {
      day,
      meMeals: meMeals.filter((meal) => meal.deletedAt == null),
      taMeals: taMeals.filter((meal) => meal.deletedAt == null),
    };
  }, [date, mePartnerKey, taPartnerKey]);
  const query = useStaleQuery<CalendarDayBundle>({ key: `calendar-day:${date}:${mePartnerKey ?? "pending"}`, fetcher, staleMs: 30_000 });
  const day = query.data?.day ?? null;
  const meMeals = query.data?.meMeals ?? EMPTY_MEALS;
  const taMeals = query.data?.taMeals ?? EMPTY_MEALS;
  const error = query.error instanceof LifeApiError || query.error instanceof MealApiError ? query.error.message : query.error ? "这一天的生活记录暂时没有加载出来" : null;

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
    <AppPageShell title={displayDate(date)} subtitle="翻开这一天，看看我们留下了什么。" actions={<Link href="/calendar" className="life-back-link">返回月历</Link>}>
      {error ? <div className="mb-3 rounded-[var(--life-radius-control)] bg-[color:color-mix(in_srgb,var(--life-coral)_14%,white)] px-3 py-2.5 text-sm text-[var(--life-danger)]">{error}</div> : null}
      {day ? (
        <div className="grid gap-3">
          <TodayMoodCard date={date} day={day} readOnly />
          <TodaySleepCard date={date} day={day} readOnly />
          <TodayActivityCard date={date} day={day} readOnly />

          <section className="life-surface life-section-card life-calendar-food-card">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-extrabold text-[var(--life-text)]">🍚 饮食</p>
              <Link href={`/food?date=${encodeURIComponent(date)}`} className="life-card-action inline-flex items-center">查看</Link>
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
      ) : query.loading ? <section className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">正在翻开这一天…</section> : null}
    </AppPageShell>
  );
}
