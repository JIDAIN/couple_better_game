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
import { defaultHeatmapStartDate } from "./mockHeatmapData";
import {
  buildHeatmapDay,
  computeCoinPreview,
  computeCoupleBonus,
  DEFAULT_COIN_RULES,
  DEFAULT_VISUAL_RULES,
  GEM_CAP,
  getCurrentIsoDate,
  gemsForPerson,
  isInCoinWeek,
  type CoinRulesConfig,
  type PersonKey,
  type SettlementVisualRules,
  type SideLogInput,
} from "./settlement-rules";
import type { HeatmapDay } from "./types";

export { GEM_CAP } from "./settlement-rules";

const STORAGE_KEY = "couple-better-game:home-resources:v1";

type Wallet = { gems: number; coins: number };

export type ResourceKind = "gem" | "coin";

export type HeatmapDayOverrides = Partial<Record<number, HeatmapDay>>;

export type ExchangeCategory = {
  id: string;
  title: string;
  icon: string;
  description: string;
  resourceKind: ResourceKind;
  price: number;
};

export type ExchangeRecord = {
  id: string;
  date: string;
  createdAt: string;
  occurredAt: string;
  time: string;
  category: string;
  remark: string;
  resourceKind: ResourceKind;
  price: number;
  icon: string;
};

type DailyRecordSide = {
  weightKg: number | null;
  deficit: number;
  minutes: number;
  gems: number;
};

export type DailyRecord = {
  id: string;
  date: string;
  recordDate: string;
  createdAt: string;
  day: number;
  fish: DailyRecordSide;
  cat: DailyRecordSide;
  bonus: number;
  coins: number;
  fishHeat: HeatmapDay;
  catHeat: HeatmapDay;
};

type TodayRecordSidePayload = {
  weightKg: number | null;
  deficit: number;
  minutes: number;
};

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

type ExchangeRedeemPayload = {
  category: string;
  remark: string;
  resourceKind: ResourceKind;
  price: number;
  icon: string;
  occurredAt?: string;
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

const DEFAULT_EXCHANGE_CATEGORIES: ExchangeCategory[] = [
  {
    id: "snack",
    title: "零食",
    icon: "🍪",
    description: "轻轻松松来一点，小小满足一下",
    resourceKind: "gem",
    price: 5,
  },
  {
    id: "drink",
    title: "双份零食",
    icon: "🍿",
    description: "给认真努力的自己，再多一点奖励",
    resourceKind: "gem",
    price: 8,
  },
  {
    id: "double-drink",
    title: "双份饮料",
    icon: "🥤",
    description: "双人份的小快乐，备注里写清楚就好",
    resourceKind: "gem",
    price: 15,
  },
  {
    id: "dinner",
    title: "大餐",
    icon: "🍝",
    description: "热乎乎的一顿，适合记账",
    resourceKind: "coin",
    price: 4,
  },
  {
    id: "deluxe-dinner",
    title: "豪华大餐",
    icon: "🍰",
    description: "更丰盛一点，像周末的小奖励",
    resourceKind: "coin",
    price: 8,
  },
  {
    id: "family",
    title: "家庭放纵餐",
    icon: "🏠",
    description: "给特殊时刻留一笔温柔的奖励",
    resourceKind: "gem",
    price: 15,
  },
];

function normalizeExchangeCategories(
  categories: ExchangeCategory[],
): ExchangeCategory[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const mergedDefaults = DEFAULT_EXCHANGE_CATEGORIES.map((category) => {
    const existing = byId.get(category.id);
    return existing ? { ...category, ...existing } : category;
  });
  const defaultIds = new Set(DEFAULT_EXCHANGE_CATEGORIES.map((item) => item.id));
  const extras = categories.filter((category) => !defaultIds.has(category.id));
  return [...mergedDefaults, ...extras];
}

const MAY_HISTORY_ROWS = [
  {
    day: 6,
    fish: { deficit: 525, minutes: 0 },
    cat: { deficit: 284, minutes: 0 },
  },
  {
    day: 7,
    fish: { deficit: 501, minutes: 60 },
    cat: { deficit: 236, minutes: 60 },
  },
  {
    day: 8,
    fish: { deficit: 871, minutes: 0 },
    cat: { deficit: 405, minutes: 0 },
  },
  {
    day: 9,
    fish: { deficit: 565, minutes: 0 },
    cat: { deficit: 89, minutes: 0 },
  },
  {
    day: 10,
    fish: { deficit: 681, minutes: 0 },
    cat: { deficit: 405, minutes: 0 },
  },
  {
    day: 11,
    fish: { deficit: 508, minutes: 0 },
    cat: { deficit: 200, minutes: 0 },
  },
  {
    day: 12,
    fish: { deficit: 317, minutes: 0 },
    cat: { deficit: 244, minutes: 0 },
  },
] as const;

const MAY_HISTORY_IMPORT_PREFIX = "seed-may-history";

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
): HomeResourcesState {
  const fallback = createDefaultState(initialGems, initialCoins);
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const next = recalculateCoinsWithCurrentRules(
        importMayHistoryRecords(fallback),
      );
      writeLocalState(next);
      return next;
    }
    const parsed = JSON.parse(raw) as Partial<HomeResourcesState>;

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
    writeLocalState(next);
    return next;
  } catch {
    const next = recalculateCoinsWithCurrentRules(
      importMayHistoryRecords(fallback),
    );
    writeLocalState(next);
    return next;
  }
}

