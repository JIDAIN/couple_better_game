import { describe, expect, it } from "vitest";
import { DEFAULT_EXCHANGE_CATEGORIES } from "../../lib/home/home-default-config";
import {
  computeGemWallet,
  countSuccessfulCheckInsInWeek,
  importMayHistoryRecords,
  recalculateCoinsWithCurrentRules,
  sumRecordGemsInCoinWeek,
} from "../../lib/home/home-stat-service";
import { buildHeatmapDay, DEFAULT_COIN_RULES, DEFAULT_VISUAL_RULES } from "../../lib/home/settlement-rules";
import type {
  DailyRecord,
  ExchangeRecord,
  HomeResourcesState,
} from "../../lib/home/types";

function makeRecord(
  recordDate: string,
  fishDeficit: number,
  catDeficit: number,
  fishGems: number,
  catGems: number,
  bonus = 0,
  coins = 0,
): DailyRecord {
  return {
    id: `daily-${recordDate}`,
    date: recordDate,
    recordDate,
    createdAt: `${recordDate}T12:00:00.000Z`,
    day: Number(recordDate.slice(-2)),
    fish: {
      weightKg: null,
      deficit: fishDeficit,
      minutes: 0,
      gems: fishGems,
    },
    cat: {
      weightKg: null,
      deficit: catDeficit,
      minutes: 0,
      gems: catGems,
    },
    bonus,
    coins,
    fishHeat: buildHeatmapDay("fish", {
      weightKg: null,
      deficit: fishDeficit,
      minutes: 0,
    }),
    catHeat: buildHeatmapDay("cat", {
      weightKg: null,
      deficit: catDeficit,
      minutes: 0,
    }),
  };
}

function makeGemExchange(
  id: string,
  occurredAt: string | undefined,
  price: number,
  date = occurredAt?.replace("T", " ") ?? "2026-05-01 12:00",
): ExchangeRecord {
  return {
    id,
    date,
    createdAt: `${date.slice(0, 10)}T12:00:00.000Z`,
    occurredAt: occurredAt ?? "",
    time: "12:00",
    category: "零食",
    remark: "",
    resourceKind: "gem",
    price,
    icon: "🍪",
  };
}

function baseState(overrides: Partial<HomeResourcesState> = {}): HomeResourcesState {
  return {
    wallet: { gems: 0, coins: 0 },
    streakDays: 0,
    weeklySuccessDays: 0,
    cumulativeSuccessDays: 0,
    yesterdayGemTotal: 0,
    todayFishGems: 0,
    todayCatGems: 0,
    todayBonusGems: 0,
    weekGemTotal: 0,
    weekCoinTotal: 0,
    heatmapStartDate: "2026-05-06",
    coinRules: DEFAULT_COIN_RULES,
    visualRules: DEFAULT_VISUAL_RULES,
    fishHeatmapOverrides: {},
    catHeatmapOverrides: {},
    dailyRecords: [],
    exchangeRecords: [],
    exchangeCategories: DEFAULT_EXCHANGE_CATEGORIES,
    ...overrides,
  };
}

