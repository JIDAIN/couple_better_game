import { formatRecordDateFromIso, parseIsoDate, previousIsoDate, todayIsoDate } from "./date-utils";
import {
  buildHeatmapOverrides,
  findRecordByIso,
  normalizeHistoricalSideInput,
  orderDailyRecords,
  recordGems,
  sideInputFromRecordSide,
} from "./daily-record-utils";
import {
  buildHeatmapDay,
  computeCoinPreview,
  computeCoupleBonus,
  gemsForPerson,
} from "./settlement-rules";
import {
  computeGemWallet,
  countSuccessfulCheckInsInWeek,
  countSuccessfulCheckInsTotal,
  sumCoinExchangeSpend,
  sumRecordCoins,
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
  const nextRecords = orderDailyRecords([record, ...state.dailyRecords]);
  const yesterdayRecord = yesterdayRecordFrom(nextRecords);
  const recordDate = record.recordDate;

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
      : zeroSide();
  const baseCat =
    existing?.cat != null ? sideInputFromRecordSide(existing.cat) : zeroSide();
  const fishInput = normalizeHistoricalSideInput(payload.fish) ?? baseFish;
  const catInput = normalizeHistoricalSideInput(payload.cat) ?? baseCat;
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

  const nextRecords = orderDailyRecords([nextRecord, ...recordsWithoutExisting]);
  const todayRecord = todayRecordFrom(nextRecords);
  const currentYesterdayRecord = yesterdayRecordFrom(nextRecords);
  const coinDelta = coin.delta - (existing?.coins ?? 0);

  return {
    result: { ok: true, updatedExisting: existing != null },
    state: {
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
    },
  };
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
  const todayRecord = todayRecordFrom(nextRecords);
  const yesterdayRecord = yesterdayRecordFrom(nextRecords);
  const earnedCoins = sumRecordCoins(nextRecords);
  const spentCoins = sumCoinExchangeSpend(state.exchangeRecords);

  return {
    deleted: true,
    state: {
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
    },
  };
}
