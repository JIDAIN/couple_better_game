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
  buildHeatmapDay,
  computeCoinPreview,
  computeCoupleBonus,
  GEM_CAP,
  gemsForPerson,
  getMaySettlementDay,
  type PersonKey,
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
};

export type HomeResourcesState = {
  wallet: Wallet;
  streakDays: number;
  todayFishGems: number;
  todayCatGems: number;
  todayBonusGems: number;
  weekGemTotal: number;
  weekCoinTotal: number;
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
  todayFishGems: number;
  todayCatGems: number;
  todayBonusGems: number;
  weekGemTotal: number;
  weekCoinTotal: number;
  fishHeatmapOverrides: HeatmapDayOverrides;
  catHeatmapOverrides: HeatmapDayOverrides;
  dailyRecords: DailyRecord[];
  exchangeRecords: ExchangeRecord[];
  exchangeCategories: ExchangeCategory[];
  applyTodayRecord: (payload: TodayRecordPayload) => void;
  applyHistoricalRecord: (
    payload: HistoricalRecordPayload,
  ) => HistoricalRecordResult;
  upsertExchangeCategory: (category: ExchangeCategory) => void;
  deleteExchangeCategory: (categoryId: string) => void;
};

const DEFAULT_EXCHANGE_CATEGORIES: ExchangeCategory[] = [
  {
    id: "snack",
    title: "零食",
    icon: "🍦",
    description: "小口甜甜，轻轻奖励一下",
    resourceKind: "gem",
    price: 5,
  },
  {
    id: "drink",
    title: "饮料",
    icon: "🧋",
    description: "想喝点喜欢的，就记这一笔",
    resourceKind: "gem",
    price: 8,
  },
  {
    id: "double-drink",
    title: "双份饮料",
    icon: "🧋",
    description: "双人份快乐，备注里写清楚就好",
    resourceKind: "gem",
    price: 15,
  },
  {
    id: "dinner",
    title: "大餐",
    icon: "🍲",
    description: "热乎乎的一顿，适合记账",
    resourceKind: "coin",
    price: 4,
  },
  {
    id: "deluxe-dinner",
    title: "豪华大餐",
    icon: "🍖",
    description: "更丰盛一点，像周末的小奖励",
    resourceKind: "coin",
    price: 8,
  },
  {
    id: "family",
    title: "家庭放纵餐",
    icon: "🏡",
    description: "给特殊时刻留一笔温柔的奖励",
    resourceKind: "gem",
    price: 15,
  },
];

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
    todayFishGems: 0,
    todayCatGems: 0,
    todayBonusGems: 0,
    weekGemTotal: 0,
    weekCoinTotal: 0,
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

