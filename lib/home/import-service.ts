import { normalizeDailyRecord, orderDailyRecords, recordIsoDate } from "./daily-record-utils";
import { normalizeExchangeRecord } from "./exchange-service";
import {
  recalculateCoinsWithCurrentRules,
} from "./home-stat-service";
import {
  DEFAULT_COIN_RULES,
  DEFAULT_VISUAL_RULES,
} from "./settlement-rules";
import type {
  CoinRulesConfig,
  ExchangeCategory,
  ExchangeRecord,
  HomeResourcesState,
  ResourceKind,
  SettlementVisualRules,
} from "./types";

type ImportResult =
  | { ok: true; state: HomeResourcesState }
  | { ok: false; reason: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function numberOr(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringOr(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function resourceKindOr(value: unknown, fallback: ResourceKind): ResourceKind {
  return value === "coin" || value === "gem" ? value : fallback;
}

function normalizeCoinRules(value: unknown): CoinRulesConfig {
  const source = isObject(value) ? value : {};
  return {
    weekStartDay: numberOr(source.weekStartDay, DEFAULT_COIN_RULES.weekStartDay),
    deficitStreakDays: numberOr(
      source.deficitStreakDays,
      DEFAULT_COIN_RULES.deficitStreakDays,
    ),
  };
}

function normalizeVisualRules(value: unknown): SettlementVisualRules {
  const source = isObject(value) ? value : {};
  const heatmap = isObject(source.heatmap) ? source.heatmap : {};
  const fish = isObject(heatmap.fish) ? heatmap.fish : {};
  const cat = isObject(heatmap.cat) ? heatmap.cat : {};
  const exerciseTag = isObject(source.exerciseTag) ? source.exerciseTag : {};
  return {
    heatmap: {
      fish: {
        noneMax: numberOr(fish.noneMax, DEFAULT_VISUAL_RULES.heatmap.fish.noneMax),
        okMin: numberOr(fish.okMin, DEFAULT_VISUAL_RULES.heatmap.fish.okMin),
        goodMin: numberOr(fish.goodMin, DEFAULT_VISUAL_RULES.heatmap.fish.goodMin),
        perfectMin: numberOr(
          fish.perfectMin,
          DEFAULT_VISUAL_RULES.heatmap.fish.perfectMin,
        ),
      },
      cat: {
        noneMax: numberOr(cat.noneMax, DEFAULT_VISUAL_RULES.heatmap.cat.noneMax),
        okMin: numberOr(cat.okMin, DEFAULT_VISUAL_RULES.heatmap.cat.okMin),
        goodMin: numberOr(cat.goodMin, DEFAULT_VISUAL_RULES.heatmap.cat.goodMin),
        perfectMin: numberOr(
          cat.perfectMin,
          DEFAULT_VISUAL_RULES.heatmap.cat.perfectMin,
        ),
      },
    },
    exerciseTag: {
      runMin: numberOr(exerciseTag.runMin, DEFAULT_VISUAL_RULES.exerciseTag.runMin),
      intenseMin: numberOr(
        exerciseTag.intenseMin,
        DEFAULT_VISUAL_RULES.exerciseTag.intenseMin,
      ),
    },
  };
}

function normalizeDailyRecords(value: unknown) {
  if (!Array.isArray(value)) return null;
  try {
    const byDate = new Map<string, HomeResourcesState["dailyRecords"][number]>();
    for (const item of value) {
      if (!isObject(item)) return null;
      const record = normalizeDailyRecord(
        item as HomeResourcesState["dailyRecords"][number],
      );
      byDate.set(recordIsoDate(record), record);
    }
    return orderDailyRecords([...byDate.values()]);
  } catch {
    return null;
  }
}

function normalizeCategory(value: unknown): ExchangeCategory | null {
  if (!isObject(value)) return null;
  const resourceKind = resourceKindOr(value.resourceKind, "gem");
  return {
    id: stringOr(value.id, `category-import-${Date.now()}`),
    title: stringOr(value.title, "未命名奖励"),
    icon: stringOr(value.icon, "🎁"),
    description: stringOr(value.description),
    resourceKind,
    price: numberOr(value.price),
  };
}

function normalizeCategories(value: unknown) {
  if (!Array.isArray(value)) return null;
  const categories: ExchangeCategory[] = [];
  for (const item of value) {
    const category = normalizeCategory(item);
    if (!category) return null;
    categories.push(category);
  }
  return categories;
}

function normalizeImportedExchangeRecord(
  value: unknown,
  categories: ExchangeCategory[],
  index: number,
): ExchangeRecord | null {
  if (!isObject(value)) return null;
  const categoryId = stringOr(value.categoryId);
  const fallback = categories.find((category) => category.id === categoryId);
  const category = stringOr(value.category, fallback?.title ?? "未知兑换");
  const icon = stringOr(value.icon, fallback?.icon ?? "🎁");
  const resourceKind = resourceKindOr(
    value.resourceKind,
    fallback?.resourceKind ?? "gem",
  );
  const price = numberOr(value.price, fallback?.price ?? 0);

  return normalizeExchangeRecord({
    id: stringOr(value.id, `exchange-import-${Date.now()}-${index}`),
    date: stringOr(value.date),
    createdAt: stringOr(value.createdAt, new Date().toISOString()),
    occurredAt: stringOr(
      value.occurredAt,
      stringOr(value.date, stringOr(value.createdAt)),
    ),
    time: stringOr(value.time),
    category,
    remark: stringOr(value.remark),
    resourceKind,
    price,
    icon,
  });
}

function normalizeExchangeRecords(
  value: unknown,
  categories: ExchangeCategory[],
) {
  if (!Array.isArray(value)) return null;
  const records: ExchangeRecord[] = [];
  for (const [index, item] of value.entries()) {
    const record = normalizeImportedExchangeRecord(item, categories, index);
    if (!record) return null;
    records.push(record);
  }
  return records;
}

export function importHomeBackupJson(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "JSON 格式不正确" };
  }

  if (!isObject(parsed) || parsed.schemaVersion !== 1) {
    return { ok: false, reason: "只支持 schemaVersion: 1 的完整备份" };
  }

  const requiredKeys = [
    "wallet",
    "dailyRecords",
    "exchangeRecords",
    "exchangeCategories",
    "heatmapStartDate",
    "coinRules",
    "visualRules",
  ];
  if (!requiredKeys.every((key) => key in parsed)) {
    return { ok: false, reason: "备份字段不完整" };
  }

  const exchangeCategories = normalizeCategories(parsed.exchangeCategories);
  const dailyRecords = normalizeDailyRecords(parsed.dailyRecords);
  if (!exchangeCategories || !dailyRecords) {
    return { ok: false, reason: "备份数据结构不正确" };
  }

  const exchangeRecords = normalizeExchangeRecords(
    parsed.exchangeRecords,
    exchangeCategories,
  );
  if (!exchangeRecords) {
    return { ok: false, reason: "兑换记录结构不正确" };
  }

  const wallet = isObject(parsed.wallet)
    ? {
        gems: numberOr(parsed.wallet.gems),
        coins: numberOr(parsed.wallet.coins),
      }
    : { gems: 0, coins: 0 };

  const base: HomeResourcesState = {
    wallet,
    streakDays: 0,
    weeklySuccessDays: 0,
    cumulativeSuccessDays: 0,
    yesterdayGemTotal: 0,
    todayFishGems: 0,
    todayCatGems: 0,
    todayBonusGems: 0,
    weekGemTotal: 0,
    weekCoinTotal: 0,
    fishHeatmapOverrides: {},
    catHeatmapOverrides: {},
    dailyRecords,
    exchangeRecords,
    exchangeCategories,
    heatmapStartDate: stringOr(parsed.heatmapStartDate),
    coinRules: normalizeCoinRules(parsed.coinRules),
    visualRules: normalizeVisualRules(parsed.visualRules),
  };

  return { ok: true, state: recalculateCoinsWithCurrentRules(base) };
}
