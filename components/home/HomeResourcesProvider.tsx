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
import { formatRecordDateFromIso, parseIsoDate, previousIsoDate, todayIsoDate } from "@/lib/home/date-utils";
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
  buildHeatmapOverrides,
  findRecordByIso,
  normalizeDailyRecord,
  normalizeHistoricalSideInput,
  orderDailyRecords,
  recordGems,
  sideInputFromRecordSide,
} from "@/lib/home/daily-record-utils";
import { DEFAULT_EXCHANGE_CATEGORIES } from "@/lib/home/home-default-config";
import { createLocalStorageAppDataStore } from "@/lib/home/local-storage-app-data-store";
import {
  computeGemWallet,
  countSuccessfulCheckInsInWeek,
  countSuccessfulCheckInsTotal,
  importMayHistoryRecords,
  recalculateCoinsWithCurrentRules,
  sumCoinExchangeSpend,
  sumRecordCoins,
  sumRecordCoinsInCoinWeek,
  sumRecordGemsInCoinWeek,
  todayRecordFrom,
  yesterdayRecordFrom,
} from "@/lib/home/home-stat-service";
import type {
  DailyRecord,
  DailyRecordSide,
  ExchangeCategory,
  ExchangeRecord,
  HeatmapDay,
  HeatmapDayOverrides,
  TodayRecordSidePayload,
  Wallet,
} from "@/lib/home/types";
import { defaultHeatmapStartDate } from "./mockHeatmapData";
import {
  buildHeatmapDay,
  computeCoinPreview,
  computeCoupleBonus,
  DEFAULT_COIN_RULES,
  DEFAULT_VISUAL_RULES,
  gemsForPerson,
  type CoinRulesConfig,
  type PersonKey,
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
  person: PersonKey;
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

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function zeroSide(): DailyRecordSide {
  return {
    weightKg: null,
    deficit: 0,
    minutes: 0,
    gems: 0,
  };
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
      const recordDate = todayIsoDate();
      const record: DailyRecord = {
        id: makeId("daily"),
        date: formatRecordDateFromIso(recordDate),
        recordDate,
        createdAt: new Date().toISOString(),
        day: payload.day,
        fish: {
          ...payload.fish,
          gems: payload.fishGems,
        },
        cat: {
          ...payload.cat,
          gems: payload.catGems,
        },
        bonus: payload.bonusGems,
        coins: payload.coinDelta,
        fishHeat: payload.fishHeat,
        catHeat: payload.catHeat,
      };

      commitHomeState((state) => {
        const nextRecords = orderDailyRecords([record, ...state.dailyRecords]);
        const yesterdayRecord = yesterdayRecordFrom(nextRecords);
        return {
          ...state,
          wallet: {
            gems: computeGemWallet(nextRecords, state.exchangeRecords),
            coins: state.wallet.coins + payload.coinDelta,
          },
          todayFishGems: payload.fishGems,
          todayCatGems: payload.catGems,
          todayBonusGems: payload.bonusGems,
          weekGemTotal: sumRecordGemsInCoinWeek(
            nextRecords,
            recordDate,
            state.coinRules,
          ),
          weekCoinTotal: sumRecordCoinsInCoinWeek(
            nextRecords,
            recordDate,
            state.coinRules,
          ),
          streakDays: countSuccessfulCheckInsInWeek(
            nextRecords,
            todayIsoDate(),
            state.coinRules,
            state.visualRules,
          ),
          weeklySuccessDays: countSuccessfulCheckInsInWeek(
            nextRecords,
            todayIsoDate(),
            state.coinRules,
            state.visualRules,
          ),
          cumulativeSuccessDays: countSuccessfulCheckInsTotal(
            nextRecords,
            state.visualRules,
          ),
          yesterdayGemTotal: yesterdayRecord ? recordGems(yesterdayRecord) : 0,
          fishHeatmapOverrides: {
            ...state.fishHeatmapOverrides,
            [payload.day]: payload.fishHeat,
          },
          catHeatmapOverrides: {
            ...state.catHeatmapOverrides,
            [payload.day]: payload.catHeat,
          },
          dailyRecords: nextRecords,
        };
      });
    },
    [commitHomeState],
  );

  const upsertHistoricalRecord = useCallback(
    (payload: HistoricalRecordDraft): HistoricalRecordResult => {
      const parsed = parseIsoDate(payload.recordDate);
      if (!parsed) {
        return { ok: false, updatedExisting: false, reason: "invalid-date" };
      }
      if (payload.recordDate > todayIsoDate()) {
        return { ok: false, updatedExisting: false, reason: "future-date" };
      }

      let result: HistoricalRecordResult = {
        ok: true,
        updatedExisting: false,
      };

      commitHomeState((state) => {
        const existing = findRecordByIso(state.dailyRecords, payload.recordDate);
        const recordsWithoutExisting = existing
          ? state.dailyRecords.filter((record) => record.id !== existing.id)
          : state.dailyRecords;
        const previousDate = previousIsoDate(payload.recordDate);
        const previousRecord = previousDate
          ? findRecordByIso(recordsWithoutExisting, previousDate)
          : null;

        const baseFish =
          existing?.fish != null
            ? sideInputFromRecordSide(existing.fish)
            : sideInputFromRecordSide(zeroSide());
        const baseCat =
          existing?.cat != null
            ? sideInputFromRecordSide(existing.cat)
            : sideInputFromRecordSide(zeroSide());
        const fishInput =
          normalizeHistoricalSideInput(payload.fish) ?? baseFish;
        const catInput =
          normalizeHistoricalSideInput(payload.cat) ?? baseCat;
        const fishGems = gemsForPerson("fish", fishInput, previousRecord);
        const catGems = gemsForPerson("cat", catInput, previousRecord);
        const couple = computeCoupleBonus(fishInput, catInput);
        const newGemTotal = fishGems + catGems + couple.gems;
        const weekGemTotalWithoutExisting = sumRecordGemsInCoinWeek(
          recordsWithoutExisting,
          payload.recordDate,
          state.coinRules,
        );
        const coin = computeCoinPreview({
          fish: fishInput,
          cat: catInput,
          todayDay: parsed.day,
          todayDate: payload.recordDate,
          todayGemTotal: newGemTotal,
          currentWeekGemTotal: weekGemTotalWithoutExisting,
          dailyRecords: recordsWithoutExisting,
          coinRules: state.coinRules,
          visualRules: state.visualRules,
        });

        const nextRecord: DailyRecord = {
          id: existing?.id ?? makeId("daily"),
          date: formatRecordDateFromIso(payload.recordDate),
          recordDate: payload.recordDate,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          day: parsed.day,
          fish: {
            ...fishInput,
            gems: fishGems,
          },
          cat: {
            ...catInput,
            gems: catGems,
          },
          bonus: couple.gems,
          coins: coin.delta,
          fishHeat: buildHeatmapDay("fish", fishInput, state.visualRules),
          catHeat: buildHeatmapDay("cat", catInput, state.visualRules),
        };

        const nextRecords = orderDailyRecords([
          nextRecord,
          ...recordsWithoutExisting,
        ]);
        const todayRecord = todayRecordFrom(nextRecords);
        const currentYesterdayRecord = yesterdayRecordFrom(nextRecords);
        const coinDelta = coin.delta - (existing?.coins ?? 0);
        result = {
          ok: true,
          updatedExisting: existing != null,
        };

        return {
          ...state,
          wallet: {
            gems: computeGemWallet(nextRecords, state.exchangeRecords),
            coins: Math.max(0, state.wallet.coins + coinDelta),
          },
          todayFishGems: todayRecord?.fish.gems ?? state.todayFishGems,
          todayCatGems: todayRecord?.cat.gems ?? state.todayCatGems,
          todayBonusGems: todayRecord?.bonus ?? state.todayBonusGems,
          weekGemTotal: sumRecordGemsInCoinWeek(
            nextRecords,
            todayIsoDate(),
            state.coinRules,
          ),
          weekCoinTotal: sumRecordCoinsInCoinWeek(
            nextRecords,
            todayIsoDate(),
            state.coinRules,
          ),
          streakDays: countSuccessfulCheckInsInWeek(
            nextRecords,
            todayIsoDate(),
            state.coinRules,
            state.visualRules,
          ),
          weeklySuccessDays: countSuccessfulCheckInsInWeek(
            nextRecords,
            todayIsoDate(),
            state.coinRules,
            state.visualRules,
          ),
          cumulativeSuccessDays: countSuccessfulCheckInsTotal(
            nextRecords,
            state.visualRules,
          ),
          yesterdayGemTotal: currentYesterdayRecord
            ? recordGems(currentYesterdayRecord)
            : 0,
          fishHeatmapOverrides: buildHeatmapOverrides(nextRecords, "fish"),
          catHeatmapOverrides: buildHeatmapOverrides(nextRecords, "cat"),
          dailyRecords: nextRecords,
        };
      });

      return result;
    },
    [commitHomeState],
  );

  const deleteHistoricalRecord = useCallback(
    (recordId: string) => {
      let removed = false;

      commitHomeState((state) => {
        const recordToDelete = state.dailyRecords.find(
          (record) => record.id === recordId,
        );
        if (!recordToDelete) return state;
        removed = true;

        const nextRecords = orderDailyRecords(
          state.dailyRecords.filter((record) => record.id !== recordId),
        );
        const todayRecord = todayRecordFrom(nextRecords);
        const yesterdayRecord = yesterdayRecordFrom(nextRecords);
        const earnedCoins = sumRecordCoins(nextRecords);
        const spentCoins = sumCoinExchangeSpend(state.exchangeRecords);

        return {
          ...state,
          wallet: {
            gems: computeGemWallet(nextRecords, state.exchangeRecords),
            coins: Math.max(0, earnedCoins - spentCoins),
          },
          todayFishGems: todayRecord?.fish.gems ?? state.todayFishGems,
          todayCatGems: todayRecord?.cat.gems ?? state.todayCatGems,
          todayBonusGems: todayRecord?.bonus ?? state.todayBonusGems,
          weekGemTotal: sumRecordGemsInCoinWeek(
            nextRecords,
            todayIsoDate(),
            state.coinRules,
          ),
          weekCoinTotal: sumRecordCoinsInCoinWeek(
            nextRecords,
            todayIsoDate(),
            state.coinRules,
          ),
          streakDays: countSuccessfulCheckInsInWeek(
            nextRecords,
            todayIsoDate(),
            state.coinRules,
            state.visualRules,
          ),
          weeklySuccessDays: countSuccessfulCheckInsInWeek(
            nextRecords,
            todayIsoDate(),
            state.coinRules,
            state.visualRules,
          ),
          cumulativeSuccessDays: countSuccessfulCheckInsTotal(
            nextRecords,
            state.visualRules,
          ),
          yesterdayGemTotal: yesterdayRecord ? recordGems(yesterdayRecord) : 0,
          fishHeatmapOverrides: buildHeatmapOverrides(nextRecords, "fish"),
          catHeatmapOverrides: buildHeatmapOverrides(nextRecords, "cat"),
          dailyRecords: nextRecords,
        };
      });

      return removed;
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
