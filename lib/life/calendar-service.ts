import type { MoodRecord } from "./life-service";

export type LifeMonthMoodDay = {
  date: string;
  moods: MoodRecord[];
};

export type LifeMonthMoodRecord = {
  month: string;
  days: LifeMonthMoodDay[];
};

type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: string };

export function parseLifeMonth(value: unknown): ParseResult<string> {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) {
    return { ok: false, reason: "月份必须是 YYYY-MM" };
  }
  const [year, month] = value.split("-").map(Number);
  if (year < 2000 || year > 2200 || month < 1 || month > 12) {
    return { ok: false, reason: "月份必须是有效的 YYYY-MM" };
  }
  return { ok: true, value };
}

export function monthStartDate(month: string) {
  return `${month}-01`;
}
