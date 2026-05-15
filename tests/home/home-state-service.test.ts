import { describe, expect, it } from "vitest";
import { snapshotFromHomeResourcesState, snapshotFromLegacyHomeState } from "../../lib/home/app-data-store";
import { createMemoryAppDataStore } from "../../lib/home/memory-app-data-store";
import { DEFAULT_EXCHANGE_CATEGORIES } from "../../lib/home/home-default-config";
import {
  createDefaultHomeResourcesState,
  readHomeResourcesState,
  writeHomeResourcesState,
} from "../../lib/home/home-state-service";
import {
  importMayHistoryRecords,
  recalculateCoinsWithCurrentRules,
} from "../../lib/home/home-stat-service";
import { DEFAULT_COIN_RULES, DEFAULT_VISUAL_RULES } from "../../lib/home/settlement-rules";
import type { HomeResourcesState } from "../../lib/home/types";

function makeState(overrides: Partial<HomeResourcesState> = {}): HomeResourcesState {
  return {
    ...createDefaultHomeResourcesState(8, 2),
    wallet: { gems: 8, coins: 2 },
    streakDays: 3,
    weeklySuccessDays: 3,
    cumulativeSuccessDays: 7,
    yesterdayGemTotal: 4,
    todayFishGems: 2,
    todayCatGems: 1,
    todayBonusGems: 2,
    weekGemTotal: 12,
    weekCoinTotal: 1,
    heatmapStartDate: "2026-05-06",
    coinRules: DEFAULT_COIN_RULES,
    visualRules: DEFAULT_VISUAL_RULES,
    fishHeatmapOverrides: {
      6: { level: "perfect", exercise: "none" },
    },
    catHeatmapOverrides: {
      6: { level: "good", exercise: "run" },
    },
    dailyRecords: [
      {
        id: "daily-1",
        date: "",
        recordDate: "2026-05-06",
        createdAt: "2026-05-06T12:00:00.000Z",
        day: 6,
        fish: { weightKg: null, deficit: 525, minutes: 0, gems: 4 },
        cat: { weightKg: null, deficit: 284, minutes: 0, gems: 2 },
        bonus: 0,
        coins: 0,
        fishHeat: { level: "perfect", exercise: "none" },
        catHeat: { level: "good", exercise: "none" },
      },
    ],
    exchangeRecords: [
      {
        id: "exchange-1",
        date: "2026-05-06 20:00",
        createdAt: "2026-05-06T20:00:00.000Z",
        occurredAt: "2026-05-06T20:00",
        time: "20:00",
        category: "Snack",
        remark: "test",
        resourceKind: "gem",
        price: 5,
        icon: "gift",
      },
    ],
    exchangeCategories: [
      {
        id: "snack",
        title: "Snack",
        icon: "gift",
        description: "test item",
        resourceKind: "gem",
        price: 5,
      },
    ],
    ...overrides,
  };
}

describe("home state service", () => {
  it("creates the default home resources state", () => {
    const state = createDefaultHomeResourcesState(7, 4);

    expect(state.wallet).toEqual({ gems: 7, coins: 4 });
    expect(state.coinRules).toEqual(DEFAULT_COIN_RULES);
    expect(state.visualRules).toEqual(DEFAULT_VISUAL_RULES);
    expect(state.exchangeCategories.length).toBeGreaterThan(0);
  });

  it("reads from an empty store with seeded records and recalculated state", () => {
    const store = createMemoryAppDataStore();
    const fallback = createDefaultHomeResourcesState(5, 7);
    const expected = recalculateCoinsWithCurrentRules(
      importMayHistoryRecords(fallback),
    );

    const state = readHomeResourcesState(store, {
      initialGems: 5,
      initialCoins: 7,
    });

    expect(state.wallet).toEqual(expected.wallet);
    expect(state.weekGemTotal).toBe(expected.weekGemTotal);
    expect(state.weekCoinTotal).toBe(expected.weekCoinTotal);
    expect(state.dailyRecords.length).toBe(expected.dailyRecords.length);
    expect(store.load()).toEqual(snapshotFromHomeResourcesState(state));
  });

  it("writes and reads snapshots through the store", () => {
    const store = createMemoryAppDataStore();
    const state = makeState();
    const expected = recalculateCoinsWithCurrentRules(
      importMayHistoryRecords(state),
    );

    writeHomeResourcesState(store, state);

    const restored = readHomeResourcesState(store, {
      initialGems: 0,
      initialCoins: 0,
    });

    expect(restored.wallet).toEqual(expected.wallet);
    expect(restored.weekGemTotal).toBe(expected.weekGemTotal);
    expect(restored.weekCoinTotal).toBe(expected.weekCoinTotal);
    expect(restored.exchangeRecords).toEqual(expected.exchangeRecords);
  });

  it("restores legacy snapshots and normalizes records plus categories", () => {
    const state = makeState({
      exchangeCategories: [
        {
          id: "custom",
          title: "Custom",
          icon: "🎁",
          description: "custom item",
          resourceKind: "gem",
          price: 9,
        },
      ],
      dailyRecords: [
        {
          id: "daily-1",
          date: "",
          recordDate: "2026-05-06",
          createdAt: "2026-05-06T12:00:00.000Z",
          day: 6,
          fish: { weightKg: null, deficit: 525, minutes: 0, gems: 4 },
          cat: { weightKg: null, deficit: 284, minutes: 0, gems: 2 },
          bonus: 0,
          coins: 0,
          fishHeat: { level: "perfect", exercise: "none" },
          catHeat: { level: "good", exercise: "none" },
        } as HomeResourcesState["dailyRecords"][number],
      ],
    });
    const snapshot = snapshotFromLegacyHomeState(state);
    const store = createMemoryAppDataStore(snapshot);

    const restored = readHomeResourcesState(store);

    expect(restored.exchangeCategories.some((item) => item.id === "custom")).toBe(true);
    expect(restored.exchangeCategories.length).toBeGreaterThanOrEqual(
      DEFAULT_EXCHANGE_CATEGORIES.length + 1,
    );
    expect(
      restored.dailyRecords.some(
        (record) =>
          record.recordDate === "2026-05-06" && record.date === "2026年5月6日",
      ),
    ).toBe(true);
  });

  it("falls back safely when the store is broken", () => {
    const store = {
      load() {
        throw new Error("broken");
      },
      save() {
        // noop
      },
    };

    const state = readHomeResourcesState(store as never, {
      initialGems: 1,
      initialCoins: 2,
    });
    const expected = recalculateCoinsWithCurrentRules(
      importMayHistoryRecords(createDefaultHomeResourcesState(1, 2)),
    );

    expect(state.wallet).toEqual(expected.wallet);
    expect(state.exchangeCategories.length).toBeGreaterThan(0);
  });
});
