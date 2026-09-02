import { NextResponse } from "next/server";
import type { LifePartnerKey } from "@/lib/life/life-service";
import { resolveFixedLifeIdentity } from "./fixed-life-auth";
import { LifeCloudError } from "./supabase-life";
import { hasCloudSyncConfig } from "./supabase-home-sync";

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

export async function authorizeLifeRequest(request: Request) {
  if (!hasCloudSyncConfig()) {
    return lifeJsonError("Supabase 服务端环境变量未配置完整", 500, "SERVER_CONFIG");
  }
  if (!resolveFixedLifeIdentity(request)) {
    return lifeJsonError("请先选择自己的账号并登录", 401, "UNAUTHORIZED");
  }
  return null;
}

export async function authorizePersonalPartnerWrite(
  request: Request,
  requestedPartnerKey: LifePartnerKey,
) {
  if (!hasCloudSyncConfig()) {
    return lifeJsonError("Supabase 服务端环境变量未配置完整", 500, "SERVER_CONFIG");
  }
  const identity = resolveFixedLifeIdentity(request);
  if (!identity) return lifeJsonError("请先登录", 401, "UNAUTHORIZED");
  if (identity.partnerKey !== requestedPartnerKey) {
    return lifeJsonError("只能修改自己的个人记录", 403, "OWN_RECORD_ONLY");
  }
  return null;
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
