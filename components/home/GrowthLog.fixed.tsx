"use client";

import { useMemo, useState } from "react";
import { useHomeResources, type DailyRecord } from "./HomeResourcesProvider.safe";

function totalGems(entry: DailyRecord) {
  return entry.fish.gems + entry.cat.gems + entry.bonus;
}

export function GrowthLog() {
  const { dailyRecords } = useHomeResources();
  const [open, setOpen] = useState(false);
  const sortedRecords = useMemo(
    () => [...dailyRecords].sort((a, b) => b.recordDate.localeCompare(a.recordDate)),
    [dailyRecords],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ui-button-secondary group flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-stone-600 shadow-sm shadow-rose-100/25 transition duration-200 hover:-translate-y-0.5 hover:bg-white/85 active:translate-y-0"
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <span className="text-base" aria-hidden>📖</span>
          <span className="truncate">成长日志</span>
        </span>
        <span className="shrink-0 text-[11px] font-semibold text-stone-400 transition group-hover:text-rose-500">
          查看
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[55] flex items-end justify-center p-2.5 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="关闭成长日志"
            className="absolute inset-0 bg-stone-900/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex max-h-[78dvh] w-full max-w-lg flex-col overflow-hidden rounded-[1.45rem] border border-white/80 bg-gradient-to-b from-rose-50/98 via-white/90 to-amber-50/85 px-4 pt-3 shadow-2xl shadow-rose-200/40 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300/70" aria-hidden />
            <div className="flex items-start justify-between gap-3 rounded-[1.15rem] border border-white/75 bg-white/70 px-3.5 py-3 shadow-sm shadow-rose-100/40">
              <div>
                <h2 className="text-base font-bold text-stone-800">📖 成长日志</h2>
                <p className="mt-0.5 text-[11px] font-medium text-stone-500">看看我们一起攒下的小脚印</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="ui-button-secondary shrink-0 px-3 py-1 text-xs font-semibold text-stone-500">
                收起
              </button>
            </div>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1">
              {sortedRecords.length > 0 ? (
                <div className="space-y-2">
                  {sortedRecords.map((entry) => (
                    <article key={entry.id} className="rounded-[1.2rem] border border-white/70 bg-white/58 px-3 py-3 shadow-sm shadow-rose-100/30 backdrop-blur-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold tracking-tight text-stone-600">{entry.date}</p>
                          <p className="mt-0.5 text-[11px] font-medium text-stone-400">
                            🐟 {entry.fish.deficit} kcal / 🐱 {entry.cat.deficit} kcal
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="rounded-full border border-rose-100/70 bg-rose-50/70 px-2 py-1 text-[10px] font-semibold text-rose-500">💎 +{totalGems(entry)}</span>
                          <span className="rounded-full border border-amber-200/70 bg-amber-50/75 px-2 py-1 text-[10px] font-semibold text-amber-500">🪙 {entry.coins > 0 ? `+${entry.coins}` : "0"}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="ui-card-soft flex min-h-52 flex-col items-center justify-center px-5 py-8 text-center">
                  <span className="text-3xl" aria-hidden>✦</span>
                  <p className="mt-3 text-sm font-semibold text-stone-600">还没有成长日志，今天开始攒第一颗星</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
