"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
  applyHistoricalRecord: (payload: HistoricalRecordPayload) => HistoricalRecordResult;
  upsertHistoricalRecord: (payload: HistoricalRecordDraft) => HistoricalRecordResult;
  updateExchangeRecord: (recordId: string, patch: { occurredAt?: string; remark?: string }) => boolean;
  deleteExchangeRecord: (recordId: string) => boolean;
  updateHeatmapStartDate: (date: string) => void;
  upsertExchangeCategory: (category: ExchangeCategory) => void;
  deleteExchangeCategory: (categoryId: string) => void;
};

const DEFAULT_EXCHANGE_CATEGORIES: ExchangeCategory[] = [
  { id: "snack", title: "零食", icon: "🍪", description: "轻轻松松来一点，小小满足一下", resourceKind: "gem", price: 5 },
  { id: "drink", title: "双份零食", icon: "🍿", description: "给认真努力的自己，再多一点奖励", resourceKind: "gem", price: 8 },
  { id: "double-drink", title: "双份饮料", icon: "🥤", description: "双人份的小快乐，备注里写清楚就好", resourceKind: "gem", price: 15 },
  { id: "dinner", title: "大餐", icon: "🍝", description: "热乎乎的一顿，适合记账", resourceKind: "coin", price: 4 },
  { id: "deluxe-dinner", title: "豪华大餐", icon: "🍰", description: "更丰盛一点，像周末的小奖励", resourceKind: "coin", price: 8 },
  { id: "family", title: "家庭放纵餐", icon: "🏠", description: "给特殊时刻留一笔温柔的奖励", resourceKind: "gem", price: 15 },
];

const MAY_HISTORY_ROWS = [
  { day: 6, fish: { deficit: 525, minutes: 0 }, cat: { deficit: 284, minutes: 0 } },
  { day: 7, fish: { deficit: 501, minutes: 60 }, cat: { deficit: 236, minutes: 60 } },
  { day: 8, fish: { deficit: 871, minutes: 0 }, cat: { deficit: 405, minutes: 0 } },
  { day: 9, fish: { deficit: 565, minutes: 0 }, cat: { deficit: 89, minutes: 0 } },
  { day: 10, fish: { deficit: 681, minutes: 0 }, cat: { deficit: 405, minutes: 0 } },
  { day: 11, fish: { deficit: 508, minutes: 0 }, cat: { deficit: 200, minutes: 0 } },
  { day: 12, fish: { deficit: 317, minutes: 0 }, cat: { deficit: 244, minutes: 0 } },
] as const;

const HomeResourcesContext = createContext<HomeResourcesContextValue | null>(null);

export function useHomeResources() {
  const ctx = useContext(HomeResourcesContext);
  if (!ctx) throw new Error("useHomeResources must be used within HomeResourcesProvider");
  return ctx;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return { year, month, day };
}

function formatRecordDate(recordDate: string) {
  const parsed = parseIsoDate(recordDate);
  return parsed ? `${parsed.year}年${parsed.month}月${parsed.day}日` : recordDate;
}

