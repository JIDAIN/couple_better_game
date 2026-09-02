import { NextResponse } from "next/server";
import type { LifePartnerKey } from "@/lib/life/life-service";
import { isAuthorizedCloudRequest } from "./cloud-request-auth";
import { resolveLifeAuth } from "./supabase-auth-http";
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
    return lifeJsonError(
      "Supabase 服务端环境变量未配置完整",
      500,
      "SERVER_CONFIG",
    );
  }

  const accountAuth = await resolveLifeAuth(request);
  if (accountAuth) {
    if (!accountAuth.identity.coupleSpaceId || !accountAuth.identity.partnerKey) {
      return lifeJsonError("账号尚未绑定双人空间", 403, "PAIRING_REQUIRED");
    }
    return null;
  }

  // Migration compatibility only. New accounts should use Supabase Auth; the old
  // shared cloud session remains temporarily so existing data is not locked out
  // before the two real accounts have been created and paired.
  if (!(await isAuthorizedCloudRequest(request))) {
    return lifeJsonError("请登录，或使用迁移期旧云端会话", 401, "UNAUTHORIZED");
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

  const accountAuth = await resolveLifeAuth(request);
  if (accountAuth) {
    if (!accountAuth.identity.coupleSpaceId || !accountAuth.identity.partnerKey) {
      return lifeJsonError("账号尚未绑定双人空间", 403, "PAIRING_REQUIRED");
    }
    if (accountAuth.identity.partnerKey !== requestedPartnerKey) {
      return lifeJsonError("只能修改自己的个人记录", 403, "OWN_RECORD_ONLY");
    }
    return null;
  }

  // Legacy fallback is intentionally temporary and will be removed after account
  // migration. It preserves the current production workflow during R1B.
  if (!(await isAuthorizedCloudRequest(request))) {
    return lifeJsonError("请登录，或使用迁移期旧云端会话", 401, "UNAUTHORIZED");
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
