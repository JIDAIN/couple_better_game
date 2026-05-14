import { describe, expect, it } from "vitest";
import { DEFAULT_EXCHANGE_CATEGORIES } from "../../lib/home/home-default-config";
import {
  createExchangeRecordFromPayload,
  deleteExchangeCategoryFromList,
  normalizeExchangeCategories,
  normalizeExchangeRecord,
  orderExchangeRecords,
  upsertExchangeCategoryInList,
  type ExchangeRedeemPayload,
} from "../../lib/home/exchange-service";
import { computeGemWallet, sumCoinExchangeSpend } from "../../lib/home/home-stat-service";
import type {
  DailyRecord,
  ExchangeCategory,
  ExchangeRecord,
} from "../../lib/home/types";

const gemCategory: ExchangeCategory = {
  id: "gem-extra",
  title: "Gem Extra",
  icon: "💎",
  description: "test category",
  resourceKind: "gem",
  price: 9,
};

const coinCategory: ExchangeCategory = {
  id: "coin-extra",
  title: "Coin Extra",
  icon: "🪙",
  description: "test category",
  resourceKind: "coin",
  price: 6,
};

describe("exchange service", () => {
  it("merges defaults while keeping existing overrides", () => {
    const categories = normalizeExchangeCategories([
      {
        ...DEFAULT_EXCHANGE_CATEGORIES[0],
        title: "Overridden title",
        price: 7,
      },
    ]);

    expect(categories[0].title).toBe("Overridden title");
    expect(categories[0].price).toBe(7);
  });

  it("keeps custom extra categories", () => {
    const categories = normalizeExchangeCategories([gemCategory]);

    expect(categories.some((item) => item.id === gemCategory.id)).toBe(true);
  });

  it("upserts and deletes category lists without changing order rules", () => {
    const upserted = upsertExchangeCategoryInList([gemCategory], coinCategory);
    expect(upserted[0].id).toBe(coinCategory.id);
    expect(deleteExchangeCategoryFromList(upserted, coinCategory.id)).toEqual([
      gemCategory,
    ]);
  });

  it("normalizes exchange record fields", () => {
    const record: ExchangeRecord = {
      id: "r1",
      date: "",
      createdAt: "2026-05-10T13:05:00.000Z",
      occurredAt: "2026-05-10T13:05",
      time: "",
      category: "Snack",
      remark: "",
      resourceKind: "gem",
      price: 5,
      icon: "🍪",
    };

    const normalized = normalizeExchangeRecord(record);

    expect(normalized.occurredAt).toBe("2026-05-10T13:05");
    expect(normalized.time).toBe("13:05");
    expect(normalized.date).toContain("13:05");
  });

  it("creates an exchange record from payload", () => {
    const payload: ExchangeRedeemPayload = {
      category: "Snack",
      remark: "reward for today",
      resourceKind: "gem",
      price: 5,
      icon: "🍪",
      occurredAt: "2026-05-10T13:05",
    };

    const record = createExchangeRecordFromPayload(
      payload,
      new Date(2026, 4, 10, 13, 5),
    );

    expect(record.category).toBe(payload.category);
    expect(record.remark).toBe(payload.remark);
    expect(record.resourceKind).toBe(payload.resourceKind);
    expect(record.price).toBe(payload.price);
    expect(record.icon).toBe(payload.icon);
    expect(record.time).toBe("13:05");
  });

  it("orders exchange records by occurredAt, createdAt, then date", () => {
    const records: ExchangeRecord[] = [
      {
        id: "a",
        date: "2026-05-10 12:00",
        createdAt: "2026-05-10T12:00:00.000Z",
        occurredAt: "2026-05-10T12:00",
        time: "12:00",
        category: "A",
        remark: "",
        resourceKind: "gem",
        price: 1,
        icon: "A",
      },
      {
        id: "b",
        date: "2026-05-11 12:00",
        createdAt: "2026-05-11T12:00:00.000Z",
        occurredAt: "",
        time: "12:00",
        category: "B",
        remark: "",
        resourceKind: "gem",
        price: 1,
        icon: "B",
      },
      {
        id: "c",
        date: "2026-05-09 12:00",
        createdAt: "",
        occurredAt: "",
        time: "12:00",
        category: "C",
        remark: "",
        resourceKind: "gem",
        price: 1,
        icon: "C",
      },
    ];

    expect(orderExchangeRecords(records).map((record) => record.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("lets gem exchanges reduce wallet balance and coin exchanges reduce coin spend", () => {
    const records: ExchangeRecord[] = [
      {
        id: "daily-1",
        date: "2026-05-10 12:00",
        createdAt: "2026-05-10T12:00:00.000Z",
        occurredAt: "2026-05-10T12:00",
        time: "12:00",
        category: "A",
        remark: "",
        resourceKind: "gem",
        price: 0,
        icon: "A",
        fish: { weightKg: null, deficit: 0, minutes: 0, gems: 2 },
        cat: { weightKg: null, deficit: 0, minutes: 0, gems: 2 },
        bonus: 2,
        coins: 0,
        fishHeat: { level: "good", exerciseTag: "none", deficit: 0, minutes: 0 },
        catHeat: { level: "good", exerciseTag: "none", deficit: 0, minutes: 0 },
        day: 10,
        recordDate: "2026-05-10",
      } as unknown as DailyRecord,
    ];
    const exchangeRecords: ExchangeRecord[] = [
      {
        id: "spend-gem",
        date: "2026-05-10 13:00",
        createdAt: "2026-05-10T13:00:00.000Z",
        occurredAt: "2026-05-10T13:00",
        time: "13:00",
        category: "B",
        remark: "",
        resourceKind: "gem",
        price: 4,
        icon: "B",
      },
      {
        id: "spend-coin",
        date: "2026-05-10 14:00",
        createdAt: "2026-05-10T14:00:00.000Z",
        occurredAt: "2026-05-10T14:00",
        time: "14:00",
        category: "C",
        remark: "",
        resourceKind: "coin",
        price: 3,
        icon: "C",
      },
    ];

    expect(sumCoinExchangeSpend(exchangeRecords)).toBe(3);
    expect(computeGemWallet(records, exchangeRecords)).toBe(2);
  });
});
