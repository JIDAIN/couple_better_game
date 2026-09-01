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
  serializeHomeSyncData,
} from "@/lib/home/export-service";
import { computeCoinWallet } from "@/lib/home/home-stat-service";
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
import {
  guardRemoteReload,
  retryExhaustedMessage,
  shouldRetrySync,
  shouldRunPendingAutoSync,
  type SyncErrorCode,
} from "@/lib/home/sync-state-service";
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

const SYNC_META_STORAGE_KEY = "couple-better-game-sync-meta";
const SYNC_DIRTY_KEY = "couple-better-game-sync-dirty";
const PRE_SYNC_BACKUP_KEY = "couple-better-game:home-resources:pre-sync-backup";
const SYNC_PASSWORD_KEY = "couple-better-sync-password";

type SyncStatus =
  | "已是最新"
  | "有未同步修改"
  | "正在加载"
  | "正在同步"
  | "同步失败";

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
  syncStatus: SyncStatus;
  syncErrorReason: string | null;
  syncErrorCode: SyncErrorCode | null;
  lastSyncedAt: string | null;
  reloadFromGitHub: (options?: {
    force?: boolean;
    silent?: boolean;
    allowDirtyOverwrite?: boolean;
  }) => Promise<{
    ok: boolean;
    reason?: string;
    errorCode?: SyncErrorCode;
  }>;
  syncToGitHub: (
    password: string,
  ) => Promise<{ ok: boolean; reason?: string; errorCode?: SyncErrorCode }>;
  exportBackupJson: () => string;
  exportGitHubSyncJson: () => string;
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

function readSyncMeta() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SYNC_META_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lastSyncedAt?: unknown };
    return typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : null;
  } catch {
    return null;
  }
}

function writeSyncMeta(lastSyncedAt: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SYNC_META_STORAGE_KEY,
    JSON.stringify({ lastSyncedAt }),
  );
}

function readSyncDirty(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SYNC_DIRTY_KEY) === "1";
}

function writeSyncDirty(dirty: boolean) {
  if (typeof window === "undefined") return;
  if (dirty) {
    window.localStorage.setItem(SYNC_DIRTY_KEY, "1");
  } else {
    window.localStorage.removeItem(SYNC_DIRTY_KEY);
  }
}

function readSyncPassword(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(SYNC_PASSWORD_KEY) ?? "";
}

function clearSyncPassword() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SYNC_PASSWORD_KEY);
}

function writePreSyncBackup(state: HomeResourcesState) {
  if (typeof window === "undefined") return;
  try {
    const backup = serializeHomeBackup(state);
    window.localStorage.setItem(PRE_SYNC_BACKUP_KEY, backup);
  } catch {
    // 备份失败不阻塞
  }
}

function clearPreSyncBackup() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PRE_SYNC_BACKUP_KEY);
  } catch {
    // ignore
  }
}

const MAX_SYNC_RETRY = 3;

function timestamp(value: string | null | undefined) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function remoteUpdatedAtFromData(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const updatedAt = (data as { updatedAt?: unknown }).updatedAt;
  return typeof updatedAt === "string" ? updatedAt : null;
}

