"use client";

import { useSyncExternalStore } from "react";
import { useHomeResources } from "./HomeResourcesProvider";
import { getCampaignDayCount } from "./mockHeatmapData";

import { CoupleGrowthPanel } from "./CoupleGrowthPanel";
import { DualMonthlyHeatmaps } from "./DualMonthlyHeatmaps";
import { EncouragementQuote } from "./EncouragementQuote";
import { ExchangeShop } from "./ExchangeShop";
import { GameTitle } from "./GameTitle";
import { GrowthLog } from "./GrowthLog";
import { HomeResourcesProvider } from "./HomeResourcesProvider";
import { RecordTodaySettlement as RecordTodayButton } from "./RecordTodayButton";

function CampaignProgressBadge() {
  const { heatmapStartDate } = useHomeResources();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const campaignDayCount = mounted
    ? getCampaignDayCount(heatmapStartDate, new Date())
    : null;
  const hasStartDate = heatmapStartDate.length > 0;
  const hasStarted = campaignDayCount != null && campaignDayCount > 0;

  if (!hasStartDate) {
    return (
      <div className="ui-card-soft ui-card-compact mx-auto w-full max-w-[28rem] text-center text-[12px] font-semibold ui-text-muted">
        设置作战开始日后，就能记录我们的第几天�?
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className="ui-card-soft ui-card-compact mx-auto w-full max-w-[28rem] text-center text-[12px] font-semibold ui-text-main">
        变美变瘦大作战即将开�?
      </div>
    );
  }

  return (
    <div className="ui-card-soft ui-card-compact mx-auto w-full max-w-[28rem] text-center">
      <span className="ui-badge ui-chip-primary">变美变瘦大作战已开�?/span>
      <span className="ml-2 text-[1.03rem] font-black tabular-nums ui-text-main">
        �?{campaignDayCount} �?�?
      </span>
    </div>
  );
}

export function HomeScreen() {
  return (
    <HomeResourcesProvider>
      <div className="relative min-h-dvh overflow-x-hidden pb-8 pt-7">
        <div
          aria-hidden
          className="ui-ambient-primary pointer-events-none absolute -right-20 top-10 h-56 w-56 rounded-full blur-3xl"
        />
        <div
          aria-hidden
          className="ui-ambient-reward pointer-events-none absolute -left-24 top-1/3 h-64 w-64 rounded-full blur-3xl"
        />
        <div
          aria-hidden
          className="ui-ambient-growth pointer-events-none absolute bottom-0 right-1/4 h-48 w-48 rounded-full blur-3xl"
        />

        <div className="relative mx-auto flex w-full max-w-md flex-col gap-4.5 px-4 sm:px-5">
          <GameTitle />

          <CampaignProgressBadge />

          <CoupleGrowthPanel />

          <DualMonthlyHeatmaps />

          <EncouragementQuote />

          <RecordTodayButton buttonVariant="today" />

          <div className="grid w-full grid-cols-2 gap-2 pt-1">
            <GrowthLog />
            <ExchangeShop />
          </div>
        </div>
      </div>
    </HomeResourcesProvider>
  );
}
