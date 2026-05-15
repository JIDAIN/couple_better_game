import { getCurrentIsoDate } from "./settlement-rules";

export function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function todayIsoDate() {
  return getCurrentIsoDate();
}

export function isoDateFromMayDay(day: number) {
  return `2026-05-${pad2(day)}`;
}

export function parseIsoDate(value: string) {
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
  return { year, month, day };
}

export function formatRecordDateFromIso(recordDate: string) {
  const parsed = parseIsoDate(recordDate);
  if (!parsed) return recordDate;
  return `${parsed.year}年${parsed.month}月${parsed.day}日`;
}

export function previousIsoDate(recordDate: string) {
  const parsed = parseIsoDate(recordDate);
  if (!parsed) return null;
  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

export function formatExchangeDateLabel(date: Date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatExchangeTimeLabel(date: Date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function parseDateTimeInput(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeExchangeDateTime(
  value?: string | null,
  fallback = new Date(),
) {
  const parsed = value ? parseDateTimeInput(value) : null;
  const date = parsed ?? fallback;
  return {
    date,
    occurredAt: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
      date.getDate(),
    )}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
  };
}
