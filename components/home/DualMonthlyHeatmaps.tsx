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

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
  const viewMonthKey = monthKey(viewMonthDate);

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
  const hasMonthRecords = dailyRecords.some(
    (record) => record.recordDate.startsWith(viewMonthKey),
  );

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

      <div className="relative mx-auto max-w-[28rem]">
        <div className="rounded-[1.25rem] border border-white/75 bg-gradient-to-br from-white/92 via-rose-50/88 to-amber-50/78 px-4 py-4 text-center shadow-[0_12px_30px_rgba(244,114,182,0.08)] backdrop-blur-sm sm:px-5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-white/70 text-sm font-bold text-stone-500 transition hover:bg-white/95"
              aria-label="查看上个月"
            >
              ‹
            </button>
            <h2 className="text-[1rem] font-bold tracking-tight text-stone-600 sm:text-[1.08rem]">
              {monthLabel} · 成长地图
            </h2>
            <button
              type="button"
              onClick={handleNextMonth}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-white/70 text-sm font-bold text-stone-500 transition hover:bg-white/95"
              aria-label="查看下个月"
            >
              ›
            </button>
          </div>
          <p className="mt-2 text-[13px] font-semibold text-rose-500/90 sm:text-[14px]">
            本周已坚持 {weeklySuccessDays} 天 🌷
          </p>
        </div>
      </div>

      <div className="relative mt-3 rounded-2xl border border-white/70 bg-white/45 px-3 py-2.5 shadow-sm shadow-rose-100/25">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-stone-600">作战开始日</p>
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
          showWeekLabels={hasMonthRecords}
        />
        <PlayerHeatmap
          title="🐱 的成长热力图"
          subtitle="小猫的脚步轻轻，但很坚定"
          playerShort="🐱"
          grid={catGrid}
          showWeekLabels={hasMonthRecords}
        />
      </div>

      <div className="ui-card-soft relative mt-3.5 px-2 py-3">
        <HeatmapLegend />
      </div>
    </section>
  );
}
