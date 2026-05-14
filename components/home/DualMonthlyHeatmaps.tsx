"use client";

import { useMemo } from "react";
import {
  buildMonthGrid,
  currentMonthLabel,
  defaultHeatmapStartDate,
} from "./mockHeatmapData";
import { HeatmapLegend } from "./HeatmapLegend";
import { PlayerHeatmap } from "./PlayerHeatmap";
import { useHomeResources } from "./HomeResourcesProvider.safe";
import type { HeatmapDay } from "./types";

function lastDateOfMonth(date: Date) {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(last.getDate()).padStart(2, "0")}`;
}

function resolveVisibleStartDate(savedDate: string, monthDate: Date) {
  const fallback = defaultHeatmapStartDate(monthDate);
  const monthEnd = lastDateOfMonth(monthDate);
  if (savedDate >= fallback && savedDate <= monthEnd) return savedDate;
  return fallback;
}

export function DualMonthlyHeatmaps() {
  const {
    dailyRecords,
    heatmapStartDate,
    weeklySuccessDays,
    updateHeatmapStartDate,
  } = useHomeResources();
  const monthDate = useMemo(() => new Date(), []);
  const monthLabel = currentMonthLabel(monthDate);
  const monthEndDate = lastDateOfMonth(monthDate);

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
  const visibleStartDate = resolveVisibleStartDate(heatmapStartDate, monthDate);

  const fishGrid = useMemo(
    () =>
      buildMonthGrid({
        monthDate,
        startDate: visibleStartDate,
        heatByDate: fishHeatByDate,
      }),
    [fishHeatByDate, monthDate, visibleStartDate],
  );
  const catGrid = useMemo(
    () =>
      buildMonthGrid({
        monthDate,
        startDate: visibleStartDate,
        heatByDate: catHeatByDate,
      }),
    [catHeatByDate, monthDate, visibleStartDate],
  );

  return (
    <section
      className="ui-card-hero relative overflow-hidden p-4 sm:p-5"
      aria-label="当月成就"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 top-6 h-24 w-24 rounded-full bg-emerald-200/30 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-4 left-0 h-20 w-20 rounded-full bg-amber-200/24 blur-2xl"
      />

      <div className="relative text-center">
        <h2 className="text-lg font-extrabold tracking-tight text-stone-800 sm:text-[1.28rem]">
          {monthLabel}成就
        </h2>
        <p className="mt-1.5 text-[12px] leading-relaxed text-stone-500">
          周六到周五为一周，已坚持 {weeklySuccessDays} 天
        </p>
      </div>

      <div className="relative mt-3 rounded-2xl border border-white/70 bg-white/45 px-3 py-2.5 shadow-sm shadow-rose-100/25">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-stone-600">第 1 周起始日</p>
          </div>
          <input
            type="date"
            value={visibleStartDate}
            max={monthEndDate}
            onChange={(event) => updateHeatmapStartDate(event.target.value)}
            className="w-[8.7rem] shrink-0 rounded-xl border border-white/80 bg-white/70 px-2.5 py-2 text-xs font-semibold text-stone-700 outline-none transition hover:bg-white/90"
          />
        </div>
      </div>

      <div className="relative mt-4 space-y-3.5">
        <PlayerHeatmap
          title="🐟 的成长热力图"
          subtitle="小鱼也在努力闪闪发光"
          playerShort="🐟"
          grid={fishGrid}
        />
        <PlayerHeatmap
          title="🐱 的成长热力图"
          subtitle="小猫的脚步轻轻但很坚定"
          playerShort="🐱"
          grid={catGrid}
        />
      </div>

      <div className="ui-card-soft relative mt-3.5 px-2 py-3">
        <HeatmapLegend />
      </div>
    </section>
  );
}
