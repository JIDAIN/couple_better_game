"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { parseIsoDate } from "@/lib/home/date-utils";
import {
  createExchangeRecordFromPayload,
  deleteExchangeCategoryFromList,
  normalizeExchangeRecord,
  orderExchangeRecords,
  type ExchangeRedeemPayload,
  upsertExchangeCategoryInList,
} from "@/lib/home/exchange-service";
import { createLocalStorageAppDataStore } from "@/lib/home/local-storage-app-data-store";
import {
  exportWeeklyReviewCsv,
  serializeHomeBackup,
} from "@/lib/home/export-service";
import { computeGemWallet } from "@/lib/home/home-stat-service";
import { importHomeBackupJson } from "@/lib/home/import-service";
import {
  applyTodayRecordToState,
  deleteDailyRecordFromState,
  deleteHistoricalRecordFromState,
  updateDailyRecordInState,
  upsertDailyRecordInState,
  upsertHistoricalRecordInState,
} from "@/lib/home/daily-record-service";
import {
  createDefaultHomeResourcesState,
  readHomeResourcesState,
  writeHomeResourcesState,
} from "@/lib/home/home-state-service";
import type {
  DailyRecord,
  ExchangeCategory,
  ExchangeRecord,
  HeatmapDay,
  HeatmapDayOverrides,
  TodayRecordSidePayload,
  Wallet,
} from "@/lib/home/types";
import { type CoinRulesConfig, type SettlementVisualRules } from "./settlement-rules";

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
  upsertDailyRecord: (
    recordDate: string,
    fish: TodayRecordSidePayload,
    cat: TodayRecordSidePayload,
  ) => HistoricalRecordResult;
  updateDailyRecord: (
    recordDate: string,
    fish: TodayRecordSidePayload,
    cat: TodayRecordSidePayload,
  ) => HistoricalRecordResult;
  deleteDailyRecord: (recordDate: string) => boolean;
  deleteHistoricalRecord: (recordId: string) => boolean;
  updateExchangeRecord: (
    recordId: string,
    patch: { occurredAt?: string; remark?: string },
  ) => boolean;
  deleteExchangeRecord: (recordId: string) => boolean;
  updateHeatmapStartDate: (date: string) => void;
  upsertExchangeCategory: (category: ExchangeCategory) => void;
  deleteExchangeCategory: (categoryId: string) => void;
  exportBackupJson: () => string;
  exportWeeklyReviewCsv: () => string;
  importBackupJson: (raw: string) => { ok: boolean; reason?: string };
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

export function HomeResourcesProvider({
  children,
  initialGems = 0,
  initialCoins = 0,
}: ProviderProps) {
  const dataStore = useMemo(() => createLocalStorageAppDataStore(), []);
  const [homeState, setHomeState] = useState<HomeResourcesState>(() =>
    createDefaultHomeResourcesState(initialGems, initialCoins),
  );
  const stateRef = useRef(homeState);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const next = readHomeResourcesState(dataStore, {
        initialGems,
        initialCoins,
      });
      stateRef.current = next;
      setHomeState(next);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [dataStore, initialGems, initialCoins]);

  const commitHomeState = useCallback(
    (updater: (current: HomeResourcesState) => HomeResourcesState) => {
      const next = updater(stateRef.current);
      stateRef.current = next;
      setHomeState(next);
      writeHomeResourcesState(dataStore, next);
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
        const nextExchangeRecords = orderExchangeRecords(
          state.exchangeRecords.map((record) =>
            record.id === recordId ? nextRecord : record,
          ),
        );
        return {
          ...state,
          wallet: {
            ...state.wallet,
            gems: computeGemWallet(state.dailyRecords, nextExchangeRecords),
          },
          exchangeRecords: nextExchangeRecords,
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

  const upsertDailyRecord = useCallback(
    (
      recordDate: string,
      fish: TodayRecordSidePayload,
      cat: TodayRecordSidePayload,
    ): HistoricalRecordResult => {
      let result: HistoricalRecordResult = {
        ok: false,
        updatedExisting: false,
      };
      commitHomeState((state) => {
        const next = upsertDailyRecordInState(state, recordDate, fish, cat);
        result = next.result;
        if (!next.result.ok) return state;
        return next.state;
      });
      return result;
    },
    [commitHomeState],
  );

  const updateDailyRecord = useCallback(
    (
      recordDate: string,
      fish: TodayRecordSidePayload,
      cat: TodayRecordSidePayload,
    ): HistoricalRecordResult => {
      let result: HistoricalRecordResult = {
        ok: false,
        updatedExisting: false,
      };
      commitHomeState((state) => {
        const next = updateDailyRecordInState(state, recordDate, fish, cat);
        result = next.result;
        if (!next.result.ok) return state;
        return next.state;
      });
      return result;
    },
    [commitHomeState],
  );

  const deleteDailyRecord = useCallback(
    (recordDate: string) => {
      let deleted = false;
      commitHomeState((state) => {
        const next = deleteDailyRecordFromState(state, recordDate);
        deleted = next.deleted;
        if (!next.deleted) return state;
        return next.state;
      });
      return deleted;
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

  const exportBackupJson = useCallback(
    () => serializeHomeBackup(stateRef.current),
    [],
  );

  const exportWeeklyReviewCsvAction = useCallback(
    () => exportWeeklyReviewCsv(stateRef.current),
    [],
  );

  const importBackupJson = useCallback(
    (raw: string) => {
      const result = importHomeBackupJson(raw);
      if (!result.ok) return result;
      stateRef.current = result.state;
      setHomeState(result.state);
      writeHomeResourcesState(dataStore, result.state);
      return { ok: true };
    },
    [dataStore],
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
      upsertDailyRecord,
      updateDailyRecord,
      deleteDailyRecord,
      deleteHistoricalRecord,
      updateExchangeRecord,
      deleteExchangeRecord,
      updateHeatmapStartDate,
      upsertExchangeCategory,
      deleteExchangeCategory,
      exportBackupJson,
      exportWeeklyReviewCsv: exportWeeklyReviewCsvAction,
      importBackupJson,
    }),
    [
      homeState,
      tryRedeem,
      redeemExchange,
      applyTodayRecord,
      applyHistoricalRecord,
      upsertHistoricalRecord,
      upsertDailyRecord,
      updateDailyRecord,
      deleteDailyRecord,
      deleteHistoricalRecord,
      updateExchangeRecord,
      deleteExchangeRecord,
      updateHeatmapStartDate,
      upsertExchangeCategory,
      deleteExchangeCategory,
      exportBackupJson,
      exportWeeklyReviewCsvAction,
      importBackupJson,
    ],
  );

  return (
    <HomeResourcesContext.Provider value={value}>
      {children}
    </HomeResourcesContext.Provider>
  );
}
