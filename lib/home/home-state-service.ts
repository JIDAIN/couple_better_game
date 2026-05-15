import {
  homeStatePatchFromSnapshot,
  snapshotFromHomeResourcesState,
  type AppDataStore,
} from "./app-data-store";
import { normalizeExchangeCategories, normalizeExchangeRecord } from "./exchange-service";
import { normalizeDailyRecord, orderDailyRecords, recordIsoDate } from "./daily-record-utils";
import {
  importMayHistoryRecords,
  recalculateCoinsWithCurrentRules,
} from "./home-stat-service";
import { DEFAULT_EXCHANGE_CATEGORIES } from "./home-default-config";
import {
  DEFAULT_COIN_RULES,
  DEFAULT_VISUAL_RULES,
  type CoinRulesConfig,
  type SettlementVisualRules,
} from "./settlement-rules";
import type { ExchangeRecord, HomeResourcesState } from "./types";

function defaultHeatmapStartDate(target = new Date()) {
  const year = target.getFullYear();
  const month = target.getMonth();
  const firstDay = new Date(year, month, 1);
  const weekday = (firstDay.getDay() + 1) % 7;
  const weekStart = new Date(firstDay);
  weekStart.setDate(firstDay.getDate() - weekday);
  const pad2 = (value: number) => String(value).padStart(2, "0");
  return `${weekStart.getFullYear()}-${pad2(weekStart.getMonth() + 1)}-${pad2(
    weekStart.getDate(),
  )}`;
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeVisualRules(
  value: unknown,
  fallback: SettlementVisualRules,
): SettlementVisualRules {
  const source = value as Partial<SettlementVisualRules> | null | undefined;
  return {
    heatmap: {
      fish: {
        ...fallback.heatmap.fish,
        ...(source?.heatmap?.fish ?? {}),
      },
      cat: {
        ...fallback.heatmap.cat,
        ...(source?.heatmap?.cat ?? {}),
      },
    },
    exerciseTag: {
      ...fallback.exerciseTag,
      ...(source?.exerciseTag ?? {}),
    },
  };
}

function normalizeCoinRules(
  value: unknown,
  fallback: CoinRulesConfig,
): CoinRulesConfig {
  const source = value as Partial<CoinRulesConfig> | null | undefined;
  return {
    weekStartDay: safeNumber(source?.weekStartDay, fallback.weekStartDay),
    deficitStreakDays: safeNumber(
      source?.deficitStreakDays,
      fallback.deficitStreakDays,
    ),
  };
}

function normalizeDailyRecords(records: HomeResourcesState["dailyRecords"]) {
  const byDate = new Map<string, HomeResourcesState["dailyRecords"][number]>();
  for (const record of records.map(normalizeDailyRecord)) {
    byDate.set(recordIsoDate(record), record);
  }
  return orderDailyRecords([...byDate.values()]);
}

export function createDefaultHomeResourcesState(
  initialGems = 0,
  initialCoins = 0,
): HomeResourcesState {
  return {
    wallet: {
      gems: initialGems,
      coins: initialCoins,
    },
    streakDays: 0,
    weeklySuccessDays: 0,
    cumulativeSuccessDays: 0,
    yesterdayGemTotal: 0,
    todayFishGems: 0,
    todayCatGems: 0,
    todayBonusGems: 0,
    weekGemTotal: 0,
    weekCoinTotal: 0,
    heatmapStartDate: defaultHeatmapStartDate(),
    coinRules: DEFAULT_COIN_RULES,
    visualRules: DEFAULT_VISUAL_RULES,
    fishHeatmapOverrides: {},
    catHeatmapOverrides: {},
    dailyRecords: [],
    exchangeRecords: [],
    exchangeCategories: DEFAULT_EXCHANGE_CATEGORIES,
  };
}

export function writeHomeResourcesState(
  dataStore: AppDataStore,
  state: HomeResourcesState,
): void {
  dataStore.save(snapshotFromHomeResourcesState(state));
}

export function readHomeResourcesState(
  dataStore: AppDataStore,
  options?: {
    initialGems?: number;
    initialCoins?: number;
  },
): HomeResourcesState {
  const fallback = createDefaultHomeResourcesState(
    options?.initialGems ?? 0,
    options?.initialCoins ?? 0,
  );

  try {
    const snapshot = dataStore.load();
    if (!snapshot) {
      const next = recalculateCoinsWithCurrentRules(
        importMayHistoryRecords(fallback),
      );
      writeHomeResourcesState(dataStore, next);
      return next;
    }

    const parsed = homeStatePatchFromSnapshot(snapshot);
    const restored: HomeResourcesState = {
      wallet: {
        gems: safeNumber(parsed.wallet?.gems, fallback.wallet.gems),
        coins: safeNumber(parsed.wallet?.coins, fallback.wallet.coins),
      },
      streakDays: safeNumber(parsed.streakDays),
      weeklySuccessDays: safeNumber(
        (parsed as Partial<HomeResourcesState>).weeklySuccessDays,
        safeNumber(parsed.streakDays),
      ),
      cumulativeSuccessDays: safeNumber(
        (parsed as Partial<HomeResourcesState>).cumulativeSuccessDays,
        safeNumber(parsed.streakDays),
      ),
      yesterdayGemTotal: safeNumber(
        (parsed as Partial<HomeResourcesState>).yesterdayGemTotal,
      ),
      todayFishGems: safeNumber(parsed.todayFishGems),
      todayCatGems: safeNumber(parsed.todayCatGems),
      todayBonusGems: safeNumber(parsed.todayBonusGems),
      weekGemTotal: safeNumber(parsed.weekGemTotal),
      weekCoinTotal: safeNumber(parsed.weekCoinTotal),
      heatmapStartDate:
        typeof parsed.heatmapStartDate === "string"
          ? parsed.heatmapStartDate
          : fallback.heatmapStartDate,
      coinRules: normalizeCoinRules(parsed.coinRules, fallback.coinRules),
      visualRules: normalizeVisualRules(parsed.visualRules, fallback.visualRules),
      fishHeatmapOverrides:
        parsed.fishHeatmapOverrides ?? fallback.fishHeatmapOverrides,
      catHeatmapOverrides:
        parsed.catHeatmapOverrides ?? fallback.catHeatmapOverrides,
      dailyRecords: Array.isArray(parsed.dailyRecords)
        ? normalizeDailyRecords(parsed.dailyRecords)
        : fallback.dailyRecords,
      exchangeRecords: Array.isArray(parsed.exchangeRecords)
        ? parsed.exchangeRecords.map((record) =>
            normalizeExchangeRecord(record as ExchangeRecord),
          )
        : fallback.exchangeRecords,
      exchangeCategories: Array.isArray(parsed.exchangeCategories)
        ? normalizeExchangeCategories(parsed.exchangeCategories)
        : fallback.exchangeCategories,
    };

    const next = recalculateCoinsWithCurrentRules(
      importMayHistoryRecords(restored),
    );
    writeHomeResourcesState(dataStore, next);
    return next;
  } catch {
    const next = recalculateCoinsWithCurrentRules(
      importMayHistoryRecords(fallback),
    );
    writeHomeResourcesState(dataStore, next);
    return next;
  }
}
