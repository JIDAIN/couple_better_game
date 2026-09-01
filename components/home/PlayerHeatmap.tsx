import type { ReactNode } from "react";
import type { MonthGrid } from "./mockHeatmapData";
import { dayLabel } from "./mockHeatmapData";
import { HeatmapCell } from "./HeatmapCell";
import type { HeatLevel } from "./types";
import { AppCard } from "../ui";

const weekdayLabels = ["六", "日", "一", "二", "三", "四", "五"] as const;

const levelHint: Record<HeatLevel, string> = {
  empty: "未记录",
  "over-light": "未达标",
  "over-mid": "未达标",
  "over-strong": "未达标",
  "over-heavy": "未达标",
  none: "未达标",
  ok: "一般",
  good: "较好",
  perfect: "超棒",
};

function buildCellTitle({
  playerLabel,
  dateLabel,
  weekday,
  level,
  hasRun,
}: {
  playerLabel: string;
  dateLabel: string | null;
  weekday: string;
  level: HeatLevel;
  hasRun: boolean;
}) {
  const run = level === "empty" ? "未记录" : hasRun ? "有运动" : "未记录运动";
  const head = dateLabel
    ? `${playerLabel} · ${dateLabel} · 周${weekday}`
    : `${playerLabel} · 周${weekday}`;
  return `${head} · 热量缺口${levelHint[level]} · ${run}`;
}

export function PlayerHeatmap({
  title,
  playerShort,
  playerLabel,
  grid,
}: {
  title: ReactNode;
  playerShort: ReactNode;
  playerLabel: string;
  grid: MonthGrid;
}) {
  const gridColumns = "repeat(7, minmax(0, 1fr))";

  return (
    <AppCard variant="item" className="min-w-0 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="heatmap-card-title">{title}</p>
        </div>
        <span className="text-base opacity-90" aria-hidden>
          {playerShort}
        </span>
      </div>

      <div className="mt-3 space-y-1.5 sm:space-y-2">
        <div
          className="grid items-center gap-x-1 sm:gap-x-1.5"
          style={{ gridTemplateColumns: gridColumns }}
        >
          {weekdayLabels.map((label) => (
            <div
              key={`weekday-${label}`}
              className="text-center text-[10px] font-semibold ui-text-soft sm:text-[11px]"
            >
              {label}
            </div>
          ))}
        </div>

        {grid.map((week, weekIndex) => (
          <div
            key={`week-${weekIndex}`}
            className="grid items-center gap-x-1 sm:gap-x-1.5"
            style={{ gridTemplateColumns: gridColumns }}
          >
            {week.map((cell, dayIndex) => {
              const heat = cell?.heat;
              const level = heat?.level ?? "empty";
              const exercise = heat?.exercise ?? "none";
              return (
                <HeatmapCell
                  key={`${weekIndex}-${dayIndex}`}
                  level={level}
                  exercise={exercise}
                  muted={cell ? !cell.isCurrentMonth : false}
                  title={buildCellTitle({
                    playerLabel,
                    dateLabel: dayLabel(cell),
                    weekday: weekdayLabels[dayIndex],
                    level,
                    hasRun: exercise !== "none",
                  })}
                />
              );
            })}
          </div>
        ))}
      </div>
    </AppCard>
  );
}
