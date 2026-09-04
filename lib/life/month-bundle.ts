import { invalidateStaleQuery, peekStaleQuery, setStaleQueryDataMany } from "../client/use-stale-query";
import type { LifeMonthMoodRecord } from "./calendar-service";
import type { LifeDayRecord, LifePartnerKey } from "./life-service";
import type { MealRecord } from "../nutrition/meal-service";

export type LifeMonthBundleDay = {
  date: string;
  day: LifeDayRecord;
  meals: MealRecord[];
};

export type LifeMonthBundle = {
  month: string;
  days: LifeMonthBundleDay[];
};

export function lifeMonthMoodsFromBundle(bundle: LifeMonthBundle): LifeMonthMoodRecord {
  return {
    month: bundle.month,
    days: bundle.days.map((item) => ({ date: item.date, moods: item.day.moods })),
  };
}

export function hydrateLifeMonthBundle(
  bundle: LifeMonthBundle,
  me: LifePartnerKey,
  ta: LifePartnerKey,
) {
  const entries: Array<{ key: string; data: unknown }> = [];
  for (const item of bundle.days) {
    entries.push(
      { key: `life-day:${item.date}`, data: item.day },
      {
        key: `meals:${me}:${item.date}`,
        data: item.meals.filter((meal) => meal.partnerKey === me && !meal.deletedAt),
      },
      {
        key: `meals:${ta}:${item.date}`,
        data: item.meals.filter((meal) => meal.partnerKey === ta && !meal.deletedAt),
      },
    );
  }
  entries.push({ key: `life-month:${bundle.month}`, data: lifeMonthMoodsFromBundle(bundle) });
  setStaleQueryDataMany(entries);
}

export function syncLifeDayCaches(date: string, day: LifeDayRecord) {
  const month = date.slice(0, 7);
  const bundleKey = `life-month-bundle:${month}`;
  const entries: Array<{ key: string; data: unknown }> = [{ key: `life-day:${date}`, data: day }];
  const monthCache = peekStaleQuery<LifeMonthMoodRecord>(`life-month:${month}`);
  if (monthCache) {
    const days = monthCache.days.filter((item) => item.date !== date);
    days.push({ date, moods: day.moods });
    days.sort((left, right) => left.date.localeCompare(right.date));
    entries.push({ key: `life-month:${month}`, data: { ...monthCache, days } });
  }

  const bundleCache = peekStaleQuery<LifeMonthBundle>(bundleKey);
  if (bundleCache) {
    const existing = bundleCache.days.find((item) => item.date === date);
    const days = bundleCache.days.filter((item) => item.date !== date);
    days.push({ date, day, meals: existing?.meals ?? [] });
    days.sort((left, right) => left.date.localeCompare(right.date));
    entries.push({ key: bundleKey, data: { ...bundleCache, days } });
  }
  setStaleQueryDataMany(entries);

  // The bundle can already be in flight without having data yet. Mark that request
  // stale so its older snapshot cannot arrive after a mood write and roll the
  // calendar back. The cache layer will transparently retry it after the write.
  if (!bundleCache) invalidateStaleQuery(bundleKey);
}
