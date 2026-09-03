export type DriveBridgeId = "cat" | "fish";

export type DriveBridgeRuntimeConfig = {
  bridgeId: DriveBridgeId;
  actor: DriveBridgeId;
  bridgeSecret: string;
  watchToken: string;
  appsScriptUrl: string;
  appsScriptWakeSecret: string;
  originalsMealsFolderId: string;
  backupLeader: boolean;
};

const DEFAULT_SUPABASE_URL = "https://bfhntnzngozdqsmgfvjk.supabase.co";
const CACHE_TTL_MS = 30_000;
const cache = new Map<DriveBridgeId, { expiresAt: number; value: DriveBridgeRuntimeConfig | null }>();

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function supabaseUrl() {
  return env("SUPABASE_URL") || DEFAULT_SUPABASE_URL;
}

function supabaseSecretKey() {
  return env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
}

function envName(bridgeId: DriveBridgeId, suffix: string) {
  return `LIFE_DRIVE_${bridgeId.toUpperCase()}_${suffix}`;
}

function envOverride(bridgeId: DriveBridgeId): DriveBridgeRuntimeConfig | null {
  const bridgeSecret = env(envName(bridgeId, "BRIDGE_SECRET"));
  if (!bridgeSecret) return null;
  return {
    bridgeId,
    actor: bridgeId,
    bridgeSecret,
    watchToken: env(envName(bridgeId, "WATCH_TOKEN")),
    appsScriptUrl: env(envName(bridgeId, "APPS_SCRIPT_URL")),
    appsScriptWakeSecret: env(envName(bridgeId, "APPS_SCRIPT_WAKE_SECRET")),
    originalsMealsFolderId: env(envName(bridgeId, "ORIGINALS_MEALS_FOLDER_ID")),
    backupLeader: env(envName(bridgeId, "BACKUP_LEADER")).toLowerCase() === "true",
  };
}

function serviceHeaders() {
  const secret = supabaseSecretKey();
  if (!secret) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  return {
    apikey: secret,
    Authorization: `Bearer ${secret}`,
  };
}

type ConfigRow = {
  bridge_id: string;
  actor: string;
  bridge_secret: string;
  watch_token: string;
  apps_script_url: string | null;
  apps_script_wake_secret: string;
  originals_meals_folder_id: string;
  backup_leader: boolean;
  active: boolean;
};

function rowToConfig(row: ConfigRow): DriveBridgeRuntimeConfig | null {
  if ((row.bridge_id !== "cat" && row.bridge_id !== "fish") || row.actor !== row.bridge_id || !row.active) return null;
  if (!row.bridge_secret || !row.watch_token || !row.apps_script_wake_secret || !row.originals_meals_folder_id) return null;
  return {
    bridgeId: row.bridge_id,
    actor: row.bridge_id,
    bridgeSecret: row.bridge_secret,
    watchToken: row.watch_token,
    appsScriptUrl: row.apps_script_url?.trim() ?? "",
    appsScriptWakeSecret: row.apps_script_wake_secret,
    originalsMealsFolderId: row.originals_meals_folder_id,
    backupLeader: row.backup_leader === true,
  };
}

export function clearDriveBridgeConfigCache() {
  cache.clear();
}

export async function getDriveBridgeConfig(bridgeId: DriveBridgeId): Promise<DriveBridgeRuntimeConfig | null> {
  const override = envOverride(bridgeId);
  if (override) return override;

  const cached = cache.get(bridgeId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const response = await fetch(
    `${supabaseUrl()}/rest/v1/life_drive_bridge_configs?bridge_id=eq.${bridgeId}&active=eq.true&select=bridge_id,actor,bridge_secret,watch_token,apps_script_url,apps_script_wake_secret,originals_meals_folder_id,backup_leader,active&limit=1`,
    { headers: serviceHeaders(), cache: "no-store" },
  );
  if (!response.ok) throw new Error("DRIVE_BRIDGE_CONFIG_READ_FAILED");
  const rows = (await response.json()) as ConfigRow[];
  const value = rows[0] ? rowToConfig(rows[0]) : null;
  cache.set(bridgeId, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}
