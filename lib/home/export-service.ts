import { getCoinWeekRange } from "./settlement-rules";
import { recordGems, recordIsoDate } from "./daily-record-utils";
import type { DailyRecord, HomeResourcesState } from "./types";

export const BACKUP_SCHEMA_VERSION = 1;

export type HomeBackupJson = {
  schemaVersion: 1;
  exportedAt: string;
  wallet: HomeResourcesState["wallet"];
  dailyRecords: HomeResourcesState["dailyRecords"];
  exchangeRecords: HomeResourcesState["exchangeRecords"];
  exchangeCategories: HomeResourcesState["exchangeCategories"];
  heatmapStartDate: HomeResourcesState["heatmapStartDate"];
  coinRules: HomeResourcesState["coinRules"];
  visualRules: HomeResourcesState["visualRules"];
};

export function buildHomeBackup(
  state: HomeResourcesState,
  exportedAt = new Date().toISOString(),
): HomeBackupJson {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    wallet: state.wallet,
    dailyRecords: state.dailyRecords,
    exchangeRecords: state.exchangeRecords,
    exchangeCategories: state.exchangeCategories,
    heatmapStartDate: state.heatmapStartDate,
    coinRules: state.coinRules,
    visualRules: state.visualRules,
  };
}

export function serializeHomeBackup(
  state: HomeResourcesState,
  exportedAt?: string,
) {
  return JSON.stringify(buildHomeBackup(state, exportedAt), null, 2);
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function dateToTime(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function weekStartIso(value: string, weekStartDay: number) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const diff = (date.getDay() - weekStartDay + 7) % 7;
  date.setDate(date.getDate() - diff);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weeklyReviewWeekLabel(
  record: DailyRecord,
  heatmapStartDate: string,
) {
  const recordDate = recordIsoDate(record);
  const startDate = heatmapStartDate || recordDate;
  const baseStart = weekStartIso(startDate, 6);
  const recordStart = getCoinWeekRange(recordDate, 6).start;
  const baseTime = dateToTime(baseStart);
  const recordTime = dateToTime(recordStart);
  if (baseTime == null || recordTime == null) return "第1周";
  const week = Math.max(
    1,
    Math.floor((recordTime - baseTime) / (7 * 24 * 60 * 60 * 1000)) + 1,
  );
  return `第${week}周`;
}

export function exportWeeklyReviewCsv(state: HomeResourcesState) {
  const headers = [
    "周次",
    "日期",
    "鱼鱼缺口kcal",
    "鱼鱼运动min",
    "鱼鱼宝石",
    "猫猫缺口kcal",
    "猫猫运动min",
    "猫猫宝石",
    "情侣bonus",
    "当日总宝石",
    "金币变化",
  ];
  const rows = [...state.dailyRecords]
    .sort((a, b) => recordIsoDate(a).localeCompare(recordIsoDate(b)))
    .map((record) => [
      weeklyReviewWeekLabel(record, state.heatmapStartDate),
      recordIsoDate(record),
      record.fish.deficit,
      record.fish.minutes,
      record.fish.gems,
      record.cat.deficit,
      record.cat.minutes,
      record.cat.gems,
      record.bonus,
      recordGems(record),
      record.coins,
    ]);

  return `\uFEFF${[headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n")}`;
}
