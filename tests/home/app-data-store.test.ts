import { describe, expect, it } from "vitest";
import {
  homeStatePatchFromSnapshot,
  isAppDataSnapshot,
  snapshotFromHomeResourcesState,
  snapshotFromLegacyHomeState,
} from "../../lib/home/app-data-store";
import {
  DEFAULT_COIN_RULES,
  DEFAULT_VISUAL_RULES,
} from "../../lib/home/settlement-rules";
import type { HomeResourcesState } from "../../lib/home/types";

const state = (): HomeResourcesState => ({
  wallet: { gems: 8, coins: 2 },
  streakDays: 3,
  weeklySuccessDays: 3,
  cumulativeSuccessDays: 9,
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
      date: "2026年5月6日",
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
      date: "5月6日 20:00",
      createdAt: "2026-05-06T20:00:00.000Z",
      occurredAt: "2026-05-06T20:00",
      time: "20:00",
      category: "零食",
      remark: "测试",
      resourceKind: "gem",
      price: 5,
      icon: "gift",
    },
  ],
  exchangeCategories: [
    {
      id: "snack",
      title: "零食",
      icon: "gift",
      description: "小奖励",
      resourceKind: "gem",
      price: 5,
    },
  ],
});

describe("app data snapshot helpers", () => {
  it("splits HomeResourcesState into runtime and config", () => {
    const snapshot = snapshotFromHomeResourcesState(state());

    expect(snapshot.version).toBe(1);
    expect(snapshot.currencySemanticsVersion).toBe(2);
    expect(snapshot.runtime.wallet).toEqual({ gems: 8, coins: 2 });
    expect(snapshot.runtime.dailyRecords).toHaveLength(1);
    expect(snapshot.config.heatmapStartDate).toBe("2026-05-06");
    expect(snapshot.config.exchangeCategories).toHaveLength(1);
  });

  it("merges snapshot runtime and config back into a state patch", () => {
    const snapshot = snapshotFromHomeResourcesState(state());
    const patch = homeStatePatchFromSnapshot(snapshot);

    expect(patch.wallet).toEqual({ gems: 8, coins: 2 });
    expect(patch.heatmapStartDate).toBe("2026-05-06");
    expect(patch.dailyRecords).toHaveLength(1);
    expect(patch.exchangeCategories).toHaveLength(1);
  });

  it("recognizes valid snapshots and rejects invalid data", () => {
    const snapshot = snapshotFromHomeResourcesState(state());

    expect(isAppDataSnapshot(snapshot)).toBe(true);
    expect(isAppDataSnapshot(null)).toBe(false);
    expect(isAppDataSnapshot({ version: 1, runtime: {} })).toBe(false);
    expect(isAppDataSnapshot({ version: 2, runtime: {}, config: {} })).toBe(
      false,
    );
  });

  it("creates a snapshot from legacy flat HomeResourcesState shape", () => {
    const legacy = state();
    const snapshot = snapshotFromLegacyHomeState(legacy);

    expect(snapshot.version).toBe(1);
    expect(snapshot.currencySemanticsVersion).toBeUndefined();
    expect(snapshot.runtime.wallet).toEqual(legacy.wallet);
    expect(snapshot.runtime.exchangeRecords).toEqual(legacy.exchangeRecords);
    expect(snapshot.config.visualRules).toEqual(legacy.visualRules);
    expect(snapshot.config.exchangeCategories).toEqual(
      legacy.exchangeCategories,
    );
  });
});
