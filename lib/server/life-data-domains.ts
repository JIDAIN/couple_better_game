export const ISLAND_LIFE_TABLES = [
  "meals",
  "meal_items",
  "mood_entries",
  "sleep_records",
  "activity_entries",
  "weight_measurements",
  "medicine_items",
  "mailbox_letters",
] as const;

export const LEGACY_GAME_TABLES = [
  "daily_records",
  "daily_record_sides",
  "exchange_categories",
  "exchange_records",
  "wallets",
  "wallet_ledger",
] as const;

export const SHARED_SYSTEM_TABLES = [
  "couple_spaces",
  "partner_profiles",
  "app_configs",
  "record_write_receipts",
  "life_fixed_accounts",
  "life_backup_snapshots",
  "life_mcp_code_redemptions",
  "life_notification_preferences",
  "life_notification_deliveries",
] as const;

export type CoupleDataDomain = "island_life" | "legacy_game" | "shared_system" | "unknown";

const islandLifeTableSet = new Set<string>(ISLAND_LIFE_TABLES);
const legacyGameTableSet = new Set<string>(LEGACY_GAME_TABLES);
const sharedSystemTableSet = new Set<string>(SHARED_SYSTEM_TABLES);

export function classifyCoupleDataTable(tableName: string): CoupleDataDomain {
  if (islandLifeTableSet.has(tableName)) return "island_life";
  if (legacyGameTableSet.has(tableName)) return "legacy_game";
  if (sharedSystemTableSet.has(tableName)) return "shared_system";
  return "unknown";
}

/**
 * Safety guard for maintenance paths that claim to operate on the current
 * Island Life product. Legacy Game is a child project under the app's Game
 * section and must never be swept into generic Life cleanup by table age.
 */
export function assertIslandLifeMaintenanceTables(tableNames: readonly string[]) {
  const legacyTables = tableNames.filter((tableName) => legacyGameTableSet.has(tableName));
  if (legacyTables.length > 0) {
    throw new Error(
      `Island Life maintenance cannot touch Legacy Game tables: ${legacyTables.join(", ")}`,
    );
  }
}

const legacyPayloadKeys = new Set<string>([
  ...LEGACY_GAME_TABLES,
  "wallet",
  "dailyRecords",
  "exchangeRecords",
  "exchangeCategories",
  "legacy_home",
]);

/**
 * Life import/export is intentionally narrower than the whole application.
 * Reject legacy-game-shaped keys instead of silently accepting a mixed payload.
 */
export function assertIsolatedLifeImportPayload(payload: Record<string, unknown>) {
  const candidateKeys = new Set<string>(Object.keys(payload));
  const user = payload.user;
  if (user && typeof user === "object" && !Array.isArray(user)) {
    Object.keys(user as Record<string, unknown>).forEach((key) => candidateKeys.add(key));
  }

  const legacyKeys = [...candidateKeys].filter((key) => legacyPayloadKeys.has(key));
  if (legacyKeys.length > 0) {
    throw new Error(
      `Life import cannot contain Legacy Game data: ${legacyKeys.join(", ")}. ` +
        "Use the explicit game flow for legacy game data.",
    );
  }
}
