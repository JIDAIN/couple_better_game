import type { MonthGrid } from "./mockHeatmapData";
import { may2026DayLabel } from "./mockHeatmapData";
import { HeatmapCell } from "./HeatmapCell";
import type { HeatLevel } from "./types";

/** 周六 → 周五 */
const weekdayLabels = ["六", "日", "一", "二", "三", "四", "五"] as const;

const levelHint: Record<HeatLevel, string> = {
  none: "未完成",
  ok: "一般完成",
  good: "完成较好",
  perfect: "超棒的一天",
};

function buildCellTitle(
  playerShort: string,
  weekIndex: number,
  rowIndex: number,
  level: HeatLevel,
  hasRun: boolean,
) {
  const dateLabel = may2026DayLabel(weekIndex, rowIndex);
  const wk = weekdayLabels[rowIndex];
  const run = hasRun ? "有运动" : "未记录运动";
  const head = dateLabel
    ? `${playerShort} · ${dateLabel} · 周${wk}`
    : `${playerShort} · 周${wk}`;
  return `${head} · 热量缺口${levelHint[level]} · ${run}`;
}

export function PlayerHeatmap({
  title,
  subtitle,
  playerShort,
  grid,
}: {
  title: string;
  subtitle: string;
  playerShort: string;
  grid: MonthGrid;
}) {
  return (
    <div className="ui-card-soft p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-bold tracking-wide text-stone-800">{title}</h3>
          <p className="text-[11px] font-medium text-stone-500">{subtitle}</p>
        </div>
        <span className="text-base opacity-90" aria-hidden>
          {playerShort}
        </span>
      </div>

      <div className="mt-3 space-y-1.5 sm:space-y-2">
        <div
          className="grid items-center gap-x-1 sm:gap-x-1.5"
          style={{ gridTemplateColumns: "2.9rem repeat(7, minmax(0, 1fr))" }}
        >
          <div className="text-[10px] font-semibold text-stone-400"> </div>
          {weekdayLabels.map((label) => (
            <div
              key={`weekday-${label}`}
              className="text-center text-[10px] font-semibold text-stone-400 sm:text-[11px]"
            >
              {label}
            </div>
          ))}
        </div>

        {grid.map((week, weekIndex) => (
          <div
            key={`week-${weekIndex}`}
            className="grid items-center gap-x-1 sm:gap-x-1.5"
            style={{ gridTemplateColumns: "2.9rem repeat(7, minmax(0, 1fr))" }}
          >
            <div className="pr-1 text-[10px] font-semibold text-stone-400 sm:text-[11px]">
              第{weekIndex + 1}周
            </div>
            {week.map((cell, dayIndex) => {
              const level = cell?.level ?? "none";
              const exercise = cell?.exercise ?? "none";
              const title = cell
                ? buildCellTitle(
                    playerShort,
                    weekIndex,
                    dayIndex,
                    cell.level,
                    cell.exercise !== "none",
                  )
                : `${playerShort} · 补齐日期 · 周${weekdayLabels[dayIndex]} · 热量缺口未完成 · 未记录运动`;
              return (
                <HeatmapCell
                  key={`${weekIndex}-${dayIndex}`}
                  level={level}
                  exercise={exercise}
                  title={title}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
