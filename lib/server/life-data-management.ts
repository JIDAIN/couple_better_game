import { assertIsolatedLifeImportPayload } from "./life-data-domains";

const DEFAULT_SUPABASE_URL = "https://bfhntnzngozdqsmgfvjk.supabase.co";
const DEFAULT_SPACE_SLUG = "couple-better-game";

type RpcErrorBody = { message?: string };

export type LifeBackupScope = "user" | "config" | "full";
export type LifeBackupReason = "manual" | "scheduled" | "pre_restore" | "import";
export type LifeBackupSnapshot = {
  id: string;
  scope: LifeBackupScope;
  reason: LifeBackupReason;
  schemaVersion: number;
  rowCounts: Record<string, number>;
  createdBy: "cat" | "fish" | null;
  createdAt: string;
};

export class LifeDataManagementError extends Error {
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

function coupleSpaceSlug() {
  return env("COUPLE_SPACE_SLUG") || DEFAULT_SPACE_SLUG;
}

async function callRpc<T>(functionName: string, body: Record<string, unknown>) {
  const secret = supabaseSecretKey();
  if (!secret) throw new LifeDataManagementError("Supabase 服务端环境变量未配置完整");

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl()}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new LifeDataManagementError("连接 Supabase 失败");
  }

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as RpcErrorBody | null;
    throw new LifeDataManagementError(error?.message ?? "读取或写入生活数据失败");
  }
  return (await response.json()) as T;
}

export function getLifeSettings() {
  return callRpc<Record<string, unknown>>("get_life_settings", {
    p_space_slug: coupleSpaceSlug(),
  });
}

export function updateLifeSettings(payload: Record<string, unknown>, actor: "cat" | "fish") {
  return callRpc<Record<string, unknown>>("update_life_settings", {
    p_payload: payload,
    p_actor: actor,
    p_space_slug: coupleSpaceSlug(),
  });
}

export function getLifeExport() {
  return callRpc<Record<string, unknown>>("get_life_export", {
    p_space_slug: coupleSpaceSlug(),
  });
}

export function getLifeFullExport() {
  return callRpc<Record<string, unknown>>("get_life_full_export", {
    p_space_slug: coupleSpaceSlug(),
  });
}

export function listLifeBackupSnapshots() {
  return callRpc<LifeBackupSnapshot[]>("list_life_backup_snapshots", {
    p_space_slug: coupleSpaceSlug(),
  });
}

export function createLifeBackupSnapshot(actor: "cat" | "fish", scope: LifeBackupScope = "full") {
  return callRpc<LifeBackupSnapshot>("create_life_backup_snapshot", {
    p_scope: scope,
    p_reason: "manual",
    p_created_by: actor,
    p_space_slug: coupleSpaceSlug(),
  });
}

export function restoreLifeBackupSnapshot(snapshotId: string, actor: "cat" | "fish") {
  return callRpc<Record<string, unknown>>("restore_life_backup_snapshot", {
    p_snapshot_id: snapshotId,
    p_created_by: actor,
    p_space_slug: coupleSpaceSlug(),
  });
}

export function importLifeFullData(payload: Record<string, unknown>, actor: "cat" | "fish") {
  // The current Island Life product and the archived slimming/beauty game share
  // one application, but they are separate data domains. A Life import must not
  // smuggle Legacy Game rows into a generic restore path.
  assertIsolatedLifeImportPayload(payload);

  return callRpc<Record<string, unknown>>("import_life_full_data", {
    p_payload: payload,
    p_created_by: actor,
    p_space_slug: coupleSpaceSlug(),
  });
}
