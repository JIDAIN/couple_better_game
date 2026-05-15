import { DEFAULT_EXCHANGE_CATEGORIES } from "./home-default-config";
import {
  formatExchangeDateLabel,
  formatExchangeTimeLabel,
  normalizeExchangeDateTime,
} from "./date-utils";
import type { ExchangeCategory, ExchangeRecord, ResourceKind } from "./types";

export type ExchangeRedeemPayload = {
  category: string;
  remark: string;
  resourceKind: ResourceKind;
  price: number;
  icon: string;
  occurredAt?: string;
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function exchangeRecordSortKey(record: ExchangeRecord) {
  return record.occurredAt || record.createdAt || record.date;
}

export function normalizeExchangeCategories(
  categories: ExchangeCategory[],
): ExchangeCategory[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const mergedDefaults = DEFAULT_EXCHANGE_CATEGORIES.map((category) => {
    const existing = byId.get(category.id);
    return existing ? { ...category, ...existing } : category;
  });
  const defaultIds = new Set(DEFAULT_EXCHANGE_CATEGORIES.map((item) => item.id));
  const extras = categories.filter((category) => !defaultIds.has(category.id));
  return [...mergedDefaults, ...extras];
}

export function upsertExchangeCategoryInList(
  categories: ExchangeCategory[],
  category: ExchangeCategory,
): ExchangeCategory[] {
  const exists = categories.some((item) => item.id === category.id);
  return exists
    ? categories.map((item) => (item.id === category.id ? category : item))
    : [category, ...categories];
}

export function deleteExchangeCategoryFromList(
  categories: ExchangeCategory[],
  categoryId: string,
): ExchangeCategory[] {
  return categories.filter((item) => item.id !== categoryId);
}

export function normalizeExchangeRecord(
  record: ExchangeRecord,
): ExchangeRecord {
  const normalized = normalizeExchangeDateTime(
    record.occurredAt ?? record.createdAt,
  );
  return {
    ...record,
    occurredAt: normalized.occurredAt,
    time: record.time || formatExchangeTimeLabel(normalized.date),
    date:
      record.date ||
      `${formatExchangeDateLabel(normalized.date)} ${formatExchangeTimeLabel(
        normalized.date,
      )}`,
  };
}

export function orderExchangeRecords(records: ExchangeRecord[]) {
  return [...records].sort((a, b) =>
    exchangeRecordSortKey(b).localeCompare(exchangeRecordSortKey(a)),
  );
}

export function createExchangeRecordFromPayload(
  payload: ExchangeRedeemPayload,
  now = new Date(),
): ExchangeRecord {
  const occurred = normalizeExchangeDateTime(payload.occurredAt, now);
  return {
    id: makeId("exchange"),
    date: `${formatExchangeDateLabel(occurred.date)} ${formatExchangeTimeLabel(
      occurred.date,
    )}`,
    createdAt: now.toISOString(),
    occurredAt: occurred.occurredAt,
    time: formatExchangeTimeLabel(occurred.date),
    ...payload,
  };
}
