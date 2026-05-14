"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  homeStatePatchFromSnapshot,
  snapshotFromHomeResourcesState,
  type AppDataStore,
} from "@/lib/home/app-data-store";
import { parseIsoDate } from "@/lib/home/date-utils";
import {
  createExchangeRecordFromPayload,
  deleteExchangeCategoryFromList,
  normalizeExchangeCategories,
  normalizeExchangeRecord,
  orderExchangeRecords,
  type ExchangeRedeemPayload,
  upsertExchangeCategoryInList,
} from "@/lib/home/exchange-service";
import {
  normalizeDailyRecord,
} from "@/lib/home/daily-record-utils";
import { DEFAULT_EXCHANGE_CATEGORIES } from "@/lib/home/home-default-config";
import { createLocalStorageAppDataStore } from "@/lib/home/local-storage-app-data-store";
import {
  computeGemWallet,
  importMayHistoryRecords,
  recalculateCoinsWithCurrentRules,
} from "@/lib/home/home-stat-service";
import {
  applyTodayRecordToState,
  deleteHistoricalRecordFromState,
  upsertHistoricalRecordInState,
} from "@/lib/home/daily-record-service";
import type {
  DailyRecord,
  ExchangeCategory,
  ExchangeRecord,
  HeatmapDay,
  HeatmapDayOverrides,
  TodayRecordSidePayload,
  Wallet,
} from "@/lib/home/types";
import { defaultHeatmapStartDate } from "./mockHeatmapData";
import {
  DEFAULT_COIN_RULES,
  DEFAULT_VISUAL_RULES,
  type CoinRulesConfig,
  type SettlementVisualRules,
} from "./settlement-rules";

export { GEM_CAP } from "./settlement-rules";
export type {
  DailyRecord,
  ExchangeCategory,
  ExchangeRecord,
  ResourceKind,
} from "@/lib/home/types";
export type TodayRecordPayload = {
  /** 5 月日期：1-31 */
  day: number;
  fish: TodayRecordSidePayload;
  cat: TodayRecordSidePayload;
  fishHeat: HeatmapDay;
  catHeat: HeatmapDay;
  fishGems: number;
  catGems: number;
  bonusGems: number;
  coinDelta: number;
};

export type HistoricalRecordPayload = {
  recordDate: string;
  person: "fish" | "cat";
  input: TodayRecordSidePayload;
};

export type HistoricalRecordDraft = {
  recordDate: string;
  fish?: TodayRecordSidePayload | null;
  cat?: TodayRecordSidePayload | null;
};

export type HistoricalRecordResult = {
  ok: boolean;
  updatedExisting: boolean;
  reason?: "future-date" | "invalid-date";
};

export type HomeResourcesState = {
  wallet: Wallet;
  streakDays: number;
  weeklySuccessDays: number;
  cumulativeSuccessDays: number;
  yesterdayGemTotal: number;
  todayFishGems: number;
  todayCatGems: number;
  todayBonusGems: number;
  weekGemTotal: number;
  weekCoinTotal: number;
  heatmapStartDate: string;
  coinRules: CoinRulesConfig;
  visualRules: SettlementVisualRules;
  fishHeatmapOverrides: HeatmapDayOverrides;
  catHeatmapOverrides: HeatmapDayOverrides;
  dailyRecords: DailyRecord[];
  exchangeRecords: ExchangeRecord[];
  exchangeCategories: ExchangeCategory[];
};

type HomeResourcesContextValue = {
  gemStock: number;
  coinStock: number;
  tryRedeem: (cost: { gems?: number; coins?: number }) => boolean;
  redeemExchange: (payload: ExchangeRedeemPayload) => boolean;
  streakDays: number;
  weeklySuccessDays: number;
  cumulativeSuccessDays: number;
  yesterdayGemTotal: number;
  todayFishGems: number;
  todayCatGems: number;
  todayBonusGems: number;
  weekGemTotal: number;
  weekCoinTotal: number;
  heatmapStartDate: string;
  coinRules: CoinRulesConfig;
  visualRules: SettlementVisualRules;
  fishHeatmapOverrides: HeatmapDayOverrides;
  catHeatmapOverrides: HeatmapDayOverrides;
  dailyRecords: DailyRecord[];
  exchangeRecords: ExchangeRecord[];
  exchangeCategories: ExchangeCategory[];
  applyTodayRecord: (payload: TodayRecordPayload) => void;
  applyHistoricalRecord: (
    payload: HistoricalRecordPayload,
  ) => HistoricalRecordResult;
  upsertHistoricalRecord: (
    payload: HistoricalRecordDraft,
  ) => HistoricalRecordResult;
  deleteHistoricalRecord: (recordId: string) => boolean;
  updateExchangeRecord: (
    recordId: string,
    patch: { occurredAt?: string; remark?: string },
  ) => boolean;
  deleteExchangeRecord: (recordId: string) => boolean;
  updateHeatmapStartDate: (date: string) => void;
  upsertExchangeCategory: (category: ExchangeCategory) => void;
  deleteExchangeCategory: (categoryId: string) => void;
};