export function HomeResourcesProvider({
  children,
  initialGems = 0,
  initialCoins = 0,
}: ProviderProps) {
  const dataStore = useMemo(() => createLocalStorageAppDataStore(), []);
  const [homeState, setHomeState] = useState<HomeResourcesState>(() =>
    createDefaultHomeResourcesState(initialGems, initialCoins),
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("正在加载");
  const [syncErrorReason, setSyncErrorReason] = useState<string | null>(null);
  const [syncErrorCode, setSyncErrorCode] = useState<SyncErrorCode | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const stateRef = useRef(homeState);
  const lastSyncedAtRef = useRef<string | null>(null);
  const hadLocalDataRef = useRef(false);
  const hasUnsyncedChangesRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const pendingAutoSyncRef = useRef(false);
  const retryCountRef = useRef(0);
  const syncErrorCodeRef = useRef<SyncErrorCode | null>(null);
  const syncErrorReasonRef = useRef<string | null>(null);

  const [dirtyVersion, setDirtyVersion] = useState(0);
  const dirtyVersionRef = useRef(0);

  const [retryVersion, setRetryVersion] = useState(0);
  const retryVersionRef = useRef(0);

  const bumpDirtyVersion = useCallback(() => {
    retryCountRef.current = 0;
    retryVersionRef.current = 0;
    setRetryVersion(0);
    dirtyVersionRef.current += 1;
    setDirtyVersion(dirtyVersionRef.current);
  }, []);

  const clearDirtyVersion = useCallback(() => {
    retryCountRef.current = 0;
    retryVersionRef.current = 0;
    setRetryVersion(0);
    dirtyVersionRef.current = 0;
    setDirtyVersion(0);
  }, []);

  const updateLastSyncedAt = useCallback((value: string) => {
    lastSyncedAtRef.current = value;
    setLastSyncedAt(value);
    writeSyncMeta(value);
  }, []);

  const clearSyncError = useCallback(() => {
    syncErrorCodeRef.current = null;
    syncErrorReasonRef.current = null;
    setSyncErrorCode(null);
    setSyncErrorReason(null);
  }, []);

  const setSyncError = useCallback(
    (reason: string, errorCode: SyncErrorCode = "UNKNOWN") => {
      syncErrorCodeRef.current = errorCode;
      syncErrorReasonRef.current = reason;
      setSyncErrorCode(errorCode);
      setSyncErrorReason(reason);
    },
    [],
  );

  const markUnsyncedChanges = useCallback(() => {
    hasUnsyncedChangesRef.current = true;
    writeSyncDirty(true);
    clearSyncError();
    setSyncStatus("有未同步修改");
    bumpDirtyVersion();
  }, [bumpDirtyVersion, clearSyncError]);

  const commitHomeState = useCallback(
    (
      updater: (current: HomeResourcesState) => HomeResourcesState,
      options?: { markDirty?: boolean },
    ) => {
      const current = stateRef.current;
      const next = updater(current);
      if (next === current) return;
      stateRef.current = next;
      setHomeState(next);
      writeHomeResourcesState(dataStore, next);
      if (options?.markDirty !== false) {
        markUnsyncedChanges();
      }
    },
    [dataStore, markUnsyncedChanges],
  );

  const applyRemoteData = useCallback(
    (raw: unknown, remoteUpdatedAt: string) => {
      const result = importHomeBackupJson(JSON.stringify(raw));
      if (!result.ok) return result;
      stateRef.current = result.state;
      setHomeState(result.state);
      writeHomeResourcesState(dataStore, result.state);
      hasUnsyncedChangesRef.current = false;
      writeSyncDirty(false);
      clearDirtyVersion();
      clearSyncError();
      updateLastSyncedAt(remoteUpdatedAt);
      setSyncStatus("已是最新");
      return { ok: true };
    },
    [dataStore, updateLastSyncedAt, clearDirtyVersion, clearSyncError],
  );

  const reloadFromGitHub = useCallback(
    async (options?: {
      force?: boolean;
      silent?: boolean;
      allowDirtyOverwrite?: boolean;
    }) => {
      const guard = guardRemoteReload({
        hasLocalData: hadLocalDataRef.current,
        hasUnsyncedChanges: hasUnsyncedChangesRef.current,
        hasLastSyncedAt: lastSyncedAtRef.current != null,
        allowDirtyOverwrite: options?.allowDirtyOverwrite ?? false,
      });
      if (!guard.ok) {
        hasUnsyncedChangesRef.current = true;
        writeSyncDirty(true);
        setSyncError(guard.reason, guard.errorCode);
        setSyncStatus("有未同步修改");
        return guard;
      }

      setSyncStatus("正在加载");
      try {
        const response = await fetch(`/data/couple-data.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("读取 GitHub 数据失败");
        const data: unknown = await response.json();
        const remoteUpdatedAt = remoteUpdatedAtFromData(data);
        if (!remoteUpdatedAt) throw new Error("GitHub 数据缺少 updatedAt");
        const remoteTime = timestamp(remoteUpdatedAt);
        const localTime = timestamp(lastSyncedAtRef.current);
        const forceReload = options?.force ?? false;
        const shouldApply =
          forceReload || localTime == null || (remoteTime ?? 0) > localTime;

        if (!shouldApply) {
          setSyncStatus(
            hasUnsyncedChangesRef.current ? "有未同步修改" : "已是最新",
          );
          return { ok: true };
        }

        const result = applyRemoteData(data, remoteUpdatedAt);
        if (!result.ok) {
          throw new Error(
            "reason" in result
              ? result.reason ?? "GitHub 数据格式不正确"
              : "GitHub 数据格式不正确",
          );
        }
        return { ok: true };
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "从 GitHub 重新加载失败";
        setSyncError(reason);
        setSyncStatus("同步失败");
        return { ok: false, reason, errorCode: "UNKNOWN" as const };
      }
    },
    [applyRemoteData, setSyncError],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const savedLastSyncedAt = readSyncMeta();
      lastSyncedAtRef.current = savedLastSyncedAt;
      setLastSyncedAt(savedLastSyncedAt);
      let hadLocalData = false;
      try {
        hadLocalData = !!dataStore.load();
      } catch {
        hadLocalData = false;
      }
      hadLocalDataRef.current = hadLocalData;
      const next = readHomeResourcesState(dataStore, {
        initialGems,
        initialCoins,
      });
      stateRef.current = next;
      setHomeState(next);

      const persistedDirty = readSyncDirty();
      if (persistedDirty && hadLocalData) {
        hasUnsyncedChangesRef.current = true;
        clearSyncError();
        setSyncStatus("有未同步修改");
        bumpDirtyVersion();
        return;
      }

      if (hadLocalData && !savedLastSyncedAt) {
        hasUnsyncedChangesRef.current = true;
        writeSyncDirty(true);
        setSyncError(
          "本地已有数据但缺少上次同步记录，为避免覆盖，请先同步本地数据",
          "LOCAL_DATA_NEEDS_SYNC",
        );
        setSyncStatus("有未同步修改");
        bumpDirtyVersion();
        return;
      }

      void reloadFromGitHub({ force: !hadLocalData, silent: true });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [
    dataStore,
    initialGems,
    initialCoins,
    reloadFromGitHub,
    bumpDirtyVersion,
    clearSyncError,
    setSyncError,
  ]);

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
          gems: state.wallet.gems - gems,
          coins: computeCoinWallet(state.dailyRecords, [
            record,
            ...state.exchangeRecords,
          ]),
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
            coins: computeCoinWallet(state.dailyRecords, nextExchangeRecords),
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
        const refundGems =
          existing.resourceKind === "gem" ? existing.price : 0;
        const nextExchangeRecords = state.exchangeRecords.filter(
          (item) => item.id !== recordId,
        );
        return {
          ...state,
          wallet: {
            gems: state.wallet.gems + refundGems,
            coins: computeCoinWallet(state.dailyRecords, nextExchangeRecords),
          },
          exchangeRecords: nextExchangeRecords,
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

  const exportGitHubSyncJson = useCallback(
    () => serializeHomeSyncData(stateRef.current),
    [],
  );

  const syncToGitHub = useCallback(
    async (
      password: string,
    ): Promise<{ ok: boolean; reason?: string; errorCode?: SyncErrorCode }> => {
      const trimmed = password.trim();
      if (!trimmed) {
        const reason = "需要先保存同步密码，之后才能自动同步";
        setSyncError(reason, "MISSING_PASSWORD");
        setSyncStatus("有未同步修改");
        return { ok: false, reason, errorCode: "MISSING_PASSWORD" };
      }

      if (syncInFlightRef.current) {
        pendingAutoSyncRef.current = true;
        return { ok: false, reason: "正在同步中", errorCode: "IN_FLIGHT" };
      }
      syncInFlightRef.current = true;

      const syncingVersion = dirtyVersionRef.current;

      writePreSyncBackup(stateRef.current);

      clearSyncError();
      setSyncStatus("正在同步");
      try {
        const response = await fetch("/api/save-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password: trimmed,
            data: JSON.parse(serializeHomeSyncData(stateRef.current)),
          }),
        });
        const result = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          errorCode?: SyncErrorCode;
          updatedAt?: string;
        } | null;
        if (!response.ok || !result?.ok) {
          const reason = result?.error ?? "同步到 GitHub 失败";
          const errorCode = result?.errorCode ?? "UNKNOWN";
          throw Object.assign(new Error(reason), { errorCode });
        }

        const syncedAt = result.updatedAt ?? new Date().toISOString();

        if (dirtyVersionRef.current === syncingVersion) {
          hasUnsyncedChangesRef.current = false;
          writeSyncDirty(false);
          clearDirtyVersion();
          clearSyncError();
          clearPreSyncBackup();
          updateLastSyncedAt(syncedAt);
          setSyncStatus("已是最新");
        } else {
          hasUnsyncedChangesRef.current = true;
          writeSyncDirty(true);
          setSyncStatus("有未同步修改");
          bumpDirtyVersion();
        }

        return { ok: true };
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "同步到 GitHub 失败";
        const errorCode =
          error instanceof Error &&
          "errorCode" in error &&
          typeof error.errorCode === "string"
            ? (error.errorCode as SyncErrorCode)
            : "UNKNOWN";
        if (errorCode === "WRONG_PASSWORD") {
          clearSyncPassword();
        }
        setSyncError(reason, errorCode);
        setSyncStatus("同步失败");
        retryVersionRef.current += 1;
        setRetryVersion(retryVersionRef.current);
        return { ok: false, reason, errorCode };
      } finally {
        syncInFlightRef.current = false;
        if (
          shouldRunPendingAutoSync({
            pendingAutoSync: pendingAutoSyncRef.current,
            hasUnsyncedChanges: hasUnsyncedChangesRef.current,
            syncInFlight: syncInFlightRef.current,
            errorCode: syncErrorCodeRef.current,
          })
        ) {
          pendingAutoSyncRef.current = false;
          bumpDirtyVersion();
        } else {
          pendingAutoSyncRef.current = false;
        }
      }
    },
    [
      updateLastSyncedAt,
      clearDirtyVersion,
      bumpDirtyVersion,
      clearSyncError,
      setSyncError,
    ],
  );

  useEffect(() => {
    if (dirtyVersion === 0) return;

    const password = readSyncPassword();
    if (!password) {
      const reason = "需要先在数据管理中勾选“记住本设备”并成功同步一次";
      const timer = window.setTimeout(() => {
        setSyncError(reason, "MISSING_PASSWORD");
        setSyncStatus("有未同步修改");
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      if (!hasUnsyncedChangesRef.current) return;
      if (syncInFlightRef.current) {
        pendingAutoSyncRef.current = true;
        return;
      }
      void syncToGitHub(password);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [dirtyVersion, syncToGitHub, setSyncError]);

  useEffect(() => {
    if (retryVersion === 0) return;
    if (
      !shouldRetrySync({
        hasUnsyncedChanges: hasUnsyncedChangesRef.current,
        retryCount: retryCountRef.current,
        maxRetry: MAX_SYNC_RETRY,
        errorCode: syncErrorCodeRef.current,
      })
    ) {
      if (
        hasUnsyncedChangesRef.current &&
        retryCountRef.current >= MAX_SYNC_RETRY
      ) {
        setSyncError(
          retryExhaustedMessage(syncErrorReasonRef.current),
          "RETRY_EXHAUSTED",
        );
        setSyncStatus("同步失败");
      }
      return;
    }

    const password = readSyncPassword();
    if (!password) {
      const timer = window.setTimeout(() => {
        setSyncError("需要先保存同步密码，之后才能自动重试", "MISSING_PASSWORD");
        setSyncStatus("有未同步修改");
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      if (!hasUnsyncedChangesRef.current) return;
      if (syncInFlightRef.current) {
        pendingAutoSyncRef.current = true;
        return;
      }
      if (
        !shouldRetrySync({
          hasUnsyncedChanges: hasUnsyncedChangesRef.current,
          retryCount: retryCountRef.current,
          maxRetry: MAX_SYNC_RETRY,
          errorCode: syncErrorCodeRef.current,
        })
      ) {
        return;
      }

      retryCountRef.current += 1;
      void syncToGitHub(password);
    }, 30_000);

    return () => window.clearTimeout(timer);
  }, [retryVersion, syncToGitHub, setSyncError]);

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
      markUnsyncedChanges();
      return { ok: true };
    },
    [dataStore, markUnsyncedChanges],
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
      syncStatus,
      syncErrorReason,
      syncErrorCode,
      lastSyncedAt,
      reloadFromGitHub,
      syncToGitHub,
      exportBackupJson,
      exportGitHubSyncJson,
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
      syncStatus,
      syncErrorReason,
      syncErrorCode,
      lastSyncedAt,
      reloadFromGitHub,
      syncToGitHub,
      exportBackupJson,
      exportGitHubSyncJson,
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
