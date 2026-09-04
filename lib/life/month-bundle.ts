import { setStaleQueryDataMany } from "@/lib/client/use-stale-query";
import type { LifeDayRecord, LifePartnerKey } from "./life-service";
import type { MealRecord } from "@/lib/nutrition/meal-service";

export type LifeMonthBundleDay = {
  date: string;
  day: LifeDayRecord;
  meals: MealRecord[];
};

export type LifeMonthBundle = {
  month: string;
  days: LifeMonthBundleDay[];
};

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
  setStaleQueryDataMany(entries);
}
