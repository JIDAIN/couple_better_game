import { formatRecordDateFromIso, parseIsoDate, previousIsoDate, todayIsoDate } from "./date-utils";
import {
  buildHeatmapOverrides,
  findRecordByIso,
  hasMeaningfulDailyInput,
  normalizeHistoricalSideInput,
  orderDailyRecords,
  recordGems,
  recordIsoDate,
  sideInputFromRecordSide,
} from "./daily-record-utils";
import {
  buildHeatmapDay,
  computeCoinPreview,
  computeCoupleBonus,
  gemsForPerson,
} from "./settlement-rules";
import {
  computeCoinWallet,
  countSuccessfulCheckInsInWeek,
  countSuccessfulCheckInsTotal,
  recalculateCoinsWithCurrentRules,
  sumRecordCoinsInCoinWeek,
  sumRecordGemsInCoinWeek,
  todayRecordFrom,
  yesterdayRecordFrom,
} from "./home-stat-service";
import type {
  DailyRecord,
  HistoricalRecordDraft,
  HistoricalRecordResult,
  HomeResourcesState,
  TodayRecordPayload,
  TodayRecordSidePayload,
} from "./types";

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function zeroSide(): TodayRecordSidePayload {
  return {
    weightKg: null,
    deficit: 0,
    minutes: 0,
  };
}

function rebuildDailyRecordDerivedState(
  state: HomeResourcesState,
  dailyRecords: DailyRecord[],
): HomeResourcesState {
  const recalculated = recalculateCoinsWithCurrentRules({
    ...state,
    dailyRecords: orderDailyRecords(dailyRecords),
  });

  return {
    ...recalculated,
    fishHeatmapOverrides: buildHeatmapOverrides(
      recalculated.dailyRecords,
      "fish",
    ),
    catHeatmapOverrides: buildHeatmapOverrides(recalculated.dailyRecords, "cat"),
  };
}

function dedupeRecordsByRecordDate(records: DailyRecord[]) {
  const byDate = new Map<string, DailyRecord>();
  for (const record of orderDailyRecords(records).reverse()) {
    byDate.set(recordIsoDate(record), record);
  }
  return orderDailyRecords([...byDate.values()]);
}

