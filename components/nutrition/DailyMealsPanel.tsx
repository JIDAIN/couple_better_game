"use client";

import { useCallback } from "react";
import { selectDailyGameOverview } from "../../lib/home/daily-overview-service";
import type { NutritionPartnerKey } from "../../lib/nutrition/meal-service";
import { useHomeResources } from "../home/HomeResourcesProvider";
import {
  DailyMealsPanelCore,
  type LinkedDailyGameOverview,
} from "./DailyMealsPanelCore";

export function DailyMealsPanel() {
  const { dailyRecords } = useHomeResources();

  const getLinkedGameOverview = useCallback(
    (
      date: string,
      partner: NutritionPartnerKey,
    ): LinkedDailyGameOverview => selectDailyGameOverview(dailyRecords, date, partner),
    [dailyRecords],
  );

  return <DailyMealsPanelCore getLinkedGameOverview={getLinkedGameOverview} />;
}
