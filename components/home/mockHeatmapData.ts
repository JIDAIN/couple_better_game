import type { HeatmapDay } from "./types";

export type HeatmapCellData = {
  date: string;
  day: number;
  month: number;
  isCurrentMonth: boolean;
  heat: HeatmapDay;
} | null;

export type WeekColumn = HeatmapCellData[];

export type MonthGrid = WeekColumn[];

const emptyHeat: HeatmapDay = {
  level: "none",
  exercise: "none",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

function parseDateKey(value: string) {
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
  return startOfLocalDay(date);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return startOfLocalDay(next);
}

function firstDayOfMonth(target: Date) {
  return startOfLocalDay(new Date(target.getFullYear(), target.getMonth(), 1));
}

function lastDayOfMonth(target: Date) {
  return startOfLocalDay(new Date(target.getFullYear(), target.getMonth() + 1, 0));
}

export function getWeekdayIndexForSatStart(date: Date | string) {
  const target = typeof date === "string" ? parseDateKey(date) : startOfLocalDay(date);
  const safeDate = target ?? startOfLocalDay(new Date());
  return (safeDate.getDay() + 1) % 7;
}

export function getSatStartWeekStart(date: Date | string) {
  const target = typeof date === "string" ? parseDateKey(date) : startOfLocalDay(date);
  const safeDate = target ?? startOfLocalDay(new Date());
  return addDays(safeDate, -getWeekdayIndexForSatStart(safeDate));
}

export function defaultHeatmapStartDate(target = new Date()) {
  return formatDateKey(getSatStartWeekStart(firstDayOfMonth(target)));
}

export function currentMonthLabel(target = new Date()) {
  return `${target.getFullYear()}年${target.getMonth() + 1}月`;
}

export function getCampaignDayCount(startDate: string, today = new Date()) {
  const start = parseDateKey(startDate);
  if (!start) return null;
  const todayStart = startOfLocalDay(today);
  return Math.floor((todayStart.getTime() - start.getTime()) / DAY_MS) + 1;
}

export function getCampaignDayText(startDate: string, today = new Date()) {
  const count = getCampaignDayCount(startDate, today);
  if (count == null || !startDate) {
    return "设置作战开始日后，就可以记录我们的第几天啦";
  }
  if (count <= 0) {
    return "变美变瘦大作战即将开始";
  }
  return `变美变瘦大作战已经开启第 ${count} 天啦`;
}

export function buildMonthGridByStartDate({
  monthDate = new Date(),
  startDate: _startDate,
  heatByDate,
}: {
  monthDate?: Date;
  startDate: string;
  heatByDate: Record<string, HeatmapDay>;
}): MonthGrid {
  void _startDate;
  const monthStart = firstDayOfMonth(monthDate);
  const monthEnd = lastDayOfMonth(monthDate);
  const gridStart = getSatStartWeekStart(monthStart);
  const gridEnd = getSatStartWeekStart(monthEnd);
  const targetMonth = monthKey(monthDate);
  const grid: MonthGrid = [];

  for (
    let weekStart = new Date(gridStart);
    weekStart <= gridEnd;
    weekStart = addDays(weekStart, 7)
  ) {
    const week: WeekColumn = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDays(weekStart, offset);
      const iso = formatDateKey(date);
      week.push({
        date: iso,
        day: date.getDate(),
        month: date.getMonth() + 1,
        isCurrentMonth: monthKey(date) === targetMonth,
        heat: heatByDate[iso] ?? emptyHeat,
      });
    }
    grid.push(week);
  }

  return grid;
}

export function buildMonthGrid(args: {
  monthDate?: Date;
  startDate: string;
  heatByDate: Record<string, HeatmapDay>;
}): MonthGrid {
  return buildMonthGridByStartDate(args);
}

export function dayLabel(cell: HeatmapCellData): string | null {
  if (!cell) return null;
  if (!cell.isCurrentMonth) return `${cell.month}/${cell.day}日`;
  return `${cell.day}日`;
}
