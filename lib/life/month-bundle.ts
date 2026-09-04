import { setStaleQueryData } from "@/lib/client/use-stale-query";
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
  for (const item of bundle.days) {
    setStaleQueryData(`life-day:${item.date}`, item.day);
    setStaleQueryData(
      `meals:${me}:${item.date}`,
      item.meals.filter((meal) => meal.partnerKey === me && !meal.deletedAt),
    );
    setStaleQueryData(
      `meals:${ta}:${item.date}`,
      item.meals.filter((meal) => meal.partnerKey === ta && !meal.deletedAt),
    );
  }
}
