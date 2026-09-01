import type {
  AppConfigData,
  AppDataSnapshot,
  ExchangeCategory,
  ExchangeRecord,
  ResourceKind,
  UserRuntimeData,
  Wallet,
} from "./types";

export const CURRENT_CURRENCY_SEMANTICS_VERSION = 2;

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasCurrentCurrencySemantics(value: {
  currencySemanticsVersion?: unknown;
}) {
  return value.currencySemanticsVersion === CURRENT_CURRENCY_SEMANTICS_VERSION;
}

function swapResourceKind(value: ResourceKind): ResourceKind {
  return value === "gem" ? "coin" : "gem";
}

function migrateWallet(wallet: Wallet | undefined): Wallet | undefined {
  if (!wallet) return wallet;
  return {
    gems: wallet.coins,
    coins: wallet.gems,
  };
}

function migrateExchangeRecord(record: ExchangeRecord): ExchangeRecord {
  return {
    ...record,
    resourceKind: swapResourceKind(record.resourceKind),
  };
}

function migrateExchangeCategory(category: ExchangeCategory): ExchangeCategory {
  return {
    ...category,
    resourceKind: swapResourceKind(category.resourceKind),
  };
}

export function migrateSnapshotCurrencySemantics(
  snapshot: AppDataSnapshot,
): AppDataSnapshot {
  if (hasCurrentCurrencySemantics(snapshot)) return snapshot;

  const runtime: Partial<UserRuntimeData> = {
    ...snapshot.runtime,
    wallet: migrateWallet(snapshot.runtime.wallet),
    weekGemTotal: snapshot.runtime.weekCoinTotal,
    weekCoinTotal: snapshot.runtime.weekGemTotal,
    exchangeRecords: snapshot.runtime.exchangeRecords?.map(
      migrateExchangeRecord,
    ),
  };

  const config: Partial<AppConfigData> = {
    ...snapshot.config,
    exchangeCategories: snapshot.config.exchangeCategories?.map(
      migrateExchangeCategory,
    ),
  };

  return {
    ...snapshot,
    currencySemanticsVersion: CURRENT_CURRENCY_SEMANTICS_VERSION,
    runtime,
    config,
  };
}

function migrateRawWallet(value: unknown) {
  if (!isObject(value)) return value;
  return {
    ...value,
    gems: value.coins,
    coins: value.gems,
  };
}

function migrateRawResourceKindItem<T extends Record<string, unknown>>(item: T) {
  if (item.resourceKind !== "gem" && item.resourceKind !== "coin") return item;
  return {
    ...item,
    resourceKind: swapResourceKind(item.resourceKind),
  };
}

function migrateRawResourceKindList(value: unknown) {
  if (!Array.isArray(value)) return value;
  return value.map((item) =>
    isObject(item) ? migrateRawResourceKindItem(item) : item,
  );
}

export function migrateBackupCurrencySemantics<T extends Record<string, unknown>>(
  backup: T,
) {
  if (hasCurrentCurrencySemantics(backup)) return backup;
  return {
    ...backup,
    currencySemanticsVersion: CURRENT_CURRENCY_SEMANTICS_VERSION,
    wallet: migrateRawWallet(backup.wallet),
    exchangeRecords: migrateRawResourceKindList(backup.exchangeRecords),
    exchangeCategories: migrateRawResourceKindList(backup.exchangeCategories),
  };
}
