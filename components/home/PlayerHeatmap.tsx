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
  const colCount = grid.length;

  return (
    <div className="rounded-2xl border border-emerald-100/60 bg-white/55 p-3 shadow-md shadow-emerald-100/30 backdrop-blur-sm sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-stone-800">{title}</h3>
          <p className="text-[11px] text-stone-500">{subtitle}</p>
        </div>
        <span className="text-lg opacity-90" aria-hidden>
          {playerShort}
        </span>
      </div>

      <div
        className="mt-3 grid w-full gap-x-1 gap-y-1 sm:gap-x-1.5 sm:gap-y-1.5"
        style={{
          gridTemplateColumns: `0.65rem repeat(${colCount}, minmax(0, 1fr))`,
        }}
      >
        {weekdayLabels.map((label, rowIndex) => (
          <div key={label} className="contents">
            <div className="flex items-center justify-end pr-0.5 text-[9px] font-semibold leading-none text-stone-400 sm:text-[10px]">
              {label}
            </div>
            {grid.map((week, wi) => {
              const cell = week[rowIndex];
              return cell ? (
                <HeatmapCell
                  key={`${wi}-${rowIndex}`}
                  level={cell.level}
                  exercise={cell.exercise}
                  title={buildCellTitle(
                    playerShort,
                    wi,
                    rowIndex,
                    cell.level,
                    cell.exercise !== "none",
                  )}
                />
              ) : (
                <div
                  key={`${wi}-${rowIndex}`}
                  className="mx-auto h-3 w-full max-w-[18px] rounded-[3px] sm:h-4 sm:max-w-[22px]"
                  aria-hidden
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