const HomeResourcesContext = createContext<HomeResourcesContextValue | null>(
  null,
);

export function useHomeResources() {
  const ctx = useContext(HomeResourcesContext);
  if (!ctx) {
    throw new Error("useHomeResources must be used within HomeResourcesProvider");
  }
  return ctx;
}

type ProviderProps = {
  children: ReactNode;
  initialGems?: number;
  initialCoins?: number;
};

function createDefaultState(
  initialGems: number,
  initialCoins: number,
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

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
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

function readLocalState(
  initialGems: number,
  initialCoins: number,
  dataStore: AppDataStore,
): HomeResourcesState {
  const fallback = createDefaultState(initialGems, initialCoins);

  try {
    const snapshot = dataStore.load();
    if (!snapshot) {
      const next = recalculateCoinsWithCurrentRules(
        importMayHistoryRecords(fallback),
      );
      writeLocalState(next, dataStore);
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
        ? parsed.dailyRecords.map(normalizeDailyRecord)
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
    writeLocalState(next, dataStore);
    return next;
  } catch {
    const next = recalculateCoinsWithCurrentRules(
      importMayHistoryRecords(fallback),
    );
    writeLocalState(next, dataStore);
    return next;
  }
}

function writeLocalState(state: HomeResourcesState, dataStore: AppDataStore) {
  dataStore.save(snapshotFromHomeResourcesState(state));
}

export function HomeResourcesProvider({
  children,
  initialGems = 0,
  initialCoins = 0,
}: ProviderProps) {
  const dataStore = useMemo(() => createLocalStorageAppDataStore(), []);
  const [homeState, setHomeState] = useState<HomeResourcesState>(() =>
    readLocalState(initialGems, initialCoins, dataStore),
  );
  const stateRef = useRef(homeState);

  const commitHomeState = useCallback(
    (updater: (current: HomeResourcesState) => HomeResourcesState) => {
      const next = updater(stateRef.current);
      stateRef.current = next;
      setHomeState(next);
      writeLocalState(next, dataStore);
    },
    [dataStore],
  );

  const tryRedeem = useCallback(
    (cost: { gems?: number; coins?: number }) => {
      const g = cost.gems ?? 0;
      const c = cost.coins ?? 0;
      const current = stateRef.current;
      if (current.wallet.gems < g || current.wallet.coins < c) return false;

      commitHomeState((state) => ({
        ...state,
        wallet: {
          gems: state.wallet.gems - g,
          coins: state.wallet.coins - c,
        },
      }));
      return true;
    },
    [commitHomeState],
  );

  const redeemExchange = useCallback(
    (payload: ExchangeRedeemPayload) => {
      const gems = payload.resourceKind === "gem" ? payload.price : 0;
      const coins = payload.resourceKind === "coin" ? payload.price : 0;
      const current = stateRef.current;
      if (current.wallet.gems < gems || current.wallet.coins < coins) {
        return false;
      }

      const record: ExchangeRecord = createExchangeRecordFromPayload(
        payload,
        new Date(),
      );

      commitHomeState((state) => ({
        ...state,
        wallet: {
          gems: computeGemWallet(state.dailyRecords, [record, ...state.exchangeRecords]),
          coins: state.wallet.coins - coins,
        },
        exchangeRecords: orderExchangeRecords([record, ...state.exchangeRecords]),
      }));
      return true;
    },
    [commitHomeState],
  );

  const updateExchangeRecord = useCallback(
    (recordId: string, patch: { occurredAt?: string; remark?: string }) => {
      let updated = false;
      commitHomeState((state) => {
        const existing = state.exchangeRecords.find(
          (record) => record.id === recordId,
        );
        if (!existing) return state;

        const nextRecord: ExchangeRecord = normalizeExchangeRecord({
          ...existing,
          occurredAt: patch.occurredAt ?? existing.occurredAt,
          remark: patch.remark ?? existing.remark,
        });

        updated = true;
        return {
          ...state,
          exchangeRecords: orderExchangeRecords(
            state.exchangeRecords.map((record) =>
              record.id === recordId ? nextRecord : record,
            ),
          ),
        };
      });
      return updated;
    },
    [commitHomeState],
  );

  const deleteExchangeRecord = useCallback(
    (recordId: string) => {
      let deleted = false;
      commitHomeState((state) => {
        const existing = state.exchangeRecords.find(
          (record) => record.id === recordId,
        );
        if (!existing) return state;
        deleted = true;
        const refundCoins =
          existing.resourceKind === "coin" ? existing.price : 0;
        return {
          ...state,
          wallet: {
            gems: computeGemWallet(
              state.dailyRecords,
              state.exchangeRecords.filter((item) => item.id !== recordId),
            ),
            coins: state.wallet.coins + refundCoins,
          },
          exchangeRecords: state.exchangeRecords.filter(
            (record) => record.id !== recordId,
          ),
        };
      });
      return deleted;
    },
    [commitHomeState],
  );

  const applyTodayRecord = useCallback(
    (payload: TodayRecordPayload) => {
      commitHomeState((state) => applyTodayRecordToState(state, payload));
    },
    [commitHomeState],
  );

  const upsertHistoricalRecord = useCallback(
    (payload: HistoricalRecordDraft): HistoricalRecordResult => {
      let result: HistoricalRecordResult = {
        ok: false,
        updatedExisting: false,
      };
      commitHomeState((state) => {
        const next = upsertHistoricalRecordInState(state, payload);
        result = next.result;
        if (!next.result.ok) return state;
        return next.state;
      });
      return result;
    },
    [commitHomeState],
  );

  const deleteHistoricalRecord = useCallback(
    (recordId: string) => {
      let deleted = false;
      commitHomeState((state) => {
        const next = deleteHistoricalRecordFromState(state, recordId);
        deleted = next.deleted;
        if (!next.deleted) return state;
        return next.state;
      });
      return deleted;
    },
    [commitHomeState],
  );

  const applyHistoricalRecord = useCallback(
    (payload: HistoricalRecordPayload): HistoricalRecordResult => {
      return upsertHistoricalRecord({
        recordDate: payload.recordDate,
        fish: payload.person === "fish" ? payload.input : null,
        cat: payload.person === "cat" ? payload.input : null,
      });
    },
    [upsertHistoricalRecord],
  );

  const updateHeatmapStartDate = useCallback(
    (date: string) => {
      if (!parseIsoDate(date)) return;
      commitHomeState((state) => ({
        ...state,
        heatmapStartDate: date,
      }));
    },
    [commitHomeState],
  );

  const upsertExchangeCategory = useCallback(
    (category: ExchangeCategory) => {
      commitHomeState((state) => {
        return {
          ...state,
          exchangeCategories: upsertExchangeCategoryInList(
            state.exchangeCategories,
            category,
          ),
        };
      });
    },
    [commitHomeState],
  );

  const deleteExchangeCategory = useCallback(
    (categoryId: string) => {
      commitHomeState((state) => ({
        ...state,
        exchangeCategories: deleteExchangeCategoryFromList(
          state.exchangeCategories,
          categoryId,
        ),
      }));
    },
    [commitHomeState],
  );

  const value = useMemo(
    () => ({
      gemStock: homeState.wallet.gems,
      coinStock: homeState.wallet.coins,
      tryRedeem,
      redeemExchange,
      streakDays: homeState.streakDays,
      weeklySuccessDays: homeState.weeklySuccessDays,
      cumulativeSuccessDays: homeState.cumulativeSuccessDays,
      todayFishGems: homeState.todayFishGems,
      todayCatGems: homeState.todayCatGems,
      todayBonusGems: homeState.todayBonusGems,
      weekGemTotal: homeState.weekGemTotal,
      weekCoinTotal: homeState.weekCoinTotal,
      yesterdayGemTotal: homeState.yesterdayGemTotal,
      heatmapStartDate: homeState.heatmapStartDate,
      coinRules: homeState.coinRules,
      visualRules: homeState.visualRules,
      fishHeatmapOverrides: homeState.fishHeatmapOverrides,
      catHeatmapOverrides: homeState.catHeatmapOverrides,
      dailyRecords: homeState.dailyRecords,
      exchangeRecords: homeState.exchangeRecords,
      exchangeCategories: homeState.exchangeCategories,
      applyTodayRecord,
      applyHistoricalRecord,
      upsertHistoricalRecord,
      deleteHistoricalRecord,
      updateExchangeRecord,
      deleteExchangeRecord,
      updateHeatmapStartDate,
      upsertExchangeCategory,
      deleteExchangeCategory,
    }),
    [
      homeState,
      tryRedeem,
      redeemExchange,
      applyTodayRecord,
      applyHistoricalRecord,
      upsertHistoricalRecord,
      deleteHistoricalRecord,
      updateExchangeRecord,
      deleteExchangeRecord,
      updateHeatmapStartDate,
      upsertExchangeCategory,
      deleteExchangeCategory,
    ],
  );

  return (
    <HomeResourcesContext.Provider value={value}>
      {children}
    </HomeResourcesContext.Provider>
  );
}
