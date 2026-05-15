import { describe, expect, it } from "vitest";
import { DEFAULT_EXCHANGE_CATEGORIES } from "../../lib/home/home-default-config";
import {
  applyTodayRecordToState,
  createTodayDailyRecord,
  deleteDailyRecordFromState,
  deleteHistoricalRecordFromState,
  updateDailyRecordInState,
  upsertDailyRecordInState,
  upsertHistoricalRecordInState,
} from "../../lib/home/daily-record-service";
import { previousIsoDate, todayIsoDate, parseIsoDate } from "../../lib/home/date-utils";
import { DEFAULT_COIN_RULES, DEFAULT_VISUAL_RULES, type HeatmapDay } from "../../lib/home/settlement-rules";
import type {
  HomeResourcesState,
  TodayRecordPayload,
} from "../../lib/home/types";

function shiftIsoDate(iso: string, days: number) {
  const parsed = parseIsoDate(iso);
  if (!parsed) {
    throw new Error("invalid iso date");
  }
  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function heat(level: HeatmapDay["level"], exercise: HeatmapDay["exercise"]): HeatmapDay {
  return { level, exercise };
}

function makeState(overrides: Partial<HomeResourcesState> = {}): HomeResourcesState {
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
    heatmapStartDate: "2026-05-01",
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

describe("daily record service", () => {
  it("creates a daily record for today", () => {
    const payload: TodayRecordPayload = {
      day: 14,
      fish: { weightKg: 48, deficit: 320, minutes: 30 },
      cat: { weightKg: 43, deficit: 210, minutes: 60 },
      fishHeat: heat("good", "run"),
      catHeat: heat("good", "intense"),
      fishGems: 3,
      catGems: 2,
      bonusGems: 2,
      coinDelta: 1,
    };

    const record = createTodayDailyRecord(payload, new Date("2026-05-14T08:00:00.000Z"));

    expect(record.recordDate).toBe(todayIsoDate());
    expect(record.day).toBe(14);
    expect(record.fish.gems).toBe(3);
    expect(record.cat.gems).toBe(2);
    expect(record.bonus).toBe(2);
    expect(record.coins).toBe(1);
    expect(record.createdAt).toBe("2026-05-14T08:00:00.000Z");
  });

  it("applies today record to state and updates wallet plus heatmap overrides", () => {
    const payload: TodayRecordPayload = {
      day: 14,
      fish: { weightKg: 48, deficit: 320, minutes: 30 },
      cat: { weightKg: 43, deficit: 210, minutes: 60 },
      fishHeat: heat("good", "run"),
      catHeat: heat("good", "intense"),
      fishGems: 3,
      catGems: 2,
      bonusGems: 2,
      coinDelta: 4,
    };

    const next = applyTodayRecordToState(makeState(), payload);

    expect(next.dailyRecords).toHaveLength(1);
    expect(next.wallet.gems).toBe(7);
    expect(next.wallet.coins).toBe(4);
    expect(next.todayFishGems).toBe(3);
    expect(next.todayCatGems).toBe(2);
    expect(next.todayBonusGems).toBe(2);
    expect(next.fishHeatmapOverrides[14]).toEqual(payload.fishHeat);
    expect(next.catHeatmapOverrides[14]).toEqual(payload.catHeat);
  });

  it("rejects invalid and future historical records", () => {
    const invalid = upsertHistoricalRecordInState(makeState(), {
      recordDate: "not-a-date",
      fish: null,
      cat: null,
    });
    const future = upsertHistoricalRecordInState(makeState(), {
      recordDate: shiftIsoDate(todayIsoDate(), 1),
      fish: null,
      cat: null,
    });

    expect(invalid.result.ok).toBe(false);
    expect(invalid.result.reason).toBe("invalid-date");
    expect(future.result.ok).toBe(false);
    expect(future.result.reason).toBe("future-date");
  });

  it("upserts historical records and updates existing ones", () => {
    const recordDate = previousIsoDate(todayIsoDate()) ?? todayIsoDate();
    const initial = upsertHistoricalRecordInState(makeState(), {
      recordDate,
      fish: { weightKg: 50, deficit: 300, minutes: 30 },
      cat: null,
    });

    expect(initial.result.ok).toBe(true);
    expect(initial.result.updatedExisting).toBe(false);
    expect(initial.state.dailyRecords).toHaveLength(1);

    const updated = upsertHistoricalRecordInState(initial.state, {
      recordDate,
      fish: { weightKg: 50, deficit: 500, minutes: 60 },
      cat: { weightKg: 44, deficit: 200, minutes: 30 },
    });

    expect(updated.result.ok).toBe(true);
    expect(updated.result.updatedExisting).toBe(true);
    expect(updated.state.dailyRecords).toHaveLength(1);
    expect(updated.state.dailyRecords[0].fish.gems).toBe(5);
    expect(updated.state.dailyRecords[0].cat.gems).toBe(3);
  });

  it("upserts daily records by date without creating duplicates", () => {
    const recordDate = previousIsoDate(todayIsoDate()) ?? todayIsoDate();
    const initial = upsertDailyRecordInState(
      makeState(),
      recordDate,
      { weightKg: 50, deficit: 300, minutes: 30 },
      { weightKg: 44, deficit: 200, minutes: 30 },
    );
    const updated = upsertDailyRecordInState(
      initial.state,
      recordDate,
      { weightKg: 50, deficit: 500, minutes: 60 },
      { weightKg: 44, deficit: 100, minutes: 0 },
    );

    expect(initial.result.updatedExisting).toBe(false);
    expect(updated.result.updatedExisting).toBe(true);
    expect(updated.state.dailyRecords).toHaveLength(1);
    expect(updated.state.dailyRecords[0].fish.deficit).toBe(500);
    expect(updated.state.dailyRecords[0].cat.deficit).toBe(100);
  });

  it("updates only existing daily records by date", () => {
    const recordDate = previousIsoDate(todayIsoDate()) ?? todayIsoDate();
    const missing = updateDailyRecordInState(
      makeState(),
      recordDate,
      { weightKg: 50, deficit: 300, minutes: 30 },
      { weightKg: 44, deficit: 200, minutes: 30 },
    );
    const withRecord = upsertDailyRecordInState(
      makeState(),
      recordDate,
      { weightKg: 50, deficit: 300, minutes: 30 },
      { weightKg: 44, deficit: 200, minutes: 30 },
    ).state;
    const updated = updateDailyRecordInState(
      withRecord,
      recordDate,
      { weightKg: 50, deficit: 500, minutes: 60 },
      { weightKg: 44, deficit: 200, minutes: 30 },
    );

    expect(missing.result.ok).toBe(false);
    expect(missing.state.dailyRecords).toHaveLength(0);
    expect(updated.result.ok).toBe(true);
    expect(updated.state.dailyRecords).toHaveLength(1);
    expect(updated.state.dailyRecords[0].fish.deficit).toBe(500);
  });

  it("deletes daily records by date", () => {
    const recordDate = previousIsoDate(todayIsoDate()) ?? todayIsoDate();
    const withRecord = upsertDailyRecordInState(
      makeState(),
      recordDate,
      { weightKg: 50, deficit: 300, minutes: 30 },
      { weightKg: 44, deficit: 200, minutes: 30 },
    ).state;

    const deleted = deleteDailyRecordFromState(withRecord, recordDate);

    expect(deleted.deleted).toBe(true);
    expect(deleted.state.dailyRecords).toHaveLength(0);
    expect(deleted.state.wallet.gems).toBe(0);
  });

  it("deletes historical records and recomputes summary state", () => {
    const recordDate = previousIsoDate(todayIsoDate()) ?? todayIsoDate();
    const withRecord = upsertHistoricalRecordInState(makeState(), {
      recordDate,
      fish: { weightKg: 50, deficit: 300, minutes: 30 },
      cat: { weightKg: 44, deficit: 200, minutes: 30 },
    }).state;

    const deleted = deleteHistoricalRecordFromState(withRecord, withRecord.dailyRecords[0].id);

    expect(deleted.deleted).toBe(true);
    expect(deleted.state.dailyRecords).toHaveLength(0);
    expect(deleted.state.wallet.gems).toBe(0);
    expect(deleted.state.weekGemTotal).toBe(0);
  });

  it("returns unchanged state when deleting a missing record", () => {
    const state = makeState();
    const deleted = deleteHistoricalRecordFromState(state, "missing");

    expect(deleted.deleted).toBe(false);
    expect(deleted.state).toBe(state);
  });
});