function buildDailyRecordForDate(
  state: HomeResourcesState,
  recordDate: string,
  fishInput: TodayRecordSidePayload,
  catInput: TodayRecordSidePayload,
  existing?: DailyRecord | null,
): DailyRecord | null {
  const parsed = parseIsoDate(recordDate);
  if (!parsed) return null;

  const recordsWithoutExisting = existing
    ? state.dailyRecords.filter((record) => record.id !== existing.id)
    : state.dailyRecords;
  const previousDate = previousIsoDate(recordDate);
  const previousRecord = previousDate
    ? findRecordByIso(recordsWithoutExisting, previousDate)
    : null;
  const fishGems = gemsForPerson("fish", fishInput, previousRecord);
  const catGems = gemsForPerson("cat", catInput, previousRecord);
  const couple = computeCoupleBonus(fishInput, catInput);
  const newGemTotal = fishGems + catGems + couple.gems;
  const weekGemTotalWithoutExisting = sumRecordGemsInCoinWeek(
    recordsWithoutExisting,
    recordDate,
    state.coinRules,
  );
  const coin = computeCoinPreview({
    fish: fishInput,
    cat: catInput,
    todayDay: parsed.day,
    todayDate: recordDate,
    todayGemTotal: newGemTotal,
    currentWeekGemTotal: weekGemTotalWithoutExisting,
    dailyRecords: recordsWithoutExisting,
    coinRules: state.coinRules,
    visualRules: state.visualRules,
  });

  return {
    id: existing?.id ?? makeId("daily"),
    date: formatRecordDateFromIso(recordDate),
    recordDate,
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
}

export function createTodayDailyRecord(
  payload: TodayRecordPayload,
  now = new Date(),
): DailyRecord {
  const recordDate = todayIsoDate();
  return {
    id: makeId("daily"),
    date: formatRecordDateFromIso(recordDate),
    recordDate,
    createdAt: now.toISOString(),
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
}

export function applyTodayRecordToState(
  state: HomeResourcesState,
  payload: TodayRecordPayload,
  now = new Date(),
): HomeResourcesState {
  const record = createTodayDailyRecord(payload, now);
  const existing = findRecordByIso(state.dailyRecords, record.recordDate);
  const recordsWithoutExisting = existing
    ? state.dailyRecords.filter((item) => item.id !== existing.id)
    : state.dailyRecords;
  const nextRecords = orderDailyRecords([
    {
      ...record,
      id: existing?.id ?? record.id,
      createdAt: existing?.createdAt ?? record.createdAt,
    },
    ...recordsWithoutExisting,
  ]);
  const todayRecord = todayRecordFrom(nextRecords);
  const yesterdayRecord = yesterdayRecordFrom(nextRecords);
  const gemDelta = payload.coinDelta - (existing?.coins ?? 0);

  return {
    ...state,
    wallet: {
      gems: Math.max(0, state.wallet.gems + gemDelta),
      coins: computeCoinWallet(nextRecords, state.exchangeRecords),
    },
    todayFishGems: todayRecord?.fish.gems ?? payload.fishGems,
    todayCatGems: todayRecord?.cat.gems ?? payload.catGems,
    todayBonusGems: todayRecord?.bonus ?? payload.bonusGems,
    weekGemTotal: sumRecordCoinsInCoinWeek(
      nextRecords,
      record.recordDate,
      state.coinRules,
    ),
    weekCoinTotal: sumRecordGemsInCoinWeek(
      nextRecords,
      record.recordDate,
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

export function upsertDailyRecordInState(
  state: HomeResourcesState,
  recordDate: string,
  fishInput: TodayRecordSidePayload,
  catInput: TodayRecordSidePayload,
): {
  result: HistoricalRecordResult;
  state: HomeResourcesState;
} {
  const parsed = parseIsoDate(recordDate);
  if (!parsed) {
    return {
      result: { ok: false, updatedExisting: false, reason: "invalid-date" },
      state,
    };
  }
  if (recordDate > todayIsoDate()) {
    return {
      result: { ok: false, updatedExisting: false, reason: "future-date" },
      state,
    };
  }

  const deduped = dedupeRecordsByRecordDate(state.dailyRecords);
  const existing = findRecordByIso(deduped, recordDate);

  const normalizedFish = normalizeHistoricalSideInput(fishInput) ?? zeroSide();
  const normalizedCat = normalizeHistoricalSideInput(catInput) ?? zeroSide();

  if (!hasMeaningfulDailyInput(normalizedFish, normalizedCat)) {
    if (existing) {
      const nextRecords = deduped.filter((item) => item.id !== existing.id);
      return {
        result: { ok: true, updatedExisting: false },
        state: rebuildDailyRecordDerivedState(state, nextRecords),
      };
    }
    return {
      result: { ok: true, updatedExisting: false },
      state,
    };
  }

  const record = buildDailyRecordForDate(
    { ...state, dailyRecords: deduped },
    recordDate,
    normalizedFish,
    normalizedCat,
    existing,
  );
  if (!record) {
    return {
      result: { ok: false, updatedExisting: false, reason: "invalid-date" },
      state,
    };
  }

  const nextRecords = orderDailyRecords([
    record,
    ...deduped.filter((item) => item.id !== existing?.id),
  ]);
  return {
    result: { ok: true, updatedExisting: existing != null },
    state: rebuildDailyRecordDerivedState(state, nextRecords),
  };
}

export function updateDailyRecordInState(
  state: HomeResourcesState,
  recordDate: string,
  fishInput: TodayRecordSidePayload,
  catInput: TodayRecordSidePayload,
): {
  result: HistoricalRecordResult;
  state: HomeResourcesState;
} {
  const parsed = parseIsoDate(recordDate);
  if (!parsed) {
    return {
      result: { ok: false, updatedExisting: false, reason: "invalid-date" },
      state,
    };
  }
  const deduped = dedupeRecordsByRecordDate(state.dailyRecords);
  const existing = findRecordByIso(deduped, recordDate);
  if (!existing) {
    return {
      result: { ok: false, updatedExisting: false },
      state,
    };
  }
  if (recordDate > todayIsoDate()) {
    return {
      result: { ok: false, updatedExisting: false, reason: "future-date" },
      state,
    };
  }

  const record = buildDailyRecordForDate(
    { ...state, dailyRecords: deduped },
    recordDate,
    normalizeHistoricalSideInput(fishInput) ?? zeroSide(),
    normalizeHistoricalSideInput(catInput) ?? zeroSide(),
    existing,
  );
  if (!record) {
    return {
      result: { ok: false, updatedExisting: false, reason: "invalid-date" },
      state,
    };
  }

  return {
    result: { ok: true, updatedExisting: true },
    state: rebuildDailyRecordDerivedState(state, [
      record,
      ...deduped.filter((item) => item.id !== existing.id),
    ]),
  };
}

export function deleteDailyRecordFromState(
  state: HomeResourcesState,
  recordDate: string,
): {
  deleted: boolean;
  state: HomeResourcesState;
} {
  const existing = findRecordByIso(state.dailyRecords, recordDate);
  if (!existing) return { deleted: false, state };
  return {
    deleted: true,
    state: rebuildDailyRecordDerivedState(
      state,
      state.dailyRecords.filter((record) => record.id !== existing.id),
    ),
  };
}

export function upsertHistoricalRecordInState(
  state: HomeResourcesState,
  payload: HistoricalRecordDraft,
): {
  result: HistoricalRecordResult;
  state: HomeResourcesState;
} {
  const parsed = parseIsoDate(payload.recordDate);
  if (!parsed) {
    return {
      result: { ok: false, updatedExisting: false, reason: "invalid-date" },
      state,
    };
  }
  if (payload.recordDate > todayIsoDate()) {
    return {
      result: { ok: false, updatedExisting: false, reason: "future-date" },
      state,
    };
  }

  const deduped = dedupeRecordsByRecordDate(state.dailyRecords);
  const existing = findRecordByIso(deduped, payload.recordDate);
  const baseFish =
    existing?.fish != null
      ? sideInputFromRecordSide(existing.fish)
      : zeroSide();
  const baseCat =
    existing?.cat != null ? sideInputFromRecordSide(existing.cat) : zeroSide();
  const fishInput = normalizeHistoricalSideInput(payload.fish) ?? baseFish;
  const catInput = normalizeHistoricalSideInput(payload.cat) ?? baseCat;

  return upsertDailyRecordInState(
    { ...state, dailyRecords: deduped },
    payload.recordDate,
    fishInput,
    catInput,
  );
}

export function deleteHistoricalRecordFromState(
  state: HomeResourcesState,
  recordId: string,
): {
  deleted: boolean;
  state: HomeResourcesState;
} {
  const recordToDelete = state.dailyRecords.find(
    (record) => record.id === recordId,
  );
  if (!recordToDelete) {
    return { deleted: false, state };
  }

  const nextRecords = orderDailyRecords(
    state.dailyRecords.filter((record) => record.id !== recordId),
  );

  return {
    deleted: true,
    state: rebuildDailyRecordDerivedState(state, nextRecords),
  };
}
