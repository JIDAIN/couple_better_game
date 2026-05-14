"use client";

import { useHomeResources } from "./HomeResourcesProvider";

export function HeatmapLegend() {
  const { visualRules } = useHomeResources();
  const items = [
    { cls: "bg-stone-200/90 border-stone-300/50", label: "未完成" },
    { cls: "bg-emerald-200/95 border-emerald-300/55", label: "一般" },
    { cls: "bg-emerald-600/90 border-emerald-700/35", label: "较好" },
    {
      cls: "bg-gradient-to-br from-amber-300 to-yellow-300 border-amber-400/60",
      label: "超棒",
    },
  ] as const;

  return (
    <div className="flex flex-col items-center gap-2.5 text-[10px] font-semibold text-stone-500 sm:text-[11px]">
      <div className="flex w-full min-w-0 flex-nowrap items-center justify-center gap-x-2 overflow-x-auto sm:gap-x-3">
        <span className="shrink-0 text-stone-400/95">热量缺口</span>
        {items.map((it) => (
          <span
            key={it.label}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap"
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-sm border ${it.cls}`}
              aria-hidden
            />
            {it.label}
          </span>
        ))}
      </div>
      <div className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 text-stone-400">
        <span>🐟 超棒 ≥ {visualRules.heatmap.fish.perfectMin} kcal</span>
        <span>🐱 超棒 ≥ {visualRules.heatmap.cat.perfectMin} kcal</span>
      </div>
      <div className="flex w-full flex-col items-center gap-y-1 sm:w-auto sm:flex-row sm:gap-x-5 sm:gap-y-0">
        <span className="inline-flex w-full items-center justify-center gap-1 sm:w-auto">
          <span className="text-[9px]" aria-hidden>
            🏃
          </span>
          {visualRules.exerciseTag.runMin}-{visualRules.exerciseTag.intenseMin - 1}
          min
        </span>
        <span className="inline-flex w-full items-center justify-center gap-1 sm:w-auto">
          <span className="text-[9px]" aria-hidden>
            🔥
          </span>
          ≥ {visualRules.exerciseTag.intenseMin} min
        </span>
      </div>
    </div>
  );
}
