import { NextResponse } from "next/server";
import { LifeCloudError } from "./supabase-life";
import { hasCloudSyncConfig } from "./supabase-home-sync";
import { resolveLifeIdentity, type LifeIdentity } from "./life-auth";

export function lifeJsonError(message: string, status: number, errorCode: string) {
  return NextResponse.json({ ok: false, error: message, errorCode }, { status });
}

export function lifeCloudErrorResponse(error: LifeCloudError) {
  const status =
    error.errorCode === "SERVER_CONFIG"
      ? 500
      : error.message.toLowerCase().includes("idempotency")
        ? 409
        : 502;
  return lifeJsonError(error.message, status, error.errorCode);
}

export async function requireLifeIdentity(request: Request): Promise<{ identity: LifeIdentity; response: null } | { identity: null; response: NextResponse }> {
  if (!hasCloudSyncConfig()) {
    return { identity: null, response: lifeJsonError("Supabase 服务端环境变量未配置完整", 500, "SERVER_CONFIG") };
  }
  try {
    const identity = await resolveLifeIdentity(request);
    if (!identity) return { identity: null, response: lifeJsonError("请先登录", 401, "UNAUTHORIZED") };
    if (!identity.coupleSpaceId || !identity.partnerKey) {
      return { identity: null, response: lifeJsonError("请先完成双人空间绑定", 403, "PAIRING_REQUIRED") };
    }
    return { identity, response: null };
  } catch {
    return { identity: null, response: lifeJsonError("登录状态无效，请重新登录", 401, "UNAUTHORIZED") };
  }
}

export async function authorizeLifeRequest(request: Request) {
  const result = await requireLifeIdentity(request);
  return result.response;
}

export async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const, response: lifeJsonError("请求格式不正确", 400, "BAD_REQUEST") };
  }
}

export const LIFE_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Couple-Data-Source": "supabase",
};
