import type { WeightRecord, WeightWritePayload } from "../life/weight-service";

const DEFAULT_SUPABASE_URL = "https://bfhntnzngozdqsmgfvjk.supabase.co";
const DEFAULT_SPACE_SLUG = "couple-better-game";

type RpcErrorBody = { message?: string };

export class WeightCloudError extends Error {
  constructor(
    message: string,
    public readonly errorCode: "SERVER_CONFIG" | "WEIGHT_READ_FAILED" | "WEIGHT_WRITE_FAILED" | "CLOUD_NETWORK_ERROR",
  ) {
    super(message);
  }
}

function env(name: string) { return process.env[name]?.trim() ?? ""; }
function supabaseUrl() { return env("SUPABASE_URL") || DEFAULT_SUPABASE_URL; }
function supabaseSecretKey() { return env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY"); }
function coupleSpaceSlug() { return env("COUPLE_SPACE_SLUG") || DEFAULT_SPACE_SLUG; }

async function callRpc<T>(name: string, body: Record<string, unknown>, operation: "read" | "write"): Promise<T> {
  const url = supabaseUrl();
  const secret = supabaseSecretKey();
  if (!url || !secret) throw new WeightCloudError("Supabase 服务端环境变量未配置完整", "SERVER_CONFIG");
  let response: Response;
  try {
    response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new WeightCloudError("连接 Supabase 失败", "CLOUD_NETWORK_ERROR");
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as RpcErrorBody | null;
    throw new WeightCloudError(
      error?.message ?? (operation === "read" ? "读取体重数据失败" : "写入体重数据失败"),
      operation === "read" ? "WEIGHT_READ_FAILED" : "WEIGHT_WRITE_FAILED",
    );
  }
  return (await response.json()) as T;
}

export function listWeights(partnerKey: "fish" | "cat", limit = 365) {
  return callRpc<WeightRecord[]>("list_weight_measurements", {
    p_space_slug: coupleSpaceSlug(), p_partner_key: partnerKey, p_limit: limit,
  }, "read");
}

export function createWeight(payload: WeightWritePayload, actor?: "cat" | "fish") {
  return callRpc<WeightRecord>(
    actor ? "create_weight_measurement_authorized" : "create_weight_measurement",
    actor
      ? { p_actor: actor, p_payload: payload, p_space_slug: coupleSpaceSlug() }
      : { p_payload: payload, p_space_slug: coupleSpaceSlug() },
    "write",
  );
}

export function updateWeight(id: string, payload: WeightWritePayload, actor?: "cat" | "fish") {
  return callRpc<WeightRecord>(
    actor ? "update_weight_measurement_authorized" : "update_weight_measurement",
    actor
      ? { p_actor: actor, p_weight_id: id, p_payload: payload, p_space_slug: coupleSpaceSlug() }
      : { p_weight_id: id, p_payload: payload, p_space_slug: coupleSpaceSlug() },
    "write",
  );
}

export function deleteWeight(id: string, actor?: "cat" | "fish") {
  return callRpc<WeightRecord>(
    actor ? "delete_weight_measurement_authorized" : "delete_weight_measurement",
    actor
      ? { p_actor: actor, p_weight_id: id, p_space_slug: coupleSpaceSlug() }
      : { p_weight_id: id, p_space_slug: coupleSpaceSlug() },
    "write",
  );
}