describe("home stat service", () => {
  it("computes gem wallet in time order and respects the cap", () => {
    const records = [
      makeRecord("2026-05-12", 0, 0, 30, 0),
      makeRecord("2026-05-10", 0, 0, 20, 0),
      makeRecord("2026-05-11", 0, 0, 25, 0),
    ];

    expect(computeGemWallet(records, [])).toBe(50);
  });

  it("deducts gem exchange records from the wallet", () => {
    const records = [
      makeRecord("2026-05-10", 0, 0, 20, 0),
      makeRecord("2026-05-11", 0, 0, 20, 0),
    ];
    const exchangeRecords: ExchangeRecord[] = [
      {
        id: "exchange-1",
        date: "2026-05-10 13:00",
        createdAt: "2026-05-10T13:00:00.000Z",
        occurredAt: "2026-05-10T13:00",
        time: "13:00",
        category: "零食",
        remark: "",
        resourceKind: "gem",
        price: 7,
        icon: "🍿",
      },
    ];

    expect(computeGemWallet(records, exchangeRecords)).toBe(33);
  });

  it("replays gem wallet by business date and caps gains before later spends", () => {
    const records = [
      makeRecord("2026-05-15", 0, 0, 51, 0),
    ];
    const exchangeRecords = [
      makeGemExchange("exchange-1", "2026-05-16T12:00", 15),
    ];

    expect(computeGemWallet(records, exchangeRecords)).toBe(35);
  });

  it("uses recordDate for gains and spends after gains on the same day", () => {
    const lateCreatedRecord = {
      ...makeRecord("2026-05-15", 0, 0, 51, 0),
      createdAt: "2026-05-20T12:00:00.000Z",
    };
    const exchangeRecords = [
      makeGemExchange("same-day", "2026-05-15T08:00", 15),
      makeGemExchange("legacy-date", undefined, 5, "2026-05-16 09:00"),
    ];

    expect(computeGemWallet([lateCreatedRecord], exchangeRecords)).toBe(30);
  });

  it("sums gems only within the current coin week", () => {
    const records = [
      makeRecord("2026-05-08", 0, 0, 20, 0),
      makeRecord("2026-05-09", 0, 0, 5, 0),
      makeRecord("2026-05-15", 0, 0, 7, 0),
    ];

    expect(sumRecordGemsInCoinWeek(records, "2026-05-14", DEFAULT_COIN_RULES)).toBe(12);
  });

  it("counts successful check-ins within the current coin week", () => {
    const records = [
      makeRecord("2026-05-08", 200, 100, 1, 1),
      makeRecord("2026-05-09", 200, 100, 1, 1),
      makeRecord("2026-05-10", 199, 99, 0, 0),
    ];

    expect(
      countSuccessfulCheckInsInWeek(
        records,
        "2026-05-14",
        DEFAULT_COIN_RULES,
        DEFAULT_VISUAL_RULES,
      ),
    ).toBe(1);
  });

  it("recalculates wallet and weekly totals without changing the rule result", () => {
    const state = baseState({
      dailyRecords: [
        makeRecord("2026-05-16", 200, 100, 5, 5),
        makeRecord("2026-05-17", 200, 100, 5, 5),
      ],
      exchangeRecords: [
        {
          id: "exchange-1",
          date: "2026-05-16 13:00",
          createdAt: "2026-05-16T13:00:00.000Z",
          occurredAt: "2026-05-16T13:00",
          time: "13:00",
          category: "零食",
          remark: "",
          resourceKind: "gem",
          price: 3,
          icon: "🍿",
        },
      ],
    });

    const next = recalculateCoinsWithCurrentRules(state);

    expect(next.wallet.gems).toBe(17);
    expect(next.weekGemTotal).toBe(20);
    expect(next.weekCoinTotal).toBe(0);
  });

  it("imports may seed records once per day", () => {
    const state = baseState({
      dailyRecords: [
        makeRecord("2026-05-06", 1, 1, 1, 1),
        makeRecord("2026-05-20", 1, 1, 1, 1),
      ],
    });

    const next = importMayHistoryRecords(state);
    const may6Count = next.dailyRecords.filter(
      (record) => record.recordDate === "2026-05-06",
    ).length;

    expect(may6Count).toBe(1);
    expect(next.dailyRecords).toHaveLength(8);
  });

  it("keeps May 11 and a 9-gem May 13 at zero coins after full recalculation", () => {
    const seeded = importMayHistoryRecords(baseState());
    const withMay13 = {
      ...seeded,
      dailyRecords: [
        ...seeded.dailyRecords,
        makeRecord("2026-05-13", 500, 200, 4, 3, 2),
      ],
    };

    const recalculated = recalculateCoinsWithCurrentRules(withMay13);
    const may11 = recalculated.dailyRecords.find(
      (record) => record.recordDate === "2026-05-11",
    );
    const may13 = recalculated.dailyRecords.find(
      (record) => record.recordDate === "2026-05-13",
    );

    expect(may11?.coins).toBe(0);
    expect(may13?.coins).toBe(0);
  });

  it("moves weekly gem threshold coins to the true crossing day only", () => {
    const state = baseState({
      dailyRecords: [
        makeRecord("2026-05-09", 200, 100, 5, 5),
        makeRecord("2026-05-10", 200, 100, 5, 5),
        makeRecord("2026-05-11", 200, 100, 3, 2),
        makeRecord("2026-05-13", 200, 100, 20, 20),
      ],
    });

    const recalculated = recalculateCoinsWithCurrentRules(state);
    const may11 = recalculated.dailyRecords.find(
      (record) => record.recordDate === "2026-05-11",
    );
    const may13 = recalculated.dailyRecords.find(
      (record) => record.recordDate === "2026-05-13",
    );

    expect(may11?.coins).toBe(0);
    expect(may13?.coins).toBe(2);
  });
});
