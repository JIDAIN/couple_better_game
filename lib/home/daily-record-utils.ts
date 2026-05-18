import {
  formatRecordDateFromIso,
  isoDateFromMayDay,
  parseIsoDate,
} from "./date-utils";
import type {
  DailyRecord,
  DailyRecordSide,
  HeatmapDayOverrides,
  TodayRecordSidePayload,
} from "./types";
import type { SideLogInput } from "./settlement-rules";

export function normalizeDailyRecord(record: DailyRecord): DailyRecord {
  const recordDate = record.recordDate ?? isoDateFromMayDay(record.day);
  return {
    ...record,
    date: record.date ?? formatRecordDateFromIso(recordDate),
    recordDate,
  };
}

export function sideInputFromRecordSide(
  side: DailyRecordSide,
): SideLogInput {
  return {
    weightKg: side.weightKg,
    deficit: side.deficit,
    minutes: side.minutes,
  };
}

export function normalizeHistoricalSideInput(
  input?: TodayRecordSidePayload | null,
): TodayRecordSidePayload | null {
  if (!input) return null;
  return {
    weightKg: input.weightKg,
    deficit: Math.trunc(input.deficit),
    minutes: Math.max(0, Math.floor(input.minutes)),
  };
}

export function recordGems(record: DailyRecord) {
  return record.fish.gems + record.cat.gems + record.bonus;
}

export function recordIsoDate(record: DailyRecord) {
  return record.recordDate ?? isoDateFromMayDay(record.day);
}

export function findRecordByIso(records: DailyRecord[], recordDate: string) {
  return records.find((record) => recordIsoDate(record) === recordDate) ?? null;
}

export function orderDailyRecords(records: DailyRecord[]) {
  return [...records].sort((a, b) =>
    recordIsoDate(b).localeCompare(recordIsoDate(a)),
  );
}

export function buildHeatmapOverrides(
  records: DailyRecord[],
  person: "fish" | "cat",
): HeatmapDayOverrides {
  return records.reduce<HeatmapDayOverrides>((acc, record) => {
    const parsed = parseIsoDate(recordIsoDate(record));
    if (!parsed || parsed.year !== 2026 || parsed.month !== 5) return acc;
    acc[record.day] = person === "fish" ? record.fishHeat : record.catHeat;
    return acc;
  }, {});
}