function readLocalState(
  initialGems: number,
  initialCoins: number,
): HomeResourcesState {
  const fallback = createDefaultState(initialGems, initialCoins);
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const imported = importMayHistoryRecords(fallback);
      writeLocalState(imported);
      return imported;
    }
    const parsed = JSON.parse(raw) as Partial<HomeResourcesState>;

    const restored: HomeResourcesState = {
      wallet: {
        gems: safeNumber(parsed.wallet?.gems, fallback.wallet.gems),
        coins: safeNumber(parsed.wallet?.coins, fallback.wallet.coins),
      },
      streakDays: safeNumber(parsed.streakDays),
      todayFishGems: safeNumber(parsed.todayFishGems),
      todayCatGems: safeNumber(parsed.todayCatGems),
      todayBonusGems: safeNumber(parsed.todayBonusGems),
      weekGemTotal: safeNumber(parsed.weekGemTotal),
      weekCoinTotal: safeNumber(parsed.weekCoinTotal),
      fishHeatmapOverrides:
        parsed.fishHeatmapOverrides ?? fallback.fishHeatmapOverrides,
      catHeatmapOverrides:
        parsed.catHeatmapOverrides ?? fallback.catHeatmapOverrides,
      dailyRecords: Array.isArray(parsed.dailyRecords)
        ? parsed.dailyRecords.map(normalizeDailyRecord)
        : fallback.dailyRecords,
      exchangeRecords: Array.isArray(parsed.exchangeRecords)
        ? parsed.exchangeRecords
        : fallback.exchangeRecords,
      exchangeCategories: Array.isArray(parsed.exchangeCategories)
        ? parsed.exchangeCategories
        : fallback.exchangeCategories,
    };
    const imported = importMayHistoryRecords(restored);
    writeLocalState(imported);
    return imported;
  } catch {
    const imported = importMayHistoryRecords(fallback);
    writeLocalState(imported);
    return imported;
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
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
    now.getDate(),
  )}`;
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

function formatRecordDate(day: number) {
  return `5月${day}日`;
}

function formatRecordDateFromIso(recordDate: string) {
  const parsed = parseIsoDate(recordDate);
  if (!parsed) return recordDate;
  return `${parsed.year}年${parsed.month}月${parsed.day}日`;
}

function formatTodayDate() {
  const now = new Date();
  return `${now.getMonth() + 1}月${now.getDate()}日`;
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

function recordGems(record: DailyRecord) {
  return record.fish.gems + record.cat.gems + record.bonus;
}

function recordIsoDate(record: DailyRecord) {
  return record.recordDate ?? isoDateFromMayDay(record.day);
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

function deficitStreakEndingAt(records: DailyRecord[], day: number) {
  let streak = 0;
  for (let currentDay = day; currentDay >= 1; currentDay -= 1) {
    const record = records.find((item) => item.day === currentDay);
    if (!record || record.fish.deficit <= 0 || record.cat.deficit <= 0) break;
    streak += 1;
  }
  return streak;
}

function sumRecordGems(records: DailyRecord[]) {
  return records.reduce((total, record) => total + recordGems(record), 0);
}

function sumRecordCoins(records: DailyRecord[]) {
  return records.reduce((total, record) => total + record.coins, 0);
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
      todayGemTotal,
      currentWeekGemTotal: sumRecordGems(workingRecords),
      dailyRecords: workingRecords,
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
      fishHeat: buildHeatmapDay(fishInput),
      catHeat: buildHeatmapDay(catInput),
    };

    importedRecords.push(record);
    workingRecords = orderDailyRecords([record, ...workingRecords]);
  }

  const nextRecords = orderDailyRecords([...importedRecords, ...baseRecords]);
  const oldGemTotal = sumRecordGems(oldImportRecords);
  const newGemTotal = sumRecordGems(importedRecords);
  const oldCoinTotal = sumRecordCoins(oldImportRecords);
  const newCoinTotal = sumRecordCoins(importedRecords);
  const todayRecord = findRecordByIso(
    nextRecords,
    isoDateFromMayDay(getMaySettlementDay()),
  );

  return {
    ...state,
    wallet: {
      gems: Math.min(
        GEM_CAP,
        Math.max(0, state.wallet.gems - oldGemTotal + newGemTotal),
      ),
      coins: Math.max(0, state.wallet.coins - oldCoinTotal + newCoinTotal),
    },
    todayFishGems: todayRecord?.fish.gems ?? state.todayFishGems,
    todayCatGems: todayRecord?.cat.gems ?? state.todayCatGems,
    todayBonusGems: todayRecord?.bonus ?? state.todayBonusGems,
    weekGemTotal: sumRecordGems(nextRecords),
    weekCoinTotal: sumRecordCoins(nextRecords),
    streakDays: deficitStreakEndingAt(nextRecords, getMaySettlementDay()),
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

      const createdAt = new Date().toISOString();
      const record: ExchangeRecord = {
        id: makeId("exchange"),
        date: formatTodayDate(),
        createdAt,
        ...payload,
      };

      commitHomeState((state) => ({
        ...state,
        wallet: {
          gems: state.wallet.gems - gems,
          coins: state.wallet.coins - coins,
        },
        exchangeRecords: [record, ...state.exchangeRecords],
      }));
      return true;
    },
    [commitHomeState],
  );

  const applyTodayRecord = useCallback(
    (payload: TodayRecordPayload) => {
      const addGems =
        payload.fishGems + payload.catGems + payload.bonusGems;
      const record: DailyRecord = {
        id: makeId("daily"),
        date: formatRecordDate(payload.day),
        recordDate: isoDateFromMayDay(payload.day),
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

      commitHomeState((state) => ({
        ...state,
        wallet: {
          gems: Math.min(GEM_CAP, state.wallet.gems + addGems),
          coins: state.wallet.coins + payload.coinDelta,
        },
        todayFishGems: payload.fishGems,
        todayCatGems: payload.catGems,
        todayBonusGems: payload.bonusGems,
        weekGemTotal: state.weekGemTotal + addGems,
        weekCoinTotal: state.weekCoinTotal + payload.coinDelta,
        streakDays:
          payload.fish.deficit > 0 && payload.cat.deficit > 0
            ? state.streakDays + 1
            : 0,
        fishHeatmapOverrides: {
          ...state.fishHeatmapOverrides,
          [payload.day]: payload.fishHeat,
        },
        catHeatmapOverrides: {
          ...state.catHeatmapOverrides,
          [payload.day]: payload.catHeat,
        },
        dailyRecords: [record, ...state.dailyRecords],
      }));
    },
    [commitHomeState],
  );

  const applyHistoricalRecord = useCallback(
    (payload: HistoricalRecordPayload): HistoricalRecordResult => {
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
        const yesterdayRecord = previousDate
          ? findRecordByIso(recordsWithoutExisting, previousDate)
          : null;

        const baseFish = existing
          ? sideInputFromRecordSide(existing.fish)
          : sideInputFromRecordSide(zeroSide());
        const baseCat = existing
          ? sideInputFromRecordSide(existing.cat)
          : sideInputFromRecordSide(zeroSide());
        const fishInput =
          payload.person === "fish" ? payload.input : baseFish;
        const catInput = payload.person === "cat" ? payload.input : baseCat;
        const fishGems = gemsForPerson("fish", fishInput, yesterdayRecord);
        const catGems = gemsForPerson("cat", catInput, yesterdayRecord);
        const couple = computeCoupleBonus(fishInput, catInput);
        const newGemTotal = fishGems + catGems + couple.gems;
        const oldGemTotal = existing ? recordGems(existing) : 0;
        const weekGemTotalWithoutExisting = Math.max(
          0,
          state.weekGemTotal - oldGemTotal,
        );
        const coin = computeCoinPreview({
          fish: fishInput,
          cat: catInput,
          todayDay: parsed.day,
          todayGemTotal: newGemTotal,
          currentWeekGemTotal: weekGemTotalWithoutExisting,
          dailyRecords: recordsWithoutExisting,
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
          fishHeat: buildHeatmapDay(fishInput),
          catHeat: buildHeatmapDay(catInput),
        };

        const nextRecords = orderDailyRecords([
          nextRecord,
          ...recordsWithoutExisting,
        ]);
        const todayRecord = findRecordByIso(
          nextRecords,
          isoDateFromMayDay(getMaySettlementDay()),
        );
        const gemDelta = newGemTotal - oldGemTotal;
        const coinDelta = coin.delta - (existing?.coins ?? 0);
        result = {
          ok: true,
          updatedExisting: existing != null,
        };

        return {
          ...state,
          wallet: {
            gems: Math.min(
              GEM_CAP,
              Math.max(0, state.wallet.gems + gemDelta),
            ),
            coins: Math.max(0, state.wallet.coins + coinDelta),
          },
          todayFishGems: todayRecord?.fish.gems ?? state.todayFishGems,
          todayCatGems: todayRecord?.cat.gems ?? state.todayCatGems,
          todayBonusGems: todayRecord?.bonus ?? state.todayBonusGems,
          weekGemTotal: sumRecordGems(nextRecords),
          weekCoinTotal: sumRecordCoins(nextRecords),
          streakDays: deficitStreakEndingAt(nextRecords, getMaySettlementDay()),
          fishHeatmapOverrides: buildHeatmapOverrides(nextRecords, "fish"),
          catHeatmapOverrides: buildHeatmapOverrides(nextRecords, "cat"),
          dailyRecords: nextRecords,
        };
      });

      return result;
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
      todayFishGems: homeState.todayFishGems,
      todayCatGems: homeState.todayCatGems,
      todayBonusGems: homeState.todayBonusGems,
      weekGemTotal: homeState.weekGemTotal,
      weekCoinTotal: homeState.weekCoinTotal,
      fishHeatmapOverrides: homeState.fishHeatmapOverrides,
      catHeatmapOverrides: homeState.catHeatmapOverrides,
      dailyRecords: homeState.dailyRecords,
      exchangeRecords: homeState.exchangeRecords,
      exchangeCategories: homeState.exchangeCategories,
      applyTodayRecord,
      applyHistoricalRecord,
      upsertExchangeCategory,
      deleteExchangeCategory,
    }),
    [
      homeState,
      tryRedeem,
      redeemExchange,
      applyTodayRecord,
      applyHistoricalRecord,
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
