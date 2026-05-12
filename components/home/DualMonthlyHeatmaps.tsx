"use client";

import { useMemo } from "react";
import {
  catMonthGrid,
  fishMonthGrid,
  mergeMonthGridWithOverrides,
} from "./mockHeatmapData";
import { HeatmapLegend } from "./HeatmapLegend";
import { PlayerHeatmap } from "./PlayerHeatmap";
import { useHomeResources } from "./HomeResourcesProvider";

export function DualMonthlyHeatmaps() {
  const { fishHeatmapOverrides, catHeatmapOverrides } = useHomeResources();

  const fishGrid = useMemo(
    () => mergeMonthGridWithOverrides(fishMonthGrid, fishHeatmapOverrides),
    [fishHeatmapOverrides],
  );
  const catGrid = useMemo(
    () => mergeMonthGridWithOverrides(catMonthGrid, catHeatmapOverrides),
    [catHeatmapOverrides],
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
        <h2 className="text-lg font-extrabold tracking-tight text-stone-800 sm:text-[1.28rem]">当月成就</h2>
        <p className="mt-1.5 text-[12px] leading-relaxed text-stone-500">
          五月的小格子，装的是一起变好的勇气；慢慢来，也很厉害 💌
        </p>
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
