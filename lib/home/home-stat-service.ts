import {
  formatRecordDateFromIso,
  isoDateFromMayDay,
  previousIsoDate,
  todayIsoDate,
} from "./date-utils";
import {
  buildHeatmapOverrides,
  findRecordByIso,
  orderDailyRecords,
  recordGems,
  recordIsoDate,
  sideInputFromRecordSide,
} from "./daily-record-utils";
import {
  buildHeatmapDay,
  computeCoinPreview,
  computeCoupleBonus,
  DEFAULT_COIN_RULES,
  DEFAULT_VISUAL_RULES,
  GEM_CAP,
  gemsForPerson,
  isInCoinWeek,
  type CoinRulesConfig,
  type SettlementVisualRules,
  type SideLogInput,
} from "./settlement-rules";
import {
  MAY_HISTORY_IMPORT_PREFIX,
  MAY_HISTORY_ROWS,
} from "./home-seed-data";
import type {
  DailyRecord,
  ExchangeRecord,
  HomeResourcesState,
} from "./types";

export function isSuccessfulCheckIn(
  record: DailyRecord,
  visualRules: SettlementVisualRules = DEFAULT_VISUAL_RULES,
) {
  return (
    record.fish.deficit >= visualRules.heatmap.fish.okMin &&
    record.cat.deficit >= visualRules.heatmap.cat.okMin
  );
}

export function countSuccessfulCheckInsInWeek(
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

export function countSuccessfulCheckInsTotal(
  records: DailyRecord[],
  visualRules: SettlementVisualRules = DEFAULT_VISUAL_RULES,
) {
  return records.reduce(
    (total, record) =>
      isSuccessfulCheckIn(record, visualRules) ? total + 1 : total,
    0,
  );
}

export function sumRecordCoins(records: DailyRecord[]) {
  return records.reduce((total, record) => total + record.coins, 0);
}

export function sumRecordGemsInCoinWeek(
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

export function sumRecordCoinsInCoinWeek(
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

export function sumCoinExchangeSpend(records: ExchangeRecord[]) {
  return records.reduce(
    (total, record) =>
      record.resourceKind === "coin" ? total + record.price : total,
    0,
  );
}

function exchangeRecordIsoDate(record: ExchangeRecord) {
  const source = record.occurredAt || record.date;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(source);
  return match?.[1] ?? "";
}

export function computeGemWallet(
  records: DailyRecord[],
  exchangeRecords: ExchangeRecord[],
) {
  const gainsByDate = new Map<string, number>();
  for (const record of records) {
    const date = recordIsoDate(record);
    gainsByDate.set(date, (gainsByDate.get(date) ?? 0) + recordGems(record));
  }

  const spendsByDate = new Map<string, number>();
  for (const record of exchangeRecords) {
    if (record.resourceKind !== "gem") continue;
    const date = exchangeRecordIsoDate(record);
    if (!date) continue;
    spendsByDate.set(date, (spendsByDate.get(date) ?? 0) + record.price);
  }

  const dates = [...new Set([...gainsByDate.keys(), ...spendsByDate.keys()])].sort();
  return dates.reduce((balance, date) => {
    const afterGain = Math.min(GEM_CAP, balance + (gainsByDate.get(date) ?? 0));
    return Math.max(0, afterGain - (spendsByDate.get(date) ?? 0));
  }, 0);
}

export function todayRecordFrom(records: DailyRecord[]) {
  return findRecordByIso(records, todayIsoDate());
}

export function yesterdayRecordFrom(records: DailyRecord[]) {
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
