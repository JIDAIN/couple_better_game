"use client";

import { useMemo, useState } from "react";
import {
  buildMonthGridByStartDate,
  currentMonthLabel,
  defaultHeatmapStartDate,
} from "./mockHeatmapData";
import { HeatmapLegend } from "./HeatmapLegend";
import { PlayerHeatmap } from "./PlayerHeatmap";
import { useHomeResources } from "./HomeResourcesProvider";
import type { HeatmapDay } from "./types";
import { AppButton, AppInput } from "../ui";

function lastDateOfMonth(date: Date) {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(last.getDate()).padStart(2, "0")}`;
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function resolveVisibleStartDate(savedDate: string, monthDate: Date) {
  const fallback = defaultHeatmapStartDate(monthDate);
  return /^\d{4}-\d{2}-\d{2}$/.test(savedDate) ? savedDate : fallback;
}

export function DualMonthlyHeatmaps() {
  const {
    dailyRecords,
    heatmapStartDate,
    weeklySuccessDays,
    updateHeatmapStartDate,
  } = useHomeResources();
  const [viewMonthDate, setViewMonthDate] = useState(() => monthStart(new Date()));

  const monthLabel = currentMonthLabel(viewMonthDate);
  const monthEndDate = lastDateOfMonth(viewMonthDate);

  const fishHeatByDate = useMemo(
    () =>
      dailyRecords.reduce<Record<string, HeatmapDay>>((acc, record) => {
        acc[record.recordDate] = record.fishHeat;
        return acc;
      }, {}),
    [dailyRecords],
  );
  const catHeatByDate = useMemo(
    () =>
      dailyRecords.reduce<Record<string, HeatmapDay>>((acc, record) => {
        acc[record.recordDate] = record.catHeat;
        return acc;
      }, {}),
    [dailyRecords],
  );

  const visibleStartDate = resolveVisibleStartDate(heatmapStartDate, viewMonthDate);

  const fishGrid = useMemo(
    () =>
      buildMonthGridByStartDate({
        monthDate: viewMonthDate,
        startDate: visibleStartDate,
        heatByDate: fishHeatByDate,
      }),
    [fishHeatByDate, viewMonthDate, visibleStartDate],
  );
  const catGrid = useMemo(
    () =>
      buildMonthGridByStartDate({
        monthDate: viewMonthDate,
        startDate: visibleStartDate,
        heatByDate: catHeatByDate,
      }),
    [catHeatByDate, viewMonthDate, visibleStartDate],
  );

  const handlePrevMonth = () => {
    setViewMonthDate((current) => addMonths(current, -1));
  };

  const handleNextMonth = () => {
    setViewMonthDate((current) => addMonths(current, 1));
  };

  return (
    <section
      className="app-card--hero app-card--main relative w-full overflow-hidden sm:p-5"
      aria-label="当月成就"
    >
      <div
        aria-hidden
        className="ui-ambient-growth pointer-events-none absolute -right-8 top-6 h-24 w-24 rounded-full blur-2xl"
      />
      <div
        aria-hidden
        className="ui-ambient-reward pointer-events-none absolute bottom-4 left-0 h-20 w-20 rounded-full blur-2xl"
      />

      <div className="relative mx-auto max-w-[28rem]">
        <div className="app-card--panel app-card--main text-center sm:px-5">
          <div className="flex items-center justify-between gap-2">
            <AppButton
              type="button"
              onClick={handlePrevMonth}
              className="app-button--ghost inline-flex h-8 w-8 items-center justify-center text-sm font-bold"
              aria-label="查看上个月"
            >
              ←
            </AppButton>
            <h2 className="text-[1rem] font-bold tracking-tight ui-text-main sm:text-[1.08rem]">
              {monthLabel} · 成长地图
            </h2>
            <AppButton
              type="button"
              onClick={handleNextMonth}
              className="app-button--ghost inline-flex h-8 w-8 items-center justify-center text-sm font-bold"
              aria-label="查看下个月"
            >
              →
            </AppButton>
          </div>
          <p className="mt-2 text-[13px] font-semibold ui-text-primary sm:text-[14px]">
            本周已坚持 {weeklySuccessDays} 天 🌟
          </p>
        </div>
      </div>

      <div className="app-card--panel app-card--compact relative mt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold ui-text-muted">作战开始日</p>
          </div>
          <AppInput
            type="date"
            value={visibleStartDate}
            max={monthEndDate}
            onChange={(event) => updateHeatmapStartDate(event.target.value)}
            className="app-input w-[8.7rem] shrink-0 px-2.5 py-2 text-xs font-semibold outline-none transition"
          />
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]">
        <PlayerHeatmap
          title="🐟 的成长热力图"
          subtitle="小鱼也在努力闪闪发光"
          playerShort="🐟"
          grid={fishGrid}
        />
        <PlayerHeatmap
          title="🐱 的成长热力图"
          subtitle="小猫的脚步轻轻，但很坚定"
          playerShort="🐱"
          grid={catGrid}
        />
      </div>

      <div className="app-card--soft app-card--compact relative mt-3.5">
        <HeatmapLegend />
      </div>
    </section>
  );
}