function previousIsoDate(recordDate: string) {
  const parsed = parseIsoDate(recordDate);
  if (!parsed) return null;
  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function defaultHeatmapStartDate() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const diffFromSaturday = first.getDay() === 6 ? 0 : first.getDay() + 1;
  first.setDate(first.getDate() - diffFromSaturday);
  return `${first.getFullYear()}-${pad2(first.getMonth() + 1)}-${pad2(first.getDate())}`;
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeSide(input: TodayRecordSidePayload | null | undefined): TodayRecordSidePayload {
  return {
    weightKg: typeof input?.weightKg === "number" ? input.weightKg : null,
    deficit: Math.max(0, Math.floor(safeNumber(input?.deficit))),
    minutes: Math.max(0, Math.floor(safeNumber(input?.minutes))),
  };
}

function zeroSide(): DailyRecordSide {
  return { weightKg: null, deficit: 0, minutes: 0, gems: 0 };
}

function recordIsoDate(record: DailyRecord) {
  return record.recordDate ?? `2026-05-${pad2(record.day)}`;
}

function recordGems(record: DailyRecord) {
  return record.fish.gems + record.cat.gems + record.bonus;
}

function orderDailyRecords(records: DailyRecord[]) {
  return [...records].sort((a, b) => recordIsoDate(b).localeCompare(recordIsoDate(a)));
}

function buildHeatmapOverrides(records: DailyRecord[], person: "fish" | "cat"): HeatmapDayOverrides {
  return records.reduce<HeatmapDayOverrides>((acc, record) => {
    const parsed = parseIsoDate(recordIsoDate(record));
    if (parsed?.year === 2026 && parsed.month === 5) {
      acc[record.day] = person === "fish" ? record.fishHeat : record.catHeat;
    }
    return acc;
  }, {});
}

function normalizeExchangeDateTime(value?: string | null, fallback = new Date()) {
  const parsed = value ? new Date(value) : null;
  const date = parsed && !Number.isNaN(parsed.getTime()) ? parsed : fallback;
  return {
    date,
    occurredAt: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
  };
}

function normalizeExchangeRecord(record: ExchangeRecord): ExchangeRecord {
  const normalized = normalizeExchangeDateTime(record.occurredAt ?? record.createdAt);
  return {
    ...record,
    occurredAt: normalized.occurredAt,
    time: record.time || `${pad2(normalized.date.getHours())}:${pad2(normalized.date.getMinutes())}`,
    date: record.date || `${normalized.date.getMonth() + 1}月${normalized.date.getDate()}日 ${pad2(normalized.date.getHours())}:${pad2(normalized.date.getMinutes())}`,
  };
}

function normalizeCategories(categories: ExchangeCategory[] | undefined): ExchangeCategory[] {
  const source = Array.isArray(categories) ? categories : [];
  const byId = new Map(source.map((category) => [category.id, category]));
  const defaultIds = new Set(DEFAULT_EXCHANGE_CATEGORIES.map((category) => category.id));
  return [
    ...DEFAULT_EXCHANGE_CATEGORIES.map((category) => ({ ...category, ...(byId.get(category.id) ?? {}) })),
    ...source.filter((category) => !defaultIds.has(category.id)),
  ];
}

function findRecordByIso(records: DailyRecord[], date: string | null) {
  if (!date) return null;
  return records.find((record) => recordIsoDate(record) === date) ?? null;
}

function buildRecord(params: {
  id?: string;
  createdAt?: string;
  recordDate: string;
  fish: TodayRecordSidePayload;
  cat: TodayRecordSidePayload;
  previousRecord: DailyRecord | null;
  previousRecords: DailyRecord[];
  coinRules: CoinRulesConfig;
  visualRules: SettlementVisualRules;
}): DailyRecord {
  const parsed = parseIsoDate(params.recordDate);
  const day = parsed?.day ?? new Date(params.recordDate).getDate();
  const fishInput = normalizeSide(params.fish);
  const catInput = normalizeSide(params.cat);
  const fishGems = gemsForPerson("fish", fishInput, params.previousRecord);
  const catGems = gemsForPerson("cat", catInput, params.previousRecord);
  const couple = computeCoupleBonus(fishInput, catInput);
  const todayGemTotal = fishGems + catGems + couple.gems;
  const currentWeekGemTotal = params.previousRecords.reduce(
    (total, record) =>
      isInCoinWeek(recordIsoDate(record), params.recordDate, params.coinRules.weekStartDay)
        ? total + recordGems(record)
        : total,
    0,
  );
  const coin = computeCoinPreview({
    fish: fishInput,
    cat: catInput,
    todayDay: day,
    todayDate: params.recordDate,
    todayGemTotal,
    currentWeekGemTotal,
    dailyRecords: params.previousRecords,
    coinRules: params.coinRules,
    visualRules: params.visualRules,
  });

  return {
    id: params.id ?? makeId("daily"),
    date: formatRecordDate(params.recordDate),
    recordDate: params.recordDate,
    createdAt: params.createdAt ?? new Date().toISOString(),
    day,
    fish: { ...fishInput, gems: fishGems },
    cat: { ...catInput, gems: catGems },
    bonus: couple.gems,
    coins: coin.delta,
    fishHeat: buildHeatmapDay("fish", fishInput, params.visualRules),
    catHeat: buildHeatmapDay("cat", catInput, params.visualRules),
  };
}

function computeGemWallet(records: DailyRecord[], exchangeRecords: ExchangeRecord[]) {
  const events = [
    ...records.map((record) => ({ at: `${record.createdAt || record.recordDate}#gain`, delta: recordGems(record) })),
    ...exchangeRecords
      .filter((record) => record.resourceKind === "gem")
      .map((record) => ({ at: `${record.occurredAt || record.createdAt || record.date}#spend`, delta: -record.price })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return events.reduce((balance, event) => {
    if (event.delta >= 0) return Math.min(GEM_CAP, balance + event.delta);
    return Math.max(0, balance + event.delta);
  }, 0);
}

function sumCoinSpend(records: ExchangeRecord[]) {
  return records.reduce((total, record) => (record.resourceKind === "coin" ? total + record.price : total), 0);
}

function isSuccessful(record: DailyRecord, rules: SettlementVisualRules) {
  return record.fish.deficit >= rules.heatmap.fish.okMin && record.cat.deficit >= rules.heatmap.cat.okMin;
}

function recalculateState(state: HomeResourcesState): HomeResourcesState {
  const sortedAscending = [...state.dailyRecords].sort((a, b) => recordIsoDate(a).localeCompare(recordIsoDate(b)));
  const rebuilt: DailyRecord[] = [];

  for (const source of sortedAscending) {
    const recordDate = recordIsoDate(source);
    const next = buildRecord({
      id: source.id,
      createdAt: source.createdAt,
      recordDate,
      fish: source.fish,
      cat: source.cat,
      previousRecord: findRecordByIso(rebuilt, previousIsoDate(recordDate)),
      previousRecords: rebuilt,
      coinRules: state.coinRules,
      visualRules: state.visualRules,
    });
    rebuilt.push(next);
  }

  const nextRecords = orderDailyRecords(rebuilt);
  const today = getCurrentIsoDate();
  const todayRecord = findRecordByIso(nextRecords, today);
  const yesterdayRecord = findRecordByIso(nextRecords, previousIsoDate(today));
  const earnedCoins = nextRecords.reduce((total, record) => total + record.coins, 0);
  const spentCoins = sumCoinSpend(state.exchangeRecords);
  const weekGemTotal = nextRecords.reduce(
    (total, record) =>
      isInCoinWeek(recordIsoDate(record), today, state.coinRules.weekStartDay) ? total + recordGems(record) : total,
    0,
  );
  const weekCoinTotal = nextRecords.reduce(
    (total, record) =>
      isInCoinWeek(recordIsoDate(record), today, state.coinRules.weekStartDay) ? total + record.coins : total,
    0,
  );
  const weeklySuccessDays = nextRecords.reduce(
    (total, record) =>
      isInCoinWeek(recordIsoDate(record), today, state.coinRules.weekStartDay) && isSuccessful(record, state.visualRules)
        ? total + 1
        : total,
    0,
  );
  const cumulativeSuccessDays = nextRecords.reduce(
    (total, record) => (isSuccessful(record, state.visualRules) ? total + 1 : total),
    0,
  );

  return {
    ...state,
    wallet: {
      gems: computeGemWallet(nextRecords, state.exchangeRecords),
      coins: Math.max(0, earnedCoins - spentCoins),
    },
    todayFishGems: todayRecord?.fish.gems ?? 0,
    todayCatGems: todayRecord?.cat.gems ?? 0,
    todayBonusGems: todayRecord?.bonus ?? 0,
    yesterdayGemTotal: yesterdayRecord ? recordGems(yesterdayRecord) : 0,
    weekGemTotal,
    weekCoinTotal,
    streakDays: weeklySuccessDays,
    weeklySuccessDays,
    cumulativeSuccessDays,
    fishHeatmapOverrides: buildHeatmapOverrides(nextRecords, "fish"),
    catHeatmapOverrides: buildHeatmapOverrides(nextRecords, "cat"),
    dailyRecords: nextRecords,
    exchangeRecords: [...state.exchangeRecords].sort((a, b) => (b.occurredAt || b.createdAt || b.date).localeCompare(a.occurredAt || a.createdAt || a.date)),
    exchangeCategories: normalizeCategories(state.exchangeCategories),
  };
}

function createDefaultState(initialGems: number, initialCoins: number): HomeResourcesState {
  const records: DailyRecord[] = [];
  let state: HomeResourcesState = {
    wallet: { gems: initialGems, coins: initialCoins },
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
    dailyRecords: records,
    exchangeRecords: [],
    exchangeCategories: DEFAULT_EXCHANGE_CATEGORIES,
  };

  state.dailyRecords = MAY_HISTORY_ROWS.map((row) => ({
    id: `seed-may-history-2026-05-${pad2(row.day)}`,
    date: formatRecordDate(`2026-05-${pad2(row.day)}`),
    recordDate: `2026-05-${pad2(row.day)}`,
    createdAt: `2026-05-${pad2(row.day)}T12:00:00.000Z`,
    day: row.day,
    fish: { weightKg: null, deficit: row.fish.deficit, minutes: row.fish.minutes, gems: 0 },
    cat: { weightKg: null, deficit: row.cat.deficit, minutes: row.cat.minutes, gems: 0 },
    bonus: 0,
    coins: 0,
    fishHeat: buildHeatmapDay("fish", row.fish, state.visualRules),
    catHeat: buildHeatmapDay("cat", row.cat, state.visualRules),
  }));
  return recalculateState(state);
}

function readLocalState(initialGems: number, initialCoins: number): HomeResourcesState {
  const fallback = createDefaultState(initialGems, initialCoins);
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<HomeResourcesState>;
    return recalculateState({
      ...fallback,
      ...parsed,
      wallet: {
        gems: safeNumber(parsed.wallet?.gems, fallback.wallet.gems),
        coins: safeNumber(parsed.wallet?.coins, fallback.wallet.coins),
      },
      heatmapStartDate: typeof parsed.heatmapStartDate === "string" ? parsed.heatmapStartDate : fallback.heatmapStartDate,
      coinRules: { ...DEFAULT_COIN_RULES, ...(parsed.coinRules ?? {}) },
      visualRules: { ...DEFAULT_VISUAL_RULES, ...(parsed.visualRules ?? {}) },
      dailyRecords: Array.isArray(parsed.dailyRecords) ? parsed.dailyRecords : fallback.dailyRecords,
      exchangeRecords: Array.isArray(parsed.exchangeRecords) ? parsed.exchangeRecords.map(normalizeExchangeRecord) : [],
      exchangeCategories: normalizeCategories(parsed.exchangeCategories),
    });
  } catch {
    return fallback;
  }
}

function writeLocalState(state: HomeResourcesState) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

export function HomeResourcesProvider({
  children,
  initialGems = 0,
  initialCoins = 0,
}: {
  children: ReactNode;
  initialGems?: number;
  initialCoins?: number;
}) {
  const [state, setState] = useState<HomeResourcesState>(() => readLocalState(initialGems, initialCoins));

  const commitState = useCallback((updater: (current: HomeResourcesState) => HomeResourcesState) => {
    setState((current) => {
      const next = recalculateState(updater(current));
      writeLocalState(next);
      return next;
    });
  }, []);

  const tryRedeem = useCallback(
    (cost: { gems?: number; coins?: number }) => {
      const gems = cost.gems ?? 0;
      const coins = cost.coins ?? 0;
      if (state.wallet.gems < gems || state.wallet.coins < coins) return false;
      commitState((current) => ({
        ...current,
        wallet: {
          gems: Math.max(0, current.wallet.gems - gems),
          coins: Math.max(0, current.wallet.coins - coins),
        },
      }));
      return true;
    },
    [commitState, state.wallet.coins, state.wallet.gems],
  );

  const redeemExchange = useCallback(
    (payload: ExchangeRedeemPayload) => {
      const stock = payload.resourceKind === "gem" ? state.wallet.gems : state.wallet.coins;
      if (stock < payload.price) return false;
      const normalized = normalizeExchangeDateTime(payload.occurredAt);
      const record: ExchangeRecord = normalizeExchangeRecord({
        id: makeId("exchange"),
        createdAt: new Date().toISOString(),
        occurredAt: normalized.occurredAt,
        date: "",
        time: "",
        category: payload.category,
        remark: payload.remark,
        resourceKind: payload.resourceKind,
        price: payload.price,
        icon: payload.icon,
      });
      commitState((current) => ({ ...current, exchangeRecords: [record, ...current.exchangeRecords] }));
      return true;
    },
    [commitState, state.wallet.coins, state.wallet.gems],
  );

  const applyTodayRecord = useCallback(
    (payload: TodayRecordPayload) => {
      const today = getCurrentIsoDate();
      commitState((current) => ({
        ...current,
        dailyRecords: orderDailyRecords([
          ...current.dailyRecords.filter((record) => recordIsoDate(record) !== today),
          {
            id: makeId("daily"),
            date: formatRecordDate(today),
            recordDate: today,
            createdAt: new Date().toISOString(),
            day: payload.day,
            fish: { ...normalizeSide(payload.fish), gems: payload.fishGems },
            cat: { ...normalizeSide(payload.cat), gems: payload.catGems },
            bonus: payload.bonusGems,
            coins: payload.coinDelta,
            fishHeat: payload.fishHeat,
            catHeat: payload.catHeat,
          },
        ]),
      }));
    },
    [commitState],
  );

  const upsertHistoricalRecord = useCallback(
    (payload: HistoricalRecordDraft): HistoricalRecordResult => {
      const parsed = parseIsoDate(payload.recordDate);
      if (!parsed) return { ok: false, updatedExisting: false, reason: "invalid-date" };
      if (payload.recordDate > getCurrentIsoDate()) return { ok: false, updatedExisting: false, reason: "future-date" };
      let updatedExisting = false;
      commitState((current) => {
        const existing = findRecordByIso(current.dailyRecords, payload.recordDate);
        updatedExisting = existing != null;
        const fish = normalizeSide(payload.fish ?? existing?.fish ?? null);
        const cat = normalizeSide(payload.cat ?? existing?.cat ?? null);
        return {
          ...current,
          dailyRecords: orderDailyRecords([
            ...current.dailyRecords.filter((record) => recordIsoDate(record) !== payload.recordDate),
            {
              id: existing?.id ?? makeId("daily"),
              date: formatRecordDate(payload.recordDate),
              recordDate: payload.recordDate,
              createdAt: existing?.createdAt ?? new Date().toISOString(),
              day: parsed.day,
              fish: { ...fish, gems: existing?.fish.gems ?? 0 },
              cat: { ...cat, gems: existing?.cat.gems ?? 0 },
              bonus: existing?.bonus ?? 0,
              coins: existing?.coins ?? 0,
              fishHeat: buildHeatmapDay("fish", fish, current.visualRules),
              catHeat: buildHeatmapDay("cat", cat, current.visualRules),
            },
          ]),
        };
      });
      return { ok: true, updatedExisting };
    },
    [commitState],
  );

  const applyHistoricalRecord = useCallback(
    (payload: HistoricalRecordPayload): HistoricalRecordResult =>
      upsertHistoricalRecord({
        recordDate: payload.recordDate,
        fish: payload.person === "fish" ? payload.input : null,
        cat: payload.person === "cat" ? payload.input : null,
      }),
    [upsertHistoricalRecord],
  );

  const updateExchangeRecord = useCallback(
    (recordId: string, patch: { occurredAt?: string; remark?: string }) => {
      let found = false;
      commitState((current) => ({
        ...current,
        exchangeRecords: current.exchangeRecords.map((record) => {
          if (record.id !== recordId) return record;
          found = true;
          return normalizeExchangeRecord({
            ...record,
            occurredAt: patch.occurredAt ?? record.occurredAt,
            remark: patch.remark ?? record.remark,
            date: "",
            time: "",
          });
        }),
      }));
      return found;
    },
    [commitState],
  );

  const deleteExchangeRecord = useCallback(
    (recordId: string) => {
      let found = false;
      commitState((current) => {
        found = current.exchangeRecords.some((record) => record.id === recordId);
        return { ...current, exchangeRecords: current.exchangeRecords.filter((record) => record.id !== recordId) };
      });
      return found;
    },
    [commitState],
  );

  const updateHeatmapStartDate = useCallback(
    (date: string) => commitState((current) => ({ ...current, heatmapStartDate: date })),
    [commitState],
  );

  const upsertExchangeCategory = useCallback(
    (category: ExchangeCategory) =>
      commitState((current) => ({
        ...current,
        exchangeCategories: normalizeCategories([
          ...current.exchangeCategories.filter((item) => item.id !== category.id),
          category,
        ]),
      })),
    [commitState],
  );

  const deleteExchangeCategory = useCallback(
    (categoryId: string) =>
      commitState((current) => ({
        ...current,
        exchangeCategories: current.exchangeCategories.filter((item) => item.id !== categoryId),
      })),
    [commitState],
  );

  const value = useMemo<HomeResourcesContextValue>(
    () => ({
      gemStock: state.wallet.gems,
      coinStock: state.wallet.coins,
      tryRedeem,
      redeemExchange,
      streakDays: state.streakDays,
      weeklySuccessDays: state.weeklySuccessDays,
      cumulativeSuccessDays: state.cumulativeSuccessDays,
      yesterdayGemTotal: state.yesterdayGemTotal,
      todayFishGems: state.todayFishGems,
      todayCatGems: state.todayCatGems,
      todayBonusGems: state.todayBonusGems,
      weekGemTotal: state.weekGemTotal,
      weekCoinTotal: state.weekCoinTotal,
      heatmapStartDate: state.heatmapStartDate,
      coinRules: state.coinRules,
      visualRules: state.visualRules,
      fishHeatmapOverrides: state.fishHeatmapOverrides,
      catHeatmapOverrides: state.catHeatmapOverrides,
      dailyRecords: state.dailyRecords,
      exchangeRecords: state.exchangeRecords,
      exchangeCategories: state.exchangeCategories,
      applyTodayRecord,
      applyHistoricalRecord,
      upsertHistoricalRecord,
      updateExchangeRecord,
      deleteExchangeRecord,
      updateHeatmapStartDate,
      upsertExchangeCategory,
      deleteExchangeCategory,
    }),
    [
      state,
      tryRedeem,
      redeemExchange,
      applyTodayRecord,
      applyHistoricalRecord,
      upsertHistoricalRecord,
      updateExchangeRecord,
      deleteExchangeRecord,
      updateHeatmapStartDate,
      upsertExchangeCategory,
      deleteExchangeCategory,
    ],
  );

  return <HomeResourcesContext.Provider value={value}>{children}</HomeResourcesContext.Provider>;
}
