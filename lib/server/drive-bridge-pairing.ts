import { createHash } from "node:crypto";
import { clearDriveBridgeConfigCache, type DriveBridgeId } from "./drive-bridge-config";

const DEFAULT_SUPABASE_URL = "https://bfhntnzngozdqsmgfvjk.supabase.co";

export type DriveBridgePairingPayload = {
  bridgeId: DriveBridgeId;
  pairingCode: string;
  sheetId: string;
  webAppUrl: string;
};

export type DriveBridgePairingResult = {
  bridgeId: DriveBridgeId;
  actor: DriveBridgeId;
  sheetId: string;
  bridgeSecret: string;
  watchToken: string;
  wakeSecret: string;
  originalsMealsFolderId: string;
  backupLeader: boolean;
  webAppUrl: string;
  pairedAt: string;
};

type JsonRecord = Record<string, unknown>;
type RpcErrorBody = { message?: string };

export class DriveBridgePairingError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function supabaseUrl() {
  return env("SUPABASE_URL") || DEFAULT_SUPABASE_URL;
}

function supabaseSecretKey() {
  return env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isGoogleSheetId(value: string) {
  return /^[A-Za-z0-9_-]{20,160}$/.test(value);
}

function isAppsScriptWebAppUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "script.google.com") return false;
    return /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname);
  } catch {
    return false;
  }
}

export function parseDriveBridgePairingPayload(value: unknown): DriveBridgePairingPayload {
  const row = asRecord(value);
  const bridgeId = stringValue(row.bridgeId);
  const pairingCode = stringValue(row.pairingCode);
  const sheetId = stringValue(row.sheetId);
  const webAppUrl = stringValue(row.webAppUrl);

  if (bridgeId !== "cat" && bridgeId !== "fish") throw new DriveBridgePairingError("PAIRING_INVALID");
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(pairingCode)) throw new DriveBridgePairingError("PAIRING_INVALID");
  if (!isGoogleSheetId(sheetId)) throw new DriveBridgePairingError("PAIRING_INVALID");
  if (!isAppsScriptWebAppUrl(webAppUrl)) throw new DriveBridgePairingError("PAIRING_INVALID_WEB_APP_URL");

  return { bridgeId, pairingCode, sheetId, webAppUrl };
}

function pairingHash(code: string) {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export async function pairDriveBridgeWorker(payload: DriveBridgePairingPayload) {
  const secret = supabaseSecretKey();
  if (!secret) throw new DriveBridgePairingError("SUPABASE_SERVER_CONFIG_MISSING");

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl()}/rest/v1/rpc/pair_life_drive_bridge_worker`, {
      method: "POST",
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_bridge_id: payload.bridgeId,
        p_sheet_id: payload.sheetId,
        p_pairing_code_hash: pairingHash(payload.pairingCode),
        p_web_app_url: payload.webAppUrl,
      }),
      cache: "no-store",
    });
  } catch {
    throw new DriveBridgePairingError("PAIRING_SERVICE_UNAVAILABLE");
  }

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as RpcErrorBody | null;
    const message = error?.message || "PAIRING_INVALID_OR_EXPIRED";
    if (message.includes("PAIRING_INVALID_OR_EXPIRED")) {
      throw new DriveBridgePairingError("PAIRING_INVALID_OR_EXPIRED");
    }
    throw new DriveBridgePairingError("PAIRING_FAILED");
  }

  const result = (await response.json()) as DriveBridgePairingResult;
  if (
    result.bridgeId !== payload.bridgeId ||
    result.actor !== payload.bridgeId ||
    result.sheetId !== payload.sheetId ||
    !result.bridgeSecret ||
    !result.watchToken ||
    !result.wakeSecret ||
    !result.originalsMealsFolderId
  ) {
    throw new DriveBridgePairingError("PAIRING_RESULT_INVALID");
  }

  clearDriveBridgeConfigCache();
  return result;
}
