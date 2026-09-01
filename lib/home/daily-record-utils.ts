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

export function hasMeaningfulDailyInput(
  fish: { weightKg: number | null; deficit: number; minutes: number },
  cat: { weightKg: number | null; deficit: number; minutes: number },
): boolean {
  return (
    fish.deficit !== 0 ||
    fish.minutes > 0 ||
    fish.weightKg != null ||
    cat.deficit !== 0 ||
    cat.minutes > 0 ||
    cat.weightKg != null
  );
}

export function hasMeaningfulGrowthActivity(record: DailyRecord): boolean {
  return (
    record.fish.deficit !== 0 ||
    record.cat.deficit !== 0 ||
    record.fish.minutes > 0 ||
    record.cat.minutes > 0 ||
    record.fish.gems > 0 ||
    record.cat.gems > 0 ||
    record.bonus > 0 ||
    record.coins > 0
  );
}
