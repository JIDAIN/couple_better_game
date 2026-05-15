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
    <article className="record-item">
      <div className="flex flex-col gap-1.5 sm:grid sm:grid-cols-[4.25rem_9rem_9rem_3.75rem_3.75rem] sm:items-center sm:gap-x-2.5 sm:gap-y-0">
        <div className="flex items-center justify-between gap-2 sm:contents">
          <p className="truncate text-[13px] font-semibold ui-text-main sm:col-start-1">
            {formatMonthDay(entry.recordDate)}
          </p>
          <div className="flex shrink-0 items-center gap-1.5 sm:col-start-4 sm:col-span-2 sm:justify-self-end">
            <span className="ui-price-pill ui-chip-primary text-[10px] tabular-nums">
              💎 +{totalGems(entry)}
            </span>
            <span className="ui-price-pill ui-chip-reward text-[10px] tabular-nums">
              🪙 {formatCoinDelta(entry.coins)}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm ui-text-muted sm:contents">
          <span className="whitespace-nowrap sm:col-start-2">
            🐟 {entry.fish.deficit}kcal / {entry.fish.minutes}min
          </span>
          <span className="whitespace-nowrap sm:col-start-3">
            🐱 {entry.cat.deficit}kcal / {entry.cat.minutes}min
          </span>
        </div>
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
        <div className="fixed inset-0 z-[55] flex items-center justify-center p-3 sm:p-4">
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
            className={`ui-sheet ui-record-sheet relative flex flex-col overflow-hidden transition-all duration-300 ease-out will-change-transform ${
              sheetEnter
                ? "translate-y-0 opacity-100 sm:scale-100"
                : "translate-y-3 opacity-0 sm:scale-95"
            }`}
          >
            <div className="record-sheet-header">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-bold leading-6 tracking-tight ui-text-main">
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
                    className="min-w-[7.2rem] text-center text-base font-semibold leading-6 tracking-tight ui-text-main"
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

            <div className="record-sheet-body">
              {sortedRecords.length > 0 ? (
                <div className="record-list">
                  {sortedRecords.map((entry) => (
                    <LogCard key={entry.id} entry={entry} />
                  ))}
                </div>
              ) : (
                <div className="flex h-full min-h-[12rem] items-center justify-center py-8 text-center text-sm font-semibold ui-text-muted">
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
