import type { MonthGrid } from "./mockHeatmapData";
import { dayLabel } from "./mockHeatmapData";
import { HeatmapCell } from "./HeatmapCell";
import type { HeatLevel } from "./types";

const weekdayLabels = ["六", "日", "一", "二", "三", "四", "五"] as const;

const levelHint: Record<HeatLevel, string> = {
  none: "未完成",
  ok: "一般完成",
  good: "完成较好",
  perfect: "超棒的一天",
};

function buildCellTitle({
  playerShort,
  dateLabel,
  weekday,
  level,
  hasRun,
}: {
  playerShort: string;
  dateLabel: string | null;
  weekday: string;
  level: HeatLevel;
  hasRun: boolean;
}) {
  const run = hasRun ? "有运动" : "未记录运动";
  const head = dateLabel
    ? `${playerShort} · ${dateLabel} · 周${weekday}`
    : `${playerShort} · 周${weekday}`;
  return `${head} · 热量缺口${levelHint[level]} · ${run}`;
}

export function PlayerHeatmap({
  title,
  subtitle,
  playerShort,
  grid,
  showWeekLabels = true,
}: {
  title: string;
  subtitle: string;
  playerShort: string;
  grid: MonthGrid;
  showWeekLabels?: boolean;
}) {
  const gridColumns = showWeekLabels
    ? "2.9rem repeat(7, minmax(0, 1fr))"
    : "repeat(7, minmax(0, 1fr))";

  return (
    <div className="ui-card-soft ui-card-item sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-bold tracking-wide ui-text-main">
            {title}
          </h3>
          <p className="text-[11px] font-medium ui-text-muted">{subtitle}</p>
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
          {showWeekLabels ? (
            <div className="text-[10px] font-semibold ui-text-soft"> </div>
          ) : null}
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
            {showWeekLabels ? (
              <div className="pr-1 text-[10px] font-semibold ui-text-soft sm:text-[11px]">
                第 {weekIndex + 1} 周
              </div>
            ) : null}
            {week.map((cell, dayIndex) => {
              const heat = cell?.heat;
              const level = heat?.level ?? "none";
              const exercise = heat?.exercise ?? "none";
              return (
                <HeatmapCell
                  key={`${weekIndex}-${dayIndex}`}
                  level={level}
                  exercise={exercise}
                  title={buildCellTitle({
                    playerShort,
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
    </div>
  );
}
