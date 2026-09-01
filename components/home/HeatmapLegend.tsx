"use client";

import { useHomeResources } from "./HomeResourcesProvider";
import { AppHeatmapMarker, AppRoleAvatar } from "../ui";

const items = [
  { cls: "heat-cell-empty", label: "未记录" },
  { cls: "heat-cell-miss", label: "未达标" },
  { cls: "heat-cell-normal", label: "一般" },
  { cls: "heat-cell-good", label: "较好" },
  { cls: "heat-cell-great", label: "超棒" },
] as const;

export function HeatmapLegend() {
  const { visualRules } = useHomeResources();

  return (
    <div className="flex flex-col items-center gap-2.5 text-[10px] font-semibold ui-text-muted sm:text-[11px]">
      <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5">
        <span className="shrink-0 ui-text-soft">热量缺口</span>
        {items.map((it) => (
          <span
            key={it.label}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
          >
            <span className={`heat-legend-dot ${it.cls}`} aria-hidden />
            {it.label}
          </span>
        ))}
      </div>
      <div className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 ui-text-soft">
        <span>
          <AppRoleAvatar role="fish" size={14} /> 超棒 ≥{" "}
          {visualRules.heatmap.fish.perfectMin} kcal
        </span>
        <span>
          <AppRoleAvatar role="cat" size={14} /> 超棒 ≥{" "}
          {visualRules.heatmap.cat.perfectMin} kcal
        </span>
      </div>
      <div className="flex w-full flex-col items-center gap-y-1 sm:w-auto sm:flex-row sm:gap-x-5 sm:gap-y-0">
        <span className="inline-flex w-full items-center justify-center gap-1 sm:w-auto">
          <AppHeatmapMarker intensity="run" size={10} />
          {visualRules.exerciseTag.runMin}-
          {visualRules.exerciseTag.intenseMin - 1}
          min
        </span>
        <span className="inline-flex w-full items-center justify-center gap-1 sm:w-auto">
          <AppHeatmapMarker intensity="intense" size={10} />≥{" "}
          {visualRules.exerciseTag.intenseMin} min
        </span>
      </div>
    </div>
  );
}
