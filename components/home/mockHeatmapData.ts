import type { HeatmapDay } from "./types";

export type HeatmapCellData = {
  date: string;
  day: number;
  heat: HeatmapDay;
} | null;

export type WeekColumn = HeatmapCellData[];

export type MonthGrid = WeekColumn[];

const emptyHeat: HeatmapDay = {
  level: "none",
  exercise: "none",
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function firstDayOfMonth(target: Date) {
  return new Date(target.getFullYear(), target.getMonth(), 1);
}

function lastDayOfMonth(target: Date) {
  return new Date(target.getFullYear(), target.getMonth() + 1, 0);
}

export function defaultHeatmapStartDate(target = new Date()) {
  const first = firstDayOfMonth(target);
  const diffFromSaturday = first.getDay() === 6 ? 0 : first.getDay() + 1;
  return formatIsoDate(addDays(first, -diffFromSaturday));
}

export function currentMonthLabel(target = new Date()) {
  return `${target.getFullYear()}年${target.getMonth() + 1}月`;
}

export function buildMonthGrid({
  monthDate = new Date(),
  startDate,
  heatByDate,
}: {
  monthDate?: Date;
  startDate: string;
  heatByDate: Record<string, HeatmapDay>;
}): MonthGrid {
  const start = parseIsoDate(startDate) ?? parseIsoDate(defaultHeatmapStartDate(monthDate))!;
  const targetMonth = monthKey(monthDate);
  const monthEnd = lastDayOfMonth(monthDate);
  const grid: MonthGrid = [];

  for (let weekStart = new Date(start); weekStart <= monthEnd; weekStart = addDays(weekStart, 7)) {
    const week: WeekColumn = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDays(weekStart, offset);
      const iso = formatIsoDate(date);
      if (monthKey(date) !== targetMonth) {
        week.push(null);
        continue;
      }
      week.push({
        date: iso,
        day: date.getDate(),
        heat: heatByDate[iso] ?? emptyHeat,
      });
    }
    grid.push(week);
  }

  return grid;
}

export function dayLabel(cell: HeatmapCellData): string | null {
  if (!cell) return null;
  return `${cell.day}日`;
}
