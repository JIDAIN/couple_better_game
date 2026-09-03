const DEFAULT_SUPABASE_URL = "https://bfhntnzngozdqsmgfvjk.supabase.co";
const DEFAULT_SPACE_SLUG = "couple-better-game";

type RpcErrorBody = { message?: string };

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
