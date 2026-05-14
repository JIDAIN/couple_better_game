import type {
  AppConfigData,
  AppDataSnapshot,
  HomeResourcesState,
  UserRuntimeData,
} from "./types";

export const APP_DATA_STORAGE_KEY = "couple-better-game:home-resources:v1";

export type AppDataStore = {
  load: () => AppDataSnapshot | null;
  save: (snapshot: AppDataSnapshot) => void;
  clear?: () => void;
};

export function isAppDataSnapshot(value: unknown): value is AppDataSnapshot {
  if (!value || typeof value !== "object") return false;
  const maybe = value as Partial<AppDataSnapshot>;
  return maybe.version === 1 && !!maybe.runtime && !!maybe.config;
}

export function snapshotFromHomeResourcesState(
  state: HomeResourcesState,
): AppDataSnapshot {
  const runtime: UserRuntimeData = {
    wallet: state.wallet,
    streakDays: state.streakDays,
    weeklySuccessDays: state.weeklySuccessDays,
    cumulativeSuccessDays: state.cumulativeSuccessDays,
    yesterdayGemTotal: state.yesterdayGemTotal,
    todayFishGems: state.todayFishGems,
    todayCatGems: state.todayCatGems,
    todayBonusGems: state.todayBonusGems,
    weekGemTotal: state.weekGemTotal,
    weekCoinTotal: state.weekCoinTotal,
    fishHeatmapOverrides: state.fishHeatmapOverrides,
    catHeatmapOverrides: state.catHeatmapOverrides,
    dailyRecords: state.dailyRecords,
    exchangeRecords: state.exchangeRecords,
  };
  const config: AppConfigData = {
    heatmapStartDate: state.heatmapStartDate,
    coinRules: state.coinRules,
    visualRules: state.visualRules,
    exchangeCategories: state.exchangeCategories,
  };

  return { version: 1, runtime, config };
}

export function snapshotFromLegacyHomeState(
  state: Partial<HomeResourcesState>,
): AppDataSnapshot {
  return {
    version: 1,
    runtime: {
      wallet: state.wallet,
      streakDays: state.streakDays,
      weeklySuccessDays: state.weeklySuccessDays,
      cumulativeSuccessDays: state.cumulativeSuccessDays,
      yesterdayGemTotal: state.yesterdayGemTotal,
      todayFishGems: state.todayFishGems,
      todayCatGems: state.todayCatGems,
      todayBonusGems: state.todayBonusGems,
      weekGemTotal: state.weekGemTotal,
      weekCoinTotal: state.weekCoinTotal,
      fishHeatmapOverrides: state.fishHeatmapOverrides,
      catHeatmapOverrides: state.catHeatmapOverrides,
      dailyRecords: state.dailyRecords,
      exchangeRecords: state.exchangeRecords,
    },
    config: {
      heatmapStartDate: state.heatmapStartDate,
      coinRules: state.coinRules,
      visualRules: state.visualRules,
      exchangeCategories: state.exchangeCategories,
    },
  };
}

export function homeStatePatchFromSnapshot(
  snapshot: AppDataSnapshot,
): Partial<HomeResourcesState> {
  return {
    ...snapshot.runtime,
    ...snapshot.config,
  };
}
