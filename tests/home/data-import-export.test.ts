import { describe, expect, it } from "vitest";
import {
  buildHomeBackup,
  exportWeeklyReviewCsv,
  serializeHomeBackup,
} from "../../lib/home/export-service";
import { importHomeBackupJson } from "../../lib/home/import-service";
import { DEFAULT_EXCHANGE_CATEGORIES } from "../../lib/home/home-default-config";
import {
  buildHeatmapDay,
  DEFAULT_COIN_RULES,
  DEFAULT_VISUAL_RULES,
} from "../../lib/home/settlement-rules";
import type {
  DailyRecord,
  ExchangeRecord,
  HomeResourcesState,
} from "../../lib/home/types";

function makeRecord(
  recordDate: string,
  fishDeficit: number,
  fishMinutes: number,
  fishGems: number,
  catDeficit: number,
  catMinutes: number,
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
      minutes: fishMinutes,
      gems: fishGems,
    },
    cat: {
      weightKg: null,
      deficit: catDeficit,
      minutes: catMinutes,
      gems: catGems,
    },
    bonus,
    coins,
    fishHeat: buildHeatmapDay("fish", {
      weightKg: null,
      deficit: fishDeficit,
      minutes: fishMinutes,
    }),
    catHeat: buildHeatmapDay("cat", {
      weightKg: null,
      deficit: catDeficit,
      minutes: catMinutes,
    }),
  };
}

function makeState(overrides: Partial<HomeResourcesState> = {}): HomeResourcesState {
  return {
    wallet: { gems: 8, coins: 2 },
    streakDays: 0,
    weeklySuccessDays: 0,
    cumulativeSuccessDays: 0,
    yesterdayGemTotal: 0,
    todayFishGems: 0,
    todayCatGems: 0,
    todayBonusGems: 0,
    weekGemTotal: 0,
    weekCoinTotal: 0,
    heatmapStartDate: "2026-05-09",
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

describe("data import/export", () => {
  it("exports a schemaVersion 1 full backup", () => {
    const state = makeState({
      dailyRecords: [makeRecord("2026-05-15", 500, 30, 5, 200, 30, 3, 2)],
    });

    const backup = buildHomeBackup(state, "2026-05-18T00:00:00.000Z");

    expect(backup).toMatchObject({
      schemaVersion: 1,
      exportedAt: "2026-05-18T00:00:00.000Z",
      wallet: state.wallet,
      dailyRecords: state.dailyRecords,
      exchangeRecords: state.exchangeRecords,
      exchangeCategories: state.exchangeCategories,
      heatmapStartDate: state.heatmapStartDate,
      coinRules: state.coinRules,
      visualRules: state.visualRules,
    });
    expect(JSON.parse(serializeHomeBackup(state))).toMatchObject({
      schemaVersion: 1,
    });
  });

  it("imports a complete backup and keeps exchange record snapshots", () => {
    const backup = {
      schemaVersion: 1,
      exportedAt: "2026-05-18T00:00:00.000Z",
      wallet: { gems: 0, coins: 0 },
      dailyRecords: [makeRecord("2026-05-15", 500, 30, 51, 0, 0, 0)],
      exchangeCategories: [
        {
          id: "snack",
          title: "新名字",
          icon: "🍰",
          description: "changed",
          resourceKind: "gem",
          price: 99,
        },
      ],
      exchangeRecords: [
        {
          id: "old-exchange",
          date: "2026-05-16 12:00",
          createdAt: "2026-05-18T12:00:00.000Z",
          occurredAt: "2026-05-16T12:00",
          time: "12:00",
          category: "旧零食",
          remark: "当时的备注",
          resourceKind: "gem",
          price: 15,
          icon: "🍪",
        } satisfies ExchangeRecord,
      ],
      heatmapStartDate: "2026-05-09",
      coinRules: DEFAULT_COIN_RULES,
      visualRules: DEFAULT_VISUAL_RULES,
    };

    const result = importHomeBackupJson(JSON.stringify(backup));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.wallet.gems).toBe(35);
    expect(result.state.exchangeRecords[0]).toMatchObject({
      category: "旧零食",
      icon: "🍪",
      resourceKind: "gem",
      price: 15,
      remark: "当时的备注",
    });
  });

  it("fills legacy exchange snapshots from categoryId once", () => {
    const result = importHomeBackupJson(
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: "2026-05-18T00:00:00.000Z",
        wallet: { gems: 0, coins: 0 },
        dailyRecords: [],
        exchangeCategories: [
          {
            id: "snack",
            title: "小零食",
            icon: "🍪",
            description: "",
            resourceKind: "gem",
            price: 6,
          },
        ],
        exchangeRecords: [
          {
            id: "legacy",
            categoryId: "snack",
            date: "2026-05-16 09:00",
            createdAt: "2026-05-18T12:00:00.000Z",
          },
        ],
        heatmapStartDate: "2026-05-09",
        coinRules: DEFAULT_COIN_RULES,
        visualRules: DEFAULT_VISUAL_RULES,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.exchangeRecords[0]).toMatchObject({
      category: "小零食",
      icon: "🍪",
      resourceKind: "gem",
      price: 6,
    });
  });

  it("exports weekly review csv with BOM and Saturday based week labels", () => {
    const state = makeState({
      heatmapStartDate: "2026-05-10",
      dailyRecords: [
        makeRecord("2026-05-16", 300, 40, 3, 100, 20, 1, 0, 1),
        makeRecord("2026-05-15", 200, 30, 2, 100, 30, 1, 2, 0),
      ],
    });

    const csv = exportWeeklyReviewCsv(state);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(
      "周次,日期,鱼鱼缺口kcal,鱼鱼运动min,鱼鱼宝石,猫猫缺口kcal,猫猫运动min,猫猫宝石,情侣bonus,当日总宝石,金币变化",
    );
    expect(csv).toContain("第1周,2026-05-15,200,30,2,100,30,1,2,5,0");
    expect(csv).toContain("第2周,2026-05-16,300,40,3,100,20,1,0,4,1");
    expect(csv.indexOf("2026-05-15")).toBeLessThan(csv.indexOf("2026-05-16"));
  });

  it("rejects incomplete backups without producing state", () => {
    expect(importHomeBackupJson("{bad").ok).toBe(false);
    expect(
      importHomeBackupJson(JSON.stringify({ schemaVersion: 1, wallet: {} })).ok,
    ).toBe(false);
  });
});
