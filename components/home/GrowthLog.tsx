"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useHomeResources, type DailyRecord } from "./HomeResourcesProvider";

type GrowthLogEntry = DailyRecord;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

function monthKeyFromDate(value: string) {
  return value.slice(0, 7);
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return `${year}年 ${month}月`;
}

function formatMonthDay(date: string) {
  const [, month, day] = date.split("-").map(Number);
  return `${month}月${day}日`;
}

function addMonths(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}`;
}

function totalGems(entry: GrowthLogEntry) {
  return entry.fish.gems + entry.cat.gems + entry.bonus;
}

function formatCoinDelta(value: number) {
  return value > 0 ? `+${value}` : "0";
}

function LogCard({ entry }: { entry: GrowthLogEntry }) {
  return (
    <article className="ui-card-soft ui-card-compact h-12 transition active:scale-[0.995]">
      <div className="grid h-full grid-cols-[4.4rem_minmax(0,1fr)_minmax(0,1fr)_3.45rem_3rem] items-center gap-2">
        <p className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-left text-[13px] font-bold leading-4 tabular-nums tracking-tight ui-text-primary">
          {formatMonthDay(entry.recordDate)}
        </p>

        <p className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-4 tabular-nums tracking-tight ui-text-muted sm:text-xs">
          🐟 {entry.fish.deficit}kcal/{entry.fish.minutes}min
        </p>

        <p className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-4 tabular-nums tracking-tight ui-text-muted sm:text-xs">
          🐱 {entry.cat.deficit}kcal/{entry.cat.minutes}min
        </p>

        <span className="ui-chip-primary inline-flex h-6 w-[3.45rem] items-center justify-center gap-0.5 text-[10px] font-semibold tabular-nums">
          <span aria-hidden className="text-[0.95em]">
            💎
          </span>
          <span>+{totalGems(entry)}</span>
        </span>

        <span className="ui-chip-reward inline-flex h-6 w-[3rem] items-center justify-center gap-0.5 text-[10px] font-semibold tabular-nums">
          <span aria-hidden className="text-[0.95em]">
            🪙
          </span>
          <span>{formatCoinDelta(entry.coins)}</span>
        </span>
      </div>
    </article>
  );
}

export function GrowthLog() {
  const { dailyRecords } = useHomeResources();
  const [open, setOpen] = useState(false);
  const [sheetEnter, setSheetEnter] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const latestRecord = [...dailyRecords].sort((a, b) =>
      b.recordDate.localeCompare(a.recordDate),
    )[0];
    return latestRecord ? monthKeyFromDate(latestRecord.recordDate) : currentMonthKey();
  });
  const titleId = useId();

  const sortedRecords = useMemo(
    () =>
      [...dailyRecords]
        .filter((record) => monthKeyFromDate(record.recordDate) === viewMonth)
        .sort((a, b) => b.recordDate.localeCompare(a.recordDate)),
    [dailyRecords, viewMonth],
  );

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setSheetEnter(true)),
    );
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const closeSheet = () => {
    setSheetEnter(false);
    setOpen(false);
  };

  const onPrevMonth = () => setViewMonth((current) => addMonths(current, -1));
  const onNextMonth = () => setViewMonth((current) => addMonths(current, 1));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ui-nav-button inline-flex w-full whitespace-nowrap text-sm"
      >
        <span aria-hidden>📒</span>
        <span>成长日志</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[55] flex items-end justify-center p-2.5 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="关闭成长日志"
            className={`ui-modal-backdrop absolute inset-0 transition-opacity duration-300 ${
              sheetEnter ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeSheet}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`ui-sheet relative flex h-[78dvh] w-full max-w-lg flex-col overflow-hidden px-4 pt-3 transition-all duration-300 ease-out will-change-transform ${
              sheetEnter
                ? "translate-y-0 opacity-100 sm:scale-100"
                : "translate-y-full opacity-90 sm:translate-y-2 sm:scale-95"
            } pb-[max(1.25rem,env(safe-area-inset-bottom))]`}
          >
            <div className="ui-sheet-handle mx-auto mb-3 h-1 w-10 rounded-full" aria-hidden />

            <div className="ui-soft-panel ui-card-compact">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-6 tracking-tight ui-text-main">
                    📒 成长日志
                  </p>
                  <p className="text-xs font-medium leading-4 ui-text-soft">
                    一起攒下的每一天
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeSheet}
                  className="ui-button-secondary shrink-0 px-3 py-1 text-xs font-semibold"
                >
                  收起
                </button>
              </div>

              <div className="mt-2 flex justify-center">
                <div className="ui-input-shell inline-flex items-center gap-4 px-4 py-1.5">
                  <button
                    type="button"
                    onClick={onPrevMonth}
                    className="ui-button-ghost inline-flex h-7 w-7 items-center justify-center text-sm font-bold leading-none"
                    aria-label="查看上个月"
                  >
                    ‹
                  </button>
                  <h2
                    id={titleId}
                    className="min-w-[7.2rem] text-center text-lg font-semibold leading-6 tracking-tight ui-text-main"
                  >
                    {formatMonthLabel(viewMonth)}
                  </h2>
                  <button
                    type="button"
                    onClick={onNextMonth}
                    className="ui-button-ghost inline-flex h-7 w-7 items-center justify-center text-sm font-bold leading-none"
                    aria-label="查看下个月"
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-2.5 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1">
              {sortedRecords.length > 0 ? (
                <div className="space-y-2">
                  {sortedRecords.map((entry) => (
                    <LogCard key={entry.id} entry={entry} />
                  ))}
                </div>
              ) : (
                <div className="ui-soft-panel ui-card-main py-6 text-center text-sm font-semibold ui-text-muted">
                  这个月还没有成长记录
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