function writeLocalState(state: HomeResourcesState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function todayIsoDate() {
  return getCurrentIsoDate();
}

function isoDateFromMayDay(day: number) {
  return `2026-05-${pad2(day)}`;
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function formatRecordDateFromIso(recordDate: string) {
  const parsed = parseIsoDate(recordDate);
  if (!parsed) return recordDate;
  return `${parsed.year}年${parsed.month}月${parsed.day}日`;
}

function formatExchangeDateLabel(date: Date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatExchangeTimeLabel(date: Date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function parseDateTimeInput(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeExchangeDateTime(
  value?: string | null,
  fallback = new Date(),
) {
  const parsed = value ? parseDateTimeInput(value) : null;
  const date = parsed ?? fallback;
  return {
    date,
    occurredAt: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
      date.getDate(),
    )}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
  };
}

function normalizeExchangeRecord(record: ExchangeRecord): ExchangeRecord {
  const normalized = normalizeExchangeDateTime(
    record.occurredAt ?? record.createdAt,
  );
  return {
    ...record,
    occurredAt: normalized.occurredAt,
    time: record.time || formatExchangeTimeLabel(normalized.date),
    date:
      record.date ||
      `${formatExchangeDateLabel(normalized.date)} ${formatExchangeTimeLabel(
        normalized.date,
      )}`,
  };
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

function normalizeDailyRecord(record: DailyRecord): DailyRecord {
  const recordDate = record.recordDate ?? isoDateFromMayDay(record.day);
  return {
    ...record,
    date: record.date ?? formatRecordDateFromIso(recordDate),
    recordDate,
  };
}

function sideInputFromRecordSide(side: DailyRecordSide): SideLogInput {
  return {
    weightKg: side.weightKg,
    deficit: side.deficit,
    minutes: side.minutes,
  };
}

function normalizeHistoricalSideInput(
  input?: TodayRecordSidePayload | null,
): TodayRecordSidePayload | null {
  if (!input) return null;
  return {
    weightKg: input.weightKg,
    deficit: Math.max(0, Math.floor(input.deficit)),
    minutes: Math.max(0, Math.floor(input.minutes)),
  };
}

function recordGems(record: DailyRecord) {
  return record.fish.gems + record.cat.gems + record.bonus;
}

function recordIsoDate(record: DailyRecord) {
  return record.recordDate ?? isoDateFromMayDay(record.day);
}

function isSuccessfulCheckIn(
  record: DailyRecord,
  visualRules: SettlementVisualRules = DEFAULT_VISUAL_RULES,
) {
  return (
    record.fish.deficit >= visualRules.heatmap.fish.okMin &&
    record.cat.deficit >= visualRules.heatmap.cat.okMin
  );
}

function countSuccessfulCheckInsInWeek(
  records: DailyRecord[],
  targetIsoDate: string,
  coinRules: CoinRulesConfig,
  visualRules: SettlementVisualRules = DEFAULT_VISUAL_RULES,
) {
  return records.reduce((total, record) => {
    const date = recordIsoDate(record);
    return isInCoinWeek(date, targetIsoDate, coinRules.weekStartDay) &&
      isSuccessfulCheckIn(record, visualRules)
      ? total + 1
      : total;
  }, 0);
}

function countSuccessfulCheckInsTotal(
  records: DailyRecord[],
  visualRules: SettlementVisualRules = DEFAULT_VISUAL_RULES,
) {
  return records.reduce(
    (total, record) =>
      isSuccessfulCheckIn(record, visualRules) ? total + 1 : total,
    0,
  );
}

function findRecordByIso(records: DailyRecord[], recordDate: string) {
  return records.find((record) => recordIsoDate(record) === recordDate) ?? null;
}

function previousIsoDate(recordDate: string) {
  const parsed = parseIsoDate(recordDate);
  if (!parsed) return null;
  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

function orderDailyRecords(records: DailyRecord[]) {
  return [...records].sort((a, b) =>
    recordIsoDate(b).localeCompare(recordIsoDate(a)),
  );
}

function buildHeatmapOverrides(
  records: DailyRecord[],
  person: "fish" | "cat",
): HeatmapDayOverrides {
  return records.reduce<HeatmapDayOverrides>((acc, record) => {
    const parsed = parseIsoDate(recordIsoDate(record));
    if (!parsed || parsed.year !== 2026 || parsed.month !== 5) return acc;
    acc[record.day] = person === "fish" ? record.fishHeat : record.catHeat;
    return acc;
  }, {});
}

function sumRecordCoins(records: DailyRecord[]) {
  return records.reduce((total, record) => total + record.coins, 0);
}

function sumRecordGemsInCoinWeek(
  records: DailyRecord[],
  targetIsoDate: string,
  coinRules: CoinRulesConfig = DEFAULT_COIN_RULES,
) {
  return records.reduce((total, record) => {
    const date = recordIsoDate(record);
    return isInCoinWeek(date, targetIsoDate, coinRules.weekStartDay)
      ? total + recordGems(record)
      : total;
  }, 0);
}

function sumRecordCoinsInCoinWeek(
  records: DailyRecord[],
  targetIsoDate: string,
  coinRules: CoinRulesConfig = DEFAULT_COIN_RULES,
) {
  return records.reduce((total, record) => {
    const date = recordIsoDate(record);
    return isInCoinWeek(date, targetIsoDate, coinRules.weekStartDay)
      ? total + record.coins
      : total;
  }, 0);
}

function sumCoinExchangeSpend(records: ExchangeRecord[]) {
  return records.reduce(
    (total, record) =>
      record.resourceKind === "coin" ? total + record.price : total,
    0,
  );
}

function computeGemWallet(
  records: DailyRecord[],
  exchangeRecords: ExchangeRecord[],
) {
  const events = [
    ...records.map((record) => ({
      at: `${record.createdAt || record.recordDate}#gain`,
      delta: recordGems(record),
    })),
    ...exchangeRecords
      .filter((record) => record.resourceKind === "gem")
      .map((record) => ({
        at: `${record.occurredAt || record.createdAt || record.date}#spend`,
        delta: -record.price,
      })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return events.reduce((balance, event) => {
    if (event.delta >= 0) {
      return Math.min(GEM_CAP, balance + event.delta);
    }
    return Math.max(0, balance + event.delta);
  }, 0);
}

function exchangeRecordSortKey(record: ExchangeRecord) {
  return record.occurredAt || record.createdAt || record.date;
}

function orderExchangeRecords(records: ExchangeRecord[]) {
  return [...records].sort((a, b) =>
    exchangeRecordSortKey(b).localeCompare(exchangeRecordSortKey(a)),
  );
}

function todayRecordFrom(records: DailyRecord[]) {
  return findRecordByIso(records, todayIsoDate());
}

function yesterdayRecordFrom(records: DailyRecord[]) {
  const iso = previousIsoDate(todayIsoDate());
  if (!iso) return null;
  return findRecordByIso(records, iso);
}

export function recalculateCoinsWithCurrentRules(
  state: HomeResourcesState,
): HomeResourcesState {
  const ascendingRecords = [...state.dailyRecords].sort((a, b) =>
    recordIsoDate(a).localeCompare(recordIsoDate(b)),
  );
  let previousRecords: DailyRecord[] = [];
  const recalculatedRecords: DailyRecord[] = [];

  for (const record of ascendingRecords) {
    const recordDate = recordIsoDate(record);
    const coin = computeCoinPreview({
      fish: sideInputFromRecordSide(record.fish),
      cat: sideInputFromRecordSide(record.cat),
      todayDay: record.day,
      todayDate: recordDate,
      todayGemTotal: recordGems(record),
      currentWeekGemTotal: sumRecordGemsInCoinWeek(
        previousRecords,
        recordDate,
        state.coinRules,
      ),
      dailyRecords: previousRecords,
      coinRules: state.coinRules,
      visualRules: state.visualRules,
    });
    const nextRecord = {
      ...record,
      coins: coin.delta,
      fishHeat: buildHeatmapDay(
        "fish",
        sideInputFromRecordSide(record.fish),
        state.visualRules,
      ),
      catHeat: buildHeatmapDay(
        "cat",
        sideInputFromRecordSide(record.cat),
        state.visualRules,
      ),
    };
    recalculatedRecords.push(nextRecord);
    previousRecords = orderDailyRecords([...previousRecords, nextRecord]);
  }

  const nextRecords = orderDailyRecords(recalculatedRecords);
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
    dailyRecords: nextRecords,
  };
}

export function importMayHistoryRecords(
  state: HomeResourcesState,
): HomeResourcesState {
  const importDates = new Set(
    MAY_HISTORY_ROWS.map((row) => isoDateFromMayDay(row.day)),
  );
  const baseRecords = state.dailyRecords.filter(
    (record) => !importDates.has(recordIsoDate(record)),
  );
  const oldImportRecords = state.dailyRecords.filter((record) =>
    importDates.has(recordIsoDate(record)),
  );

  let workingRecords = orderDailyRecords(baseRecords);
  const importedRecords: DailyRecord[] = [];

  for (const row of MAY_HISTORY_ROWS) {
    const recordDate = isoDateFromMayDay(row.day);
    const previousDate = previousIsoDate(recordDate);
    const yesterdayRecord = previousDate
      ? findRecordByIso(workingRecords, previousDate)
      : null;
    const fishInput: SideLogInput = {
      weightKg: null,
      deficit: row.fish.deficit,
      minutes: row.fish.minutes,
    };
    const catInput: SideLogInput = {
      weightKg: null,
      deficit: row.cat.deficit,
      minutes: row.cat.minutes,
    };
    const fishGems = gemsForPerson("fish", fishInput, yesterdayRecord);
    const catGems = gemsForPerson("cat", catInput, yesterdayRecord);
    const couple = computeCoupleBonus(fishInput, catInput);
    const todayGemTotal = fishGems + catGems + couple.gems;
    const coin = computeCoinPreview({
      fish: fishInput,
      cat: catInput,
      todayDay: row.day,
      todayDate: recordDate,
      todayGemTotal,
      currentWeekGemTotal: sumRecordGemsInCoinWeek(
        workingRecords,
        recordDate,
        state.coinRules,
      ),
      dailyRecords: workingRecords,
      coinRules: state.coinRules,
      visualRules: state.visualRules,
    });

    const record: DailyRecord = {
      id: `${MAY_HISTORY_IMPORT_PREFIX}-${recordDate}`,
      date: formatRecordDateFromIso(recordDate),
      recordDate,
      createdAt: `${recordDate}T12:00:00.000Z`,
      day: row.day,
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

    importedRecords.push(record);
    workingRecords = orderDailyRecords([record, ...workingRecords]);
  }

  const nextRecords = orderDailyRecords([...importedRecords, ...baseRecords]);
  const oldCoinTotal = sumRecordCoins(oldImportRecords);
  const newCoinTotal = sumRecordCoins(importedRecords);
  const todayRecord = todayRecordFrom(nextRecords);
  const yesterdayRecord = yesterdayRecordFrom(nextRecords);

  return {
    ...state,
    wallet: {
      gems: computeGemWallet(nextRecords, state.exchangeRecords),
      coins: Math.max(0, state.wallet.coins - oldCoinTotal + newCoinTotal),
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
}

export function HomeResourcesProvider({
  children,
  initialGems = 0,
  initialCoins = 0,
}: ProviderProps) {
  const [homeState, setHomeState] = useState<HomeResourcesState>(() =>
    readLocalState(initialGems, initialCoins),
  );
  const stateRef = useRef(homeState);

  const commitHomeState = useCallback(
    (updater: (current: HomeResourcesState) => HomeResourcesState) => {
      const next = updater(stateRef.current);
      stateRef.current = next;
      setHomeState(next);
      writeLocalState(next);
    },
    [],
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

      const occurred = normalizeExchangeDateTime(
        payload.occurredAt,
        new Date(),
      );
      const createdAt = new Date().toISOString();
      const record: ExchangeRecord = {
        id: makeId("exchange"),
        date: `${formatExchangeDateLabel(occurred.date)} ${formatExchangeTimeLabel(
          occurred.date,
        )}`,
        createdAt,
        occurredAt: occurred.occurredAt,
        time: formatExchangeTimeLabel(occurred.date),
        ...payload,
      };

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

        const occurred = normalizeExchangeDateTime(
          patch.occurredAt ?? existing.occurredAt,
          new Date(existing.createdAt),
        );
        const nextRecord: ExchangeRecord = normalizeExchangeRecord({
          ...existing,
          occurredAt: occurred.occurredAt,
          time: formatExchangeTimeLabel(occurred.date),
          date: `${formatExchangeDateLabel(occurred.date)} ${formatExchangeTimeLabel(
            occurred.date,
          )}`,
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
        const exists = state.exchangeCategories.some(
          (item) => item.id === category.id,
        );
        return {
          ...state,
          exchangeCategories: exists
            ? state.exchangeCategories.map((item) =>
                item.id === category.id ? category : item,
              )
            : [category, ...state.exchangeCategories],
        };
      });
    },
    [commitHomeState],
  );

  const deleteExchangeCategory = useCallback(
    (categoryId: string) => {
      commitHomeState((state) => ({
        ...state,
        exchangeCategories: state.exchangeCategories.filter(
          (item) => item.id !== categoryId,
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
