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
  computeCoupleBonus,
  DEFAULT_COIN_RULES,
  DEFAULT_VISUAL_RULES,
  GEM_CAP,
  getCurrentIsoDate,
  gemsForPerson,
  type CoinRulesConfig,
  type PersonKey,
  type SettlementVisualRules,
} from "./settlement-rules";
import type { HeatmapDay } from "./types";

export { GEM_CAP } from "./settlement-rules";

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

const HomeResourcesContext = createContext<HomeResourcesContextValue | null>(null);

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

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function todayIsoDate() {
  return getCurrentIsoDate();
}

function formatDate(recordDate: string) {
  const date = new Date(recordDate);
  if (Number.isNaN(date.getTime())) return recordDate;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function previousIsoDate(recordDate: string) {
  const date = new Date(recordDate);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function recordGems(record: DailyRecord) {
  return record.fish.gems + record.cat.gems + record.bonus;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultHeatmapStartDate() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const diffFromSaturday = first.getDay() === 6 ? 0 : first.getDay() + 1;
  first.setDate(first.getDate() - diffFromSaturday);
  return `${first.getFullYear()}-${pad2(first.getMonth() + 1)}-${pad2(first.getDate())}`;
}

function makeRecord(day: number, fish: TodayRecordSidePayload, cat: TodayRecordSidePayload, previous: DailyRecord | null): DailyRecord {
  const recordDate = `2026-05-${pad2(day)}`;
  const fishGems = gemsForPerson("fish", fish, previous);
  const catGems = gemsForPerson("cat", cat, previous);
  const couple = computeCoupleBonus(fish, cat);
  return {
    id: `seed-${recordDate}`,
    date: formatDate(recordDate),
    recordDate,
    createdAt: `${recordDate}T12:00:00.000Z`,
    day,
    fish: { ...fish, gems: fishGems },
    cat: { ...cat, gems: catGems },
    bonus: couple.gems,
    coins: 0,
    fishHeat: buildHeatmapDay("fish", fish, DEFAULT_VISUAL_RULES),
    catHeat: buildHeatmapDay("cat", cat, DEFAULT_VISUAL_RULES),
  };
}

function initialRecords() {
  const records: DailyRecord[] = [];
  for (const row of MAY_HISTORY_ROWS) {
    const previous = records.at(-1) ?? null;
    records.push(
      makeRecord(
        row.day,
        { weightKg: null, deficit: row.fish.deficit, minutes: row.fish.minutes },
        { weightKg: null, deficit: row.cat.deficit, minutes: row.cat.minutes },
        previous,
      ),
    );
  }
  return records.sort((a, b) => b.recordDate.localeCompare(a.recordDate));
}

function orderRecords(records: DailyRecord[]) {
  return [...records].sort((a, b) => b.recordDate.localeCompare(a.recordDate));
}

function normalizeDateTime(value?: string) {
  const date = value ? new Date(value) : new Date();
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  return `${safe.getFullYear()}-${pad2(safe.getMonth() + 1)}-${pad2(safe.getDate())}T${pad2(safe.getHours())}:${pad2(safe.getMinutes())}`;
}

export function useHomeResources() {
  const ctx = useContext(HomeResourcesContext);
  if (!ctx) throw new Error("useHomeResources must be used within HomeResourcesProvider");
  return ctx;
}

export function HomeResourcesProvider({ children }: { children: ReactNode }) {
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>(initialRecords);
  const [exchangeRecords, setExchangeRecords] = useState<ExchangeRecord[]>([]);
  const [exchangeCategories, setExchangeCategories] = useState<ExchangeCategory[]>(DEFAULT_EXCHANGE_CATEGORIES);
  const [heatmapStartDate, setHeatmapStartDate] = useState(defaultHeatmapStartDate);

  const todayRecord = dailyRecords.find((record) => record.recordDate === todayIsoDate()) ?? null;
  const yesterdayRecord = dailyRecords.find((record) => record.recordDate === previousIsoDate(todayIsoDate())) ?? null;
  const earnedGems = dailyRecords.reduce((total, record) => total + recordGems(record), 0);
  const spentGems = exchangeRecords.reduce((total, record) => record.resourceKind === "gem" ? total + record.price : total, 0);
  const earnedCoins = dailyRecords.reduce((total, record) => total + record.coins, 0);
  const spentCoins = exchangeRecords.reduce((total, record) => record.resourceKind === "coin" ? total + record.price : total, 0);

  const applyTodayRecord = useCallback((payload: TodayRecordPayload) => {
    const date = todayIsoDate();
    const record: DailyRecord = {
      id: makeId("daily"),
      date: formatDate(date),
      recordDate: date,
      createdAt: new Date().toISOString(),
      day: payload.day,
      fish: { ...payload.fish, gems: payload.fishGems },
      cat: { ...payload.cat, gems: payload.catGems },
      bonus: payload.bonusGems,
      coins: payload.coinDelta,
      fishHeat: payload.fishHeat,
      catHeat: payload.catHeat,
    };
    setDailyRecords((current) => orderRecords([...current.filter((item) => item.recordDate !== date), record]));
  }, []);

  const redeemExchange = useCallback((payload: ExchangeRedeemPayload) => {
    const record: ExchangeRecord = {
      id: makeId("exchange"),
      createdAt: new Date().toISOString(),
      occurredAt: normalizeDateTime(payload.occurredAt),
      date: formatDate(normalizeDateTime(payload.occurredAt).slice(0, 10)),
      time: normalizeDateTime(payload.occurredAt).slice(11, 16),
      category: payload.category,
      remark: payload.remark,
      resourceKind: payload.resourceKind,
      price: payload.price,
      icon: payload.icon,
    };
    setExchangeRecords((current) => [record, ...current]);
    return true;
  }, []);

  const upsertHistoricalRecord = useCallback((payload: HistoricalRecordDraft): HistoricalRecordResult => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.recordDate)) return { ok: false, updatedExisting: false, reason: "invalid-date" };
    if (payload.recordDate > todayIsoDate()) return { ok: false, updatedExisting: false, reason: "future-date" };
    let updatedExisting = false;
    setDailyRecords((current) => {
      const existing = current.find((record) => record.recordDate === payload.recordDate) ?? null;
      updatedExisting = existing !== null;
      const day = new Date(payload.recordDate).getDate();
      const previous = current.find((record) => record.recordDate === previousIsoDate(payload.recordDate)) ?? null;
      const fish = payload.fish ?? existing?.fish ?? { weightKg: null, deficit: 0, minutes: 0 };
      const cat = payload.cat ?? existing?.cat ?? { weightKg: null, deficit: 0, minutes: 0 };
      const record = makeRecord(day, fish, cat, previous);
      return orderRecords([...current.filter((item) => item.recordDate !== payload.recordDate), { ...record, id: existing?.id ?? makeId("daily"), recordDate: payload.recordDate, date: formatDate(payload.recordDate) }]);
    });
    return { ok: true, updatedExisting };
  }, []);

  const value = useMemo<HomeResourcesContextValue>(() => {
    const weekGemTotal = dailyRecords.reduce((total, record) => total + recordGems(record), 0);
    return {
      gemStock: Math.max(0, Math.min(GEM_CAP, earnedGems - spentGems)),
      coinStock: Math.max(0, earnedCoins - spentCoins),
      tryRedeem: () => true,
      redeemExchange,
      streakDays: dailyRecords.length,
      weeklySuccessDays: dailyRecords.length,
      cumulativeSuccessDays: dailyRecords.length,
      yesterdayGemTotal: yesterdayRecord ? recordGems(yesterdayRecord) : 0,
      todayFishGems: todayRecord?.fish.gems ?? 0,
      todayCatGems: todayRecord?.cat.gems ?? 0,
      todayBonusGems: todayRecord?.bonus ?? 0,
      weekGemTotal,
      weekCoinTotal: dailyRecords.reduce((total, record) => total + record.coins, 0),
      heatmapStartDate,
      coinRules: DEFAULT_COIN_RULES,
      visualRules: DEFAULT_VISUAL_RULES,
      fishHeatmapOverrides: {},
      catHeatmapOverrides: {},
      dailyRecords,
      exchangeRecords,
      exchangeCategories,
      applyTodayRecord,
      applyHistoricalRecord: (payload) => upsertHistoricalRecord({ recordDate: payload.recordDate, fish: payload.person === "fish" ? payload.input : null, cat: payload.person === "cat" ? payload.input : null }),
      upsertHistoricalRecord,
      updateExchangeRecord: () => false,
      deleteExchangeRecord: () => false,
      updateHeatmapStartDate: setHeatmapStartDate,
      upsertExchangeCategory: (category) => setExchangeCategories((current) => [...current.filter((item) => item.id !== category.id), category]),
      deleteExchangeCategory: (categoryId) => setExchangeCategories((current) => current.filter((item) => item.id !== categoryId)),
    };
  }, [
    applyTodayRecord,
    dailyRecords,
    earnedCoins,
    earnedGems,
    exchangeCategories,
    exchangeRecords,
    heatmapStartDate,
    redeemExchange,
    spentCoins,
    spentGems,
    todayRecord,
    upsertHistoricalRecord,
    yesterdayRecord,
  ]);

  return <HomeResourcesContext.Provider value={value}>{children}</HomeResourcesContext.Provider>;
}
