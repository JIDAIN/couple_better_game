import { timingSafeEqual } from "node:crypto";

const DEFAULT_SUPABASE_URL = "https://bfhntnzngozdqsmgfvjk.supabase.co";
const DEFAULT_SPACE_SLUG = "couple-better-game";

type RpcErrorBody = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

export class CloudSyncError extends Error {
  constructor(
    message: string,
    public readonly errorCode:
      | "SERVER_CONFIG"
      | "CLOUD_READ_FAILED"
      | "CLOUD_WRITE_FAILED"
      | "CLOUD_NETWORK_ERROR",
  ) {
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

export function hasCloudSyncConfig() {
  return Boolean(supabaseUrl() && supabaseSecretKey() && env("DATA_EDIT_PASSWORD"));
}

export function isValidSyncPassword(value: unknown) {
  const expected = env("DATA_EDIT_PASSWORD");
  if (!expected || typeof value !== "string") return false;
  const actual = value.trim();
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

async function callRpc<T>(
  functionName: string,
  body: Record<string, unknown>,
  operation: "read" | "write",
): Promise<T> {
  const url = supabaseUrl();
  const secretKey = supabaseSecretKey();
  if (!url || !secretKey) {
    throw new CloudSyncError(
      "Supabase 服务端环境变量未配置完整",
      "SERVER_CONFIG",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new CloudSyncError("连接 Supabase 失败", "CLOUD_NETWORK_ERROR");
  }

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as RpcErrorBody | null;
    const message =
      result?.message ??
      (operation === "read" ? "读取 Supabase 数据失败" : "写入 Supabase 数据失败");
    throw new CloudSyncError(
      message,
      operation === "read" ? "CLOUD_READ_FAILED" : "CLOUD_WRITE_FAILED",
    );
  }

  return (await response.json()) as T;
}

export async function loadHomeSyncSnapshot() {
  return callRpc<Record<string, unknown>>(
    "export_home_sync_snapshot",
    { p_space_slug: coupleSpaceSlug() },
    "read",
  );
}

export async function saveHomeSyncSnapshot(data: unknown) {
  return callRpc<{
    ok?: boolean;
    updatedAt?: string;
    wallet?: { gems?: number; coins?: number };
  }>(
    "replace_home_sync_snapshot",
    { p_data: data, p_space_slug: coupleSpaceSlug() },
    "write",
  );
}
