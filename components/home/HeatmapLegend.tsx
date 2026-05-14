"use client";

import { useHomeResources } from "./HomeResourcesProvider";

export function HeatmapLegend() {
  const { visualRules } = useHomeResources();
  const items = [
    { cls: "heat-cell-empty", label: "未完成" },
    { cls: "heat-cell-normal", label: "一般" },
    { cls: "heat-cell-good", label: "较好" },
    { cls: "heat-cell-great", label: "超棒" },
  ] as const;

  return (
    <div className="flex flex-col items-center gap-2.5 text-[10px] font-semibold ui-text-muted sm:text-[11px]">
      <div className="flex w-full min-w-0 flex-nowrap items-center justify-center gap-x-2 overflow-x-auto sm:gap-x-3">
        <span className="shrink-0 ui-text-soft">热量缺口</span>
        {items.map((it) => (
          <span
            key={it.label}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap"
          >
            <span
              className={`heat-cell h-2.5 w-2.5 shrink-0 ${it.cls}`}
              aria-hidden
            />
            {it.label}
          </span>
        ))}
      </div>
      <div className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 ui-text-soft">
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
