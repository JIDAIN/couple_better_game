import type { HeatmapDay } from "./types";

/**
 * 2026 年 5 月，以周六为一周起始：每列为「周六→周五」一周。
 * 与热力图列顺序一致；null 表示非本月日期。
 */
export const MAY_2026_SAT_START_DAY_GRID: (number | null)[][] = [
  [null, null, null, null, null, null, 1],
  [2, 3, 4, 5, 6, 7, 8],
  [9, 10, 11, 12, 13, 14, 15],
  [16, 17, 18, 19, 20, 21, 22],
  [23, 24, 25, 26, 27, 28, 29],
  [30, 31, null, null, null, null, null],
];

export type WeekColumn = (HeatmapDay | null)[];

/** 每列 = 一周（周六→周五），共 6 列 */
export type MonthGrid = WeekColumn[];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!;
}

/** 将按 5 月 1 日→31 日顺序的 31 个格子，填入周六起始的月历网格 */
function scatterIntoMay2026Grid(daysMay1To31: HeatmapDay[]): MonthGrid {
  const cols: MonthGrid = MAY_2026_SAT_START_DAY_GRID.map((column) =>
    column.map(() => null as HeatmapDay | null),
  );
  for (let c = 0; c < MAY_2026_SAT_START_DAY_GRID.length; c++) {
    for (let r = 0; r < 7; r++) {
      const dom = MAY_2026_SAT_START_DAY_GRID[c]![r];
      if (dom != null) {
        cols[c]![r] = daysMay1To31[dom - 1]!;
      }
    }
  }
  return cols;
}

/** 31 天示例：🐟 偏稳、绿色多 */
const fishDays31: HeatmapDay[] = Array.from({ length: 31 }, (_, i) => {
  const cycle: HeatmapDay[] = [
    { level: "ok", exercise: "run" },
    { level: "good", exercise: "none" },
    { level: "good", exercise: "run" },
    { level: "ok", exercise: "none" },
    { level: "perfect", exercise: "run" },
    { level: "good", exercise: "intense" },
    { level: "ok", exercise: "run" },
    { level: "none", exercise: "none" },
    { level: "good", exercise: "run" },
    { level: "ok", exercise: "none" },
  ];
  return pick(cycle, i + 2);
});

/** 31 天示例：🐱 波动大、金色略多 */
const catDays31: HeatmapDay[] = Array.from({ length: 31 }, (_, i) => {
  const cycle: HeatmapDay[] = [
    { level: "good", exercise: "run" },
    { level: "perfect", exercise: "intense" },
    { level: "ok", exercise: "none" },
    { level: "good", exercise: "none" },
    { level: "perfect", exercise: "run" },
    { level: "good", exercise: "intense" },
    { level: "none", exercise: "none" },
    { level: "ok", exercise: "run" },
    { level: "good", exercise: "run" },
    { level: "good", exercise: "intense" },
  ];
  return pick(cycle, i + 5);
});

export const fishMonthGrid: MonthGrid = scatterIntoMay2026Grid(fishDays31);
export const catMonthGrid: MonthGrid = scatterIntoMay2026Grid(catDays31);

export function may2026DayLabel(weekIndex: number, rowIndex: number): string | null {
  const dom = MAY_2026_SAT_START_DAY_GRID[weekIndex]?.[rowIndex];
  if (dom == null) return null;
  return `5月${dom}日`;
}

/** 按「5 月几号」覆盖当月格子，未覆盖的保留 base */
export function mergeMonthGridWithOverrides(
  base: MonthGrid,
  overrides: Partial<Record<number, HeatmapDay>>,
): MonthGrid {
  return base.map((col, wi) =>
    col.map((cell, ri) => {
      const dom = MAY_2026_SAT_START_DAY_GRID[wi]?.[ri];
      if (dom == null) return null;
      const next = overrides[dom];
      if (next) return next;
      return cell;
    }),
  );
}
